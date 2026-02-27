import { GatewayFrame, ConnectionStatus } from "@/types";

type EventHandler = (event: string, data: unknown) => void;
type StatusHandler = (status: ConnectionStatus) => void;

export class GatewayClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private requestId = 0;
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private eventHandlers = new Set<EventHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 800;
  private _status: ConnectionStatus = "disconnected";
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(s: ConnectionStatus) {
    this._status = s;
    this.statusHandlers.forEach((h) => h(s));
  }

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  connect(): void {
    if (this.ws) return;
    this.shouldReconnect = true;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setStatus("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectDelay = 800;
      this.send("connect", {
        token: this.token,
        clientId: "optaplus-web",
        capabilities: ["chat", "cron", "config", "control"],
      }).then(() => {
        this.setStatus("connected");
        this.startPing();
      }).catch(() => {
        this.setStatus("error");
      });
    };

    this.ws.onmessage = (ev) => {
      try {
        const frame: GatewayFrame = JSON.parse(ev.data as string);
        if (frame.type === "res" && frame.id) {
          const p = this.pending.get(frame.id);
          if (p) {
            this.pending.delete(frame.id);
            if (frame.ok) p.resolve(frame.data);
            else p.reject(new Error(frame.error ?? "Unknown error"));
          }
        } else if (frame.type === "event") {
          this.eventHandlers.forEach((h) => h(frame.event!, frame.data));
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.setStatus("disconnected");
      if (this.shouldReconnect) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.cleanup();
      this.setStatus("error");
      if (this.shouldReconnect) this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.cleanup();
    this.ws?.close();
    this.ws = null;
    this.setStatus("disconnected");
  }

  async send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }
      const id = String(++this.requestId);
      const frame: GatewayFrame = { type: "req", id, method, params };
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(frame));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);
    });
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.pending.forEach((p) => p.reject(new Error("Connection closed")));
    this.pending.clear();
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send("ping").catch(() => {});
    }, 30000);
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const jitter = this.reconnectDelay * (0.8 + Math.random() * 0.4);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ws = null;
      this.connect();
    }, jitter);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 15000);
  }
}
