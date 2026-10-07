// One shared store for the replay page (Zustand).
//
// React components subscribe to the slices they show (e.g. the play button
// reads `latest.playing`) and re-render only when that slice changes. The
// canvas does NOT subscribe: it reads the store with getState() inside its
// own animation loop, 60 times a second, without involving React at all.
import { create } from "zustand";
import { replaySocketUrl } from "./api";
import { applyFrame, emptyBuffer, expectAck, type FrameBuffer } from "./frameBuffer";
import { ReplaySocket, type ConnectionState } from "./replaySocket";
import type { Command, Hello } from "./types";

/** Where a fresh connection starts (a reconnect resumes from the latest frame instead). */
export interface StartOptions {
  t?: number;
  speed?: number;
  autoplay?: boolean;
}

interface ReplayStore {
  connection: ConnectionState | "idle";
  connectionDetail: string;
  hello: Hello | null;
  buffer: FrameBuffer;
  socket: ReplaySocket | null;
  connect: (year: number, round: number, start?: StartOptions) => void;
  disconnect: () => void;
  send: (command: Command) => void;
}

export const useReplayStore = create<ReplayStore>((set, get) => ({
  connection: "idle",
  connectionDetail: "",
  hello: null,
  buffer: emptyBuffer,
  socket: null,

  connect(year, round, start = {}) {
    get().socket?.close();
    set({ buffer: emptyBuffer, hello: null });
    const socket = new ReplaySocket(
      () => {
        // On a reconnect, carry on from where we were, at the same speed.
        const latest = get().buffer.latest;
        return replaySocketUrl(year, round, {
          t: latest?.t ?? start.t ?? 0,
          speed: latest?.speed ?? start.speed ?? 1,
          autoplay: latest?.playing ?? start.autoplay ?? true,
        });
      },
      {
        onHello: (hello) => set({ hello }),
        onFrame: (frame) => set({ buffer: applyFrame(get().buffer, frame, performance.now()) }),
        onState: (connection, detail = "") => set({ connection, connectionDetail: detail }),
      },
    );
    set({ socket });
    socket.connect();
  },

  disconnect() {
    get().socket?.close();
    set({ socket: null, connection: "idle" });
  },

  send(command) {
    const id = get().socket?.send(command);
    if (id != null) set({ buffer: expectAck(get().buffer, id, performance.now()) });
  },
}));
