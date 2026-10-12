import * as THREE from "three";
import { buildLevel, type Level } from "./level";

/**
 * Shared, non-reactive render state. React never re-renders on this; the
 * player writes the target, the pipeline reads it, the DOM prompt projects
 * through it.
 */
export const rig = {
  camera: new THREE.PerspectiveCamera(20, 16 / 9, 5, 300),
  /** Smoothed point the camera looks at. */
  focus: new THREE.Vector3(10, 0, -2),
  /** Where the camera wants to look (written by the player). */
  target: new THREE.Vector3(10, 0, -2),
  /** Camera elevation in radians. */
  pitch: THREE.MathUtils.degToRad(56),
  distance: 40,
  /** Screen pixels (device) per render-target pixel. */
  rtScale: 3,
  margin: 2,
  /** Sub-pixel camera remainder, in render-target pixels. */
  sub: new THREE.Vector2(),
  rtSize: new THREE.Vector2(1, 1),
  dpr: 1,
  cssHeight: 1,
  /** Dev aid: set to teleport Cole on the next frame. */
  warp: null as THREE.Vector3 | null,
};

const tmp = new THREE.Vector3();

/** World point → CSS pixel position on the page, matching the composite's sampling. */
export function worldToScreen(v: THREE.Vector3, out: { x: number; y: number }) {
  tmp.copy(v).project(rig.camera);
  const qx = (tmp.x * 0.5 + 0.5) * rig.rtSize.x;
  const qy = (tmp.y * 0.5 + 0.5) * rig.rtSize.y;
  const px = (qx - rig.margin - rig.sub.x) * rig.rtScale;
  const py = (qy - rig.margin - rig.sub.y) * rig.rtScale;
  out.x = px / rig.dpr;
  out.y = rig.cssHeight - py / rig.dpr;
  return tmp.z < 1;
}

let level: Level | null = null;
/** The level is built once on the client (it needs a canvas for textures). */
export function getLevel() {
  if (!level) level = buildLevel();
  return level;
}

/** Shared flicker curves so a neon light and its window glow stutter together. */
export function neonFlicker(t: number, seed = 0) {
  const s = Math.sin(t * 0.7 + seed * 3.1) + Math.sin(t * 1.9 + seed);
  const cut = s > 1.75 ? (Math.sin(t * 40) > 0 ? 0.15 : 1) : 1;
  return cut * (0.92 + 0.08 * Math.sin(t * 9 + seed));
}

export function bulbFlicker(t: number, seed = 0) {
  return 0.96 + 0.025 * Math.sin(t * 7.3 + seed * 5) + 0.015 * Math.sin(t * 13.1 + seed);
}
