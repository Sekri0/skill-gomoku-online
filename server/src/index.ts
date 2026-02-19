import { createServer } from "http";
import { WebSocketServer } from "ws";
import { RoomManager } from "./roomManager";
import type { ClientToServerMessage } from "../../src/net/protocol";
import type { ClientMeta } from "./types";

const PORT = Number(process.env.PORT || 8080);
const manager = new RoomManager();

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
  let clientMeta: ClientMeta | null = null;

  socket.on("message", (data) => {
    let message: ClientToServerMessage;
    try {
      message = JSON.parse(data.toString()) as ClientToServerMessage;
    } catch {
      return;
    }

    if (!clientMeta) {
      if (message.type !== "joinRoom") {
        socket.send(
          JSON.stringify({
            type: "error",
            code: "INVALID_ACTION",
            message: "\u8bf7\u5148\u52a0\u5165\u623f\u95f4"
          })
        );
        return;
      }

      const result = manager.handleJoin(
        socket,
        message.roomId,
        message.playerName,
        message.sessionId
      );
      if ("code" in result) {
        socket.send(JSON.stringify({ type: "error", code: result.code, message: result.message }));
        return;
      }
      clientMeta = result;
      manager.publishJoinSuccess(clientMeta);
      return;
    }

    manager.handleMessage(clientMeta, message);
  });

  socket.on("close", () => {
    if (clientMeta) {
      manager.handleDisconnect(clientMeta);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Skill Gomoku server listening on :${PORT}`);
});
