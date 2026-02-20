import type { WebSocket } from "ws";
import type { GameState, PlayerId } from "../../shared/types";

export interface ClientMeta {
  socket: WebSocket;
  token: string | null;
  username: string | null;
  roomId: string | null;
  seat: PlayerId | null;
  lastPingAt: number;
}

export interface RoomPlayer {
  token: string;
  name: string;
  online: boolean;
}

export interface RoomState {
  id: string;
  version: number;
  game: GameState;
  readyMap: Record<PlayerId, boolean>;
  rematchVotes: Record<PlayerId, { swapColors: boolean } | null>;
  players: Record<PlayerId, RoomPlayer | null>;
  sockets: Record<PlayerId, WebSocket | null>;
  reconnectTimers: Record<PlayerId, NodeJS.Timeout | null>;
  hostSeat: PlayerId;
}
