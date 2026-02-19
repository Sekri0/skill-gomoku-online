export const DEFAULT_BOARD_SIZE = 15;

export const CELL_DAMAGED = -1;
export const CELL_EMPTY = 0;
export const CELL_BLACK = 1;
export const CELL_WHITE = 2;

export type Cell = -1 | 0 | 1 | 2;
export type Color = "black" | "white";
export type PlayerId = "P1" | "P2";
export type SkillId = "flySand" | "mountain" | "cleaner";
export type CleanerAxis = "row" | "col";
export type Mode = "local" | "online";
export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

export interface Coord {
  x: number;
  y: number;
}

export type SkillTarget =
  | { skillId: "flySand"; x: number; y: number }
  | { skillId: "mountain"; x: number; y: number }
  | { skillId: "cleaner"; axis: CleanerAxis; index: number };

export type Action =
  | { type: "useSkill"; color: Color; skillId: SkillId; target: SkillTarget }
  | { type: "place"; color: Color; x: number; y: number };

export interface WinnerResult {
  winnerColor: Color;
  lineCells: Coord[];
}

export interface WinnerInfo extends WinnerResult {
  winnerPlayer: PlayerId;
}

export interface Config {
  boardSize?: number;
  player1Color: Color;
  mode: Mode;
  wsUrl?: string;
  roomId?: string;
  playerName?: string;
}

export interface SkillsUsed {
  P1: Record<SkillId, boolean>;
  P2: Record<SkillId, boolean>;
}

export interface PlayerColorMap {
  P1: Color;
  P2: Color;
}

export interface GameState {
  boardSize: number;
  board: Int8Array;
  currentTurnColor: Color;
  playerColors: PlayerColorMap;
  skillsUsed: SkillsUsed;
  winner: WinnerInfo | null;
}

export interface SerializedGameState {
  boardSize: number;
  board: number[];
  currentTurnColor: Color;
  playerColors: PlayerColorMap;
  skillsUsed: SkillsUsed;
  winner: WinnerInfo | null;
}

export function serializeGameState(state: GameState): SerializedGameState {
  return {
    boardSize: state.boardSize,
    board: Array.from(state.board),
    currentTurnColor: state.currentTurnColor,
    playerColors: state.playerColors,
    skillsUsed: state.skillsUsed,
    winner: state.winner
  };
}

export function deserializeGameState(state: SerializedGameState): GameState {
  return {
    boardSize: state.boardSize,
    board: Int8Array.from(state.board),
    currentTurnColor: state.currentTurnColor,
    playerColors: state.playerColors,
    skillsUsed: state.skillsUsed,
    winner: state.winner
  };
}
