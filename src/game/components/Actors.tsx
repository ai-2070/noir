"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { axis } from "../input";
import type { AABB } from "../kit";
import { glow, toon } from "../materials";
import { C } from "../palette";
import { getLevel, rig } from "../rig";
import { useGame } from "../store";
import { tryLeave } from "../story";
import { NO_OUTLINE } from "./PixelRenderer";

const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

function turnToward(a: number, b: number, maxStep: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + THREE.MathUtils.clamp(d, -maxStep, maxStep);
}

/** Circle-vs-boxes push-out; a few passes handle corners. */
function resolve(x: number, z: number, r: number, boxes: AABB[]) {
  for (let pass = 0; pass < 3; pass++) {
    for (const b of boxes) {
      const cx = THREE.MathUtils.clamp(x, b.minX, b.maxX);
      const cz = THREE.MathUtils.clamp(z, b.minZ, b.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // centre inside the box: leave by the shallowest side
        const pen = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) x = b.minX - r;
        else if (i === 1) x = b.maxX + r;
        else if (i === 2) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
  }
  return [x, z] as const;
}

/** Soft contact shadow; dithered by the palette pass, never outlined. */
function BlobShadow({ radius = 0.6, opacity = 0.45 }: { radius?: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => ref.current?.layers.set(NO_OUTLINE), []);
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position-y={0.03} renderOrder={1}>
      <circleGeometry args={[radius, 12]} />
      <meshBasicMaterial color={C.ink0} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Cole
// ---------------------------------------------------------------------------

const COAT = "#a8845a";
const COAT_DK = "#76583a";

export function Player() {
  const level = getLevel();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const skirt = useRef<THREE.Mesh>(null);
  const st = useRef({
    pos: level.anchors.player.clone(),
    yaw: Math.PI,
    yawTarget: Math.PI,
    dir: new THREE.Vector2(0, -1),
    speed: 0,
    phase: 0,
    leaving: false,
    retreat: false,
  });

  useFrame(({ clock }, delta) => {
    const g = useGame.getState();
    const dt = Math.min(delta, 1 / 20);
    const s = st.current;
    if (rig.warp) {
      s.pos.copy(rig.warp);
      rig.focus.copy(rig.warp);
      rig.warp = null;
    }

    let mx = 0;
    let mz = 0;
    let run = false;
    if (s.retreat) {
      mz = -1;
      if (s.pos.z < 3.4) s.retreat = false;
    } else if (g.phase === "play" && !g.dialogue) {
      const a = axis();
      mx = a.x;
      mz = a.z;
      run = a.run;
    }
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      s.dir.set(mx / len, mz / len);
      s.yawTarget = Math.atan2(s.dir.x, s.dir.y);
    }
    s.speed = damp(s.speed, len > 0 ? (run ? 9.5 : 5.8) : 0, 12, dt);
    const step = s.speed * dt;
    const [nx, nz] = resolve(s.pos.x + s.dir.x * step, s.pos.z + s.dir.y * step, 0.45, level.colliders);
    s.pos.x = nx;
    s.pos.z = nz;
    s.pos.y = damp(s.pos.y, level.heightAt(nx, nz), 18, dt);
    s.yaw = turnToward(s.yaw, s.yawTarget, 11 * dt);

    // walk cycle, driven by distance so feet don't skate
    s.phase += step * 1.15;
    const k = Math.min(1, s.speed / 5.8);
    const sw = Math.sin(s.phase);
    if (legL.current && legR.current && armL.current && armR.current && body.current && root.current && skirt.current) {
      legL.current.rotation.x = sw * 0.65 * k;
      legR.current.rotation.x = -sw * 0.65 * k;
      armL.current.rotation.x = -sw * 0.45 * k;
      armR.current.rotation.x = sw * 0.45 * k;
      const breathe = Math.sin(clock.elapsedTime * 1.6) * 0.012 * (1 - k);
      body.current.position.y = Math.abs(Math.cos(s.phase)) * 0.09 * k + breathe;
      body.current.rotation.x = 0.06 * k;
      skirt.current.rotation.x = -0.08 * k + Math.sin(s.phase * 2) * 0.03 * k;
      root.current.position.copy(s.pos);
      root.current.rotation.y = s.yaw;
    }
    rig.target.copy(s.pos);

    // nearest interactable, biased toward what Cole is facing
    if (g.phase === "play") {
      let best: string | null = null;
      let bestScore = Infinity;
      const fx = Math.sin(s.yaw);
      const fz = Math.cos(s.yaw);
      for (const it of level.interactables) {
        const dx = it.pos.x - s.pos.x;
        const dz = it.pos.z - s.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > (it.reach ?? 2.9)) continue;
        const score = d - (0.9 * (dx * fx + dz * fz)) / Math.max(d, 0.001);
        if (score < bestScore) {
          bestScore = score;
          best = it.id;
        }
      }
      g.setNearby(g.dialogue ? null : best);

      if (!g.dialogue && !s.leaving && s.pos.z > level.anchors.exitZ) {
        s.leaving = true;
        tryLeave(() => {
          s.retreat = true;
          s.leaving = false;
        });
      }
    }
  });

  const m = useMemo(
    () => ({
      coat: toon(COAT),
      coatDk: toon(COAT_DK),
      trousers: toon(C.ink3),
      shoe: toon(C.ink1),
      skin: toon(C.skin0),
      hat: toon(C.ink2),
      band: toon(C.ink0),
      shirt: toon(C.grey5),
      tie: toon(C.red3),
      hair: toon(C.wood1),
    }),
    [],
  );

  return (
    <group ref={root}>
      {/* a dim personal key light, so the lead never dissolves into the dark */}
      <pointLight position={[0.6, 4.2, 1.6]} color="#c9b48f" intensity={3.2} distance={5.5} decay={1.4} />
      <BlobShadow radius={0.7} />
      <group ref={body}>
        {[legL, legR].map((ref, i) => (
          <group key={i} ref={ref} position={[i ? 0.2 : -0.2, 1.45, 0]}>
            <mesh material={m.trousers} position={[0, -0.68, 0]} castShadow>
              <boxGeometry args={[0.28, 1.36, 0.3]} />
            </mesh>
            <mesh material={m.shoe} position={[0, -1.37, 0.08]} castShadow>
              <boxGeometry args={[0.3, 0.16, 0.5]} />
            </mesh>
          </group>
        ))}
        <mesh ref={skirt} material={m.coat} position={[0, 1.22, 0]} scale={[1, 1, 0.8]} castShadow>
          <cylinderGeometry args={[0.5, 0.64, 1.05, 8]} />
        </mesh>
        <mesh material={m.coat} position={[0, 2.1, 0]} scale={[1, 1, 0.78]} castShadow>
          <cylinderGeometry args={[0.47, 0.5, 0.9, 8]} />
        </mesh>
        <mesh material={m.coatDk} position={[0, 1.74, 0]} scale={[1, 1, 0.8]}>
          <cylinderGeometry args={[0.52, 0.52, 0.1, 8]} />
        </mesh>
        <mesh material={m.coat} position={[0, 2.45, 0]} castShadow>
          <boxGeometry args={[1.02, 0.22, 0.6]} />
        </mesh>
        {/* shirt, tie, lapels */}
        <mesh material={m.shirt} position={[0, 2.3, 0.36]}>
          <boxGeometry args={[0.22, 0.34, 0.04]} />
        </mesh>
        <mesh material={m.tie} position={[0, 2.22, 0.39]}>
          <boxGeometry args={[0.08, 0.36, 0.03]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.coatDk} position={[s * 0.17, 2.32, 0.38]} rotation={[0, 0, s * 0.35]}>
            <boxGeometry args={[0.12, 0.42, 0.04]} />
          </mesh>
        ))}
        <mesh material={m.coatDk} position={[0, 2.6, -0.06]} castShadow>
          <boxGeometry args={[0.66, 0.24, 0.42]} />
        </mesh>
        {[armL, armR].map((ref, i) => (
          <group key={i} ref={ref} position={[i ? 0.56 : -0.56, 2.45, 0]}>
            <mesh material={m.coat} position={[0, -0.5, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.16, 1.0, 6]} />
            </mesh>
            <mesh material={m.skin} position={[0, -1.08, 0.02]}>
              <boxGeometry args={[0.16, 0.18, 0.16]} />
            </mesh>
          </group>
        ))}
        {/* head */}
        <mesh material={m.skin} position={[0, 2.88, 0.02]} castShadow>
          <boxGeometry args={[0.42, 0.48, 0.44]} />
        </mesh>
        <mesh material={m.hair} position={[0, 2.86, -0.18]}>
          <boxGeometry args={[0.44, 0.3, 0.12]} />
        </mesh>
        {/* fedora, tipped low */}
        <group position={[0, 3.1, 0.02]} rotation={[0.09, 0, 0]}>
          <mesh material={m.hat} castShadow>
            <cylinderGeometry args={[0.54, 0.54, 0.05, 12]} />
          </mesh>
          <mesh material={m.hat} position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.27, 0.33, 0.34, 10]} />
          </mesh>
          <mesh material={m.band} position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.335, 0.335, 0.08, 10]} />
          </mesh>
          <mesh material={m.band} position={[0, 0.35, 0.02]}>
            <boxGeometry args={[0.08, 0.03, 0.4]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Vera, at the typewriter
// ---------------------------------------------------------------------------

export function Vera() {
  const level = getLevel();
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const lookYaw = useRef(0);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const p = rig.target;
    const a = level.anchors.vera;
    const near = Math.hypot(p.x - a.x, p.z - a.z) < 6;
    const talking = useGame.getState().dialogue?.lines.some((l) => l.who === "VERA") ?? false;
    const typing = !near && !talking;
    const want = near || talking ? THREE.MathUtils.clamp(Math.atan2(p.x - a.x, p.z - a.z), -0.9, 0.9) : Math.sin(t * 0.4) * 0.08;
    lookYaw.current = damp(lookYaw.current, want, 4, Math.min(delta, 0.05));
    if (head.current) {
      head.current.rotation.y = lookYaw.current;
      head.current.rotation.x = typing ? 0.25 : 0.0;
    }
    if (armL.current && armR.current) {
      const burst = Math.sin(t * 0.9) > -0.2 ? 1 : 0;
      armL.current.rotation.x = -1.05 + (typing ? Math.max(0, Math.sin(t * 17)) * 0.1 * burst : 0.25);
      armR.current.rotation.x = -1.05 + (typing ? Math.max(0, Math.sin(t * 17 + 2)) * 0.1 * burst : 0.25);
    }
  });

  const m = useMemo(
    () => ({
      dress: toon(C.green2),
      dressDk: toon(C.green1),
      skin: toon(C.skin1),
      hair: toon("#7a3324"),
      lips: toon(C.red4),
      collar: toon(C.grey6),
      pearls: toon(C.grey6),
    }),
    [],
  );

  return (
    <group position={level.anchors.vera}>
      <mesh material={m.dress} position={[0, 1.24, 0.05]} castShadow>
        <boxGeometry args={[0.82, 0.34, 0.8]} />
      </mesh>
      <mesh material={m.dress} position={[0, 1.22, 0.55]} castShadow>
        <boxGeometry args={[0.72, 0.26, 0.6]} />
      </mesh>
      <mesh material={m.dress} position={[0, 1.85, -0.02]} scale={[1, 1, 0.75]} castShadow>
        <cylinderGeometry args={[0.34, 0.42, 0.9, 8]} />
      </mesh>
      <mesh material={m.dressDk} position={[0, 1.42, 0]} scale={[1, 1, 0.75]}>
        <cylinderGeometry args={[0.43, 0.43, 0.08, 8]} />
      </mesh>
      <mesh material={m.collar} position={[0, 2.28, 0.08]}>
        <boxGeometry args={[0.36, 0.08, 0.3]} />
      </mesh>
      {[armL, armR].map((ref, i) => (
        <group key={i} ref={ref} position={[i ? 0.44 : -0.44, 2.18, 0]} rotation={[-1.05, 0, i ? -0.25 : 0.25]}>
          <mesh material={m.dress} position={[0, -0.36, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.72, 6]} />
          </mesh>
          <group position={[0, -0.7, 0]} rotation={[0.7, 0, 0]}>
            <mesh material={m.skin} position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.08, 0.09, 0.56, 6]} />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={head} position={[0, 2.36, 0]}>
        <mesh material={m.skin} position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.18, 6]} />
        </mesh>
        <mesh material={m.skin} position={[0, 0.38, 0.02]} castShadow>
          <boxGeometry args={[0.38, 0.44, 0.4]} />
        </mesh>
        <mesh material={m.lips} position={[0, 0.24, 0.225]}>
          <boxGeometry args={[0.12, 0.04, 0.02]} />
        </mesh>
        {/* a 40s set: crown, back roll, two victory rolls */}
        <mesh material={m.hair} position={[0, 0.55, -0.04]} castShadow>
          <boxGeometry args={[0.46, 0.22, 0.5]} />
        </mesh>
        <mesh material={m.hair} position={[0, 0.3, -0.2]} castShadow>
          <boxGeometry args={[0.5, 0.42, 0.18]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.hair} position={[s * 0.16, 0.66, 0.08]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.1, 0.1, 0.18, 8]} />
          </mesh>
        ))}
        <mesh material={m.hair} position={[0, 0.12, -0.22]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 0.5, 8]} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ink, the office cat
// ---------------------------------------------------------------------------

export function Cat() {
  const level = getLevel();
  const tail = useRef<THREE.Group>(null);
  const body = useRef<THREE.Mesh>(null);
  const eyes = useRef<THREE.Group>(null);
  const ear = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const p = rig.target;
    const a = level.anchors.cat;
    const near = Math.hypot(p.x - a.x, p.z - a.z) < 3.2;
    if (body.current) body.current.scale.y = 0.62 + Math.sin(t * 1.3) * 0.025;
    if (tail.current) tail.current.rotation.y = Math.sin(t * (near ? 2.4 : 0.8)) * (near ? 0.35 : 0.18);
    if (eyes.current) eyes.current.visible = near;
    if (ear.current) ear.current.rotation.z = Math.sin(t * 9) > 0.97 ? 0.4 : 0.15;
  });

  const fur = useMemo(() => toon(C.ink3), []);
  const furLt = useMemo(() => toon(C.ink4), []);
  return (
    <group position={level.anchors.cat} rotation-y={level.anchors.catYaw}>
      <mesh ref={body} material={fur} position={[0, 0.22, 0]} scale={[1.25, 0.62, 1]} castShadow>
        <sphereGeometry args={[0.38, 10, 7]} />
      </mesh>
      <group position={[0.18, 0.3, 0.28]}>
        <mesh material={fur} castShadow>
          <sphereGeometry args={[0.2, 8, 6]} />
        </mesh>
        <mesh material={furLt} position={[0.02, -0.04, 0.16]}>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
        </mesh>
        <mesh ref={ear} material={fur} position={[-0.1, 0.18, 0]} rotation={[0, 0, 0.15]}>
          <coneGeometry args={[0.07, 0.16, 4]} />
        </mesh>
        <mesh material={fur} position={[0.1, 0.18, 0]} rotation={[0, 0, -0.15]}>
          <coneGeometry args={[0.07, 0.16, 4]} />
        </mesh>
        <group ref={eyes} visible={false}>
          {[-1, 1].map((s) => (
            <mesh key={s} material={glow(C.green5, 1.6)} position={[s * 0.07, 0.03, 0.18]}>
              <boxGeometry args={[0.05, 0.03, 0.02]} />
            </mesh>
          ))}
        </group>
      </group>
      <group ref={tail} position={[-0.42, 0.12, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={fur} position={[-0.02 + i * 0.12, 0, 0.18 + i * 0.1]} rotation={[0, -0.6 + i * 0.35, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 0.22, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cigarette smoke: single-pixel points with per-particle alpha
// ---------------------------------------------------------------------------

export function Smoke() {
  const level = getLevel();
  // three multiplies point size by the pixel ratio; undo that so a point is one art pixel
  const dpr = useThree((s) => s.viewport.dpr);
  const N = 16;
  const ref = useRef<THREE.Points>(null);
  const { geo, life } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 4), 4));
    const l = new Float32Array(N);
    for (let i = 0; i < N; i++) l[i] = i / N;
    return { geo: g, life: l };
  }, []);

  useEffect(() => ref.current?.layers.set(NO_OUTLINE), []);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    const o = level.anchors.smoke;
    for (let i = 0; i < N; i++) {
      life[i] += Math.min(delta, 0.05) / 4.5;
      if (life[i] > 1) life[i] -= 1;
      const a = life[i];
      const curl = Math.sin(a * 6 + t * 0.8) * a * 0.18;
      pos.setXYZ(i, o.x + curl + a * 0.12, o.y + a * 1.8, o.z + Math.cos(a * 5 + t * 0.5) * a * 0.08);
      const fade = Math.sin(Math.min(1, a * 1.2) * Math.PI) * 0.45;
      col.setXYZ(i, 0.42, 0.4, 0.46);
      col.setW(i, fade);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial vertexColors size={1 / dpr} sizeAttenuation={false} transparent depthWrite={false} />
    </points>
  );
}
