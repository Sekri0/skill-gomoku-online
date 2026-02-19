import type { WebSocket } from "ws";
import type { GameState, PlayerId } from "../../shared/types";

export interface ClientMeta {
  socket: WebSocket;
  roomId: string;
  seat: PlayerId;
  sessionId: string;
  lastPingAt: number;
}

export interface RoomPlayer {
  sessionId: string;
  name: string;
  online: boolean;
}

export interface RoomState {
  id: string;
  version: number;
  game: GameState;
  readyMap: Record<PlayerId, boolean>;
  players: Record<PlayerId, RoomPlayer | null>;
  sockets: Record<PlayerId, WebSocket | null>;
  reconnectTimers: Record<PlayerId, NodeJS.Timeout | null>;
}
