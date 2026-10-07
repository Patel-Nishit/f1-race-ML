// The browser end of the replay WebSocket, with automatic reconnects.
import { decodeFrame } from "./protocol";
import type { Command, Frame, Hello, WireFrame } from "./types";

export type ConnectionState = "connecting" | "open" | "reconnecting" | "closed" | "failed";

interface Handlers {
  onHello: (hello: Hello) => void;
  onFrame: (frame: Frame) => void;
  onState: (state: ConnectionState, detail?: string) => void;
}

const MAX_BACKOFF_MS = 5000;

export class ReplaySocket {
  private ws: WebSocket | null = null;
  private fields: string[] = [];
  private attempts = 0;
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;

  /** makeUrl is called on every (re)connect, so it can resume from the latest time. */
  constructor(private makeUrl: () => string, private handlers: Handlers) {}

  connect() {
    this.stopped = false;
    this.handlers.onState(this.attempts === 0 ? "connecting" : "reconnecting");
    const ws = new WebSocket(this.makeUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.handlers.onState("open");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "hello") {
        this.fields = message.driver_fields;
        this.handlers.onHello(message as Hello);
      } else if (message.type === "frame") {
        this.handlers.onFrame(decodeFrame(message as WireFrame, this.fields));
      } else if (message.type === "error") {
        console.warn("Replay server:", message.message);
      }
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return; // an old socket we already replaced
      if (this.stopped) return this.handlers.onState("closed");
      if (event.code === 4404) return this.handlers.onState("failed", "This race isn't prepared.");
      // Exponential backoff: 0.5 s, 1 s, 2 s, 4 s, then every 5 s. Retrying
      // instantly in a loop would hammer a server that's restarting.
      const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempts++);
      this.handlers.onState("reconnecting", `retrying in ${(delay / 1000).toFixed(1)}s`);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  /** Sends a command; returns its id (the server echoes it back as `ack`). */
  send(command: Command): number | null {
    if (this.ws?.readyState !== WebSocket.OPEN) return null;
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ ...command, id }));
    return id;
  }

  close() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
  }
}
