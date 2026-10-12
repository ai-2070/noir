import * as THREE from "three";

/**
 * Stepped light response shared by every lit surface. The bands come from
 * N·L; distance falloff stays smooth and is broken into dithered bands later
 * by the palette pass, which is what gives lamp pools their stippled rings.
 */
let gradient: THREE.DataTexture | null = null;
export function toonGradient() {
  if (!gradient) {
    const steps = [0, 34, 150, 255];
    const data = new Uint8Array(steps.length * 4);
    steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
    gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const cache = new Map<string, THREE.Material>();

export interface ToonOpts {
  map?: THREE.Texture;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}

export function toon(color: string, opts: ToonOpts = {}): THREE.MeshToonMaterial {
  const key = `toon|${color}|${opts.map?.uuid ?? ""}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? ""}|${opts.side ?? ""}|${opts.opacity ?? ""}`;
  let m = cache.get(key) as THREE.MeshToonMaterial | undefined;
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color,
      map: opts.map ?? null,
      gradientMap: toonGradient(),
      emissive: opts.emissive ?? "#000000",
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Unlit colour, for bulbs and glowing glass. `boost` > 1 pushes into HDR. */
export function glow(color: string, boost = 1): THREE.MeshBasicMaterial {
  const key = `glow|${color}|${boost}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    const c = new THREE.Color(color).multiplyScalar(boost);
    m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    cache.set(key, m);
  }
  return m;
}
