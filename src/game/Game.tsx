"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Cat, Player, Smoke, Vera } from "./components/Actors";
import { Dialogue, EndCard, FxPanel, Hud, Prompt, TitleCard, Toast } from "./components/Overlay";
import { PixelRenderer } from "./components/PixelRenderer";
import { World } from "./components/World";
import { held } from "./input";
import { getLevel, rig } from "./rig";
import { INTRO, interact } from "./story";
import { useGame, type Fx } from "./store";

const FX_KEYS: Record<string, keyof Fx> = { Digit1: "pixel", Digit2: "outline", Digit3: "palette", Digit4: "dither" };

function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      held.add(e.code);
      if (e.repeat) return;
      const g = useGame.getState();

      if (FX_KEYS[e.code]) return g.toggleFx(FX_KEYS[e.code]);
      if (e.code === "BracketLeft") return g.nudgeScale(-1);
      if (e.code === "BracketRight") return g.nudgeScale(1);

      const confirm = e.code === "Enter" || e.code === "Space" || e.code === "KeyE";
      if (g.phase === "title" && confirm) {
        e.preventDefault();
        g.start();
        g.say(INTRO);
      } else if (g.phase === "end" && e.code === "Enter" && performance.now() - g.endedAt > 2500) {
        window.location.reload();
      } else if (g.phase === "play" && !g.dialogue && e.code === "KeyE" && g.nearby) {
        interact(g.nearby);
      }
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const blur = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

/** Dev-only handle for poking at the scene from the console. */
function DevHook() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __noir: unknown }).__noir = { scene, rig, level: getLevel(), game: useGame };
  }, [scene]);
  return null;
}

export default function Game() {
  useKeyboard();
  return (
    <div className="game-root">
      <Canvas
        className="game-canvas"
        shadows="basic"
        dpr={[1, 2]}
        flat
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <PixelRenderer />
        <DevHook />
        <World />
        <Player />
        <Vera />
        <Cat />
        <Smoke />
      </Canvas>
      <Hud />
      <Toast />
      <Prompt />
      <Dialogue />
      <TitleCard />
      <EndCard />
      <FxPanel />
    </div>
  );
}
