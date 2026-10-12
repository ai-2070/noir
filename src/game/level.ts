import * as THREE from "three";
import { Kit, type AABB } from "./kit";
import { toon } from "./materials";
import { C } from "./palette";
import * as P from "./props";
import {
  calendarTexture,
  capTexture,
  checkerTexture,
  concreteTexture,
  corkboardTexture,
  darkroomWallTexture,
  officeWallTexture,
  paintingTexture,
  plankTexture,
  receptionWallTexture,
  rugTexture,
  signTexture,
  slabTexture,
  WALL_H,
} from "./textures";

export interface Interactable {
  id: string;
  label: string;
  /** World position the prompt hangs from. */
  pos: THREE.Vector3;
  /** How close Cole must be (XZ). Defaults to 2.9. */
  reach?: number;
}

export interface LightDef {
  kind: "point" | "spot";
  pos: THREE.Vector3;
  color: string;
  intensity: number;
  distance: number;
  decay?: number;
  shadow?: boolean;
  flicker?: "bulb" | "neon" | "safelight";
  /** Flicker phase; neon lights share theirs with the window shader. */
  seed?: number;
  target?: THREE.Vector3;
  angle?: number;
  /** Projected light pattern. */
  cookie?: "blinds";
}

export interface WindowDef {
  center: THREE.Vector3;
  w: number;
  h: number;
  seed: number;
}

export interface Level {
  set: THREE.Group;
  colliders: AABB[];
  interactables: Interactable[];
  lights: LightDef[];
  windows: WindowDef[];
  anchors: {
    player: THREE.Vector3;
    vera: THREE.Vector3;
    cat: THREE.Vector3;
    catYaw: number;
    smoke: THREE.Vector3;
    exitZ: number;
  };
  heightAt: (x: number, z: number) => number;
  /** Camera focus is clamped to this XZ box so the frame never drifts into empty void. */
  cameraBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const T = 0.7; // wall thickness
const FRONT = 3; // z of the cut front edge of every room
const H = WALL_H;

// Stairs down to the street, cut into the lobby's front edge.
const STAIR = { x0: -5, x1: -2, z0: FRONT, run: 3.6, drop: 2.7, steps: 6 };

export function buildLevel(): Level {
  const k = new Kit();
  const interactables: Interactable[] = [];
  const lights: LightDef[] = [];
  const windows: WindowDef[] = [];
  const smoke = new THREE.Vector3();
  const at = (id: string, label: string, x: number, y: number, z: number, reach?: number) =>
    interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), reach });

  const mats = {
    cap: toon("#ffffff", { map: capTexture() }),
    slab: toon("#ffffff", { map: slabTexture() }),
    office: toon("#ffffff", { map: officeWallTexture() }),
    reception: toon("#ffffff", { map: receptionWallTexture() }),
    darkroom: toon("#ffffff", { map: darkroomWallTexture() }),
    planks: toon("#ffffff", { map: plankTexture() }),
    checker: toon("#ffffff", { map: checkerTexture() }),
    concrete: toon("#ffffff", { map: concreteTexture() }),
    trim: toon(C.wood1),
    trimLt: toon(C.wood3),
  };

  // --- wall helpers -------------------------------------------------------
  const wall = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, y0 = 0, y1 = H, collide = true) => {
    const w = x1 - x0;
    const d = z1 - z0;
    k.box(w, y1 - y0, d, x0 + w / 2, y0, z0 + d / 2, mat, { worldUV: [2, H] });
    if (collide && y0 === 0) k.collide(x0 + w / 2, z0 + d / 2, w, d);
  };
  const cap = (x0: number, x1: number, z0: number, z1: number) => {
    k.box(x1 - x0, 0.08, z1 - z0, (x0 + x1) / 2, H, (z0 + z1) / 2, mats.cap, { worldUV: [1, 1], cast: false });
  };
  /** Wall running along X (a back wall), with optional window hole. */
  const backWall = (x0: number, x1: number, zFace: number, mat: THREE.Material, hole?: { a: number; b: number; y0: number; y1: number }) => {
    const z0 = zFace - T;
    if (!hole) wall(x0, x1, z0, zFace, mat);
    else {
      wall(x0, hole.a, z0, zFace, mat);
      wall(hole.b, x1, z0, zFace, mat);
      wall(hole.a, hole.b, z0, zFace, mat, 0, hole.y0, false);
      wall(hole.a, hole.b, z0, zFace, mat, hole.y1, H, false);
      k.collide((hole.a + hole.b) / 2, z0 + T / 2, hole.b - hole.a, T);
    }
    cap(x0, x1, z0, zFace);
  };
  /** Partition running along Z at x, split down the middle so each side wears its own room's paper. */
  const partition = (x: number, z0: number, z1: number, left: THREE.Material, right: THREE.Material, door: { a: number; b: number; h: number }) => {
    for (const [xa, xb, m] of [[x - T / 2, x, left], [x, x + T / 2, right]] as const) {
      wall(xa, xb, z0, door.a, m);
      wall(xa, xb, door.b, z1, m);
      wall(xa, xb, door.a, door.b, m, door.h, H, false);
    }
    cap(x - T / 2, x + T / 2, z0, z1);
    // door casing on both faces
    for (const s of [-1, 1]) {
      const fx = x + s * (T / 2 + 0.05);
      k.box(0.12, door.h + 0.2, 0.22, fx, 0, door.a - 0.08, mats.trim);
      k.box(0.12, door.h + 0.2, 0.22, fx, 0, door.b + 0.08, mats.trim);
      k.box(0.12, 0.22, door.b - door.a + 0.4, fx, door.h, (door.a + door.b) / 2, mats.trim);
    }
  };
  const floor = (x0: number, x1: number, z0: number, z1: number, mat: THREE.Material, tile: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    k.decal(w, d, x0 + w / 2, 0, z0 + d / 2, mat, { worldUV: [tile, tile] });
    k.box(w, 0.8, d, x0 + w / 2, -0.802, z0 + d / 2, mats.slab, { worldUV: [1, 1], cast: false });
  };

  // ======================================================================
  // Shell
  // ======================================================================
  // Office      x [3, 19]    z [-12, FRONT]
  // Reception   x [-12, 3]   z [-10, FRONT]
  // Darkroom    x [-22, -12] z [-8, FRONT]
  floor(3, 19 + T, -12 - T, FRONT, mats.planks, 4);
  floor(-12, 3, -10 - T, FRONT, mats.checker, 2);
  floor(-22 - T, -12, -8 - T, FRONT, mats.concrete, 4);

  backWall(3 - T / 2, 19 + T, -12, mats.office, { a: 9, b: 13, y0: 1.4, y1: 3.9 });
  backWall(-12, 3, -10, mats.reception, { a: 0, b: 2.2, y0: 1.5, y1: 3.6 });
  backWall(-22 - T, -12, -8, mats.darkroom);
  // outer side walls
  wall(19, 19 + T, -12 - T, FRONT, mats.office);
  cap(19, 19 + T, -12, FRONT);
  wall(-22 - T, -22, -8, FRONT, mats.darkroom);
  cap(-22 - T, -22, -8, FRONT);
  // partitions
  partition(3, -12 - T, FRONT, mats.reception, mats.office, { a: -3.5, b: -0.5, h: 3.6 });
  partition(-12, -10 - T, FRONT, mats.darkroom, mats.reception, { a: -4, b: -1, h: 3.6 });
  // the reception partition past the darkroom's shallower back wall faces void on its left
  k.collide(-12, -9.4, T, 2.8);

  // front edge: invisible rail everywhere except the stairwell
  k.collide((-23 + STAIR.x0) / 2, FRONT + 0.4, STAIR.x0 + 23, 0.8);
  k.collide((STAIR.x1 + 20) / 2, FRONT + 0.4, 20 - STAIR.x1, 0.8);

  // ======================================================================
  // Office
  // ======================================================================
  {
    // window: frame, mullion, sill, venetian blinds (real geometry; the
    // moonlight's shadow map turns the slats into stripes on the floor)
    const zf = -12;
    k.box(4.3, 0.16, 0.5, 11, 1.26, zf + 0.1, mats.trimLt);
    k.box(4.2, 0.14, 0.14, 11, 3.88, zf + 0.04, mats.trim);
    k.box(0.14, 2.5, 0.14, 8.95, 1.4, zf + 0.04, mats.trim);
    k.box(0.14, 2.5, 0.14, 13.05, 1.4, zf + 0.04, mats.trim);
    k.box(0.1, 2.5, 0.1, 11, 1.4, zf - 0.3, mats.trim);
    // blinds drawn up into a stack under the head rail; their striped shadow
    // is projected by the moonlight's cookie (see SceneLight)
    k.box(4.0, 0.12, 0.22, 11, 3.72, zf + 0.16, toon(C.grey2));
    k.box(3.96, 0.26, 0.2, 11, 3.46, zf + 0.17, toon(C.grey3));
    for (let i = 0; i < 4; i++) k.box(3.98, 0.02, 0.21, 11, 3.48 + i * 0.06, zf + 0.17, toon(C.grey1), { cast: false });
    for (const x of [9.6, 12.4]) k.box(0.02, 1.6, 0.02, x, 1.9, zf + 0.22, toon(C.grey1), { cast: false });
    windows.push({ center: new THREE.Vector3(11, 2.65, zf - T - 0.4), w: 4.8, h: 3.2, seed: 1 });
    at("window", "Window", 11, 3.1, -11.6);

    k.push(11, 0, -11.62);
    P.radiator(k, 3.6);
    k.pop();

    k.decal(8.2, 6.2, 11, 0.01, -4.9, toon("#ffffff", { map: rugTexture(8.2, 6.2, "oxblood") }));

    // desk and what's on it
    k.push(11, 0, -6);
    P.executiveDesk(k);
    k.pop();
    const top = 1.56;
    k.push(9.2, top, -6.7, 0.15);
    const bulb = P.bankerLamp(k);
    const bulbW = k.here(bulb.x, bulb.y, bulb.z);
    k.pop();
    lights.push({ kind: "point", pos: bulbW, color: "#ffd59a", intensity: 14, distance: 11, decay: 1.6, shadow: true, flicker: "bulb" });
    at("lamp", "Desk lamp", 9.2, 2.5, -6.7);

    k.push(11.3, top, -6.4, Math.PI + 0.06);
    P.typewriter(k);
    k.pop();
    at("typewriter", "Typewriter", 11.3, 2.5, -6.4);

    k.push(10.1, top, -5.4, 0.1);
    P.paperStack(k, 8);
    k.pop();

    k.push(12.65, top, -5.35, 0);
    const tip = P.ashtray(k);
    smoke.copy(k.here(tip.x, tip.y, tip.z));
    k.pop();
    k.push(13.05, top, -5.2, 0);
    P.matchbook(k);
    k.pop();
    at("matchbook", "Ashtray", 12.8, 2.1, -5.3);

    k.push(13.05, top, -6.7, 0);
    P.bottle(k);
    k.pop();
    k.push(12.55, top, -6.35, 0);
    P.tumbler(k);
    k.pop();
    at("whiskey", "Bottle of rye", 12.85, 2.5, -6.55);

    k.push(10.15, top, -6.85, 0.3);
    P.candlestickPhone(k);
    k.pop();
    at("phone", "Telephone", 10.15, 2.5, -6.85);

    k.push(11, top, -5.0, 0);
    P.nameplate(k, "COLE");
    k.pop();

    k.push(11, 0, -8.5, 0);
    P.swivelChair(k);
    k.pop();
    k.push(9.3, 0, -2.6, Math.PI + 0.25);
    P.clientChair(k);
    k.pop();
    k.push(12.7, 0, -2.6, Math.PI - 0.25);
    P.clientChair(k);
    k.pop();

    // back wall, left of window
    k.push(4.3, 0, -11.38);
    P.filingCabinet(k);
    k.pop();
    k.push(5.5, 0, -11.38);
    P.filingCabinet(k);
    k.pop();
    at("files", "Filing cabinets", 4.9, 3.0, -11.2);
    k.push(4.9, 3.15, -11.97);
    P.framed(k, signTexture("LICENSED", C.ink2, C.grey5, 2), 1.2, 0.6);
    k.pop();

    k.push(7.3, 0, -10.9);
    P.coatRack(k);
    k.pop();
    at("coatrack", "Coat rack", 7.3, 3.6, -10.9);

    // right of window
    k.push(15.3, 0, -11.5);
    P.bookshelf(k, 2.6, 3.9, 0.9, 4);
    k.pop();
    at("bookshelf", "Bookshelf", 15.3, 3.4, -11.1);
    k.push(17.85, 2.15, -11.97);
    P.framed(k, corkboardTexture(), 2.0, 1.33);
    k.pop();
    at("pinboard", "Pinboard", 17.85, 3.2, -11.6);

    k.push(17.9, 0, -9.1);
    P.safe(k);
    k.pop();
    at("safe", "Safe", 17.9, 2.4, -8.4);

    // reading corner
    k.push(16.6, 0, -0.5, -Math.PI / 2 - 0.35);
    P.armchair(k);
    k.pop();
    at("cat", "Cat", 16.6, 1.9, -0.4);
    k.push(16.9, 0, 1.75);
    P.sideTable(k);
    k.pop();
    k.push(16.9, 1.35, 1.75, -0.5);
    P.radio(k);
    k.pop();
    at("radio", "Radio", 16.9, 2.6, 1.75);
    k.push(18.3, 0, -2.4);
    const fl = P.floorLamp(k);
    lights.push({ kind: "point", pos: k.here(fl.x, fl.y, fl.z), color: "#ffc27a", intensity: 11, distance: 9, decay: 1.7, flicker: "bulb" });
    k.pop();

    // moonlight through the blinds
    const winC = new THREE.Vector3(11, 2.65, -12);
    // raking in from the right so the striped patch lands on open floor beside the desk
    const dir = new THREE.Vector3(-0.5, -Math.sin(0.4), Math.cos(0.4)).normalize();
    lights.push({
      kind: "spot",
      pos: winC.clone().addScaledVector(dir, -24),
      target: winC.clone().addScaledVector(dir, 8),
      color: "#9fbde0",
      intensity: 9,
      distance: 0,
      decay: 0,
      angle: 0.18,
      shadow: true,
      cookie: "blinds",
    });
    // neon from the hotel sign across the street
    lights.push({ kind: "point", pos: new THREE.Vector3(12.5, 3.6, -13.6), color: "#ff4d7d", intensity: 5, distance: 9, decay: 1.4, flicker: "neon", seed: 10 });
  }

  // ======================================================================
  // Reception
  // ======================================================================
  {
    const zf = -10;
    // window
    k.box(2.5, 0.16, 0.45, 1.1, 1.36, zf + 0.1, mats.trimLt);
    k.box(2.4, 0.14, 0.14, 1.1, 3.58, zf + 0.04, mats.trim);
    k.box(0.12, 2.1, 0.1, 1.1, 1.5, zf - 0.3, mats.trim);
    k.box(2.2, 0.1, 0.1, 1.1, 2.5, zf - 0.3, mats.trim);
    windows.push({ center: new THREE.Vector3(1.1, 2.55, zf - T - 0.4), w: 3.0, h: 2.8, seed: 2 });
    at("window2", "Window", 1.1, 2.9, -9.6);
    lights.push({ kind: "point", pos: new THREE.Vector3(1.1, 3.0, -11.6), color: "#39d0c8", intensity: 3.2, distance: 8, decay: 1.4, flicker: "neon", seed: 13 });

    k.push(1.1, 0, -9.4);
    P.bench(k, 2.4);
    k.pop();
    at("bench", "Bench", 1.1, 1.8, -9.0);
    k.push(1.0, 0, -7.4);
    P.magazineTable(k);
    k.pop();

    // door to the corridor (decorative: the elevator's been out for years)
    k.push(-3.2, 0, zf + 0.1);
    P.door(k);
    k.pop();
    k.collide(-3.2, zf + 0.2, 2.4, 0.4);
    at("door", "Door", -3.2, 2.6, -9.6);
    k.push(-3.2, 4.15, zf);
    P.wallClock(k);
    k.pop();
    k.push(-1.25, 0, -9.45);
    P.umbrellaStand(k);
    k.pop();
    at("umbrella", "Umbrella", -1.25, 2.2, -9.3);

    for (const x of [-5.3, -0.9]) {
      k.push(x, 3.6, zf);
      const b = P.sconce(k);
      lights.push({ kind: "point", pos: k.here(b.x, b.y, b.z), color: "#ffcf8a", intensity: 6, distance: 7, decay: 1.6, flicker: "bulb" });
      k.pop();
    }

    k.push(-10.1, 1.75, zf);
    P.framed(k, calendarTexture(), 1.5, 1.875);
    k.pop();
    at("calendar", "Calendar", -10.1, 3.2, -9.6);
    k.push(-7.5, 2.2, zf);
    P.framed(k, paintingTexture(), 2.5, 1.625);
    k.pop();

    k.push(-11.15, 0, -9.3);
    P.waterCooler(k);
    k.pop();
    at("cooler", "Water cooler", -11.15, 2.6, -9.0);

    // Vera's desk
    k.push(-7, 0, -5.2);
    P.receptionDesk(k);
    k.pop();
    const vt = 1.5;
    k.push(-8.55, vt, -5.5);
    const vb = P.deskLamp(k);
    lights.push({ kind: "point", pos: k.here(vb.x, vb.y, vb.z), color: "#ffcf8a", intensity: 5.5, distance: 6, decay: 1.6, flicker: "bulb" });
    k.pop();
    k.push(-6.75, vt, -5.55, Math.PI);
    P.typewriter(k);
    k.pop();
    k.push(-5.35, vt, -5.6, -0.3);
    P.candlestickPhone(k);
    k.pop();
    k.push(-5.45, vt, -4.65);
    P.vase(k);
    k.pop();
    k.push(-8.1, vt, -4.7, 0.1);
    P.inbox(k);
    k.pop();
    k.push(-7, vt, -4.35);
    P.nameplate(k, "VERA");
    k.pop();
    k.push(-7, 0, -6.95, 0);
    P.clientChair(k);
    k.pop();
    at("vera", "Vera", -7, 3.1, -6.8, 4.9); // talked to across the desk

    k.decal(6, 4.4, -3.6, 0.01, -0.8, toon("#ffffff", { map: rugTexture(6, 4.4, "navy") }));

    k.push(-11.05, 0, 2.1);
    P.pottedPlant(k, 1);
    k.pop();
    at("plant", "Fern", -11.05, 2.4, 2.1);
    k.push(2.0, 0, 2.1);
    P.pottedPlant(k, 4);
    k.pop();

    // stairwell down to the street
    const { x0, x1, z0, run, drop, steps } = STAIR;
    const depth = run / steps;
    const rise = drop / steps;
    const sw = x1 - x0;
    for (let i = 0; i < steps; i++) {
      const topY = -(i + 1) * rise;
      k.box(sw, 3.6 + topY, depth, (x0 + x1) / 2, -3.6, z0 + depth * (i + 0.5), mats.planks, { worldUV: [4, 4] });
      k.box(sw, 0.06, 0.08, (x0 + x1) / 2, topY - 0.02, z0 + depth * i + 0.04, mats.trimLt);
    }
    k.box(sw + 0.6, 0.6, 1.6, (x0 + x1) / 2, -drop - 0.6, z0 + run + 0.8, mats.planks, { worldUV: [4, 4] });
    for (const sx of [x0 - 0.15, x1 + 0.15]) {
      for (let i = 0; i < steps; i++) {
        const topY = -(i + 1) * rise;
        k.box(0.3, 3.0 + topY + 0.5, depth, sx, -3.0, z0 + depth * (i + 0.5), mats.trim);
      }
      // newel posts + banister
      k.box(0.2, 1.6, 0.2, sx, 0, z0 + 0.1, mats.trimLt);
      k.sphere(0.13, sx, 1.65, z0 + 0.1, mats.trimLt);
      k.box(0.2, 1.4, 0.2, sx, -drop, z0 + run, mats.trimLt);
      const len = Math.hypot(run, drop);
      k.add(new THREE.BoxGeometry(0.12, 0.12, len), sx, 1.4 - drop / 2, z0 + run / 2, mats.trimLt, { rot: [Math.atan2(drop, run), 0, 0] });
    }
    k.collide(x0 - 0.3, z0 + 2.6, 0.5, 5.6);
    k.collide(x1 + 0.3, z0 + 2.6, 0.5, 5.6);
    k.collide((x0 + x1) / 2, z0 + run + 1.9, sw + 1, 0.4);
    lights.push({ kind: "point", pos: new THREE.Vector3((x0 + x1) / 2, -1.2, z0 + run + 0.8), color: "#6585ad", intensity: 2.2, distance: 6, decay: 1.5 });
  }

  // ======================================================================
  // Darkroom
  // ======================================================================
  {
    const zf = -8;
    k.push(-17.8, 0, zf + 0.65);
    P.darkroomCounter(k, 7.6);
    k.pop();
    const ct = 1.47;
    k.push(-21.2, ct, -7.55);
    P.chemBottles(k);
    k.pop();
    k.push(-18.6, ct, -7.3);
    P.trays(k);
    k.pop();
    at("trays", "Developing trays", -18.6, 2.0, -7.0);
    k.push(-15.3, ct, -7.3);
    P.enlarger(k);
    k.pop();
    at("enlarger", "Enlarger", -15.3, 3.4, -7.0);

    k.push(-13.1, 3.5, zf);
    const sl = P.safelight(k);
    lights.push({ kind: "point", pos: k.here(sl.x, sl.y, sl.z), color: "#ff3020", intensity: 18, distance: 15, decay: 1.5, shadow: true, flicker: "safelight" });
    k.pop();
    at("safelight", "Safelight", -13.1, 3.6, -7.6);

    // prints drying over the counter
    k.push(-19.0, 4.25, -7.15);
    P.clothesline(k, 5.2, ["street", "car", "clue", "blank"]);
    k.pop();
    at("photo", "Hanging prints", -18.0, 3.6, -7.0);

    k.push(-21.2, 0, -3.4, Math.PI / 2);
    P.sink(k);
    k.pop();
    at("sink", "Sink", -21.2, 1.9, -3.4);
    k.push(-21.4, 0, 0.6, Math.PI / 2);
    P.metalShelves(k, 2.6);
    k.pop();
    at("shelves", "Shelves", -21.2, 3.0, 0.6);

    // light-tight curtain pulled aside in the doorway
    for (const z of [-3.75, -1.25]) k.box(0.12, 3.5, 0.55, -12.5, 0.05, z, toon(C.ink1));
    k.box(0.06, 0.06, 3.6, -12.5, 3.55, -2.5, toon(C.grey2));
    k.decal(0.6, 0.6, -17, 0.012, -1.2, toon(C.ink2));
    for (let i = 0; i < 4; i++) k.decal(0.5, 0.05, -17, 0.014, -1.4 + i * 0.13, toon(C.grey0));
  }

  return {
    set: k.build(),
    colliders: k.colliders,
    interactables,
    lights,
    windows,
    anchors: {
      player: new THREE.Vector3(10.2, 0, -0.4),
      vera: new THREE.Vector3(-7, 0, -6.95),
      cat: new THREE.Vector3(16.75, 1.1, -0.45),
      catYaw: -Math.PI / 2 - 0.35,
      smoke,
      exitZ: STAIR.z0 + STAIR.run - 0.2,
    },
    heightAt: (x, z) => {
      if (x > STAIR.x0 - 0.3 && x < STAIR.x1 + 0.3 && z > STAIR.z0) {
        return -Math.min(1, (z - STAIR.z0) / STAIR.run) * STAIR.drop;
      }
      return 0;
    },
    cameraBounds: { minX: -15, maxX: 12, minZ: -6.6, maxZ: -3.2 },
  };
}
