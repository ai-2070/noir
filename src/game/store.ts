import { create } from "zustand";

export type ClueId = "matchbook" | "calendar" | "ledger" | "photo";

export const CLUES: { id: ClueId; name: string; note: string }[] = [
  { id: "matchbook", name: "Blue Orchid matchbook", note: "Thurs — back room — 2 AM" },
  { id: "calendar", name: "A circled date", note: "10 · 14 · 47" },
  { id: "ledger", name: "Torn ledger page", note: "Fridays, to R.M." },
  { id: "photo", name: "Larkin's last roll", note: "A handshake under an awning" },
];

export interface Line {
  who?: string;
  text: string;
}

export interface Fx {
  pixel: boolean;
  outline: boolean;
  palette: boolean;
  dither: boolean;
}

interface Dialogue {
  lines: Line[];
  index: number;
  then?: () => void;
}

interface GameState {
  phase: "title" | "play" | "end";
  /** performance.now() when the end card appeared (guards against mashed keys). */
  endedAt: number;
  clues: ClueId[];
  flags: Record<string, boolean>;
  dialogue: Dialogue | null;
  nearby: string | null;
  toast: { text: string; key: number } | null;
  fx: Fx;
  /** Screen pixels per art pixel. null = fit to window height. */
  pixelScale: number | null;
  /** The scale actually in use (written by the renderer). */
  activeScale: number;

  start: () => void;
  finish: () => void;
  say: (lines: Line[], then?: () => void) => void;
  advance: () => void;
  setNearby: (id: string | null) => void;
  addClue: (id: ClueId) => void;
  setFlag: (k: string) => void;
  toggleFx: (k: keyof Fx) => void;
  nudgeScale: (d: number) => void;
  setActiveScale: (s: number) => void;
}

export const useGame = create<GameState>()((set, get) => ({
  phase: "title",
  endedAt: 0,
  clues: [],
  flags: {},
  dialogue: null,
  nearby: null,
  toast: null,
  fx: { pixel: true, outline: true, palette: true, dither: true },
  pixelScale: null,
  activeScale: 3,

  start: () => set({ phase: "play" }),
  finish: () => set({ phase: "end", dialogue: null, nearby: null, endedAt: performance.now() }),

  say: (lines, then) => set({ dialogue: { lines, index: 0, then } }),

  advance: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.index < d.lines.length - 1) {
      set({ dialogue: { ...d, index: d.index + 1 } });
    } else {
      set({ dialogue: null });
      d.then?.();
    }
  },

  setNearby: (id) => {
    if (get().nearby !== id) set({ nearby: id });
  },

  addClue: (id) => {
    if (get().clues.includes(id)) return;
    const name = CLUES.find((c) => c.id === id)?.name ?? id;
    set((s) => ({ clues: [...s.clues, id], toast: { text: `Logged: ${name}`, key: Date.now() } }));
  },

  setFlag: (k) => set((s) => ({ flags: { ...s.flags, [k]: true } })),

  toggleFx: (k) => set((s) => ({ fx: { ...s.fx, [k]: !s.fx[k] } })),

  nudgeScale: (d) => {
    const cur = get().pixelScale ?? get().activeScale;
    set({ pixelScale: Math.min(8, Math.max(1, cur + d)) });
  },

  setActiveScale: (s) => {
    if (get().activeScale !== s) set({ activeScale: s });
  },
}));
