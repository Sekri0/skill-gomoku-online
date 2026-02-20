import {
  applyPlacement,
  applySkill,
  getPlayerByColor,
  initState
} from "../../shared/engine";
import * as fs from "node:fs";
import * as path from "node:path";
import { serializeGameState, type Color, type PlayerId } from "../../shared/types";
import type {
  ClientToServerMessage,
  ErrorCode,
  RoomSummary,
  ServerToClientMessage
} from "../../src/net/protocol";
import type { ClientMeta, RoomPlayer, RoomState } from "./types";
import { WebSocket } from "ws";

const MAX_ROOMS = 5;
const RECONNECT_TTL_MS = 60_000;

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly clients = new Set<ClientMeta>();
  private readonly accounts = new Map<string, string>();
  private readonly tokens = new Map<string, string>();
  private readonly accountsFilePath: string;
  private nextTokenId = 1;
  private nextRoomId = 1001;

  constructor(accountsFilePath: string) {
    this.accountsFilePath = accountsFilePath;
    this.loadAccounts();
  }

  attachClient(client: ClientMeta): void {
    this.clients.add(client);
  }

  detachClient(client: ClientMeta): void {
    this.clients.delete(client);
    this.handleDisconnect(client);
  }

  handleMessage(client: ClientMeta, message: ClientToServerMessage): void {
    if (message.type === "ping") {
      client.lastPingAt = Date.now();
      this.send(client.socket, { type: "pong" });
      return;
    }

    if (message.type === "register") {
      this.handleRegister(client, message.username, message.password);
      return;
    }

    if (message.type === "login") {
      this.handleLogin(client, message.username, message.password);
      return;
    }

    if (message.type === "authWithToken") {
      this.handleAuthWithToken(client, message.token);
      return;
    }

    if (!client.username || !client.token) {
      this.sendError(client.socket, "AUTH_REQUIRED", "请先登录");
      return;
    }

    if (message.type === "listRooms") {
      this.sendLobbyState(client.socket);
      return;
    }

    if (message.type === "createRoom") {
      this.handleCreateRoom(client, message.preferredColor);
      return;
    }

    if (message.type === "joinRoom") {
      this.handleJoinRoom(client, message.roomId);
      return;
    }

    if (message.type === "leaveRoom") {
      this.handleLeaveRoom(client);
      return;
    }

    if (!client.roomId || !client.seat) {
      this.sendError(client.socket, "INVALID_ACTION", "当前不在房间中");
      return;
    }

    const room = this.rooms.get(client.roomId);
    if (!room) {
      this.sendError(client.socket, "ROOM_NOT_FOUND", "房间不存在");
      client.roomId = null;
      client.seat = null;
      return;
    }

    if (message.type === "ready") {
      room.readyMap[client.seat] = true;
      if (room.readyMap.P1 && room.readyMap.P2) {
        room.game = initState({
          mode: "online",
          player1Color: room.game.playerColors.P1,
          boardSize: room.game.boardSize
        });
        room.rematchVotes = { P1: null, P2: null };
        room.version += 1;
      }
      this.broadcastRoomState(room);
      return;
    }

    if (message.type === "rematchRequest") {
      this.handleRematch(client, room, message.swapColors);
      return;
    }

    if (message.type !== "actionIntent") {
      this.sendError(client.socket, "INVALID_ACTION", "不支持的消息类型");
      return;
    }

    if (!room.readyMap.P1 || !room.readyMap.P2) {
      this.send(client.socket, {
        type: "actionRejected",
        roomId: room.id,
        seq: message.seq,
        code: "INVALID_ACTION",
        message: "对局尚未开始"
      });
      return;
    }

    const action = message.action;
    if (action.color !== room.game.playerColors[client.seat]) {
      this.send(client.socket, {
        type: "actionRejected",
        roomId: room.id,
        seq: message.seq,
        code: "NOT_YOUR_TURN",
        message: "颜色与座位不匹配"
      });
      return;
    }

    try {
      room.game =
        action.type === "place"
          ? applyPlacement(room.game, action.color, action.x, action.y)
          : applySkill(room.game, action.color, action.skillId, action.target);

      room.version += 1;
      room.rematchVotes = { P1: null, P2: null };
      this.broadcast(room, {
        type: "actionApplied",
        roomId: room.id,
        seq: message.seq,
        version: room.version,
        action,
        state: serializeGameState(room.game)
      });

      if (room.game.winner) {
        this.broadcast(room, {
          type: "gameOver",
          roomId: room.id,
          winner: {
            playerId: getPlayerByColor(room.game, room.game.winner.winnerColor),
            color: room.game.winner.winnerColor
          },
          version: room.version,
          state: serializeGameState(room.game)
        });
      }
    } catch (err) {
      this.send(client.socket, {
        type: "actionRejected",
        roomId: room.id,
        seq: message.seq,
        code: toErrorCode(err),
        message: (err as Error).message
      });
    }
  }

  private handleRegister(client: ClientMeta, username: string, password: string): void {
    const name = username.trim();
    if (!name || !password.trim()) {
      this.send(client.socket, {
        type: "authError",
        code: "AUTH_FAILED",
        message: "用户名和密码不能为空"
      });
      return;
    }
    if (this.accounts.has(name)) {
      this.send(client.socket, {
        type: "authError",
        code: "USER_EXISTS",
        message: "用户名已存在"
      });
      return;
    }
    this.accounts.set(name, password);
    this.saveAccounts();
    this.issueAuth(client, name);
  }

  private handleLogin(client: ClientMeta, username: string, password: string): void {
    const name = username.trim();
    const saved = this.accounts.get(name);
    if (!saved || saved !== password) {
      this.send(client.socket, {
        type: "authError",
        code: "AUTH_FAILED",
        message: "用户名或密码错误"
      });
      return;
    }
    this.issueAuth(client, name);
  }

  private handleAuthWithToken(client: ClientMeta, token: string): void {
    const username = this.tokens.get(token);
    if (!username) {
      this.send(client.socket, {
        type: "authError",
        code: "AUTH_FAILED",
        message: "登录状态失效，请重新登录"
      });
      return;
    }
    client.token = token;
    client.username = username;
    this.send(client.socket, {
      type: "authOk",
      username,
      token
    });
  }

  private issueAuth(client: ClientMeta, username: string): void {
    const token = `T${this.nextTokenId++}`;
    this.tokens.set(token, username);
    client.username = username;
    client.token = token;
    this.send(client.socket, {
      type: "authOk",
      username,
      token
    });
  }

  private handleCreateRoom(client: ClientMeta, preferredColor: Color): void {
    if (client.roomId) {
      this.sendError(client.socket, "ALREADY_IN_ROOM", "请先退出当前房间");
      return;
    }

    if (this.rooms.size >= MAX_ROOMS) {
      this.sendError(client.socket, "ROOM_LIMIT_REACHED", `房间数已达上限（${MAX_ROOMS}）`);
      return;
    }

    const roomId = `room-${this.nextRoomId++}`;
    const room: RoomState = {
      id: roomId,
      version: 1,
      game: initState({ mode: "online", player1Color: preferredColor, boardSize: 15 }),
      readyMap: { P1: false, P2: false },
      rematchVotes: { P1: null, P2: null },
      players: {
        P1: {
          token: client.token!,
          name: client.username!,
          online: true
        },
        P2: null
      },
      sockets: { P1: client.socket, P2: null },
      reconnectTimers: { P1: null, P2: null },
      hostSeat: "P1"
    };
    this.rooms.set(roomId, room);

    client.roomId = roomId;
    client.seat = "P1";

    this.send(client.socket, { type: "roomCreated", roomId });
    this.send(client.socket, {
      type: "joined",
      roomId,
      seat: "P1",
      color: room.game.playerColors.P1,
      isHost: true,
      username: client.username!
    });
    this.broadcastLobbyState();
    this.broadcastRoomState(room);
  }

  private handleJoinRoom(client: ClientMeta, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendError(client.socket, "ROOM_NOT_FOUND", "房间不存在");
      return;
    }

    if (client.roomId && client.roomId !== roomId) {
      this.sendError(client.socket, "ALREADY_IN_ROOM", "请先退出当前房间");
      return;
    }

    const reconnectSeat = this.findSeatByToken(room, client.token!);
    let seat: PlayerId | null = reconnectSeat;
    if (!seat) {
      seat = !room.players.P1 ? "P1" : !room.players.P2 ? "P2" : null;
    }

    if (!seat) {
      this.sendError(client.socket, "ROOM_FULL", "房间已满");
      return;
    }

    room.players[seat] = {
      token: client.token!,
      name: client.username!,
      online: true
    };
    room.sockets[seat] = client.socket;
    if (room.reconnectTimers[seat]) {
      clearTimeout(room.reconnectTimers[seat]!);
      room.reconnectTimers[seat] = null;
    }
    room.readyMap[seat] = false;
    room.rematchVotes[seat] = null;

    client.roomId = room.id;
    client.seat = seat;

    this.send(client.socket, {
      type: "joined",
      roomId: room.id,
      seat,
      color: room.game.playerColors[seat],
      isHost: room.hostSeat === seat,
      username: client.username!
    });
    this.broadcastRoomState(room);
    this.broadcastLobbyState();
  }

  private handleLeaveRoom(client: ClientMeta): void {
    if (!client.roomId || !client.seat) {
      return;
    }
    const room = this.rooms.get(client.roomId);
    if (!room) {
      client.roomId = null;
      client.seat = null;
      return;
    }

    const leavingSeat = client.seat;
    room.players[leavingSeat] = null;
    room.sockets[leavingSeat] = null;
    if (room.reconnectTimers[leavingSeat]) {
      clearTimeout(room.reconnectTimers[leavingSeat]!);
      room.reconnectTimers[leavingSeat] = null;
    }
    room.readyMap[leavingSeat] = false;
    room.rematchVotes[leavingSeat] = null;

    client.roomId = null;
    client.seat = null;

    if (!room.players.P1 && !room.players.P2) {
      this.rooms.delete(room.id);
      this.broadcastLobbyState();
      return;
    }

    if (room.hostSeat === leavingSeat) {
      room.hostSeat = room.players.P1 ? "P1" : "P2";
    }

    this.broadcast(room, {
      type: "playerLeft",
      roomId: room.id,
      seat: leavingSeat
    });
    this.broadcastRoomState(room);
    this.broadcastLobbyState();
  }

  private handleDisconnect(client: ClientMeta): void {
    if (!client.roomId || !client.seat) {
      return;
    }
    const room = this.rooms.get(client.roomId);
    if (!room) {
      client.roomId = null;
      client.seat = null;
      return;
    }

    const seat = client.seat;
    const player = room.players[seat];
    room.sockets[seat] = null;
    if (player) {
      player.online = false;
    }

    if (room.reconnectTimers[seat]) {
      clearTimeout(room.reconnectTimers[seat]!);
    }
    room.reconnectTimers[seat] = setTimeout(() => {
      const activeRoom = this.rooms.get(room.id);
      if (!activeRoom) return;
      activeRoom.players[seat] = null;
      activeRoom.sockets[seat] = null;
      activeRoom.readyMap[seat] = false;
      activeRoom.rematchVotes[seat] = null;
      activeRoom.reconnectTimers[seat] = null;
      if (!activeRoom.players.P1 && !activeRoom.players.P2) {
        this.rooms.delete(activeRoom.id);
      } else if (activeRoom.hostSeat === seat) {
        activeRoom.hostSeat = activeRoom.players.P1 ? "P1" : "P2";
      }
      this.broadcastLobbyState();
    }, RECONNECT_TTL_MS);

    this.broadcast(room, {
      type: "playerLeft",
      roomId: room.id,
      seat
    });
    this.broadcastRoomState(room);
    this.broadcastLobbyState();

    client.roomId = null;
    client.seat = null;
  }

  private handleRematch(client: ClientMeta, room: RoomState, swapColors: boolean): void {
    if (room.hostSeat !== client.seat) {
      this.sendError(client.socket, "NOT_HOST", "只有房主可以发起再来一局");
      return;
    }

    if (!room.players.P1 || !room.players.P2) {
      this.sendError(client.socket, "INVALID_ACTION", "需要两名玩家都在房间内");
      return;
    }
    if (!room.game.winner) {
      this.sendError(client.socket, "INVALID_ACTION", "当前对局尚未结束");
      return;
    }

    const player1Color = swapColors
      ? room.game.playerColors.P1 === "black"
        ? "white"
        : "black"
      : room.game.playerColors.P1;

    room.game = initState({
      mode: "online",
      player1Color,
      boardSize: room.game.boardSize
    });
    room.readyMap = { P1: true, P2: true };
    room.rematchVotes = { P1: null, P2: null };
    room.version += 1;

    this.broadcast(room, {
      type: "rematchRequested",
      roomId: room.id,
      swapColors
    });
    this.broadcastRoomState(room);
    this.broadcastLobbyState();
  }

  private findSeatByToken(room: RoomState, token: string): PlayerId | null {
    if (room.players.P1?.token === token) return "P1";
    if (room.players.P2?.token === token) return "P2";
    return null;
  }

  private sendLobbyState(socket: WebSocket): void {
    this.send(socket, {
      type: "lobbyState",
      maxRooms: MAX_ROOMS,
      rooms: this.listRoomSummaries()
    });
  }

  private broadcastLobbyState(): void {
    const payload: ServerToClientMessage = {
      type: "lobbyState",
      maxRooms: MAX_ROOMS,
      rooms: this.listRoomSummaries()
    };
    for (const client of this.clients) {
      if (!client.username || client.roomId) continue;
      if (client.socket.readyState !== WebSocket.OPEN) continue;
      this.send(client.socket, payload);
    }
  }

  private listRoomSummaries(): RoomSummary[] {
    const list: RoomSummary[] = [];
    for (const room of this.rooms.values()) {
      const host = room.players[room.hostSeat] as RoomPlayer;
      const players = Number(Boolean(room.players.P1)) + Number(Boolean(room.players.P2));
      const status: RoomSummary["status"] = room.game.winner
        ? "finished"
        : room.readyMap.P1 && room.readyMap.P2
          ? "playing"
          : "waiting";
      list.push({
        roomId: room.id,
        hostName: host?.name ?? "-",
        hostColor: room.game.playerColors[room.hostSeat],
        players,
        status
      });
    }
    list.sort((a, b) => a.roomId.localeCompare(b.roomId));
    return list;
  }

  private broadcastRoomState(room: RoomState): void {
    this.broadcast(room, {
      type: "roomState",
      roomId: room.id,
      version: room.version,
      state: serializeGameState(room.game),
      players: ["P1", "P2"].flatMap((seat) => {
        const p = room.players[seat as PlayerId];
        if (!p) return [];
        return [
          {
            seat: seat as PlayerId,
            name: p.name,
            color: room.game.playerColors[seat as PlayerId],
            online: p.online,
            isHost: room.hostSeat === seat
          }
        ];
      }),
      readyMap: room.readyMap
    });
  }

  private broadcast(room: RoomState, message: ServerToClientMessage): void {
    for (const seat of ["P1", "P2"] as const) {
      const socket = room.sockets[seat];
      if (!socket || socket.readyState !== WebSocket.OPEN) continue;
      this.send(socket, message);
    }
  }

  private sendError(socket: WebSocket, code: ErrorCode, message: string): void {
    this.send(socket, { type: "error", code, message });
  }

  private send(socket: WebSocket, message: ServerToClientMessage): void {
    socket.send(JSON.stringify(message));
  }

  private loadAccounts(): void {
    try {
      if (!fs.existsSync(this.accountsFilePath)) {
        fs.mkdirSync(path.dirname(this.accountsFilePath), { recursive: true });
        fs.writeFileSync(this.accountsFilePath, "{}\n", "utf-8");
      }
      const raw = fs.readFileSync(this.accountsFilePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [username, password] of Object.entries(parsed)) {
        if (username && typeof password === "string") {
          this.accounts.set(username, password);
        }
      }
    } catch (err) {
      console.error("Failed to load accounts file:", err);
    }
  }

  private saveAccounts(): void {
    try {
      fs.mkdirSync(path.dirname(this.accountsFilePath), { recursive: true });
      const plain = Object.fromEntries(this.accounts.entries());
      fs.writeFileSync(this.accountsFilePath, `${JSON.stringify(plain, null, 2)}\n`, "utf-8");
    } catch (err) {
      console.error("Failed to save accounts file:", err);
    }
  }
}

function toErrorCode(err: unknown): ErrorCode {
  const message = (err as Error)?.message ?? "";
  if (message.includes("turn")) return "NOT_YOUR_TURN";
  if (message.includes("skill")) return "SKILL_USED";
  if (message.includes("target")) return "INVALID_TARGET";
  if (message.includes("empty")) return "CELL_OCCUPIED";
  return "INVALID_ACTION";
}
