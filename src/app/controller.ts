import {
  applyPlacement,
  applySkill,
  getCurrentPlayerId,
  listLegalSkillTargets
} from "../core/engine";
import {
  deserializeGameState,
  type Action,
  type Color,
  type Config,
  type ConnectionStatus,
  type Coord,
  type GameState,
  type PlayerId,
  type SkillId,
  type SkillTarget
} from "../core/types";
import { initState } from "../core/engine";
import { hitTestCell, renderBoard, type BoardUIState } from "../ui/canvasBoard";
import { AudioManager } from "../ui/audio";
import { mountGameLayout, updatePanels, type GameUI } from "../ui/panels";
import { NetClient } from "../net/client";
import type { ClientToServerMessage, ServerToClientMessage } from "../net/protocol";

interface ControllerOptions {
  root: HTMLElement;
  config: Config;
  audio: AudioManager;
  onExitToLobby: () => void;
}

interface UIState {
  targetingSkill: SkillId | null;
  validTargets: Set<number>;
  hoverCell: Coord | null;
  cleanerAxis: "row" | "col";
  instruction: string;
}

interface OnlineSession {
  roomId: string;
  playerName: string;
  sessionId: string | null;
  mySeat: PlayerId | null;
  myColor: Color | null;
  seq: number;
  version: number;
  netStatus: ConnectionStatus;
}

export class GameController {
  private readonly options: ControllerOptions;
  private readonly ui: GameUI;
  private readonly audio: AudioManager;
  private readonly netClient: NetClient | null;
  private state: GameState;
  private uiState: UIState;
  private online: OnlineSession | null;
  private destroyNetHooks: Array<() => void> = [];
  private destroyed = false;

  private readonly onPointerDown = (ev: PointerEvent) => {
    if (this.destroyed || this.state.winner || !this.canInteractWithBoard()) return;
    const cell = hitTestCell(this.ui.canvas, ev, this.state.boardSize);
    if (!cell) return;
    ev.preventDefault();

    if (this.uiState.targetingSkill) {
      this.handleSkillTargetPick(cell);
      return;
    }

    this.dispatchAction({
      type: "place",
      color: this.state.currentTurnColor,
      x: cell.x,
      y: cell.y
    });
  };

  private readonly onPointerMove = (ev: PointerEvent) => {
    if (this.destroyed || this.uiState.targetingSkill !== "cleaner") return;
    const cell = hitTestCell(this.ui.canvas, ev, this.state.boardSize);
    this.uiState.hoverCell = cell;
    this.render();
  };

  private readonly onPointerLeave = () => {
    if (this.uiState.hoverCell) {
      this.uiState.hoverCell = null;
      this.render();
    }
  };

  private readonly onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Escape" && this.uiState.targetingSkill) {
      this.cancelTargeting("\u5df2\u53d6\u6d88\u6280\u80fd\u9009\u62e9\uff0c\u8bf7\u843d\u5b50");
    }
  };

  private readonly onResize = () => {
    this.resizeCanvas();
    this.render();
  };

  constructor(options: ControllerOptions) {
    this.options = options;
    this.audio = options.audio;
    this.state = initState(options.config);
    this.uiState = {
      targetingSkill: null,
      validTargets: new Set<number>(),
      hoverCell: null,
      cleanerAxis: "row",
      instruction: "\u8bf7\u5728\u68cb\u76d8\u843d\u4e0b\u4e00\u5b50"
    };
    this.online =
      options.config.mode === "online"
        ? {
            roomId: options.config.roomId ?? "",
            playerName: options.config.playerName ?? "\u73a9\u5bb6",
            sessionId: null,
            mySeat: null,
            myColor: null,
            seq: 0,
            version: 0,
            netStatus: "idle"
          }
        : null;

    this.ui = mountGameLayout(this.options.root);
    this.netClient = this.options.config.mode === "online" ? new NetClient() : null;

    this.bindUIEvents();
    this.bindNetworkEvents();
    this.resizeCanvas();
    this.render();
    this.bootstrapOnline();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.ui.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.ui.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.ui.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.onResize);

    for (const off of this.destroyNetHooks) {
      off();
    }
    this.destroyNetHooks = [];

    this.netClient?.disconnect();
    this.audio.dispose();
  }

  private bindUIEvents(): void {
    this.ui.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.ui.canvas.addEventListener("pointermove", this.onPointerMove);
    this.ui.canvas.addEventListener("pointerleave", this.onPointerLeave);

    for (const playerId of ["P1", "P2"] as const) {
      for (const skillId of ["flySand", "mountain", "cleaner"] as const) {
        const btn = this.ui.skillButtons[playerId][skillId];
        btn.addEventListener("click", () => this.tryEnterTargeting(playerId, skillId));
      }
    }

    this.ui.cancelButton.addEventListener("click", () =>
      this.cancelTargeting("\u5df2\u53d6\u6d88\u6280\u80fd\u9009\u62e9\uff0c\u8bf7\u843d\u5b50")
    );

    this.ui.axisRowButton.addEventListener("click", () => {
      this.uiState.cleanerAxis = "row";
      this.render();
    });

    this.ui.axisColButton.addEventListener("click", () => {
      this.uiState.cleanerAxis = "col";
      this.render();
    });

    this.ui.newGameButton.addEventListener("click", () => {
      this.options.onExitToLobby();
    });

    this.ui.bgmToggle.addEventListener("change", () => {
      this.audio.setBgmEnabled(this.ui.bgmToggle.checked);
    });
    this.ui.sfxToggle.addEventListener("change", () => {
      this.audio.setSfxEnabled(this.ui.sfxToggle.checked);
    });
    this.ui.bgmVolume.addEventListener("input", () => {
      this.audio.setBgmVolume(Number(this.ui.bgmVolume.value));
    });
    this.ui.sfxVolume.addEventListener("input", () => {
      this.audio.setSfxVolume(Number(this.ui.sfxVolume.value));
    });

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.onResize);
  }

  private bindNetworkEvents(): void {
    if (!this.netClient || !this.online) return;

    this.destroyNetHooks.push(
      this.netClient.onStatusChange((status) => {
        if (!this.online) return;
        this.online.netStatus = status;
        if (status === "connected") {
          this.uiState.instruction = "\u5df2\u8fde\u63a5\u670d\u52a1\u5668\uff0c\u6b63\u5728\u8fdb\u5165\u623f\u95f4...";
          this.sendOnline({
            type: "joinRoom",
            roomId: this.online.roomId,
            playerName: this.online.playerName,
            sessionId: this.online.sessionId ?? undefined
          });
        } else if (status === "reconnecting") {
          this.uiState.instruction = "\u7f51\u7edc\u65ad\u5f00\uff0c\u6b63\u5728\u91cd\u8fde...";
        } else if (status === "error") {
          this.uiState.instruction = "\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5";
        }
        this.render();
      })
    );

    this.destroyNetHooks.push(
      this.netClient.onMessage((msg) => {
        this.handleServerMessage(msg);
      })
    );
  }

  private async bootstrapOnline(): Promise<void> {
    if (!this.netClient || !this.online) return;
    if (!this.options.config.wsUrl) {
      this.uiState.instruction = "\u7f3a\u5c11\u8054\u673a\u5730\u5740\uff0c\u65e0\u6cd5\u8fde\u63a5";
      this.render();
      return;
    }

    try {
      await this.netClient.connect(this.options.config.wsUrl);
    } catch {
      this.uiState.instruction = "\u8fde\u63a5\u670d\u52a1\u5668\u5931\u8d25";
      this.render();
    }
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    if (!this.online) return;

    if (msg.type === "joined") {
      this.online.sessionId = msg.sessionId;
      this.online.mySeat = msg.seat;
      this.online.myColor = msg.color;
      this.uiState.instruction = "\u5df2\u8fdb\u5165\u623f\u95f4\uff0c\u7b49\u5f85\u5bf9\u624b\u5e76\u51c6\u5907\u5f00\u5c40";
      this.sendOnline({ type: "ready", roomId: this.online.roomId });
      this.render();
      return;
    }

    if (msg.type === "roomState") {
      this.online.version = msg.version;
      this.state = deserializeGameState(msg.state);
      this.uiState.instruction = this.instructionByState(msg.readyMap.P1 && msg.readyMap.P2);
      this.render();
      return;
    }

    if (msg.type === "actionApplied") {
      this.online.version = msg.version;
      this.state = deserializeGameState(msg.state);
      if (msg.action.type === "useSkill") {
        this.audio.playSkillSfx();
      } else {
        this.audio.playPlaceSfx();
      }
      this.uiState.instruction = this.state.winner
        ? "\u5bf9\u5c40\u7ed3\u675f\uff0c\u70b9\u51fb\u201c\u65b0\u6e38\u620f\u201d\u8fd4\u56de"
        : "\u8bf7\u5728\u68cb\u76d8\u843d\u4e0b\u4e00\u5b50";
      this.cancelTargeting(this.uiState.instruction);
      return;
    }

    if (msg.type === "actionRejected") {
      this.uiState.instruction = `\u64cd\u4f5c\u5931\u8d25\uff1a${toRejectedText(msg.code, msg.message)}`;
      this.render();
      return;
    }

    if (msg.type === "gameOver") {
      this.online.version = msg.version;
      this.state = deserializeGameState(msg.state);
      this.uiState.instruction = "\u5bf9\u5c40\u7ed3\u675f\uff0c\u70b9\u51fb\u201c\u65b0\u6e38\u620f\u201d\u8fd4\u56de";
      this.render();
      return;
    }

    if (msg.type === "playerLeft") {
      this.uiState.instruction = "\u5bf9\u624b\u79bb\u7ebf\uff0c\u7b49\u5f85\u5176\u91cd\u8fde\uff0860\u79d2\uff09";
      this.render();
      return;
    }

    if (msg.type === "error") {
      this.uiState.instruction = `\u670d\u52a1\u5668\u9519\u8bef\uff1a${msg.message}`;
      this.render();
    }
  }

  private instructionByState(started: boolean): string {
    if (!started) {
      return "\u623f\u95f4\u5df2\u5efa\u7acb\uff0c\u7b49\u5f85\u53cc\u65b9\u51c6\u5907";
    }
    if (this.online?.myColor !== this.state.currentTurnColor) {
      return "\u7b49\u5f85\u5bf9\u624b\u64cd\u4f5c";
    }
    return "\u8bf7\u5728\u68cb\u76d8\u843d\u4e0b\u4e00\u5b50";
  }

  private canInteractWithBoard(): boolean {
    if (!this.online) {
      return true;
    }
    if (!this.online.myColor) {
      return false;
    }
    if (this.online.netStatus !== "connected") {
      return false;
    }
    return this.online.myColor === this.state.currentTurnColor;
  }

  private tryEnterTargeting(playerId: PlayerId, skillId: SkillId): void {
    if (this.state.winner || !this.canInteractWithBoard()) {
      return;
    }
    const currentPlayer = getCurrentPlayerId(this.state);
    if (playerId !== currentPlayer) {
      this.uiState.instruction = "\u5f53\u524d\u4e0d\u662f\u8be5\u73a9\u5bb6\u56de\u5408";
      this.render();
      return;
    }

    const legal = listLegalSkillTargets(this.state, skillId, this.state.currentTurnColor);
    if (legal.length === 0) {
      this.uiState.instruction = "\u5f53\u524d\u65e0\u6709\u6548\u6280\u80fd\u76ee\u6807";
      this.render();
      return;
    }

    this.uiState.targetingSkill = skillId;
    this.uiState.hoverCell = null;
    this.uiState.validTargets.clear();

    if (skillId !== "cleaner") {
      for (const t of legal) {
        if ("x" in t && "y" in t) {
          this.uiState.validTargets.add(t.y * this.state.boardSize + t.x);
        }
      }
    }

    this.uiState.instruction = skillInstruction(skillId);
    this.render();
  }

  private handleSkillTargetPick(cell: Coord): void {
    const skillId = this.uiState.targetingSkill;
    if (!skillId) return;

    const target: SkillTarget =
      skillId === "cleaner"
        ? {
            skillId: "cleaner",
            axis: this.uiState.cleanerAxis,
            index: this.uiState.cleanerAxis === "row" ? cell.y : cell.x
          }
        : { skillId, x: cell.x, y: cell.y };

    this.dispatchAction({
      type: "useSkill",
      color: this.state.currentTurnColor,
      skillId,
      target
    });
  }

  private dispatchAction(action: Action): void {
    if (!this.online) {
      this.applyLocalAction(action);
      return;
    }

    if (!this.canInteractWithBoard()) {
      this.uiState.instruction = "\u5f53\u524d\u4e0d\u53ef\u64cd\u4f5c\uff0c\u8bf7\u7b49\u5f85";
      this.render();
      return;
    }

    this.online.seq += 1;
    this.sendOnline({
      type: "actionIntent",
      roomId: this.online.roomId,
      seq: this.online.seq,
      action
    });
  }

  private sendOnline(message: ClientToServerMessage): void {
    if (!this.netClient) return;
    try {
      this.netClient.send(message);
    } catch {
      this.uiState.instruction = "\u6d88\u606f\u53d1\u9001\u5931\u8d25\uff0c\u7b49\u5f85\u91cd\u8fde";
      this.render();
    }
  }

  private applyLocalAction(action: Action): void {
    try {
      if (action.type === "useSkill") {
        this.state = applySkill(this.state, action.color, action.skillId, action.target);
        this.audio.playSkillSfx();
        this.cancelTargeting("\u6280\u80fd\u5df2\u751f\u6548\uff0c\u8bf7\u843d\u5b50");
      } else {
        this.state = applyPlacement(this.state, action.color, action.x, action.y);
        this.audio.playPlaceSfx();
        this.uiState.instruction = this.state.winner
          ? "\u5bf9\u5c40\u7ed3\u675f\uff0c\u70b9\u51fb\u201c\u65b0\u6e38\u620f\u201d\u8fd4\u56de"
          : "\u8bf7\u5728\u68cb\u76d8\u843d\u4e0b\u4e00\u5b50";
      }
    } catch {
      this.uiState.instruction =
        action.type === "useSkill"
          ? "\u8be5\u76ee\u6807\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9"
          : "\u8be5\u4f4d\u7f6e\u4e0d\u53ef\u843d\u5b50";
    }
    this.render();
  }

  private cancelTargeting(instruction: string): void {
    this.uiState.targetingSkill = null;
    this.uiState.validTargets.clear();
    this.uiState.hoverCell = null;
    this.uiState.instruction = instruction;
    this.render();
  }

  private resizeCanvas(): void {
    const side = Math.max(320, Math.floor(this.ui.boardWrap.clientWidth));
    const dpr = window.devicePixelRatio || 1;
    this.ui.canvas.style.width = `${side}px`;
    this.ui.canvas.style.height = `${side}px`;
    this.ui.canvas.width = Math.floor(side * dpr);
    this.ui.canvas.height = Math.floor(side * dpr);
  }

  private render(): void {
    const ctx = this.ui.canvas.getContext("2d");
    if (!ctx) return;

    const boardUi: BoardUIState = {
      targetingSkill: this.uiState.targetingSkill,
      validTargets: this.uiState.validTargets,
      hoverCell: this.uiState.hoverCell,
      cleanerAxis: this.uiState.cleanerAxis,
      winnerLine: this.state.winner?.lineCells ?? null
    };
    renderBoard(ctx, this.state, boardUi);

    updatePanels(this.ui, this.state, {
      modeLabel: this.online ? `\u8054\u673a\u5bf9\u6218\uff08${netStatusText(this.online.netStatus)}\uff09` : "\u672c\u5730\u5bf9\u6218",
      roomLabel: this.online ? `\u623f\u95f4\uff1a${this.online.roomId}` : "\u623f\u95f4\uff1a-",
      instruction: this.uiState.instruction,
      targetingSkill: this.uiState.targetingSkill,
      cleanerAxis: this.uiState.cleanerAxis
    });
  }
}

function skillInstruction(skillId: SkillId): string {
  if (skillId === "flySand") return "\u98de\u6c99\u8d70\u77f3\uff1a\u8bf7\u9009\u62e9\u5bf9\u65b9\u4e00\u679a\u68cb\u5b50";
  if (skillId === "mountain") return "\u529b\u62d4\u5c71\u516e\uff1a\u8bf7\u9009\u62e9\u4e00\u4e2a\u7a7a\u4f4d\u9020\u6210\u635f\u574f";
  return "\u4fdd\u6d01\u4e0a\u95e8\uff1a\u5148\u9009\u884c/\u5217\uff0c\u518d\u70b9\u51fb\u68cb\u76d8\u786e\u8ba4";
}

function netStatusText(status: ConnectionStatus): string {
  if (status === "connected") return "\u5df2\u8fde\u63a5";
  if (status === "connecting") return "\u8fde\u63a5\u4e2d";
  if (status === "reconnecting") return "\u91cd\u8fde\u4e2d";
  if (status === "error") return "\u9519\u8bef";
  if (status === "closed") return "\u5df2\u65ad\u5f00";
  return "\u7a7a\u95f2";
}

function toRejectedText(code: string, fallback: string): string {
  const map: Record<string, string> = {
    ROOM_FULL: "\u623f\u95f4\u5df2\u6ee1",
    ROOM_NOT_FOUND: "\u623f\u95f4\u4e0d\u5b58\u5728",
    INVALID_ACTION: "\u52a8\u4f5c\u65e0\u6548",
    NOT_YOUR_TURN: "\u672a\u5230\u4f60\u7684\u56de\u5408",
    SKILL_USED: "\u6280\u80fd\u5df2\u4f7f\u7528",
    INVALID_TARGET: "\u76ee\u6807\u975e\u6cd5",
    CELL_OCCUPIED: "\u4f4d\u7f6e\u4e0d\u53ef\u843d\u5b50",
    INTERNAL: "\u670d\u52a1\u5668\u5185\u90e8\u9519\u8bef"
  };
  return map[code] ?? fallback;
}
