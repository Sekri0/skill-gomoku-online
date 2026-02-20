import { getCurrentPlayerId } from "../core/engine";
import type { GameState, PlayerId, SkillId } from "../core/types";

const SKILL_LABELS: Record<SkillId, string> = {
  flySand: "\u98de\u6c99\u8d70\u77f3",
  mountain: "\u529b\u62d4\u5c71\u516e",
  cleaner: "\u4fdd\u6d01\u4e0a\u95e8"
};

export interface PanelViewState {
  modeLabel: string;
  roomLabel: string;
  instruction: string;
  targetingSkill: SkillId | null;
  cleanerAxis: "row" | "col";
  playerTitles?: Partial<Record<PlayerId, string>>;
  showRematch: boolean;
  rematchLabel: string;
  rematchEnabled: boolean;
}

export interface GameUI {
  container: HTMLElement;
  boardWrap: HTMLDivElement;
  canvas: HTMLCanvasElement;
  winnerBanner: HTMLDivElement;
  hudTurn: HTMLSpanElement;
  hudMode: HTMLSpanElement;
  hudRoom: HTMLSpanElement;
  hudInstruction: HTMLSpanElement;
  cancelButton: HTMLButtonElement;
  axisRowButton: HTMLButtonElement;
  axisColButton: HTMLButtonElement;
  newGameButton: HTMLButtonElement;
  rematchButton: HTMLButtonElement;
  playerPanels: Record<PlayerId, HTMLElement>;
  skillButtons: Record<PlayerId, Record<SkillId, HTMLButtonElement>>;
  bgmToggle: HTMLInputElement;
  sfxToggle: HTMLInputElement;
  bgmVolume: HTMLInputElement;
  sfxVolume: HTMLInputElement;
}

export function mountGameLayout(root: HTMLElement): GameUI {
  root.innerHTML = `
    <div class="app-shell">
      <div class="game" id="game-root">
        <div class="hud">
          <div class="line">
            <span id="hud-turn"></span>
            <span id="hud-mode"></span>
            <span id="hud-room"></span>
          </div>
          <div class="line">
            <strong>\u63d0\u793a\uff1a</strong><span id="hud-instruction"></span>
          </div>
        </div>

        <section class="player-panel" id="panel-P1">
          <div class="player-title" id="title-P1">\u73a9\u5bb61</div>
          <div id="color-P1"></div>
          <button class="skill-btn" id="skill-P1-flySand"></button>
          <button class="skill-btn" id="skill-P1-mountain"></button>
          <button class="skill-btn" id="skill-P1-cleaner"></button>
        </section>

        <div class="board-wrap" id="board-wrap">
          <canvas id="board-canvas"></canvas>
          <div id="winner-banner"></div>
        </div>

        <section class="player-panel" id="panel-P2">
          <div class="player-title" id="title-P2">\u73a9\u5bb62</div>
          <div id="color-P2"></div>
          <button class="skill-btn" id="skill-P2-flySand"></button>
          <button class="skill-btn" id="skill-P2-mountain"></button>
          <button class="skill-btn" id="skill-P2-cleaner"></button>
        </section>

        <div class="controls">
          <button class="ghost-btn" id="new-game-btn">\u65b0\u6e38\u620f</button>
          <button class="ghost-btn" id="rematch-btn" style="display:none;"></button>
          <button class="ghost-btn" id="cancel-btn" style="display:none;">\u53d6\u6d88\uff08ESC\uff09</button>
          <div class="axis-group" id="axis-group">
            <button class="ghost-btn" id="axis-row-btn">\u884c</button>
            <button class="ghost-btn" id="axis-col-btn">\u5217</button>
          </div>
          <div class="group">
            <label><input id="bgm-toggle" type="checkbox" checked />BGM</label>
            <input id="bgm-volume" type="range" min="0" max="1" step="0.01" value="0.35" />
          </div>
          <div class="group">
            <label><input id="sfx-toggle" type="checkbox" checked />\u97f3\u6548</label>
            <input id="sfx-volume" type="range" min="0" max="1" step="0.01" value="0.8" />
          </div>
        </div>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`) as T;

  return {
    container: q("game-root"),
    boardWrap: q("board-wrap"),
    canvas: q("board-canvas"),
    winnerBanner: q("winner-banner"),
    hudTurn: q("hud-turn"),
    hudMode: q("hud-mode"),
    hudRoom: q("hud-room"),
    hudInstruction: q("hud-instruction"),
    cancelButton: q("cancel-btn"),
    axisRowButton: q("axis-row-btn"),
    axisColButton: q("axis-col-btn"),
    newGameButton: q("new-game-btn"),
    rematchButton: q("rematch-btn"),
    playerPanels: {
      P1: q("panel-P1"),
      P2: q("panel-P2")
    },
    skillButtons: {
      P1: {
        flySand: q("skill-P1-flySand"),
        mountain: q("skill-P1-mountain"),
        cleaner: q("skill-P1-cleaner")
      },
      P2: {
        flySand: q("skill-P2-flySand"),
        mountain: q("skill-P2-mountain"),
        cleaner: q("skill-P2-cleaner")
      }
    },
    bgmToggle: q("bgm-toggle"),
    sfxToggle: q("sfx-toggle"),
    bgmVolume: q("bgm-volume"),
    sfxVolume: q("sfx-volume")
  };
}

export function updatePanels(
  ui: GameUI,
  state: GameState,
  view: PanelViewState
): void {
  const currentPlayer = getCurrentPlayerId(state);

  ui.hudMode.textContent = `\u6a21\u5f0f\uff1a${view.modeLabel}`;
  ui.hudRoom.textContent = view.roomLabel;
  ui.hudInstruction.textContent = view.instruction;

  const winnerText = state.winner
    ? `\u73a9\u5bb6${state.winner.winnerPlayer === "P1" ? "1" : "2"}\uff08${state.winner.winnerColor === "black" ? "\u9ed1" : "\u767d"}\uff09\u80dc\u5229`
    : `\u8f6e\u5230\uff1a\u73a9\u5bb6${currentPlayer === "P1" ? "1" : "2"}\uff08${state.currentTurnColor === "black" ? "\u9ed1" : "\u767d"}\uff09`;
  ui.hudTurn.textContent = winnerText;

  ui.playerPanels.P1.classList.toggle("active", !state.winner && currentPlayer === "P1");
  ui.playerPanels.P2.classList.toggle("active", !state.winner && currentPlayer === "P2");

  setText("title-P1", view.playerTitles?.P1 ?? "\u73a9\u5bb61");
  setText("title-P2", view.playerTitles?.P2 ?? "\u73a9\u5bb62");
  setText("color-P1", `\u6267\u5b50\uff1a${state.playerColors.P1 === "black" ? "\u9ed1" : "\u767d"}`);
  setText("color-P2", `\u6267\u5b50\uff1a${state.playerColors.P2 === "black" ? "\u9ed1" : "\u767d"}`);

  for (const playerId of ["P1", "P2"] as const) {
    for (const skillId of ["flySand", "mountain", "cleaner"] as const) {
      const btn = ui.skillButtons[playerId][skillId];
      const used = state.skillsUsed[playerId][skillId];
      const enabledPlayer = playerId === currentPlayer && !state.winner;
      btn.textContent = `${SKILL_LABELS[skillId]}${used ? "\uff08\u5df2\u4f7f\u7528\uff09" : ""}`;
      btn.disabled = used || !enabledPlayer;
      btn.classList.toggle("used", used);
      btn.classList.toggle(
        "active",
        view.targetingSkill === skillId && playerId === currentPlayer
      );
    }
  }

  ui.cancelButton.style.display = view.targetingSkill ? "inline-block" : "none";

  const axisGroup = ui.axisRowButton.parentElement as HTMLElement;
  axisGroup.style.display = view.targetingSkill === "cleaner" ? "flex" : "none";
  ui.axisRowButton.style.background = view.cleanerAxis === "row" ? "#e6bb79" : "#efe6d2";
  ui.axisColButton.style.background = view.cleanerAxis === "col" ? "#e6bb79" : "#efe6d2";

  ui.rematchButton.style.display = view.showRematch ? "inline-block" : "none";
  ui.rematchButton.textContent = view.rematchLabel;
  ui.rematchButton.disabled = !view.rematchEnabled;

  if (state.winner) {
    ui.winnerBanner.style.display = "block";
    ui.winnerBanner.textContent = winnerText;
  } else {
    ui.winnerBanner.style.display = "none";
    ui.winnerBanner.textContent = "";
  }
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = text;
  }
}
