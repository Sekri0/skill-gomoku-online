import type { ConnectionStatus } from "../core/types";
import type { ClientToServerMessage, ServerToClientMessage } from "./protocol";
import { isServerMessage } from "./protocol";

type MessageHandler = (message: ServerToClientMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export class NetClient {
  private socket: WebSocket | null = null;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = "idle";
  private url = "";
  private shouldReconnect = true;
  private retryCount = 0;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private lastPongAt = 0;

  async connect(url: string): Promise<void> {
    this.url = url;
    this.shouldReconnect = true;
    await this.openSocket(this.retryCount > 0 ? "reconnecting" : "connecting");
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.close();
      this.socket = null;
    }
    this.emitStatus("closed");
  }

  send(message: ClientToServerMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("socket is not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.status);
    return () => this.statusHandlers.delete(handler);
  }

  private openSocket(status: ConnectionStatus): Promise<void> {
    this.emitStatus(status);
    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(this.url);
        this.socket = socket;

        socket.onopen = () => {
          this.retryCount = 0;
          this.lastPongAt = Date.now();
          this.startHeartbeat();
          this.emitStatus("connected");
          resolve();
        };

        socket.onmessage = (ev) => {
          let payload: unknown = null;
          try {
            payload = JSON.parse(ev.data as string);
          } catch {
            return;
          }

          if (!isServerMessage(payload)) {
            return;
          }
          if (payload.type === "pong") {
            this.lastPongAt = Date.now();
          }
          for (const handler of this.messageHandlers) {
            handler(payload);
          }
        };

        socket.onclose = () => {
          this.clearHeartbeat();
          this.socket = null;
          if (!this.shouldReconnect) {
            this.emitStatus("closed");
            return;
          }
          this.scheduleReconnect();
        };

        socket.onerror = () => {
          this.emitStatus("error");
          reject(new Error("websocket error"));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }
    this.clearReconnectTimer();
    this.retryCount += 1;
    const delay = Math.min(1000 * 2 ** (this.retryCount - 1), 8000);
    this.emitStatus("reconnecting");
    this.reconnectTimer = window.setTimeout(() => {
      void this.openSocket("reconnecting").catch(() => {
        this.scheduleReconnect();
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.pingTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
      }
      if (Date.now() - this.lastPongAt > 30000) {
        this.socket.close();
        return;
      }
      this.socket.send(JSON.stringify({ type: "ping" } satisfies ClientToServerMessage));
    }, 10000);
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearHeartbeat();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearHeartbeat(): void {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private emitStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}
