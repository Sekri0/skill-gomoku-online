import type {
  Action,
  Color,
  PlayerId,
  SerializedGameState
} from "../core/types";

export type ErrorCode =
  | "ROOM_FULL"
  | "ROOM_NOT_FOUND"
  | "INVALID_ACTION"
  | "NOT_YOUR_TURN"
  | "SKILL_USED"
  | "INVALID_TARGET"
  | "CELL_OCCUPIED"
  | "INTERNAL";

export interface RoomPlayerView {
  seat: PlayerId;
  name: string;
  color: Color;
  online: boolean;
}

export type ClientToServerMessage =
  | {
      type: "joinRoom";
      roomId: string;
      playerName: string;
      sessionId?: string;
    }
  | {
      type: "ready";
      roomId: string;
    }
  | {
      type: "actionIntent";
      roomId: string;
      seq: number;
      action: Action;
    }
  | { type: "ping" };

export type ServerToClientMessage =
  | {
      type: "joined";
      roomId: string;
      sessionId: string;
      seat: PlayerId;
      color: Color;
    }
  | {
      type: "roomState";
      roomId: string;
      version: number;
      state: SerializedGameState;
      players: RoomPlayerView[];
      readyMap: Record<PlayerId, boolean>;
    }
  | {
      type: "actionApplied";
      roomId: string;
      seq: number;
      version: number;
      action: Action;
      state: SerializedGameState;
    }
  | {
      type: "actionRejected";
      roomId: string;
      seq: number;
      code: ErrorCode;
      message: string;
    }
  | {
      type: "playerLeft";
      roomId: string;
      seat: PlayerId;
    }
  | {
      type: "gameOver";
      roomId: string;
      winner: {
        playerId: PlayerId;
        color: Color;
      };
      version: number;
      state: SerializedGameState;
    }
  | { type: "pong" }
  | {
      type: "error";
      code: ErrorCode;
      message: string;
    };

export function isServerMessage(value: unknown): value is ServerToClientMessage {
  return typeof value === "object" && value !== null && "type" in value;
}
