import {
  CELL_BLACK,
  CELL_DAMAGED,
  CELL_WHITE,
  type Coord,
  type GameState,
  type SkillId
} from "../core/types";

export interface BoardUIState {
  targetingSkill: SkillId | null;
  validTargets: Set<number>;
  hoverCell: Coord | null;
  cleanerAxis: "row" | "col";
  winnerLine: Coord[] | null;
}

interface Metrics {
  originX: number;
  originY: number;
  cell: number;
  boardPixels: number;
}

const BOARD_PADDING = 26;

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  uiState: BoardUIState
): void {
  const { width, height } = ctx.canvas;
  const m = getMetrics(width, height, state.boardSize);

  ctx.clearRect(0, 0, width, height);

  drawBoardBackground(ctx, width, height);
  drawCleanerOverlay(ctx, uiState, m);
  drawGrid(ctx, state.boardSize, m);
  drawStars(ctx, m);

  if (uiState.targetingSkill && uiState.targetingSkill !== "cleaner") {
    drawTargetHints(ctx, state, uiState, m);
  }

  drawCells(ctx, state, m);

  if (uiState.winnerLine && uiState.winnerLine.length > 0) {
    drawWinnerHighlight(ctx, uiState.winnerLine, m);
  }
}

export function hitTestCell(
  canvas: HTMLCanvasElement,
  ev: PointerEvent,
  boardSize = 15
): Coord | null {
  const rect = canvas.getBoundingClientRect();
  const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const py = (ev.clientY - rect.top) * (canvas.height / rect.height);

  const m = getMetrics(canvas.width, canvas.height, boardSize);
  const gx = (px - m.originX) / m.cell;
  const gy = (py - m.originY) / m.cell;
  const x = Math.round(gx);
  const y = Math.round(gy);

  if (x < 0 || y < 0 || x >= boardSize || y >= boardSize) {
    return null;
  }

  const cx = m.originX + x * m.cell;
  const cy = m.originY + y * m.cell;
  const dx = px - cx;
  const dy = py - cy;
  const dist2 = dx * dx + dy * dy;
  const threshold = (m.cell * 0.48) ** 2;

  return dist2 <= threshold ? { x, y } : null;
}

function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#d6ad73");
  g.addColorStop(1, "#bf9258");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  boardSize: number,
  m: Metrics
): void {
  ctx.save();
  ctx.strokeStyle = "#4b341f";
  ctx.lineWidth = Math.max(1, m.cell * 0.03);

  for (let i = 0; i < boardSize; i += 1) {
    const p = m.originX + i * m.cell;
    ctx.beginPath();
    ctx.moveTo(p, m.originY);
    ctx.lineTo(p, m.originY + m.boardPixels);
    ctx.stroke();

    const q = m.originY + i * m.cell;
    ctx.beginPath();
    ctx.moveTo(m.originX, q);
    ctx.lineTo(m.originX + m.boardPixels, q);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, m: Metrics): void {
  const stars = [3, 7, 11];
  ctx.save();
  ctx.fillStyle = "#3d2a19";
  for (const y of stars) {
    for (const x of stars) {
      const cx = m.originX + x * m.cell;
      const cy = m.originY + y * m.cell;
      ctx.beginPath();
      ctx.arc(cx, cy, m.cell * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  m: Metrics
): void {
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      const v = state.board[y * state.boardSize + x];
      const cx = m.originX + x * m.cell;
      const cy = m.originY + y * m.cell;

      if (v === CELL_DAMAGED) {
        drawDamagedCell(ctx, cx, cy, m.cell);
      } else if (v === CELL_BLACK || v === CELL_WHITE) {
        drawStone(ctx, cx, cy, m.cell, v === CELL_BLACK ? "black" : "white");
      }
    }
  }
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  color: "black" | "white"
): void {
  const r = cell * 0.42;

  ctx.save();
  if (color === "black") {
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.2, cx, cy, r);
    g.addColorStop(0, "#686868");
    g.addColorStop(1, "#141414");
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(cx - r * 0.45, cy - r * 0.45, r * 0.2, cx, cy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#d9d9d9");
    ctx.fillStyle = g;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color === "black" ? "#000" : "#8a8a8a";
  ctx.lineWidth = Math.max(1, cell * 0.03);
  ctx.stroke();
  ctx.restore();
}

function drawDamagedCell(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number
): void {
  const r = cell * 0.42;
  ctx.save();
  ctx.fillStyle = "rgba(40, 26, 18, 0.62)";
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.strokeStyle = "rgba(255, 220, 170, 0.55)";
  ctx.lineWidth = Math.max(1.2, cell * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.9, cy - r * 0.6);
  ctx.lineTo(cx + r * 0.9, cy + r * 0.7);
  ctx.moveTo(cx - r * 0.7, cy + r * 0.8);
  ctx.lineTo(cx + r * 0.8, cy - r * 0.8);
  ctx.stroke();
  ctx.restore();
}

function drawTargetHints(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  uiState: BoardUIState,
  m: Metrics
): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 245, 100, 0.24)";
  ctx.strokeStyle = "rgba(180, 120, 30, 0.95)";
  ctx.lineWidth = Math.max(1, m.cell * 0.035);

  for (const idx of uiState.validTargets) {
    const x = idx % state.boardSize;
    const y = Math.floor(idx / state.boardSize);
    const cx = m.originX + x * m.cell;
    const cy = m.originY + y * m.cell;

    ctx.beginPath();
    ctx.arc(cx, cy, m.cell * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawCleanerOverlay(
  ctx: CanvasRenderingContext2D,
  uiState: BoardUIState,
  m: Metrics
): void {
  if (uiState.targetingSkill !== "cleaner" || !uiState.hoverCell) {
    return;
  }

  const idx = uiState.cleanerAxis === "row" ? uiState.hoverCell.y : uiState.hoverCell.x;
  ctx.save();
  ctx.fillStyle = "rgba(200, 40, 40, 0.22)";

  if (uiState.cleanerAxis === "row") {
    const y = m.originY + idx * m.cell - m.cell * 0.5;
    ctx.fillRect(m.originX - m.cell * 0.5, y, m.boardPixels + m.cell, m.cell);
  } else {
    const x = m.originX + idx * m.cell - m.cell * 0.5;
    ctx.fillRect(x, m.originY - m.cell * 0.5, m.cell, m.boardPixels + m.cell);
  }
  ctx.restore();
}

function drawWinnerHighlight(
  ctx: CanvasRenderingContext2D,
  line: Coord[],
  m: Metrics
): void {
  const start = line[0];
  const end = line[line.length - 1];
  const sx = m.originX + start.x * m.cell;
  const sy = m.originY + start.y * m.cell;
  const ex = m.originX + end.x * m.cell;
  const ey = m.originY + end.y * m.cell;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 70, 70, 0.95)";
  ctx.lineWidth = Math.max(4, m.cell * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.restore();
}

function getMetrics(width: number, height: number, boardSize: number): Metrics {
  const cell = Math.min(
    (width - BOARD_PADDING * 2) / (boardSize - 1),
    (height - BOARD_PADDING * 2) / (boardSize - 1)
  );
  const boardPixels = cell * (boardSize - 1);
  const originX = (width - boardPixels) / 2;
  const originY = (height - boardPixels) / 2;

  return { originX, originY, cell, boardPixels };
}
