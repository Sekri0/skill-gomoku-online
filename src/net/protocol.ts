import type {
  Action,
  Color,
  PlayerId,
  SerializedGameState
} from "../core/types";

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FAILED"
  | "USER_EXISTS"
  | "ROOM_FULL"
  | "ROOM_LIMIT_REACHED"
  | "ROOM_NOT_FOUND"
  | "ALREADY_IN_ROOM"
  | "NOT_HOST"
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
  isHost: boolean;
}

export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomSummary {
  roomId: string;
  hostName: string;
  hostColor: Color;
  players: number;
  status: RoomStatus;
}

export type ClientToServerMessage =
  | {
      type: "register";
      username: string;
      password: string;
    }
  | {
      type: "login";
      username: string;
      password: string;
    }
  | {
      type: "authWithToken";
      token: string;
    }
  | {
      type: "listRooms";
    }
  | {
      type: "createRoom";
      preferredColor: Color;
    }
  | {
      type: "joinRoom";
      roomId: string;
    }
  | {
      type: "leaveRoom";
      roomId: string;
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
  | {
      type: "rematchRequest";
      roomId: string;
      swapColors: boolean;
    }
  | { type: "ping" };

export type ServerToClientMessage =
  | {
      type: "authOk";
      username: string;
      token: string;
    }
  | {
      type: "authError";
      code: "AUTH_FAILED" | "USER_EXISTS";
      message: string;
    }
  | {
      type: "lobbyState";
      maxRooms: number;
      rooms: RoomSummary[];
    }
  | {
      type: "roomCreated";
      roomId: string;
    }
  | {
      type: "joined";
      roomId: string;
      seat: PlayerId;
      color: Color;
      isHost: boolean;
      username: string;
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
      type: "roomClosed";
      roomId: string;
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
  | {
      type: "rematchRequested";
      roomId: string;
      swapColors: boolean;
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
