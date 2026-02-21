import "./style.css";
import { GameController } from "./app/controller";
import type { Color, Config, Mode } from "./core/types";
import { AudioManager } from "./ui/audio";
import { NetClient } from "./net/client";
import type { RoomSummary, ServerToClientMessage } from "./net/protocol";

const app = document.getElementById("app");
if (!app) {
  throw new Error("missing #app");
}
const appRoot = app;

let controller: GameController | null = null;
let hallClient: NetClient | null = null;
let hallState: {
  wsUrl: string;
  username: string;
  token: string;
  rooms: RoomSummary[];
  maxRooms: number;
  message: string;
} | null = null;

renderModeSelect();

function renderModeSelect(): void {
  const defaultWs =
    (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://1.13.164.21:8080/ws";
  appRoot.innerHTML = `
    <div class="app-shell">
      <section class="lobby">
        <h1>Skill Gomoku</h1>
        <div class="row">
          <label>\u6a21\u5f0f\u9009\u62e9\uff1a</label>
          <button id="mode-local-btn" class="primary-btn">\u672c\u5730\u5bf9\u6218</button>
          <button id="mode-online-btn" class="ghost-btn">\u8054\u673a\u5bf9\u6218</button>
        </div>
        <div id="local-fields">
          <div class="row">
          <label for="p1-color">\u73a9\u5bb61\u6267\u5b50\uff1a</label>
          <select id="p1-color">
            <option value="black">\u6267\u9ed1\uff08\u5148\u624b\uff09</option>
            <option value="white">\u6267\u767d\uff08\u540e\u624b\uff09</option>
          </select>
          </div>
        </div>
        <div id="online-fields" style="display:none;">
          <div class="row">
            <label for="ws-url">\u670d\u52a1\u5668\u5730\u5740\uff1a</label>
            <input id="ws-url" class="text-input" value="${escapeHtml(defaultWs)}" />
          </div>
        </div>
        <div class="row">
          <button id="start-btn" class="primary-btn">\u4e0b\u4e00\u6b65</button>
        </div>
        <p class="hint">\u8054\u673a\u6a21\u5f0f\u9700\u8981\u5148\u542f\u52a8\u672c\u5730\u6216\u4e91\u7aef WebSocket \u670d\u52a1\u7aef\u3002</p>
      </section>
    </div>
  `;

  let mode: Mode = "local";
  const localModeBtn = document.getElementById("mode-local-btn") as HTMLButtonElement;
  const onlineModeBtn = document.getElementById("mode-online-btn") as HTMLButtonElement;
  const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
  const p1ColorSelect = document.getElementById("p1-color") as HTMLSelectElement;
  const localFields = document.getElementById("local-fields") as HTMLDivElement;
  const onlineFields = document.getElementById("online-fields") as HTMLDivElement;
  const wsUrlInput = document.getElementById("ws-url") as HTMLInputElement;

  const syncModeFields = () => {
    localFields.style.display = mode === "local" ? "block" : "none";
    onlineFields.style.display = mode === "online" ? "block" : "none";
    localModeBtn.className = mode === "local" ? "primary-btn" : "ghost-btn";
    onlineModeBtn.className = mode === "online" ? "primary-btn" : "ghost-btn";
  };
  localModeBtn.addEventListener("click", () => {
    mode = "local";
    syncModeFields();
  });
  onlineModeBtn.addEventListener("click", () => {
    mode = "online";
    syncModeFields();
  });
  syncModeFields();

  startBtn.addEventListener("click", async () => {
    const p1Color = (p1ColorSelect.value as Color) || "black";
    const audio = new AudioManager();
    await audio.initFromGesture();

    if (mode === "online") {
      const wsUrl = wsUrlInput.value.trim();
      if (!wsUrl) {
        alert("\u8bf7\u586b\u5199 WebSocket \u670d\u52a1\u5668\u5730\u5740");
        return;
      }
      renderOnlineAuth(wsUrl, audio);
      return;
    }

    const config: Config = {
      boardSize: 15,
      player1Color: p1Color,
      mode
    };

    appRoot.innerHTML = "";
    controller = new GameController({
      root: appRoot,
      config,
      audio,
      onExitToLobby: () => {
        controller?.destroy();
        controller = null;
        renderModeSelect();
      }
    });
  });
}

function renderOnlineAuth(wsUrl: string, audio: AudioManager): void {
  disconnectHallClient();
  appRoot.innerHTML = `
    <div class="app-shell">
      <section class="lobby">
        <h1>\u8054\u673a\u767b\u5f55</h1>
        <div class="row">
          <label for="auth-username">\u7528\u6237\u540d\uff1a</label>
          <input id="auth-username" class="text-input" />
        </div>
        <div class="row">
          <label for="auth-password">\u5bc6\u7801\uff1a</label>
          <input id="auth-password" type="password" class="text-input" />
        </div>
        <div class="row">
          <button id="login-btn" class="primary-btn">\u767b\u5f55</button>
          <button id="register-btn" class="ghost-btn">\u6ce8\u518c</button>
          <button id="back-btn" class="ghost-btn">\u8fd4\u56de</button>
        </div>
        <p id="auth-msg" class="hint"></p>
      </section>
    </div>
  `;

  const usernameInput = document.getElementById("auth-username") as HTMLInputElement;
  const passwordInput = document.getElementById("auth-password") as HTMLInputElement;
  const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
  const registerBtn = document.getElementById("register-btn") as HTMLButtonElement;
  const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
  const msg = document.getElementById("auth-msg") as HTMLParagraphElement;

  let busy = false;
  const setBusy = (next: boolean) => {
    busy = next;
    loginBtn.disabled = next;
    registerBtn.disabled = next;
  };

  const ensureClient = async (): Promise<NetClient> => {
    if (hallClient) {
      return hallClient;
    }
    const client = new NetClient();
    hallClient = client;
    bindCommonHallHandlers(client, () => {
      msg.textContent = "\u7f51\u7edc\u65ad\u5f00\uff0c\u8bf7\u91cd\u8bd5";
      setBusy(false);
    });
    await client.connect(wsUrl);
    return client;
  };

  const submit = async (kind: "login" | "register") => {
    if (busy) return;
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
      msg.textContent = "\u8bf7\u8f93\u5165\u7528\u6237\u540d\u548c\u5bc6\u7801";
      return;
    }
    setBusy(true);
    msg.textContent = "\u6b63\u5728\u8fde\u63a5\u670d\u52a1\u5668...";
    try {
      const client = await ensureClient();
      client.send({ type: kind, username, password });
      const off = client.onMessage((incoming) => {
        if (incoming.type === "authOk") {
          off();
          hallState = {
            wsUrl,
            username: incoming.username,
            token: incoming.token,
            rooms: [],
            maxRooms: 1,
            message: "\u767b\u5f55\u6210\u529f"
          };
          setBusy(false);
          renderOnlineHall(audio);
        } else if (incoming.type === "authError") {
          off();
          msg.textContent = incoming.message;
          setBusy(false);
        } else if (incoming.type === "error" && (incoming.code === "AUTH_FAILED" || incoming.code === "USER_EXISTS")) {
          off();
          msg.textContent = incoming.message;
          setBusy(false);
        }
      });
    } catch {
      msg.textContent = "\u8fde\u63a5\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u5730\u5740";
      setBusy(false);
    }
  };

  loginBtn.addEventListener("click", () => void submit("login"));
  registerBtn.addEventListener("click", () => void submit("register"));
  backBtn.addEventListener("click", () => {
    disconnectHallClient();
    renderModeSelect();
  });
}

function renderOnlineHall(audio: AudioManager): void {
  if (!hallState) return;
  appRoot.innerHTML = `
    <div class="app-shell">
      <section class="lobby">
        <h1>\u6e38\u620f\u5927\u5385</h1>
        <div class="row"><strong>\u5f53\u524d\u7528\u6237\uff1a${escapeHtml(hallState.username)}</strong></div>
        <div class="row">
          <label for="host-color">\u521b\u5efa\u623f\u95f4\u6267\u5b50\uff1a</label>
          <select id="host-color">
            <option value="black">\u6211\u6267\u9ed1</option>
            <option value="white">\u6211\u6267\u767d</option>
          </select>
          <button id="create-room-btn" class="primary-btn">\u521b\u5efa\u623f\u95f4</button>
        </div>
        <div class="row">
          <button id="refresh-rooms-btn" class="ghost-btn">\u5237\u65b0\u623f\u95f4</button>
          <button id="hall-back-btn" class="ghost-btn">\u9000\u51fa\u767b\u5f55</button>
        </div>
        <p class="hint" id="hall-msg">${escapeHtml(hallState.message)}</p>
        <div id="room-list"></div>
      </section>
    </div>
  `;

  const createBtn = document.getElementById("create-room-btn") as HTMLButtonElement;
  const refreshBtn = document.getElementById("refresh-rooms-btn") as HTMLButtonElement;
  const backBtn = document.getElementById("hall-back-btn") as HTMLButtonElement;
  const hostColor = document.getElementById("host-color") as HTMLSelectElement;
  const hallMsg = document.getElementById("hall-msg") as HTMLParagraphElement;
  const roomList = document.getElementById("room-list") as HTMLDivElement;
  const client = hallClient;
  if (!client) {
    renderOnlineAuth(hallState.wsUrl, audio);
    return;
  }

  const renderRooms = () => {
    if (!hallState) return;
    roomList.innerHTML = hallState.rooms
      .map(
        (room) => `
      <div class="row" style="justify-content:space-between;border:1px solid #d4c2a4;border-radius:8px;padding:8px;">
        <span>${escapeHtml(room.roomId)} | \u623f\u4e3b\uff1a${escapeHtml(room.hostName)} | \u623f\u4e3b\u6267${room.hostColor === "black" ? "\u9ed1" : "\u767d"} | \u4eba\u6570\uff1a${room.players}/2</span>
        <button class="ghost-btn join-room-btn" data-room-id="${escapeHtml(room.roomId)}" ${
          room.players >= 2 ? "disabled" : ""
        }>\u52a0\u5165</button>
      </div>`
      )
      .join("");

    roomList.querySelectorAll<HTMLButtonElement>(".join-room-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const roomId = btn.dataset.roomId;
        if (!roomId) return;
        hallMsg.textContent = `\u6b63\u5728\u52a0\u5165\u623f\u95f4 ${roomId} ...`;
        client.send({ type: "joinRoom", roomId });
      });
    });
  };

  const offMessage = client.onMessage((msg: ServerToClientMessage) => {
    if (!hallState) return;
    if (msg.type === "lobbyState") {
      hallState.rooms = msg.rooms;
      hallState.maxRooms = msg.maxRooms;
      hallMsg.textContent = `\u623f\u95f4\u4e0a\u9650\uff1a${msg.maxRooms}\uff0c\u5f53\u524d\u623f\u95f4\uff1a${msg.rooms.length}`;
      renderRooms();
      createBtn.disabled = msg.rooms.length >= msg.maxRooms;
      return;
    }
    if (msg.type === "roomCreated") {
      hallMsg.textContent = `\u521b\u5efa\u6210\u529f\uff0c\u623f\u95f4\u53f7\uff1a${msg.roomId}`;
      client.send({ type: "listRooms" });
      return;
    }
    if (msg.type === "joined") {
      const active = hallState;
      hallState = null;
      offMessage();
      disconnectHallClient();
      appRoot.innerHTML = "";
      controller = new GameController({
        root: appRoot,
        config: {
          boardSize: 15,
          player1Color: "black",
          mode: "online",
          wsUrl: active.wsUrl,
          roomId: msg.roomId,
          playerName: active.username,
          authToken: active.token
        },
        audio,
        onExitToLobby: () => {
          controller?.destroy();
          controller = null;
          renderModeSelect();
        }
      });
      return;
    }
    if (msg.type === "error" || msg.type === "authError") {
      hallMsg.textContent = msg.message;
    }
  });

  createBtn.addEventListener("click", () => {
    client.send({ type: "createRoom", preferredColor: hostColor.value as Color });
  });
  refreshBtn.addEventListener("click", () => {
    client.send({ type: "listRooms" });
  });
  backBtn.addEventListener("click", () => {
    offMessage();
    disconnectHallClient();
    hallState = null;
    renderModeSelect();
  });

  client.send({ type: "authWithToken", token: hallState.token });
  client.send({ type: "listRooms" });
}

function bindCommonHallHandlers(client: NetClient, onError: () => void): void {
  client.onStatusChange((status) => {
    if (status === "error" || status === "closed") {
      onError();
    }
  });
}

function disconnectHallClient(): void {
  hallClient?.disconnect();
  hallClient = null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
