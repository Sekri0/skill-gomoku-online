import {
  applyPlacement,
  applySkill,
  getPlayerByColor,
  initState
} from "../../shared/engine";
import { serializeGameState, type PlayerId } from "../../shared/types";
import type {
  ClientToServerMessage,
  ErrorCode,
  ServerToClientMessage
} from "../../src/net/protocol";
import type { ClientMeta, RoomState } from "./types";
import { WebSocket } from "ws";
import type { WebSocket as WSInstance } from "ws";

const RECONNECT_TTL_MS = 60_000;

export class RoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private nextSessionId = 1;

  handleJoin(
    socket: WSInstance,
    roomId: string,
    playerName: string,
    sessionId?: string
  ): ClientMeta | { code: ErrorCode; message: string } {
    const room = this.ensureRoom(roomId);
    const reconnectSeat = sessionId ? this.findSeatBySession(room, sessionId) : null;

    let seat: PlayerId | null = reconnectSeat;
    if (!seat) {
      if (!room.players.P1) {
        seat = "P1";
      } else if (!room.players.P2) {
        seat = "P2";
      } else {
        return { code: "ROOM_FULL", message: "\u623f\u95f4\u5df2\u6ee1" };
      }
    }

    const id = reconnectSeat && sessionId ? sessionId : `S${this.nextSessionId++}`;
    room.players[seat] = {
      sessionId: id,
      name: playerName,
      online: true
    };
    room.sockets[seat] = socket;
    if (room.reconnectTimers[seat]) {
      clearTimeout(room.reconnectTimers[seat]!);
      room.reconnectTimers[seat] = null;
    }

    return {
      socket,
      roomId,
      seat,
      sessionId: id,
      lastPingAt: Date.now()
    };
  }

  handleDisconnect(client: ClientMeta): void {
    const room = this.rooms.get(client.roomId);
    if (!room) return;

    room.sockets[client.seat] = null;
    const player = room.players[client.seat];
    if (player) {
      player.online = false;
    }

    room.reconnectTimers[client.seat] = setTimeout(() => {
      const r = this.rooms.get(client.roomId);
      if (!r) return;
      r.players[client.seat] = null;
      r.readyMap[client.seat] = false;
      if (!r.players.P1 && !r.players.P2) {
        this.rooms.delete(client.roomId);
      }
    }, RECONNECT_TTL_MS);

    this.broadcast(
      room,
      {
        type: "playerLeft",
        roomId: room.id,
        seat: client.seat
      },
      null
    );
  }

  handleMessage(client: ClientMeta, message: ClientToServerMessage): void {
    const room = this.rooms.get(client.roomId);
    if (!room) {
      this.send(client.socket, {
        type: "error",
        code: "ROOM_NOT_FOUND",
        message: "\u623f\u95f4\u4e0d\u5b58\u5728"
      });
      return;
    }

    if (message.type === "ping") {
      client.lastPingAt = Date.now();
      this.send(client.socket, { type: "pong" });
      return;
    }

    if (message.type === "ready") {
      room.readyMap[client.seat] = true;
      if (room.readyMap.P1 && room.readyMap.P2) {
        room.game = initState({
          mode: "online",
          player1Color: "black",
          boardSize: room.game.boardSize
        });
        room.version += 1;
      }
      this.broadcastRoomState(room);
      return;
    }

    if (message.type !== "actionIntent") {
      this.send(client.socket, {
        type: "error",
        code: "INVALID_ACTION",
        message: "\u4e0d\u652f\u6301\u7684\u6d88\u606f\u7c7b\u578b"
      });
      return;
    }

    if (!room.readyMap.P1 || !room.readyMap.P2) {
      this.send(client.socket, {
        type: "actionRejected",
        roomId: room.id,
        seq: message.seq,
        code: "INVALID_ACTION",
        message: "\u5bf9\u5c40\u5c1a\u672a\u5f00\u59cb"
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
        message: "\u989c\u8272\u4e0e\u5ea7\u4f4d\u4e0d\u5339\u914d"
      });
      return;
    }

    try {
      room.game =
        action.type === "place"
          ? applyPlacement(room.game, action.color, action.x, action.y)
          : applySkill(room.game, action.color, action.skillId, action.target);

      room.version += 1;
      const payload: ServerToClientMessage = {
        type: "actionApplied",
        roomId: room.id,
        seq: message.seq,
        version: room.version,
        action,
        state: serializeGameState(room.game)
      };
      this.broadcast(room, payload, null);

      if (room.game.winner) {
        this.broadcast(
          room,
          {
            type: "gameOver",
            roomId: room.id,
            winner: {
              playerId: getPlayerByColor(room.game, room.game.winner.winnerColor),
              color: room.game.winner.winnerColor
            },
            version: room.version,
            state: serializeGameState(room.game)
          },
          null
        );
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

  publishJoinSuccess(client: ClientMeta): void {
    const room = this.rooms.get(client.roomId);
    if (!room) return;

    const color = room.game.playerColors[client.seat];
    this.send(client.socket, {
      type: "joined",
      roomId: room.id,
      sessionId: client.sessionId,
      seat: client.seat,
      color
    });
    this.broadcastRoomState(room);
  }

  private ensureRoom(roomId: string): RoomState {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;

    const room: RoomState = {
      id: roomId,
      version: 1,
      game: initState({ mode: "online", player1Color: "black", boardSize: 15 }),
      readyMap: { P1: false, P2: false },
      players: { P1: null, P2: null },
      sockets: { P1: null, P2: null },
      reconnectTimers: { P1: null, P2: null }
    };
    this.rooms.set(roomId, room);
    return room;
  }

  private findSeatBySession(room: RoomState, sessionId: string): PlayerId | null {
    if (room.players.P1?.sessionId === sessionId) return "P1";
    if (room.players.P2?.sessionId === sessionId) return "P2";
    return null;
  }

  private broadcastRoomState(room: RoomState): void {
    this.broadcast(
      room,
      {
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
              online: p.online
            }
          ];
        }),
        readyMap: room.readyMap
      },
      null
    );
  }

  private broadcast(
    room: RoomState,
    message: ServerToClientMessage,
    exceptSeat: PlayerId | null
  ): void {
    for (const seat of ["P1", "P2"] as const) {
      if (exceptSeat && seat === exceptSeat) continue;
      const socket = room.sockets[seat];
      if (!socket || socket.readyState !== WebSocket.OPEN) continue;
      this.send(socket, message);
    }
  }

  private send(socket: WSInstance, message: ServerToClientMessage): void {
    socket.send(JSON.stringify(message));
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
