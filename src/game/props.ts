import * as THREE from "three";
import type { Kit } from "./kit";
import { glow, toon } from "./materials";
import { C } from "./palette";
import {
  booksTexture,
  clockTexture,
  doorGlassTexture,
  grainTexture,
  matchbookTexture,
  paperTexture,
  photoTexture,
  signTexture,
  typewriterTexture,
} from "./textures";

/**
 * Prop library. Every prop is authored in its own frame: origin on the floor
 * at the centre of its footprint, "front" facing +Z (toward the camera).
 * Callers place them with kit.push(x, y, z, rotY) … kit.pop().
 */

const wood = {
  dark: () => toon("#ffffff", { map: grainTexture("dark") }),
  mid: () => toon("#ffffff", { map: grainTexture("mid") }),
  light: () => toon("#ffffff", { map: grainTexture("light") }),
};
const G = (u = 1.5): [number, number] => [u, u];

export const M = {
  ink: () => toon(C.ink2),
  iron: () => toon(C.ink3),
  ironLt: () => toon(C.ink4),
  steel: () => toon(C.grey1),
  steelLt: () => toon(C.grey2),
  brass: () => toon(C.brass2),
  brassDk: () => toon(C.brass1),
  paper: () => toon(C.grey5),
  bone: () => toon(C.grey4),
  leather: () => toon(C.red2),
  leatherDk: () => toon(C.red1),
  green: () => toon(C.green3),
  manila: () => toon(C.wood7),
};

// ---------------------------------------------------------------------------
// Office
// ---------------------------------------------------------------------------

export function executiveDesk(k: Kit, w = 5, d = 2.4) {
  const top = wood.dark();
  const body = wood.mid();
  k.box(w + 0.2, 0.16, d + 0.2, 0, 1.4, 0, top, { worldUV: G() });
  k.box(w + 0.1, 0.06, d + 0.1, 0, 1.34, 0, toon(C.wood1));
  const pw = 1.5;
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - pw / 2);
    k.box(pw, 1.34, d - 0.1, x, 0, 0, body, { worldUV: G() });
    // front (camera side) raised panel
    k.box(pw - 0.3, 0.9, 0.04, x, 0.22, d / 2 - 0.03, top, { worldUV: G() });
    // drawers on the sitter's side
    for (let i = 0; i < 3; i++) {
      k.box(pw - 0.2, 0.36, 0.05, x, 0.1 + i * 0.42, -d / 2 + 0.03, top, { worldUV: G() });
      k.box(0.24, 0.05, 0.06, x, 0.26 + i * 0.42, -d / 2, M.brass());
    }
    k.box(pw + 0.04, 0.1, d - 0.05, x, 0, 0, toon(C.wood1));
  }
  // modesty panel
  k.box(w - pw * 2, 0.95, 0.08, 0, 0.4, d / 2 - 0.25, body, { worldUV: G() });
  k.collide(0, 0, w + 0.2, d + 0.2);
}

/** Green-glass banker's lamp. Returns the local bulb position. */
export function bankerLamp(k: Kit) {
  k.box(0.6, 0.06, 0.34, 0, 0, 0, M.brass());
  k.box(0.5, 0.04, 0.26, 0, 0.06, 0, M.brassDk());
  k.cyl(0.035, 0.035, 0.62, 0, 0.08, -0.06, M.brass(), 6);
  const shade = new THREE.CylinderGeometry(0.2, 0.26, 0.9, 10, 1, true, 0, Math.PI);
  k.add(shade, 0, 0.72, 0.02, toon(C.green4, { emissive: C.green1, side: THREE.DoubleSide }), { rot: [0, 0, Math.PI / 2] });
  // end caps of the shade
  k.box(0.04, 0.22, 0.46, -0.46, 0.68, 0.02, M.brass());
  k.box(0.04, 0.22, 0.46, 0.46, 0.68, 0.02, M.brass());
  k.box(0.5, 0.06, 0.06, 0, 0.66, 0.02, glow(C.light, 2.6), { cast: false });
  k.cyl(0.015, 0.015, 0.2, 0.18, 0.48, 0.16, M.brass(), 4); // pull chain
  return new THREE.Vector3(0, 0.56, 0.06);
}

export function typewriter(k: Kit) {
  k.box(0.95, 0.22, 0.75, 0, 0, 0, M.ink());
  k.box(0.85, 0.02, 0.4, 0, 0.22, 0.15, toon("#ffffff", { map: typewriterTexture() }), { rot: [0.18, 0, 0] });
  k.box(1.05, 0.16, 0.24, 0, 0.22, -0.22, M.iron());
  k.add(new THREE.CylinderGeometry(0.08, 0.08, 1.15, 8), 0, 0.42, -0.22, M.ink(), { rot: [0, 0, Math.PI / 2] });
  k.box(0.08, 0.06, 0.06, 0.62, 0.4, -0.22, M.steelLt());
  // sheet in the roller
  k.add(new THREE.BoxGeometry(0.58, 0.6, 0.01), 0, 0.68, -0.28, toon("#ffffff", { map: paperTexture(3) }), { rot: [-0.18, 0, 0] });
}

export function candlestickPhone(k: Kit) {
  k.cyl(0.14, 0.17, 0.06, 0, 0, 0, M.ink(), 10);
  k.cyl(0.03, 0.035, 0.5, 0, 0.06, 0, M.ink(), 6);
  k.add(new THREE.CylinderGeometry(0.09, 0.04, 0.12, 8), 0, 0.6, 0.04, M.ink(), { rot: [-0.9, 0, 0] });
  // earpiece on its hook
  k.box(0.08, 0.03, 0.03, 0.06, 0.48, 0, M.steelLt());
  k.cyl(0.05, 0.04, 0.22, 0.12, 0.3, 0.02, M.ink(), 6);
  k.add(new THREE.TorusGeometry(0.13, 0.012, 3, 10, Math.PI), 0.1, 0.2, -0.04, M.ink(), { rot: [0, Math.PI / 2, 0], cast: false });
}

export function bottle(k: Kit, color: string = C.brass1) {
  k.cyl(0.12, 0.12, 0.42, 0, 0, 0, toon(color, { emissive: C.red0 }), 8);
  k.cyl(0.05, 0.1, 0.1, 0, 0.42, 0, toon(color), 8);
  k.cyl(0.04, 0.04, 0.12, 0, 0.52, 0, toon(color), 6);
  k.cyl(0.045, 0.045, 0.05, 0, 0.64, 0, M.ink(), 6);
  k.panel(0.16, 0.16, 0, 0.2, 0.125, M.paper());
}

export function tumbler(k: Kit) {
  k.cyl(0.08, 0.07, 0.16, 0, 0, 0, toon(C.blue4), 8);
  k.cyl(0.06, 0.06, 0.08, 0, 0.02, 0, toon(C.brass1), 8);
}

/** Returns the local position of the cigarette tip (for smoke). */
export function ashtray(k: Kit) {
  k.cyl(0.2, 0.18, 0.06, 0, 0, 0, M.steelLt(), 10);
  k.cyl(0.14, 0.14, 0.01, 0, 0.06, 0, toon(C.grey0), 10);
  k.box(0.26, 0.035, 0.035, 0.12, 0.08, 0.02, M.paper(), { rot: [0, 0.4, 0] });
  k.box(0.04, 0.036, 0.036, 0.24, 0.08, -0.03, glow(C.red5, 2.2), { cast: false });
  // butts
  k.box(0.08, 0.03, 0.03, -0.05, 0.07, -0.04, toon(C.wood6), { rot: [0, 1.1, 0] });
  k.box(0.07, 0.03, 0.03, -0.02, 0.07, 0.06, toon(C.wood6), { rot: [0, -0.5, 0] });
  return new THREE.Vector3(0.24, 0.12, -0.03);
}

export function matchbook(k: Kit) {
  k.box(0.26, 0.03, 0.17, 0, 0, 0, toon("#ffffff", { map: matchbookTexture() }), { rot: [0, 0.3, 0] });
}

export function paperStack(k: Kit, seed: number) {
  k.box(0.7, 0.1, 0.5, 0, 0, 0, M.manila(), { rot: [0, 0.08, 0] });
  k.box(0.68, 0.08, 0.48, 0.02, 0.1, 0.01, M.paper(), { rot: [0, -0.1, 0] });
  k.decal(0.5, 0.62, 0.0, 0.19, 0, toon("#ffffff", { map: paperTexture(seed) }), { rot: [0, 0, 0.12] });
}

export function nameplate(k: Kit, text: string) {
  const tex = signTexture(text, C.brass3, C.ink2);
  const img = tex.image as HTMLCanvasElement;
  const w = img.width / 16;
  const h = img.height / 16;
  k.box(w + 0.06, 0.06, 0.24, 0, 0, 0, M.brassDk());
  k.add(new THREE.PlaneGeometry(w, h), 0, 0.06 + h / 2 - 0.02, 0.04, toon("#ffffff", { map: tex }), { rot: [-0.35, 0, 0], cast: false });
  k.add(new THREE.BoxGeometry(w, h, 0.03), 0, 0.06 + h / 2 - 0.02, 0.0, M.ink(), { rot: [-0.35, 0, 0] });
}

export function clientChair(k: Kit) {
  const m = wood.mid();
  k.box(1.1, 0.14, 1.05, 0, 0.86, 0, m, { worldUV: G() });
  k.box(1.0, 0.08, 0.95, 0, 0.98, 0, M.leather());
  for (const [x, z] of [[-0.45, -0.42], [0.45, -0.42], [-0.45, 0.42], [0.45, 0.42]]) k.box(0.12, 0.86, 0.12, x, 0, z, m);
  for (const x of [-0.45, 0.45]) k.box(0.12, 1.3, 0.12, x, 1.0, -0.44, m);
  k.box(1.02, 0.42, 0.08, 0, 1.75, -0.44, m, { worldUV: G() });
  k.box(1.02, 0.08, 0.08, 0, 1.3, -0.44, m);
  k.collide(0, 0, 1.1, 1.05);
}

export function swivelChair(k: Kit) {
  const l = M.leather();
  k.cyl(0.08, 0.08, 0.6, 0, 0.2, 0, M.steelLt(), 6);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    k.box(0.08, 0.08, 0.6, Math.sin(a) * 0.28, 0.14, Math.cos(a) * 0.28, M.iron(), { rot: [0, a, 0] });
    k.box(0.12, 0.14, 0.12, Math.sin(a) * 0.58, 0, Math.cos(a) * 0.58, M.ink());
  }
  k.box(1.3, 0.3, 1.2, 0, 0.8, 0, l);
  k.box(1.3, 0.06, 1.2, 0, 0.8, 0, M.leatherDk());
  k.box(1.36, 1.5, 0.3, 0, 1.0, -0.56, l);
  k.box(1.2, 0.08, 0.26, 0, 2.45, -0.56, M.leatherDk());
  for (const s of [-1, 1]) {
    k.box(0.16, 0.5, 1.0, s * 0.7, 1.0, -0.05, M.leatherDk());
    for (let i = 0; i < 4; i++) k.box(0.04, 0.04, 0.02, s * 0.6, 2.2 - i * 0.35, -0.4, M.brass(), { cast: false });
  }
  k.collide(0, 0, 1.3, 1.3);
}

export function filingCabinet(k: Kit) {
  const w = 1.15;
  const h = 2.7;
  const d = 1.2;
  k.box(w, h, d, 0, 0, 0, M.steel());
  k.box(w + 0.04, 0.06, d + 0.04, 0, h, 0, M.steelLt());
  for (let i = 0; i < 4; i++) {
    const y = 0.15 + i * 0.63;
    k.box(w - 0.12, 0.55, 0.05, 0, y, d / 2, M.steelLt());
    k.box(0.36, 0.06, 0.08, 0, y + 0.18, d / 2 + 0.04, M.brass());
    k.box(0.24, 0.12, 0.02, 0, y + 0.34, d / 2 + 0.03, M.paper(), { cast: false });
  }
  k.box(w, 0.12, d, 0, 0, 0, toon(C.ink2));
  k.collide(0, 0, w, d);
}

export function coatRack(k: Kit) {
  const m = wood.dark();
  k.box(1.3, 0.12, 0.16, 0, 0, 0, m);
  k.box(0.16, 0.12, 1.3, 0, 0, 0, m);
  k.cyl(0.06, 0.07, 3.3, 0, 0.1, 0, m, 6);
  k.sphere(0.1, 0, 3.45, 0, m);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    k.box(0.05, 0.05, 0.4, Math.sin(a) * 0.18, 3.1, Math.cos(a) * 0.18, M.brass(), { rot: [0.5, a, 0] });
  }
  // a fedora on the top hook
  k.cyl(0.42, 0.42, 0.04, 0.12, 3.22, 0.22, M.iron(), 12, { rot: [0.25, 0, 0] });
  k.cyl(0.24, 0.28, 0.32, 0.12, 3.24, 0.2, M.iron(), 10, { rot: [0.25, 0, 0] });
  k.cyl(0.285, 0.285, 0.07, 0.12, 3.26, 0.2, toon(C.ink1), 10, { rot: [0.25, 0, 0] });
  // Larkin's scarf
  k.box(0.22, 1.4, 0.05, -0.2, 1.75, 0.12, toon(C.red3), { rot: [0, 0, 0.1] });
  k.box(0.22, 1.1, 0.05, -0.02, 1.95, 0.15, toon(C.red2), { rot: [0, 0, -0.06] });
  k.collide(0, 0, 0.9, 0.9);
}

export function bookshelf(k: Kit, w: number, h: number, d: number, seed: number) {
  const m = wood.dark();
  k.box(w, h, 0.1, 0, 0, -d / 2 + 0.05, toon(C.wood1));
  k.box(0.14, h, d, -w / 2 + 0.07, 0, 0, m, { worldUV: G() });
  k.box(0.14, h, d, w / 2 - 0.07, 0, 0, m, { worldUV: G() });
  k.box(w + 0.16, 0.14, d + 0.08, 0, h, 0, m, { worldUV: G() });
  k.box(w, 0.3, d, 0, 0, 0, m, { worldUV: G() });
  const shelves = 4;
  const gap = (h - 0.3) / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = 0.3 + i * gap;
    if (i > 0) k.box(w - 0.2, 0.08, d - 0.1, 0, y - 0.08, 0, m);
    const bh = gap * 0.72;
    const bw = w - 0.34;
    if (seed % 3 === i % 3) {
      // a gap with a few leaning volumes and a bookend
      k.box(bw * 0.55, bh, d * 0.6, -bw * 0.2, y, 0, M.bone());
      k.panel(bw * 0.55, bh, -bw * 0.2, y + bh / 2, d * 0.3 + 0.01, toon("#ffffff", { map: booksTexture(bw * 0.55, bh, seed + i) }));
      k.box(0.12, bh * 0.6, d * 0.5, bw * 0.15, y, 0, M.brass());
      k.box(0.3, 0.24, 0.3, bw * 0.35, y, 0, M.iron());
    } else {
      k.box(bw, bh, d * 0.6, 0, y, 0, M.bone());
      k.panel(bw, bh, 0, y + bh / 2, d * 0.3 + 0.01, toon("#ffffff", { map: booksTexture(bw, bh, seed + i) }));
    }
  }
  k.collide(0, 0, w, d);
}

export function safe(k: Kit) {
  const w = 1.7;
  const h = 1.95;
  const d = 1.5;
  for (const [x, z] of [[-0.65, -0.55], [0.65, -0.55], [-0.65, 0.55], [0.65, 0.55]]) k.box(0.2, 0.14, 0.2, x, 0, z, M.ink());
  k.box(w, h, d, 0, 0.14, 0, M.iron());
  k.box(w - 0.24, h - 0.3, 0.06, 0, 0.29, d / 2, M.ironLt());
  k.box(w - 0.4, 0.04, 0.02, 0, h - 0.1, d / 2 + 0.03, M.brassDk(), { cast: false });
  k.add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12), -0.15, 1.2, d / 2 + 0.07, M.brass(), { rot: [Math.PI / 2, 0, 0] });
  k.add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 8), -0.15, 1.2, d / 2 + 0.13, M.ink(), { rot: [Math.PI / 2, 0, 0] });
  k.box(0.06, 0.4, 0.08, 0.35, 0.95, d / 2 + 0.06, M.steelLt());
  k.box(0.3, 0.06, 0.08, 0.45, 1.13, d / 2 + 0.08, M.steelLt());
  k.collide(0, 0, w, d);
}

export function armchair(k: Kit) {
  const l = toon(C.red2);
  const ld = toon(C.red1);
  for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) k.box(0.14, 0.3, 0.14, x, 0, z, wood.dark());
  k.box(1.7, 0.55, 1.5, 0, 0.3, 0, ld);
  k.box(1.25, 0.25, 1.25, 0, 0.85, 0.08, l);
  k.box(1.7, 1.55, 0.36, 0, 0.85, -0.6, l);
  k.box(1.5, 0.25, 0.3, 0, 2.3, -0.6, ld);
  for (const s of [-1, 1]) {
    k.box(0.26, 0.6, 1.45, s * 0.74, 0.85, 0.02, l);
    k.box(0.3, 0.12, 1.5, s * 0.74, 1.45, 0.02, ld);
    for (let i = 0; i < 4; i++) k.box(0.03, 0.03, 0.02, s * 0.88, 1.38, 0.5 - i * 0.3, M.brass(), { cast: false });
  }
  k.collide(0, 0, 1.75, 1.5);
}

/** Returns the bulb position. */
export function floorLamp(k: Kit) {
  k.cyl(0.36, 0.42, 0.1, 0, 0, 0, M.brassDk(), 10);
  k.cyl(0.04, 0.04, 3.0, 0, 0.1, 0, M.brass(), 6);
  k.cyl(0.32, 0.6, 0.75, 0, 3.0, 0, toon(C.skin0, { emissive: C.brass1, emissiveIntensity: 0.9, side: THREE.DoubleSide }), 10);
  k.cyl(0.33, 0.33, 0.04, 0, 3.72, 0, M.brassDk(), 10);
  k.cyl(0.61, 0.61, 0.04, 0, 2.99, 0, M.brassDk(), 10);
  k.collide(0, 0, 0.7, 0.7);
  return new THREE.Vector3(0, 3.1, 0);
}

export function sideTable(k: Kit) {
  const m = wood.mid();
  k.cyl(0.62, 0.62, 0.1, 0, 1.25, 0, m, 12, { worldUV: G() });
  k.cyl(0.07, 0.09, 1.25, 0, 0, 0, m, 6);
  k.cyl(0.4, 0.45, 0.08, 0, 0, 0, m, 10);
  k.collide(0, 0, 1.1, 1.1);
}

export function radio(k: Kit) {
  const m = wood.light();
  k.box(0.95, 0.62, 0.5, 0, 0, 0, m, { worldUV: G(1) });
  k.add(new THREE.CylinderGeometry(0.475, 0.475, 0.5, 12, 1, false, 0, Math.PI), 0, 0.62, 0, m, { rot: [Math.PI / 2, Math.PI / 2, 0] });
  k.box(0.6, 0.5, 0.04, 0, 0.12, 0.25, toon(C.wood2));
  for (let i = 0; i < 4; i++) k.box(0.56, 0.03, 0.05, 0, 0.2 + i * 0.1, 0.26, M.brassDk(), { cast: false });
  k.box(0.22, 0.08, 0.05, 0, 0.75, 0.27, glow(C.brass3, 1.3), { cast: false });
  for (const x of [-0.3, 0.3]) k.add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), x, 0.05, 0.27, M.brass(), { rot: [Math.PI / 2, 0, 0] });
}

export function radiator(k: Kit, w: number) {
  const m = toon(C.grey3);
  const n = Math.floor(w / 0.2);
  for (let i = 0; i < n; i++) k.box(0.12, 1.1, 0.34, -w / 2 + 0.1 + i * 0.2, 0.15, 0, m);
  k.box(w, 0.1, 0.12, 0, 0.2, 0, toon(C.grey2));
  k.box(w, 0.1, 0.12, 0, 1.1, 0, toon(C.grey2));
  k.box(0.1, 0.15, 0.1, -w / 2 + 0.1, 0, 0, toon(C.grey2));
  k.box(0.1, 0.15, 0.1, w / 2 - 0.1, 0, 0, toon(C.grey2));
  k.collide(0, 0, w, 0.5);
}

// ---------------------------------------------------------------------------
// Reception
// ---------------------------------------------------------------------------

export function receptionDesk(k: Kit) {
  const w = 4.2;
  const d = 2;
  const m = wood.mid();
  k.box(w + 0.2, 0.14, d + 0.2, 0, 1.36, 0, wood.dark(), { worldUV: G() });
  k.box(w, 1.36, d - 0.2, 0, 0, -0.05, m, { worldUV: G() });
  // reeded front, art-deco
  for (let i = 0; i < 13; i++) k.box(0.18, 1.2, 0.06, -w / 2 + 0.3 + i * 0.3, 0.08, d / 2 - 0.12, i % 2 ? m : wood.dark(), { worldUV: G() });
  k.box(w + 0.08, 0.08, 0.1, 0, 0, d / 2 - 0.1, toon(C.wood1));
  k.box(w + 0.1, 0.06, 0.12, 0, 1.28, d / 2 - 0.08, M.brass());
  k.collide(0, 0, w + 0.2, d + 0.2);
}

/** Small brass desk lamp with a cream shade. Returns bulb position. */
export function deskLamp(k: Kit) {
  k.cyl(0.18, 0.22, 0.06, 0, 0, 0, M.brass(), 8);
  k.cyl(0.03, 0.03, 0.7, 0, 0.06, 0, M.brass(), 6);
  k.cyl(0.18, 0.34, 0.36, 0, 0.62, 0, toon(C.grey5, { emissive: C.brass1, emissiveIntensity: 0.8, side: THREE.DoubleSide }), 10);
  return new THREE.Vector3(0, 0.62, 0);
}

export function vase(k: Kit) {
  k.cyl(0.09, 0.13, 0.36, 0, 0, 0, toon(C.blue2), 8);
  k.cyl(0.015, 0.015, 0.5, 0.02, 0.3, 0, toon(C.green3), 4, { cast: false });
  k.sphere(0.1, 0.02, 0.86, 0, toon(C.red4), { squash: [1, 0.8, 1] });
  k.sphere(0.07, -0.08, 0.76, 0.04, toon(C.green4), { squash: [1.4, 0.5, 1] });
}

export function inbox(k: Kit) {
  k.box(0.6, 0.06, 0.45, 0, 0, 0, M.steel());
  k.box(0.56, 0.12, 0.42, 0, 0.06, 0, M.paper());
  k.box(0.6, 0.04, 0.45, 0, 0.26, 0, M.steel());
  for (const x of [-0.28, 0.28]) k.box(0.03, 0.26, 0.03, x, 0, 0.2, M.steel());
}

export function waterCooler(k: Kit) {
  k.box(0.85, 1.5, 0.8, 0, 0, 0, toon(C.grey5));
  k.box(0.85, 0.12, 0.8, 0, 0, 0, toon(C.grey2));
  k.box(0.5, 0.08, 0.1, 0, 1.1, 0.42, M.steelLt());
  k.box(0.08, 0.12, 0.08, -0.1, 1.18, 0.44, toon(C.blue1));
  k.cyl(0.36, 0.36, 0.85, 0, 1.55, 0, toon(C.blue3, { emissive: C.blue0 }), 10);
  k.cyl(0.28, 0.36, 0.14, 0, 2.4, 0, toon(C.blue3), 10);
  k.cyl(0.1, 0.1, 0.08, 0, 1.5, 0, toon(C.blue2), 8);
  // the cup dispenser
  k.cyl(0.08, 0.08, 0.5, 0.48, 0.6, 0.0, toon(C.grey6), 8);
  k.collide(0, 0, 0.9, 0.9);
}

export function pottedPlant(k: Kit, seed = 1) {
  k.cyl(0.46, 0.34, 0.8, 0, 0, 0, toon(C.red3), 10);
  k.cyl(0.5, 0.5, 0.1, 0, 0.75, 0, toon(C.red2), 10);
  k.cyl(0.42, 0.42, 0.02, 0, 0.82, 0, toon(C.wood1), 10);
  k.cyl(0.05, 0.08, 1.3, 0.02, 0.8, 0, toon(C.wood3), 5);
  const leaves = [C.green2, C.green3, C.green4, C.green3, C.green5];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + seed;
    const r = 0.25 + (i % 3) * 0.12;
    const y = 1.5 + (i % 4) * 0.28;
    k.sphere(0.32 + (i % 2) * 0.08, Math.cos(a) * r, y, Math.sin(a) * r, toon(leaves[i % leaves.length]), { squash: [1.3, 0.55, 1] });
  }
  k.collide(0, 0, 0.9, 0.9);
}

export function bench(k: Kit, w = 2.6) {
  const m = wood.mid();
  for (let i = 0; i < 4; i++) k.box(w, 0.08, 0.2, 0, 0.9, -0.35 + i * 0.24, m, { worldUV: G() });
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
    k.box(0.12, 0.9, 0.9, x, 0, 0, M.iron());
    k.box(0.12, 1.2, 0.1, x, 0.95, -0.4, M.iron(), { rot: [-0.15, 0, 0] });
  }
  for (let i = 0; i < 3; i++) k.box(w, 0.18, 0.06, 0, 1.25 + i * 0.3, -0.45 - i * 0.05, m, { worldUV: G() });
  k.collide(0, 0, w, 1);
}

export function magazineTable(k: Kit) {
  const m = wood.dark();
  k.box(1.6, 0.1, 0.9, 0, 0.75, 0, m, { worldUV: G() });
  for (const [x, z] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) k.box(0.1, 0.75, 0.1, x, 0, z, m);
  k.box(0.5, 0.03, 0.7, -0.3, 0.85, 0, toon(C.red3), { rot: [0, 0.2, 0] });
  k.box(0.5, 0.03, 0.7, -0.2, 0.88, 0.05, toon(C.blue4), { rot: [0, -0.1, 0] });
  k.box(0.5, 0.03, 0.7, 0.4, 0.85, -0.05, toon(C.grey5), { rot: [0, 0.4, 0] });
  k.collide(0, 0, 1.6, 0.9);
}

export function umbrellaStand(k: Kit) {
  k.cyl(0.26, 0.22, 0.85, 0, 0, 0, M.brassDk(), 10);
  k.cyl(0.27, 0.27, 0.05, 0, 0.82, 0, M.brass(), 10);
  k.cyl(0.13, 0.03, 1.3, 0.04, 0.6, 0.02, toon(C.ink3), 6, { rot: [0, 0, 0.1] });
  k.cyl(0.02, 0.02, 0.3, -0.04, 1.9, 0.02, toon(C.wood3), 4, { rot: [0, 0, 0.1] });
  k.add(new THREE.TorusGeometry(0.08, 0.025, 3, 8, Math.PI), -0.0, 2.2, 0.02, toon(C.wood3), { rot: [0, 0, 0.1] });
  k.collide(0, 0, 0.6, 0.6);
}

export function door(k: Kit) {
  // frame
  const f = wood.dark();
  k.box(0.18, 3.75, 0.18, -1.1, 0, 0, f);
  k.box(0.18, 3.75, 0.18, 1.1, 0, 0, f);
  k.box(2.4, 0.2, 0.2, 0, 3.6, 0, f);
  // slab
  const m = wood.mid();
  k.box(2.0, 3.6, 0.08, 0, 0, -0.02, m, { worldUV: G() });
  k.box(1.5, 1.2, 0.06, 0, 2.05, 0.02, toon("#ffffff", { map: doorGlassTexture(), emissive: C.blue0, emissiveIntensity: 0.5 }));
  k.box(1.5, 0.9, 0.04, 0, 0.6, 0.02, wood.dark(), { worldUV: G() });
  k.box(1.9, 0.3, 0.04, 0, 0.05, 0.03, M.brassDk());
  k.sphere(0.07, 0.75, 1.75, 0.1, M.brass());
  k.box(0.1, 0.28, 0.03, 0.75, 1.62, 0.05, M.brassDk());
}

// ---------------------------------------------------------------------------
// Darkroom
// ---------------------------------------------------------------------------

export function darkroomCounter(k: Kit, w: number) {
  const d = 1.3;
  k.box(w, 1.35, d - 0.1, 0, 0, -0.05, toon(C.ink3));
  for (let x = -w / 2 + 0.9; x < w / 2; x += 1.6) {
    k.box(1.4, 1.0, 0.04, x, 0.2, d / 2 - 0.1, toon(C.ink4));
    k.box(0.3, 0.05, 0.05, x, 1.0, d / 2 - 0.06, M.steelLt());
  }
  k.box(w + 0.1, 0.12, d + 0.05, 0, 1.35, 0, toon(C.grey0));
  k.collide(0, 0, w, d);
}

export function trays(k: Kit) {
  const liquids = [C.brass1, C.grey3, C.blue2];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 1.0;
    k.box(0.9, 0.14, 0.7, x, 0, 0, toon(C.grey5));
    k.box(0.78, 0.01, 0.58, x, 0.13, 0, toon(liquids[i]), { cast: false });
  }
  k.box(0.4, 0.02, 0.06, 0.7, 0.16, 0.25, M.steelLt(), { rot: [0, 0.5, 0] }); // tongs
}

export function chemBottles(k: Kit) {
  const heights = [0.6, 0.45, 0.7, 0.5];
  heights.forEach((h, i) => {
    const x = i * 0.32;
    k.cyl(0.13, 0.13, h, x, 0, (i % 2) * 0.12, toon(C.wood2, { emissive: C.red0 }), 8);
    k.cyl(0.06, 0.06, 0.1, x, h, (i % 2) * 0.12, M.ink(), 6);
    k.panel(0.16, 0.12, x, h * 0.55, (i % 2) * 0.12 + 0.135, M.paper());
  });
}

export function enlarger(k: Kit) {
  k.box(1.0, 0.1, 1.0, 0, 0, 0, toon(C.grey1));
  k.box(0.14, 2.6, 0.14, 0, 0.1, -0.4, M.steel());
  k.box(0.5, 0.12, 0.6, 0, 1.6, -0.15, M.steelLt());
  k.box(0.55, 0.55, 0.55, 0, 1.72, -0.15, toon(C.ink4));
  k.box(0.3, 0.3, 0.3, 0, 1.3, -0.1, toon(C.ink2));
  k.cyl(0.1, 0.12, 0.15, 0, 1.15, -0.1, M.ink(), 8);
  k.box(0.2, 0.15, 0.2, 0, 2.27, -0.15, M.steel());
}

/** Wall-mounted safelight. Returns the lamp front position. */
export function safelight(k: Kit) {
  k.box(0.7, 0.5, 0.35, 0, 0, 0, toon(C.ink3));
  k.box(0.56, 0.38, 0.04, 0, 0.06, 0.18, glow(C.red5, 3.2), { cast: false });
  k.box(0.05, 0.6, 0.05, 0, 0.5, -0.1, M.steel());
  return new THREE.Vector3(0, 0.25, 0.45);
}

export function sink(k: Kit) {
  k.box(1.6, 1.3, 1.2, 0, 0, 0, toon(C.grey2));
  k.box(1.4, 0.04, 1.0, 0, 1.28, 0, toon(C.ink2), { cast: false });
  k.box(1.6, 0.2, 0.1, 0, 1.3, 0.55, toon(C.grey3));
  k.box(1.6, 0.2, 0.1, 0, 1.3, -0.55, toon(C.grey3));
  k.cyl(0.04, 0.04, 0.5, 0, 1.3, -0.45, M.steelLt(), 6);
  k.box(0.06, 0.06, 0.3, 0, 1.75, -0.32, M.steelLt());
  k.collide(0, 0, 1.6, 1.2);
}

export function metalShelves(k: Kit, w = 2.4) {
  const d = 0.9;
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) k.box(0.08, 3.2, 0.08, x, 0, z, M.steel());
  const boxColors = [C.brass2, C.brass3, C.grey4, C.ink4];
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * 0.95;
    k.box(w + 0.08, 0.06, d, 0, y, 0, M.steelLt());
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 4 === 3) continue;
      const bw = 0.45 + ((i * 3 + j) % 3) * 0.12;
      k.box(bw, 0.35 + (j % 2) * 0.15, 0.6, -w / 2 + 0.45 + j * 0.75, y + 0.06, 0, toon(boxColors[(i + j) % boxColors.length]));
    }
  }
  k.collide(0, 0, w, d);
}

/** A string of prints pegged across the room. */
export function clothesline(k: Kit, w: number, prints: ("clue" | "street" | "car" | "blank")[]) {
  k.box(w, 0.025, 0.025, 0, 0, 0, toon(C.grey4), { cast: false });
  for (const s of [-1, 1]) k.box(0.1, 0.1, 0.12, (s * w) / 2, -0.05, 0, M.steel());
  prints.forEach((p, i) => {
    const x = -w / 2 + ((i + 1) * w) / (prints.length + 1);
    k.box(0.06, 0.14, 0.04, x, -0.08, 0, toon(C.wood6), { cast: false });
    k.add(new THREE.BoxGeometry(0.75, 0.94, 0.01), x, -0.55, 0, toon("#ffffff", { map: photoTexture(p) }), { rot: [0.04 * (i % 2 ? 1 : -1), 0, 0] });
  });
}

// ---------------------------------------------------------------------------
// Wall decor
// ---------------------------------------------------------------------------

/** Sconce on a wall facing +Z. Returns bulb position. */
export function sconce(k: Kit) {
  k.box(0.26, 0.5, 0.05, 0, -0.25, 0.02, M.brassDk());
  k.box(0.06, 0.06, 0.3, 0, -0.15, 0.18, M.brass());
  k.cyl(0.16, 0.24, 0.3, 0, -0.05, 0.36, toon(C.skin0, { emissive: C.brass1, emissiveIntensity: 1.1, side: THREE.DoubleSide }), 8);
  k.sphere(0.07, 0, -0.06, 0.36, glow(C.light, 2.4), { cast: false });
  return new THREE.Vector3(0, -0.2, 0.5);
}

export function framed(k: Kit, tex: THREE.Texture, w: number, h: number) {
  k.box(w + 0.1, h + 0.1, 0.06, 0, -0.05, 0, toon(C.ink1));
  k.add(new THREE.PlaneGeometry(w, h), 0, h / 2, 0.035, toon("#ffffff", { map: tex }), { cast: false });
}

export function wallClock(k: Kit) {
  k.add(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 14), 0, 0, 0.04, toon("#ffffff", { map: clockTexture() }), { rot: [Math.PI / 2, 0, 0] });
  k.add(new THREE.TorusGeometry(0.4, 0.04, 4, 14), 0, 0, 0.08, M.brass(), { cast: false });
}
