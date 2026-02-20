import { createServer } from "http";
import * as fs from "node:fs";
import * as path from "node:path";
import { WebSocketServer } from "ws";
import { RoomManager } from "./roomManager";
import type { ClientToServerMessage } from "../../src/net/protocol";
import type { ClientMeta } from "./types";

const PORT = Number(process.env.PORT || 8080);
const manager = new RoomManager(resolveAccountsFilePath());

const server = createServer((req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.end("ok");
    return;
  }
  res.statusCode = 404;
  res.end("not found");
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { url } = request;
  if (url !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws);
  });
});

wss.on("connection", (socket) => {
  const clientMeta: ClientMeta = {
    socket,
    token: null,
    username: null,
    roomId: null,
    seat: null,
    lastPingAt: Date.now()
  };
  manager.attachClient(clientMeta);

  socket.on("message", (data) => {
    let message: ClientToServerMessage;
    try {
      message = JSON.parse(data.toString()) as ClientToServerMessage;
    } catch {
      return;
    }
    manager.handleMessage(clientMeta, message);
  });

  socket.on("close", () => {
    manager.detachClient(clientMeta);
  });
});

server.listen(PORT, () => {
  console.log(`Skill Gomoku server listening on :${PORT}`);
});

function resolveAccountsFilePath(): string {
  if (process.env.ACCOUNTS_FILE) {
    return process.env.ACCOUNTS_FILE;
  }
  const cwd = process.cwd();
  const rootCandidate = path.resolve(cwd, "server");
  if (fs.existsSync(rootCandidate)) {
    return path.resolve(rootCandidate, "data/accounts.json");
  }
  return path.resolve(cwd, "data/accounts.json");
}
