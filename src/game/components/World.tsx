"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LightDef, WindowDef } from "../level";
import { C } from "../palette";
import { bulbFlicker, getLevel, neonFlicker } from "../rig";
import { NO_OUTLINE } from "./PixelRenderer";

export function World() {
  const level = getLevel();
  return (
    <>
      <color attach="background" args={[C.ink1]} />
      <hemisphereLight args={["#46557a", "#24182a", 3.2]} />
      <primitive object={level.set} />
      <MoonOccluder />
      {level.windows.map((w, i) => (
        <CityWindow key={i} def={w} />
      ))}
      {level.lights.map((l, i) => (
        <SceneLight key={i} def={l} index={i} />
      ))}
      <DustMotes />
    </>
  );
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

/**
 * The cutaway has no ceiling, so low moonlight would pour in over the back
 * wall. This slab extends that wall upward, but only in shadow maps: it
 * writes no colour or depth, and sits on the no-outline layer so the normal
 * pass skips it. (three filters shadow casters by the *view* camera's layers.)
 */
function MoonOccluder() {
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => ref.current?.layers.set(NO_OUTLINE), []);
  return (
    <mesh ref={ref} position={[11.35, 10, -12.35]} castShadow>
      <boxGeometry args={[17.5, 10.8, 0.7]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  );
}

/** Venetian-blind stripes for the moon's cookie. */
function blindsCookie() {
  const S = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#fff";
  // ~ one slat per 0.3u at the window; the frustum spans ~7u there
  for (let y = 0; y < S; y += 8) ctx.fillRect(0, y, S, 5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function SceneLight({ def, index }: { def: LightDef; index: number }) {
  const ref = useRef<THREE.PointLight & THREE.SpotLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const cookie = useMemo(() => (def.cookie === "blinds" ? blindsCookie() : null), [def.cookie]);
  useEffect(() => () => cookie?.dispose(), [cookie]);

  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.shadow.bias = -0.0015;
    l.shadow.normalBias = 0.02;
    if (def.kind === "spot") {
      target.position.copy(def.target ?? new THREE.Vector3());
      target.updateMatrixWorld();
      l.target = target;
      l.map = cookie;
      l.shadow.mapSize.set(1024, 1024);
      l.shadow.camera.near = 10;
      l.shadow.camera.far = 60;
      l.shadow.bias = -0.0004;
    } else {
      l.shadow.mapSize.set(512, 512);
      l.shadow.camera.near = 0.1;
      l.shadow.camera.far = def.distance + 2;
    }
  }, [def, target, cookie]);

  useFrame(({ clock }) => {
    const l = ref.current;
    if (!l || !def.flicker) return;
    const t = clock.elapsedTime;
    const seed = def.seed ?? index;
    const f =
      def.flicker === "neon"
        ? neonFlicker(t, seed)
        : def.flicker === "safelight"
          ? 0.97 + 0.03 * Math.sin(t * 2.1)
          : bulbFlicker(t, seed);
    l.intensity = def.intensity * f;
  });

  if (def.kind === "spot") {
    return (
      <spotLight
        ref={ref}
        position={def.pos}
        color={def.color}
        intensity={def.intensity}
        distance={def.distance}
        decay={def.decay ?? 0}
        angle={def.angle ?? 0.3}
        penumbra={0.05}
        castShadow={def.shadow}
      />
    );
  }
  return (
    <pointLight
      ref={ref}
      position={def.pos}
      color={def.color}
      intensity={def.intensity}
      distance={def.distance}
      decay={def.decay ?? 2}
      castShadow={def.shadow}
    />
  );
}

// ---------------------------------------------------------------------------
// The city outside: rain, lit windows, a neon sign that can't stay lit.
// ---------------------------------------------------------------------------

const windowVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const windowFrag = /* glsl */ `
uniform float uTime;
uniform vec2 uSize;
uniform float uSeed;
uniform float uNeon;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 S = floor(uSize * 16.0);
  vec2 p = floor(vUv * S);
  float y = p.y / S.y;

  vec3 col = mix(vec3(0.004, 0.003, 0.012), vec3(0.03, 0.022, 0.06), y);

  // far skyline
  float fx = floor((p.x + uSeed * 53.0) / 6.0);
  float fh = S.y * (0.5 + 0.38 * hash(vec2(fx, uSeed + 1.0)));
  if (p.y < fh) {
    col = vec3(0.008, 0.008, 0.02);
    if (mod(p.x, 3.0) == 1.0 && mod(p.y, 3.0) == 1.0 && hash(p + uSeed) > 0.8) col = vec3(0.22, 0.15, 0.06);
  }

  // the building across the street
  float nx = floor((p.x + uSeed * 17.0) / 18.0);
  float nh = S.y * (0.25 + 0.3 * hash(vec2(nx, uSeed + 7.0)));
  if (p.y < nh) {
    col = vec3(0.004, 0.003, 0.01);
    vec2 w = mod(p, vec2(5.0, 6.0));
    if (w.x > 0.5 && w.x < 3.5 && w.y > 1.5 && w.y < 4.5) {
      float h = hash(floor(p / vec2(5.0, 6.0)) + uSeed * 3.0);
      if (h > 0.72) col = h > 0.93 ? vec3(0.04, 0.3, 0.28) : vec3(0.35, 0.22, 0.08);
    }
  }

  // vertical neon blade sign
  float sx = floor(S.x * (uSeed < 1.5 ? 0.7 : 0.25));
  if (p.x >= sx && p.x <= sx + 5.0 && y > 0.18 && y < 0.95) {
    bool edge = p.x == sx || p.x == sx + 5.0 || mod(p.y, 7.0) == 0.0;
    vec3 tube = uSeed < 1.5 ? vec3(1.6, 0.25, 0.5) : vec3(0.2, 1.3, 1.2);
    col = edge ? tube * uNeon : vec3(0.02, 0.01, 0.02) + tube * 0.05 * uNeon;
    if (!edge && mod(p.y, 7.0) > 1.5 && mod(p.y, 7.0) < 5.5 && p.x > sx + 1.5 && p.x < sx + 3.5) col = tube * 0.6 * uNeon;
  }

  // rain: slanted streaks on per-column timers
  float c = floor(p.x + p.y * 0.25);
  float speed = 26.0 + 22.0 * hash(vec2(c, 3.0));
  float len = 10.0 + 14.0 * hash(vec2(c, 5.0));
  float yy = p.y + uTime * speed + hash(vec2(c, 9.0)) * 200.0;
  float cell = floor(yy / len);
  if (fract(yy / len) < 0.22 && hash(vec2(c, cell)) > 0.62) col += vec3(0.07, 0.085, 0.12);

  // condensation haze toward the bottom of the glass
  col += vec3(0.01, 0.014, 0.024) * smoothstep(0.4, 0.0, y);
  gl_FragColor = vec4(col, 1.0);
}
`;

function CityWindow({ def }: { def: WindowDef }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: new THREE.Vector2(def.w, def.h) },
          uSeed: { value: def.seed },
          uNeon: { value: 1 },
        },
        vertexShader: windowVert,
        fragmentShader: windowFrag,
      }),
    [def],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    // same seeds as the neon point lights in level.ts, so glass and spill stutter together
    mat.uniforms.uNeon.value = neonFlicker(clock.elapsedTime, def.seed === 1 ? 10 : 13);
  });
  return (
    <mesh position={def.center} material={mat}>
      <planeGeometry args={[def.w, def.h]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Dust hanging in the moonbeam. Single-pixel points, no outline.
// ---------------------------------------------------------------------------

function DustMotes() {
  const count = 36;
  const dpr = useThree((s) => s.viewport.dpr);
  const { geo, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const s = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      s[i * 3] = Math.random();
      s[i * 3 + 1] = Math.random();
      s[i * 3 + 2] = Math.random();
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, seeds: s };
  }, []);
  const ref = useRef<THREE.Points>(null);

  useEffect(() => {
    ref.current?.layers.set(NO_OUTLINE);
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const a = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const sx = seeds[i * 3];
      const sy = seeds[i * 3 + 1];
      const sz = seeds[i * 3 + 2];
      // drift inside the beam between the window and the desk
      const z = -11.6 + sz * 6.5;
      const yTop = 3.8 - (z + 11.6) * 0.45;
      a.setXYZ(
        i,
        9.2 + sx * 3.6 + Math.sin(t * 0.3 + sy * 20) * 0.25,
        0.4 + ((sy * yTop + t * 0.05 * (0.3 + sx)) % Math.max(0.5, yTop)),
        z + Math.cos(t * 0.21 + sx * 13) * 0.2,
      );
    }
    a.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#6585ad" size={1 / dpr} sizeAttenuation={false} transparent opacity={0.5} depthWrite={false} />
    </points>
  );
}
