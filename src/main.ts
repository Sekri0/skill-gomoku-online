import "./style.css";
import { GameController } from "./app/controller";
import type { Color, Config, Mode } from "./core/types";
import { AudioManager } from "./ui/audio";

const app = document.getElementById("app");
if (!app) {
  throw new Error("missing #app");
}
const appRoot = app;

let controller: GameController | null = null;

renderLobby();

function renderLobby(): void {
  const defaultWs = (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://127.0.0.1:8080/ws";
  appRoot.innerHTML = `
    <div class="app-shell">
      <section class="lobby">
        <h1>Skill Gomoku</h1>
        <div class="row">
          <label for="mode-select">\u6a21\u5f0f\uff1a</label>
          <select id="mode-select">
            <option value="local">\u672c\u5730\u5bf9\u6218</option>
            <option value="online">\u8054\u673a\u5bf9\u6218</option>
          </select>
        </div>
        <div class="row">
          <label for="p1-color">\u73a9\u5bb61\u6267\u5b50\uff1a</label>
          <select id="p1-color">
            <option value="black">\u6267\u9ed1\uff08\u5148\u624b\uff09</option>
            <option value="white">\u6267\u767d\uff08\u540e\u624b\uff09</option>
          </select>
        </div>
        <div id="online-fields" style="display:none;">
          <div class="row">
            <label for="ws-url">\u670d\u52a1\u5668\u5730\u5740\uff1a</label>
            <input id="ws-url" class="text-input" value="${escapeHtml(defaultWs)}" />
          </div>
          <div class="row">
            <label for="room-id">\u623f\u95f4\u53f7\uff1a</label>
            <input id="room-id" class="text-input" value="room-1001" />
          </div>
          <div class="row">
            <label for="player-name">\u6635\u79f0\uff1a</label>
            <input id="player-name" class="text-input" value="\u73a9\u5bb6A" />
          </div>
        </div>
        <div class="row">
          <button id="start-btn" class="primary-btn">\u5f00\u59cb\u6e38\u620f</button>
        </div>
        <p class="hint">\u8054\u673a\u6a21\u5f0f\u9700\u8981\u5148\u542f\u52a8\u672c\u5730\u6216\u4e91\u7aef WebSocket \u670d\u52a1\u7aef\u3002</p>
      </section>
    </div>
  `;

  const modeSelect = document.getElementById("mode-select") as HTMLSelectElement;
  const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
  const p1ColorSelect = document.getElementById("p1-color") as HTMLSelectElement;
  const onlineFields = document.getElementById("online-fields") as HTMLDivElement;
  const wsUrlInput = document.getElementById("ws-url") as HTMLInputElement;
  const roomIdInput = document.getElementById("room-id") as HTMLInputElement;
  const playerNameInput = document.getElementById("player-name") as HTMLInputElement;

  const syncModeFields = () => {
    const mode = modeSelect.value as Mode;
    onlineFields.style.display = mode === "online" ? "block" : "none";
    p1ColorSelect.disabled = mode === "online";
  };
  modeSelect.addEventListener("change", syncModeFields);
  syncModeFields();

  startBtn.addEventListener("click", async () => {
    const mode = modeSelect.value as Mode;
    const p1Color = (p1ColorSelect.value as Color) || "black";
    const audio = new AudioManager();
    await audio.initFromGesture();

    const config: Config = {
      boardSize: 15,
      player1Color: mode === "online" ? "black" : p1Color,
      mode,
      wsUrl: wsUrlInput.value.trim(),
      roomId: roomIdInput.value.trim(),
      playerName: playerNameInput.value.trim()
    };

    if (mode === "online" && (!config.wsUrl || !config.roomId || !config.playerName)) {
      alert("\u8054\u673a\u6a21\u5f0f\u9700\u8981\u586b\u5199\u670d\u52a1\u5668\u5730\u5740\u3001\u623f\u95f4\u53f7\u548c\u6635\u79f0");
      return;
    }

    appRoot.innerHTML = "";
    controller = new GameController({
      root: appRoot,
      config,
      audio,
      onExitToLobby: () => {
        controller?.destroy();
        controller = null;
        renderLobby();
      }
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
