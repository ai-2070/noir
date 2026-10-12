import * as THREE from "three";
import { C } from "./palette";
import { drawPixelText, textWidth } from "./pixelFont";

/** Texels per world unit. The camera is fitted so one texel ≈ one screen pixel. */
export const TPU = 16;
/** Interior wall height in world units (texture is authored to exactly this). */
export const WALL_H = 4.6;
const WALL_TEX_H = Math.round(WALL_H * TPU);

type Ctx = CanvasRenderingContext2D;

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function makeCanvas(w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function toTexture(canvas: HTMLCanvasElement, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  // Bresenham, so strings and cracks stay one texel wide.
  ctx.fillStyle = c;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 512; i++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function speckle(ctx: Ctx, w: number, h: number, r: () => number, colors: readonly string[], density: number) {
  const n = Math.floor(w * h * density);
  for (let i = 0; i < n; i++) {
    rect(ctx, Math.floor(r() * w), Math.floor(r() * h), 1, 1, pick(r, colors));
  }
}

// ---------------------------------------------------------------------------
// Floors
// ---------------------------------------------------------------------------

/** Dark walnut planks, 0.5u wide, staggered. Tiles every 4 units. */
export function plankTexture() {
  return cached("planks", () => {
    const S = 64;
    const { canvas, ctx } = makeCanvas(S, S);
    const r = rng(7);
    const rowH = 8;
    for (let row = 0; row < S / rowH; row++) {
      const y = row * rowH;
      let x = Math.floor(r() * 24);
      const start = x;
      while (x < start + S) {
        const len = 34 + Math.floor(r() * 30);
        const base = pick(r, [C.wood3, C.wood3, C.wood4]);
        for (let i = 0; i < len; i++) {
          const px = (x + i) % S;
          rect(ctx, px, y, 1, rowH, base);
          rect(ctx, px, y + rowH - 1, 1, 1, C.wood1);
          if (r() < 0.3) rect(ctx, px, y, 1, 1, C.wood5);
        }
        // grain streaks
        for (let g = 0; g < 3; g++) {
          const gy = y + 1 + Math.floor(r() * (rowH - 2));
          const gx = x + Math.floor(r() * len);
          const gl = 3 + Math.floor(r() * 9);
          const gc = pick(r, [C.wood2, C.wood2, C.wood5]);
          for (let i = 0; i < gl && gx + i < x + len - 1; i++) rect(ctx, (gx + i) % S, gy, 1, 1, gc);
        }
        // knot
        if (r() < 0.15) {
          const kx = (x + 4 + Math.floor(r() * (len - 8))) % S;
          rect(ctx, kx, y + 3, 2, 2, C.wood1);
          rect(ctx, kx, y + 3, 1, 1, C.wood2);
        }
        // butt joint + nails
        const ex = (x + len - 1) % S;
        rect(ctx, ex, y, 1, rowH - 1, C.wood1);
        rect(ctx, (x + 2) % S, y + 3, 1, 1, C.wood2);
        x += len;
      }
    }
    return toTexture(canvas);
  });
}

/** Lobby linoleum: charcoal and bone checker with grime. 2u repeat. */
export function checkerTexture() {
  return cached("checker", () => {
    const S = 32;
    const { canvas, ctx } = makeCanvas(S, S);
    const r = rng(11);
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const dark = (tx + ty) % 2 === 0;
        const x = tx * 16;
        const y = ty * 16;
        rect(ctx, x, y, 16, 16, dark ? C.ink3 : C.grey4);
        for (let i = 0; i < 26; i++) {
          rect(ctx, x + Math.floor(r() * 16), y + Math.floor(r() * 16), 1, 1, dark ? pick(r, [C.ink2, C.ink4]) : pick(r, [C.grey3, C.grey5]));
        }
        // bevel
        rect(ctx, x, y, 16, 1, dark ? C.ink4 : C.grey5);
        rect(ctx, x, y + 15, 16, 1, C.ink2);
        rect(ctx, x + 15, y, 1, 16, C.ink2);
      }
    }
    return toTexture(canvas);
  });
}

/** Stained darkroom concrete. 4u repeat. */
export function concreteTexture() {
  return cached("concrete", () => {
    const S = 64;
    const { canvas, ctx } = makeCanvas(S, S);
    const r = rng(23);
    rect(ctx, 0, 0, S, S, C.grey1);
    speckle(ctx, S, S, r, [C.grey0, C.grey2, C.ink4], 0.18);
    // stains
    for (let s = 0; s < 4; s++) {
      const cx = r() * S;
      const cy = r() * S;
      const rad = 4 + r() * 7;
      for (let y = -rad; y <= rad; y++)
        for (let x = -rad; x <= rad; x++)
          if (x * x + y * y < rad * rad && r() < 0.6) rect(ctx, (Math.floor(cx + x) + S) % S, (Math.floor(cy + y) + S) % S, 1, 1, C.grey0);
    }
    // cracks
    for (let k = 0; k < 3; k++) {
      let x = r() * S;
      let y = r() * S;
      for (let i = 0; i < 14; i++) {
        const nx = x + (r() - 0.5) * 8;
        const ny = y + (r() - 0.3) * 6;
        line(ctx, x, y, nx, ny, C.ink2);
        x = nx;
        y = ny;
      }
    }
    // expansion joints
    rect(ctx, 0, S - 1, S, 1, C.ink3);
    rect(ctx, S - 1, 0, 1, S, C.ink3);
    return toTexture(canvas);
  });
}

// ---------------------------------------------------------------------------
// Walls  (authored at exactly WALL_H tall; u repeats horizontally)
// ---------------------------------------------------------------------------

function wainscot(ctx: Ctx, W: number, top: number, r: () => number) {
  const H = WALL_TEX_H;
  // baseboard
  rect(ctx, 0, H - 6, W, 6, C.wood1);
  rect(ctx, 0, H - 6, W, 1, C.wood3);
  // panels
  rect(ctx, 0, top, W, H - 6 - top, C.wood2);
  for (let px = 0; px < W; px += 16) {
    const x = px + 2;
    const y = top + 4;
    const w = 12;
    const h = H - 6 - top - 7;
    rect(ctx, x, y, w, 1, C.wood1);
    rect(ctx, x, y, 1, h, C.wood1);
    rect(ctx, x, y + h, w, 1, C.wood3);
    rect(ctx, x + w, y, 1, h + 1, C.wood3);
    for (let i = 0; i < 5; i++) rect(ctx, x + 2 + Math.floor(r() * 9), y + 2 + Math.floor(r() * (h - 3)), 1 + Math.floor(r() * 3), 1, C.wood1);
  }
  // chair rail
  rect(ctx, 0, top - 3, W, 3, C.wood3);
  rect(ctx, 0, top - 3, W, 1, C.wood5);
  rect(ctx, 0, top, W, 1, C.wood1);
}

function crown(ctx: Ctx, W: number) {
  rect(ctx, 0, 0, W, 4, C.wood2);
  rect(ctx, 0, 0, W, 1, C.wood4);
  rect(ctx, 0, 3, W, 1, C.wood1);
}

/** Office: deep bottle-green damask over walnut wainscot. */
export function officeWallTexture() {
  return cached("wall-office", () => {
    const W = 32;
    const H = WALL_TEX_H;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(31);
    rect(ctx, 0, 0, W, H, C.green2);
    for (let x = 0; x < W; x += 8) {
      rect(ctx, x, 0, 1, H, C.green1);
      rect(ctx, x + 1, 0, 1, H, C.green3);
    }
    // damask diamonds
    for (let y = 8; y < H - 30; y += 10) {
      for (let x = 4; x < W; x += 8) {
        rect(ctx, x, y, 1, 1, C.green3);
        rect(ctx, x - 1, y + 1, 3, 1, C.green1);
        rect(ctx, x, y + 2, 1, 1, C.green3);
      }
    }
    speckle(ctx, W, H - 30, r, [C.green1], 0.03);
    wainscot(ctx, W, H - 28, r);
    crown(ctx, W);
    return toTexture(canvas);
  });
}

/** Reception: faded oxblood pinstripe paper. */
export function receptionWallTexture() {
  return cached("wall-reception", () => {
    const W = 32;
    const H = WALL_TEX_H;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(37);
    rect(ctx, 0, 0, W, H, C.red2);
    for (let x = 0; x < W; x += 6) rect(ctx, x, 0, 1, H, C.red1);
    for (let x = 3; x < W; x += 12) for (let y = 6; y < H - 30; y += 6) rect(ctx, x, y, 1, 1, C.brass1);
    speckle(ctx, W, H - 30, r, [C.red1, C.dusk0], 0.04);
    // water stain near the crown
    for (let i = 0; i < 40; i++) rect(ctx, 18 + Math.floor(r() * 10), 4 + Math.floor(r() * r() * 14), 1, 1, C.red1);
    wainscot(ctx, W, H - 28, r);
    crown(ctx, W);
    return toTexture(canvas);
  });
}

/** Darkroom: painted cinderblock, scuffed black skirting. */
export function darkroomWallTexture() {
  return cached("wall-darkroom", () => {
    const W = 32;
    const H = WALL_TEX_H;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(41);
    rect(ctx, 0, 0, W, H, C.grey1);
    for (let y = 0, row = 0; y < H; y += 8, row++) {
      rect(ctx, 0, y, W, 1, C.grey0);
      const off = row % 2 ? 8 : 0;
      for (let x = off; x < W + 16; x += 16) rect(ctx, x % W, y, 1, 8, C.grey0);
      for (let x = 0; x < W; x++) if (r() < 0.25) rect(ctx, x, y + 1, 1, 1, C.grey2);
    }
    speckle(ctx, W, H, r, [C.grey0, C.ink4], 0.06);
    rect(ctx, 0, H - 7, W, 7, C.ink2);
    rect(ctx, 0, H - 7, W, 1, C.ink4);
    return toTexture(canvas);
  });
}

/** Top-of-wall cap seen in the cutaway: dark with inset violet tiles. */
export function capTexture() {
  return cached("cap", () => {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, C.ink1);
    for (let y = 0; y < 16; y += 8)
      for (let x = 0; x < 16; x += 8) {
        rect(ctx, x + 1, y + 1, 6, 6, C.ink4);
        rect(ctx, x + 1, y + 1, 6, 1, C.ink5);
        rect(ctx, x + 2, y + 2, 4, 4, C.ink3);
      }
    return toTexture(canvas);
  });
}

/** Slab edge under the floor, seen at the cut front of the building. */
export function slabTexture() {
  return cached("slab", () => {
    const { canvas, ctx } = makeCanvas(16, 16);
    rect(ctx, 0, 0, 16, 16, C.ink2);
    rect(ctx, 0, 0, 16, 2, C.wood2);
    rect(ctx, 0, 2, 16, 1, C.wood1);
    for (let x = 0; x < 16; x += 8) rect(ctx, x, 4, 1, 12, C.ink1);
    return toTexture(canvas);
  });
}

// ---------------------------------------------------------------------------
// Furniture surfaces
// ---------------------------------------------------------------------------

/** Tileable wood grain for furniture. `tone` shifts the ramp. */
export function grainTexture(tone: "dark" | "mid" | "light" = "mid") {
  return cached("grain-" + tone, () => {
    const S = 32;
    const ramp = tone === "dark" ? [C.wood1, C.wood2, C.wood3] : tone === "mid" ? [C.wood2, C.wood3, C.wood4] : [C.wood4, C.wood5, C.wood6];
    const { canvas, ctx } = makeCanvas(S, S);
    const r = rng(tone.length * 13);
    rect(ctx, 0, 0, S, S, ramp[1]);
    for (let y = 0; y < S; y++) {
      let x = Math.floor(r() * S);
      while (x < S * 2) {
        const len = 2 + Math.floor(r() * 10);
        const c = r() < 0.6 ? ramp[0] : ramp[2];
        if (r() < 0.45) for (let i = 0; i < len; i++) rect(ctx, (x + i) % S, y, 1, 1, c);
        x += len + 3 + Math.floor(r() * 8);
      }
    }
    return toTexture(canvas);
  });
}

// ---------------------------------------------------------------------------
// Rugs
// ---------------------------------------------------------------------------

export function rugTexture(wUnits: number, hUnits: number, variant: "oxblood" | "navy") {
  return cached(`rug-${variant}-${wUnits}x${hUnits}`, () => {
    const W = Math.round(wUnits * TPU);
    const H = Math.round(hUnits * TPU);
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(W * 7 + H);
    const field = variant === "oxblood" ? C.red2 : C.blue1;
    const field2 = variant === "oxblood" ? C.red3 : C.blue2;
    const border = variant === "oxblood" ? C.blue0 : C.red2;
    const trim = C.brass1;
    rect(ctx, 0, 0, W, H, border);
    // fringe on the short ends
    for (let y = 0; y < H; y += 2) {
      rect(ctx, 0, y, 2, 1, C.grey4);
      rect(ctx, W - 2, y, 2, 1, C.grey4);
    }
    rect(ctx, 2, 0, W - 4, H, border);
    // border motif
    for (let x = 4; x < W - 4; x += 4) {
      rect(ctx, x, 2, 2, 1, trim);
      rect(ctx, x, H - 3, 2, 1, trim);
    }
    for (let y = 4; y < H - 4; y += 4) {
      rect(ctx, 4, y, 1, 2, trim);
      rect(ctx, W - 5, y, 1, 2, trim);
    }
    const inset = 6;
    rect(ctx, inset, inset, W - inset * 2, H - inset * 2, trim);
    rect(ctx, inset + 1, inset + 1, W - inset * 2 - 2, H - inset * 2 - 2, field);
    // lattice of diamonds
    const cx = W / 2;
    const cy = H / 2;
    for (let y = inset + 2; y < H - inset - 2; y++) {
      for (let x = inset + 2; x < W - inset - 2; x++) {
        const lx = (x - cx + 1000) % 10;
        const ly = (y - cy + 1000) % 10;
        if (Math.abs(lx - 5) + Math.abs(ly - 5) === 4) rect(ctx, x, y, 1, 1, field2);
        if (lx === 5 && ly === 5) rect(ctx, x, y, 1, 1, trim);
      }
    }
    // central medallion
    const rad = Math.min(W, H) * 0.28;
    for (let y = -rad; y <= rad; y++) {
      for (let x = -rad * 1.4; x <= rad * 1.4; x++) {
        const d = Math.abs(x) / 1.4 + Math.abs(y);
        const px = Math.floor(cx + x);
        const py = Math.floor(cy + y);
        if (d < rad - 1) rect(ctx, px, py, 1, 1, border);
        if (d >= rad - 1 && d < rad) rect(ctx, px, py, 1, 1, trim);
        if (d < rad * 0.45 && d >= rad * 0.45 - 1) rect(ctx, px, py, 1, 1, field2);
      }
    }
    rect(ctx, Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2, trim);
    // wear
    speckle(ctx, W, H, r, [C.ink3], 0.03);
    return toTexture(canvas, false);
  });
}

// ---------------------------------------------------------------------------
// Decor
// ---------------------------------------------------------------------------

export function booksTexture(wUnits: number, hUnits: number, seed: number) {
  return cached(`books-${wUnits}-${hUnits}-${seed}`, () => {
    const W = Math.round(wUnits * TPU);
    const H = Math.round(hUnits * TPU);
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(seed);
    rect(ctx, 0, 0, W, H, C.ink1);
    let x = 0;
    while (x < W) {
      if (r() < 0.12) {
        x += 2 + Math.floor(r() * 4);
        continue;
      }
      const w = 2 + Math.floor(r() * 3);
      const h = Math.max(4, H - Math.floor(r() * 4));
      const c = pick(r, [C.red2, C.red3, C.green2, C.green3, C.blue1, C.wood3, C.wood4, C.ink4, C.grey2, C.brass0]);
      rect(ctx, x, H - h, w, h, c);
      rect(ctx, x + w - 1, H - h, 1, h, C.ink2);
      if (h > 6) {
        rect(ctx, x, H - h + 2, w - 1, 1, C.brass2);
        if (r() < 0.5) rect(ctx, x, H - 3, w - 1, 1, C.brass1);
      }
      x += w;
    }
    return toTexture(canvas, false);
  });
}

export function corkboardTexture() {
  return cached("cork", () => {
    const W = 48;
    const H = 32;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(5);
    rect(ctx, 0, 0, W, H, C.wood5);
    speckle(ctx, W, H, r, [C.wood4, C.wood6, C.wood4], 0.35);
    const pins: [number, number][] = [];
    const notes: [number, number, number, number, string][] = [
      [4, 4, 9, 11, C.grey6],
      [16, 3, 8, 8, C.grey2],
      [28, 5, 10, 12, C.grey5],
      [40, 3, 6, 8, C.grey2],
      [7, 19, 10, 9, C.grey5],
      [22, 17, 8, 10, C.grey2],
      [35, 20, 9, 8, C.grey6],
    ];
    for (const [x, y, w, h, c] of notes) {
      rect(ctx, x + 1, y + 1, w, h, C.wood3);
      rect(ctx, x, y, w, h, c);
      if (c === C.grey2) {
        // photo: a face in a hat
        rect(ctx, x + 2, y + 2, w - 4, h - 4, C.ink3);
        rect(ctx, x + w / 2 - 1, y + 3, 3, 3, C.grey3);
        rect(ctx, x + w / 2 - 2, y + 2, 5, 1, C.ink1);
      } else {
        for (let ly = y + 2; ly < y + h - 1; ly += 2) rect(ctx, x + 1, ly, w - 2 - Math.floor(r() * 3), 1, C.grey3);
      }
      pins.push([x + Math.floor(w / 2), y]);
    }
    const links = [
      [0, 1], [1, 2], [2, 6], [4, 5], [5, 2], [1, 5], [3, 6],
    ];
    for (const [a, b] of links) line(ctx, pins[a][0], pins[a][1], pins[b][0], pins[b][1], C.red4);
    for (const [x, y] of pins) rect(ctx, x, y, 1, 1, C.red5);
    // frame
    rect(ctx, 0, 0, W, 1, C.wood2);
    rect(ctx, 0, H - 1, W, 1, C.wood1);
    rect(ctx, 0, 0, 1, H, C.wood2);
    rect(ctx, W - 1, 0, 1, H, C.wood1);
    return toTexture(canvas, false);
  });
}

export function calendarTexture() {
  return cached("calendar", () => {
    const W = 24;
    const H = 30;
    const { canvas, ctx } = makeCanvas(W, H);
    rect(ctx, 0, 0, W, H, C.grey5);
    rect(ctx, 0, 0, W, 8, C.red3);
    drawPixelText(ctx, "OCT", 2, 2, C.grey6);
    drawPixelText(ctx, "47", 15, 2, C.grey5);
    // pin-up illustration strip
    rect(ctx, 0, 8, W, 1, C.red1);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        const x = 1 + col * 3 + 1;
        const y = 11 + row * 4;
        rect(ctx, x, y, 2, 1, col === 0 ? C.red3 : C.grey2);
      }
    }
    // the 14th, circled hard in red
    const cx = 1 + 2 * 3 + 1;
    const cy = 11 + 2 * 4;
    ctx.fillStyle = C.red4;
    for (const [dx, dy] of [[-1, -1], [0, -2], [1, -2], [2, -1], [3, 0], [2, 1], [1, 2], [0, 2], [-1, 1], [-2, 0], [3, -1]]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    rect(ctx, 0, H - 1, W, 1, C.grey3);
    return toTexture(canvas, false);
  });
}

export function paintingTexture() {
  return cached("painting", () => {
    const W = 40;
    const H = 26;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(99);
    // night harbour
    for (let y = 0; y < H; y++) rect(ctx, 0, y, W, 1, y < 6 ? C.ink3 : y < 11 ? C.blue0 : y < 14 ? C.blue1 : C.ink2);
    rect(ctx, 28, 3, 3, 3, C.grey5);
    rect(ctx, 29, 3, 2, 1, C.grey6);
    // skyline
    let x = 0;
    while (x < W) {
      const w = 3 + Math.floor(r() * 5);
      const h = 2 + Math.floor(r() * 7);
      rect(ctx, x, 14 - h, w, h, C.ink1);
      if (r() < 0.7) rect(ctx, x + 1, 14 - h + 2, 1, 1, C.brass2);
      x += w;
    }
    // reflections
    for (let y = 15; y < H; y += 2) for (let i = 0; i < 4; i++) rect(ctx, Math.floor(r() * W), y, 2 + Math.floor(r() * 3), 1, i % 2 ? C.blue2 : C.brass1);
    rect(ctx, 26, 15, 6, 1, C.grey4);
    // gilt frame
    rect(ctx, 0, 0, W, 2, C.brass1);
    rect(ctx, 0, H - 2, W, 2, C.brass0);
    rect(ctx, 0, 0, 2, H, C.brass1);
    rect(ctx, W - 2, 0, 2, H, C.brass0);
    rect(ctx, 0, 0, W, 1, C.brass2);
    return toTexture(canvas, false);
  });
}

/** A hanging print. `subject` changes the composition. */
export function photoTexture(subject: "clue" | "street" | "car" | "blank") {
  return cached("photo-" + subject, () => {
    const W = 12;
    const H = 15;
    const { canvas, ctx } = makeCanvas(W, H);
    rect(ctx, 0, 0, W, H, C.grey6);
    rect(ctx, 1, 1, W - 2, H - 4, C.grey3);
    if (subject === "clue") {
      // awning, two figures shaking hands
      rect(ctx, 1, 1, W - 2, 3, C.ink3);
      for (let x = 1; x < W - 1; x += 2) rect(ctx, x, 4, 1, 1, C.ink3);
      rect(ctx, 3, 6, 2, 1, C.ink1);
      rect(ctx, 3, 7, 2, 4, C.ink2);
      rect(ctx, 7, 6, 2, 1, C.ink1);
      rect(ctx, 7, 7, 2, 4, C.grey1);
      rect(ctx, 5, 9, 2, 1, C.grey5);
    } else if (subject === "street") {
      rect(ctx, 1, 8, W - 2, 4, C.grey1);
      rect(ctx, 3, 3, 2, 5, C.ink3);
      rect(ctx, 7, 4, 3, 4, C.grey2);
    } else if (subject === "car") {
      rect(ctx, 2, 7, 8, 3, C.ink2);
      rect(ctx, 4, 5, 4, 2, C.ink3);
      rect(ctx, 2, 10, 2, 1, C.ink1);
      rect(ctx, 8, 10, 2, 1, C.ink1);
    }
    return toTexture(canvas, false);
  });
}

/** Mirror-written gilt lettering on the frosted door glass. */
export function doorGlassTexture() {
  return cached("door-glass", () => {
    const W = 24;
    const H = 20;
    const { canvas, ctx } = makeCanvas(W, H);
    rect(ctx, 0, 0, W, H, C.grey4);
    const r = rng(3);
    speckle(ctx, W, H, r, [C.grey3, C.grey5], 0.2);
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    drawPixelText(ctx, "COLE", Math.floor((W - textWidth("COLE")) / 2), 4, C.brass2);
    drawPixelText(ctx, "P.I.", Math.floor((W - textWidth("P.I.")) / 2), 11, C.brass1);
    ctx.restore();
    return toTexture(canvas, false);
  });
}

/** Small plaques and signs in the bitmap font. */
export function signTexture(text: string, fg: string, bg: string, pad = 1) {
  return cached(`sign-${text}-${fg}-${bg}`, () => {
    const W = textWidth(text) + pad * 2 + 2;
    const H = 5 + pad * 2 + 2;
    const { canvas, ctx } = makeCanvas(W, H);
    rect(ctx, 0, 0, W, H, C.ink1);
    rect(ctx, 1, 1, W - 2, H - 2, bg);
    drawPixelText(ctx, text, pad + 1, pad + 1, fg);
    return toTexture(canvas, false);
  });
}

export function clockTexture() {
  return cached("clock", () => {
    const S = 12;
    const { canvas, ctx } = makeCanvas(S, S);
    rect(ctx, 0, 0, S, S, C.ink1);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - 5.5, y - 5.5);
        if (d < 5.6) rect(ctx, x, y, 1, 1, d > 4.6 ? C.brass1 : C.grey6);
      }
    for (const [x, y] of [[5, 1], [10, 5], [5, 10], [1, 5]]) rect(ctx, x, y, 1, 1, C.ink2);
    line(ctx, 6, 6, 6, 2, C.ink1); // twelve-ish
    line(ctx, 6, 6, 8, 6, C.ink1); // quarter past
    return toTexture(canvas, false);
  });
}

/** Keyboard + paper for the typewriters. */
export function typewriterTexture() {
  return cached("typewriter", () => {
    const W = 12;
    const H = 8;
    const { canvas, ctx } = makeCanvas(W, H);
    rect(ctx, 0, 0, W, H, C.ink2);
    for (let y = 1; y < H - 1; y += 2) for (let x = 1 + (y % 4 === 1 ? 0 : 1); x < W - 1; x += 2) rect(ctx, x, y, 1, 1, C.grey4);
    return toTexture(canvas, false);
  });
}

export function paperTexture(seed: number) {
  return cached("paper-" + seed, () => {
    const W = 8;
    const H = 10;
    const { canvas, ctx } = makeCanvas(W, H);
    const r = rng(seed);
    rect(ctx, 0, 0, W, H, C.grey5);
    for (let y = 1; y < H - 1; y += 2) rect(ctx, 1, y, 3 + Math.floor(r() * 4), 1, C.grey3);
    return toTexture(canvas, false);
  });
}

export function matchbookTexture() {
  return cached("matchbook", () => {
    const { canvas, ctx } = makeCanvas(6, 4);
    rect(ctx, 0, 0, 6, 4, C.blue2);
    rect(ctx, 1, 1, 2, 2, C.neonPink);
    rect(ctx, 0, 3, 6, 1, C.grey5);
    return toTexture(canvas, false);
  });
}
