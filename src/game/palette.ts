import * as THREE from "three";

/**
 * The master palette. Every pixel on screen is snapped to one of these
 * (with ordered dithering between neighbours), which is what keeps the
 * 3D render reading as hand-placed pixel art.
 *
 * Ramps are hue-shifted the way a pixel artist would paint them: shadows
 * drift toward violet/blue, highlights drift toward amber.
 */
export const PALETTE = [
  // ink / void
  "#0a080d", "#131019", "#1c1724", "#272031", "#342b40", "#4a3a52",
  // night blues
  "#22304a", "#2f4566", "#43608a", "#6585ad", "#95b3cf", "#c9dbe6",
  // warm greys
  "#3b3638", "#544c4c", "#6f6562", "#8d827b", "#ada197", "#cfc4b6", "#ece4d4",
  // wood, plus lamplit orange-browns so warm light on timber doesn't snap to oxblood
  "#1f1412", "#2e1c17", "#43281d", "#5c3824", "#77492c", "#935e37", "#b17a48", "#cc9a62",
  "#4e2619", "#6e3a22", "#8c4b2a", "#a8603a", "#c4793f", "#dc9a5a",
  // skin / lamplight
  "#e2b98a", "#f2d5a8", "#fff1d6",
  // oxblood
  "#2c0f14", "#47161b", "#6a1f22", "#922c2a", "#bb3f33", "#e0603f",
  // brass
  "#5a421c", "#8a6a2a", "#bd9742", "#e6c66a",
  // greens
  "#12201c", "#1a3129", "#24463a", "#33604c", "#4a7c5f", "#79a27a",
  // neon
  "#ff4d7d", "#ff9ab8", "#39d0c8", "#a3fff0",
  // dusk violets
  "#6c4469", "#8f5c7a",
] as const;

/** Named colours used when authoring props and textures. */
export const C = {
  ink0: "#0a080d",
  ink1: "#131019",
  ink2: "#1c1724",
  ink3: "#272031",
  ink4: "#342b40",
  ink5: "#4a3a52",
  blue0: "#22304a",
  blue1: "#2f4566",
  blue2: "#43608a",
  blue3: "#6585ad",
  blue4: "#95b3cf",
  blue5: "#c9dbe6",
  grey0: "#3b3638",
  grey1: "#544c4c",
  grey2: "#6f6562",
  grey3: "#8d827b",
  grey4: "#ada197",
  grey5: "#cfc4b6",
  grey6: "#ece4d4",
  wood0: "#1f1412",
  wood1: "#2e1c17",
  wood2: "#43281d",
  wood3: "#5c3824",
  wood4: "#77492c",
  wood5: "#935e37",
  wood6: "#b17a48",
  wood7: "#cc9a62",
  skin0: "#e2b98a",
  skin1: "#f2d5a8",
  light: "#fff1d6",
  red0: "#2c0f14",
  red1: "#47161b",
  red2: "#6a1f22",
  red3: "#922c2a",
  red4: "#bb3f33",
  red5: "#e0603f",
  brass0: "#5a421c",
  brass1: "#8a6a2a",
  brass2: "#bd9742",
  brass3: "#e6c66a",
  green0: "#12201c",
  green1: "#1a3129",
  green2: "#24463a",
  green3: "#33604c",
  green4: "#4a7c5f",
  green5: "#79a27a",
  neonPink: "#ff4d7d",
  neonPinkLt: "#ff9ab8",
  neonTeal: "#39d0c8",
  neonTealLt: "#a3fff0",
  dusk0: "#6c4469",
  dusk1: "#8f5c7a",
} as const;

// ---------------------------------------------------------------------------
// OKLab nearest-colour lookup table
// ---------------------------------------------------------------------------

function srgbToLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function toOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Bakes a 3D lookup texture (sRGB in → nearest palette colour out).
 * Distance is measured in OKLab so the snap is perceptual, with chroma
 * weighted up so a surface keeps its hue family instead of jumping ramps.
 */
export function buildPaletteLUT(size = 32): THREE.Data3DTexture {
  const pal = PALETTE.map((h) => {
    const rgb = hexToRgb(h);
    return { rgb, lab: toOklab(...rgb) };
  });
  const data = new Uint8Array(size * size * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [L, A, B] = toOklab(r / (size - 1), g / (size - 1), b / (size - 1));
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < pal.length; i++) {
          const p = pal[i].lab;
          const dl = L - p[0];
          const da = (A - p[1]) * 1.4;
          const db = (B - p[2]) * 1.4;
          const d = dl * dl + da * da + db * db;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        const o = (r + g * size + b * size * size) * 4;
        const rgb = pal[best].rgb;
        data[o] = Math.round(rgb[0] * 255);
        data[o + 1] = Math.round(rgb[1] * 255);
        data[o + 2] = Math.round(rgb[2] * 255);
        data[o + 3] = 255;
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, size, size, size);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapR = tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}
