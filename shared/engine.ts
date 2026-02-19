import {
  CELL_BLACK,
  CELL_DAMAGED,
  CELL_EMPTY,
  CELL_WHITE,
  type Color,
  type Config,
  DEFAULT_BOARD_SIZE,
  type GameState,
  type PlayerColorMap,
  type PlayerId,
  type SkillId,
  type SkillTarget,
  type WinnerResult
} from "./types";

const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

export function initState(config: Config): GameState {
  const boardSize = config.boardSize ?? DEFAULT_BOARD_SIZE;
  const playerColors: PlayerColorMap =
    config.player1Color === "black"
      ? { P1: "black", P2: "white" as const }
      : { P1: "white", P2: "black" as const };

  return {
    boardSize,
    board: new Int8Array(boardSize * boardSize).fill(CELL_EMPTY),
    currentTurnColor: "black",
    playerColors,
    skillsUsed: {
      P1: { flySand: false, mountain: false, cleaner: false },
      P2: { flySand: false, mountain: false, cleaner: false }
    },
    winner: null
  };
}

export function getCurrentColor(state: GameState): Color {
  return state.currentTurnColor;
}

export function getCurrentPlayerId(state: GameState): PlayerId {
  return getPlayerByColor(state, state.currentTurnColor);
}

export function getPlayerByColor(state: GameState, color: Color): PlayerId {
  return state.playerColors.P1 === color ? "P1" : "P2";
}

export function getOpponentColor(color: Color): Color {
  return color === "black" ? "white" : "black";
}

export function listLegalPlacements(
  state: GameState,
  color: Color
): Array<{ x: number; y: number }> {
  if (state.winner || color !== state.currentTurnColor) {
    return [];
  }

  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      if (getCell(state.board, state.boardSize, x, y) === CELL_EMPTY) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function listLegalSkillTargets(
  state: GameState,
  skillId: SkillId,
  color: Color
): SkillTarget[] {
  if (state.winner || color !== state.currentTurnColor) {
    return [];
  }

  const playerId = getPlayerByColor(state, color);
  if (state.skillsUsed[playerId][skillId]) {
    return [];
  }

  const targets: SkillTarget[] = [];
  const opponent = colorToCell(getOpponentColor(color));

  if (skillId === "flySand") {
    for (let y = 0; y < state.boardSize; y += 1) {
      for (let x = 0; x < state.boardSize; x += 1) {
        if (getCell(state.board, state.boardSize, x, y) === opponent) {
          targets.push({ skillId, x, y });
        }
      }
    }
    return targets;
  }

  if (skillId === "mountain") {
    for (let y = 0; y < state.boardSize; y += 1) {
      for (let x = 0; x < state.boardSize; x += 1) {
        if (getCell(state.board, state.boardSize, x, y) === CELL_EMPTY) {
          targets.push({ skillId, x, y });
        }
      }
    }
    return targets;
  }

  for (let i = 0; i < state.boardSize; i += 1) {
    targets.push({ skillId: "cleaner", axis: "row", index: i });
    targets.push({ skillId: "cleaner", axis: "col", index: i });
  }
  return targets;
}

export function applySkill(
  state: GameState,
  color: Color,
  skillId: SkillId,
  target: SkillTarget
): GameState {
  if (state.winner) {
    throw new Error("game already ended");
  }
  if (state.currentTurnColor !== color) {
    throw new Error("not this color's turn");
  }

  const playerId = getPlayerByColor(state, color);
  if (state.skillsUsed[playerId][skillId]) {
    throw new Error("skill already used");
  }

  const nextBoard = new Int8Array(state.board);

  if (skillId === "flySand") {
    if (target.skillId !== "flySand" || !isInside(state.boardSize, target.x, target.y)) {
      throw new Error("invalid target");
    }
    const v = getCell(nextBoard, state.boardSize, target.x, target.y);
    if (v !== colorToCell(getOpponentColor(color))) {
      throw new Error("target must be opponent stone");
    }
    setCell(nextBoard, state.boardSize, target.x, target.y, CELL_EMPTY);
  } else if (skillId === "mountain") {
    if (target.skillId !== "mountain" || !isInside(state.boardSize, target.x, target.y)) {
      throw new Error("invalid target");
    }
    const v = getCell(nextBoard, state.boardSize, target.x, target.y);
    if (v !== CELL_EMPTY) {
      throw new Error("target must be empty");
    }
    setCell(nextBoard, state.boardSize, target.x, target.y, CELL_DAMAGED);
  } else {
    if (
      target.skillId !== "cleaner" ||
      (target.axis !== "row" && target.axis !== "col") ||
      target.index < 0 ||
      target.index >= state.boardSize
    ) {
      throw new Error("invalid target");
    }

    for (let i = 0; i < state.boardSize; i += 1) {
      const x = target.axis === "row" ? i : target.index;
      const y = target.axis === "row" ? target.index : i;
      const v = getCell(nextBoard, state.boardSize, x, y);
      if (v === CELL_BLACK || v === CELL_WHITE) {
        setCell(nextBoard, state.boardSize, x, y, CELL_EMPTY);
      }
    }
  }

  const nextSkills = cloneSkillsUsed(state.skillsUsed);
  nextSkills[playerId][skillId] = true;

  return {
    ...state,
    board: nextBoard,
    skillsUsed: nextSkills
  };
}

export function applyPlacement(
  state: GameState,
  color: Color,
  x: number,
  y: number
): GameState {
  if (state.winner) {
    throw new Error("game already ended");
  }
  if (color !== state.currentTurnColor) {
    throw new Error("not this color's turn");
  }
  if (!isInside(state.boardSize, x, y)) {
    throw new Error("out of board");
  }
  if (getCell(state.board, state.boardSize, x, y) !== CELL_EMPTY) {
    throw new Error("cell is not empty");
  }

  const nextBoard = new Int8Array(state.board);
  setCell(nextBoard, state.boardSize, x, y, colorToCell(color));

  const switched: GameState = {
    ...state,
    board: nextBoard,
    currentTurnColor: getOpponentColor(color)
  };

  const winner = checkWinner(switched);
  if (!winner) {
    return switched;
  }

  return {
    ...switched,
    winner: {
      ...winner,
      winnerPlayer: getPlayerByColor(switched, winner.winnerColor)
    }
  };
}

export function checkWinner(state: GameState): WinnerResult | null {
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      const v = getCell(state.board, state.boardSize, x, y);
      if (v !== CELL_BLACK && v !== CELL_WHITE) {
        continue;
      }

      for (const [dx, dy] of DIRECTIONS) {
        const px = x - dx;
        const py = y - dy;
        if (
          isInside(state.boardSize, px, py) &&
          getCell(state.board, state.boardSize, px, py) === v
        ) {
          continue;
        }

        let len = 0;
        let cx = x;
        let cy = y;
        while (
          isInside(state.boardSize, cx, cy) &&
          getCell(state.board, state.boardSize, cx, cy) === v
        ) {
          len += 1;
          cx += dx;
          cy += dy;
        }

        if (len >= 5) {
          const lineCells = [];
          for (let i = 0; i < 5; i += 1) {
            lineCells.push({ x: x + dx * i, y: y + dy * i });
          }
          return {
            winnerColor: v === CELL_BLACK ? "black" : "white",
            lineCells
          };
        }
      }
    }
  }
  return null;
}

function getCell(board: Int8Array, size: number, x: number, y: number): number {
  return board[y * size + x];
}

function setCell(
  board: Int8Array,
  size: number,
  x: number,
  y: number,
  value: number
): void {
  board[y * size + x] = value;
}

function isInside(size: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < size && y < size;
}

function colorToCell(color: Color): number {
  return color === "black" ? CELL_BLACK : CELL_WHITE;
}

function cloneSkillsUsed(skills: GameState["skillsUsed"]): GameState["skillsUsed"] {
  return {
    P1: { ...skills.P1 },
    P2: { ...skills.P2 }
  };
}
