"use client";

import dynamic from "next/dynamic";

// WebGL + canvas-generated textures: client only.
const Game = dynamic(() => import("@/game/Game"), {
  ssr: false,
  loading: () => <div className="game-loading">Developing…</div>,
});

export default function GameShell() {
  return <Game />;
}
