"use client";

import { useEffect, useRef, useState } from "react";
import { getLevel, worldToScreen } from "../rig";
import { CLUES, useGame } from "../store";

/** Snap a CSS length to the art-pixel grid so UI and scene share pixels. */
function snap(v: number) {
  const px = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--px")) || 1;
  return Math.round(v / px) * px;
}

export function Hud() {
  const phase = useGame((s) => s.phase);
  const clues = useGame((s) => s.clues);
  if (phase !== "play") return null;
  return (
    <div className="hud-card">
      <div className="hud-kicker">Case file 47-114</div>
      <div className="hud-title">The Larkin Job</div>
      <ul>
        {CLUES.map((c) => {
          const found = clues.includes(c.id);
          return (
            <li key={c.id} className={found ? "found" : ""}>
              <span className="box" aria-hidden>
                {found ? "■" : "□"}
              </span>
              {found ? (
                <span>
                  {c.name}
                  <em>{c.note}</em>
                </span>
              ) : (
                <span className="unknown">— unaccounted for —</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.key} className="toast">
      {toast.text}
    </div>
  );
}

export function Prompt() {
  const nearby = useGame((s) => s.nearby);
  const ref = useRef<HTMLDivElement>(null);
  const it = nearby ? getLevel().interactables.find((i) => i.id === nearby) : undefined;

  useEffect(() => {
    if (!it) return;
    let raf = 0;
    const p = { x: 0, y: 0 };
    const tick = () => {
      worldToScreen(it.pos, p);
      if (ref.current) ref.current.style.transform = `translate(${snap(p.x)}px, ${snap(p.y)}px)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [it]);

  if (!it) return null;
  return (
    <div ref={ref} className="prompt">
      <div className="prompt-inner">
        <kbd>E</kbd>
        {it.label}
      </div>
    </div>
  );
}

const CPS = 52;

export function Dialogue() {
  const d = useGame((s) => s.dialogue);
  const line = d ? d.lines[d.index] : null;
  return line ? <DialogueLine key={`${d!.index}-${line.text}`} who={line.who} text={line.text} /> : null;
}

function DialogueLine({ who, text }: { who?: string; text: string }) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;

  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setShown((n) => Math.min(text.length, n + 1)), 1000 / CPS);
    return () => clearTimeout(id);
  }, [shown, done, text]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !["KeyE", "Space", "Enter"].includes(e.code)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!done) setShown(text.length);
      else useGame.getState().advance();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [done, text]);

  return (
    <div className="dialogue" role="dialog" aria-live="polite">
      {who && <div className="speaker">{who}</div>}
      <p className={who ? "" : "narration"}>
        {text.slice(0, shown)}
        <span className="ghost">{text.slice(shown)}</span>
      </p>
      <span className={`more ${done ? "on" : ""}`} aria-hidden>
        ▼
      </span>
    </div>
  );
}

export function TitleCard() {
  const phase = useGame((s) => s.phase);
  if (phase !== "title") return null;
  return (
    <div className="title-card">
      <div className="title-inner">
        <div className="title-kicker">Case file 47-114</div>
        <h1>NOIR</h1>
        <div className="title-sub">The Larkin Job</div>
        <p className="title-blink">Press Enter</p>
        <div className="title-controls">
          <span>
            <kbd>W</kbd>
            <kbd>A</kbd>
            <kbd>S</kbd>
            <kbd>D</kbd> walk
          </span>
          <span>
            <kbd>Shift</kbd> hurry
          </span>
          <span>
            <kbd>E</kbd> examine
          </span>
        </div>
      </div>
    </div>
  );
}

export function EndCard() {
  const phase = useGame((s) => s.phase);
  if (phase !== "end") return null;
  return (
    <div className="title-card end">
      <div className="title-inner">
        <div className="title-kicker">The Larkin Job — closed for tonight</div>
        <h1 className="small">To be continued</h1>
        <div className="title-sub">Next: The Blue Orchid</div>
        <p className="title-blink">Press Enter to play again</p>
      </div>
    </div>
  );
}

export function FxPanel() {
  const fx = useGame((s) => s.fx);
  const scale = useGame((s) => s.activeScale);
  const auto = useGame((s) => s.pixelScale === null);
  const row = (key: string, label: string, on: boolean) => (
    <div className={on ? "on" : ""}>
      <kbd>{key}</kbd>
      {label}
    </div>
  );
  return (
    <div className="fx-panel">
      {row("1", "Pixels", fx.pixel)}
      {row("2", "Outlines", fx.outline)}
      {row("3", "Palette", fx.palette)}
      {row("4", "Dither", fx.dither)}
      <div className="on">
        <kbd>[</kbd>
        <kbd>]</kbd>
        {scale}× {auto ? "auto" : ""}
      </div>
    </div>
  );
}
