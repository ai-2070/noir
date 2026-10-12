import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PartOpts {
  /** Euler rotation in radians, applied in the part's local frame. */
  rot?: [number, number, number];
  /** Casts shadows. Default true. */
  cast?: boolean;
  /**
   * World-space UV projection: [unitsPerTileU, unitsPerTileV]. Vertical faces
   * map v to world height; horizontal faces use the U scale on both axes.
   * Omit to keep the geometry's own 0..1 face UVs (signs, paintings).
   */
  worldUV?: [number, number];
}

interface Bucket {
  material: THREE.Material;
  cast: boolean;
  geos: THREE.BufferGeometry[];
}

/**
 * Builds the static set from primitives with a transform stack, then merges
 * everything by material so the whole interior is a few dozen draw calls.
 * That matters: each frame renders the scene for colour, normals and
 * several shadow maps.
 */
export class Kit {
  private stack: THREE.Matrix4[] = [new THREE.Matrix4()];
  private buckets = new Map<string, Bucket>();
  readonly colliders: AABB[] = [];

  private get top() {
    return this.stack[this.stack.length - 1];
  }

  /** Enter a local frame at (x, y, z), rotated about Y. */
  push(x: number, y: number, z: number, rotY = 0) {
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    this.stack.push(this.top.clone().multiply(m));
    return this;
  }

  pop() {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }

  /** Current frame's local point → world. */
  here(x = 0, y = 0, z = 0) {
    return new THREE.Vector3(x, y, z).applyMatrix4(this.top);
  }

  /** Local rotation about Y → world yaw (for placing dynamic actors). */
  yaw(local = 0) {
    const e = new THREE.Euler().setFromRotationMatrix(this.top, "YXZ");
    return e.y + local;
  }

  add(geo: THREE.BufferGeometry, x: number, y: number, z: number, mat: THREE.Material, opts: PartOpts = {}) {
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(opts.rot ?? [0, 0, 0]))),
      new THREE.Vector3(1, 1, 1),
    );
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(this.top.clone().multiply(local));
    if (opts.worldUV) worldUV(g, opts.worldUV[0], opts.worldUV[1]);
    const cast = opts.cast ?? true;
    const key = mat.uuid + (cast ? "|c" : "|n");
    let b = this.buckets.get(key);
    if (!b) {
      b = { material: mat, cast, geos: [] };
      this.buckets.set(key, b);
    }
    b.geos.push(g);
    geo.dispose();
    return this;
  }

  /** Box whose BOTTOM sits at y (furniture is easier to author that way). */
  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z, mat, opts);
  }

  /** Cylinder whose bottom sits at y. */
  cyl(rTop: number, rBot: number, h: number, x: number, y: number, z: number, mat: THREE.Material, seg = 10, opts?: PartOpts) {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), x, y + h / 2, z, mat, opts);
  }

  sphere(r: number, x: number, y: number, z: number, mat: THREE.Material, opts?: PartOpts & { squash?: [number, number, number] }) {
    const g = new THREE.SphereGeometry(r, 10, 7);
    if (opts?.squash) g.scale(...opts.squash);
    return this.add(g, x, y, z, mat, opts);
  }

  /** Plane facing +Z (toward the camera) centred at (x, y, z). */
  panel(w: number, h: number, x: number, y: number, z: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(new THREE.PlaneGeometry(w, h), x, y, z, mat, { cast: false, ...opts });
  }

  /** Plane lying on the floor (facing +Y). */
  decal(w: number, d: number, x: number, y: number, z: number, mat: THREE.Material, opts?: PartOpts) {
    return this.add(new THREE.PlaneGeometry(w, d), x, y, z, mat, { cast: false, ...opts, rot: [-Math.PI / 2, 0, opts?.rot?.[2] ?? 0] });
  }

  /** Axis-aligned blocker in the current frame's local XZ. */
  collide(x: number, z: number, w: number, d: number) {
    const pts = [
      this.here(x - w / 2, 0, z - d / 2),
      this.here(x + w / 2, 0, z - d / 2),
      this.here(x - w / 2, 0, z + d / 2),
      this.here(x + w / 2, 0, z + d / 2),
    ];
    this.colliders.push({
      minX: Math.min(...pts.map((p) => p.x)),
      maxX: Math.max(...pts.map((p) => p.x)),
      minZ: Math.min(...pts.map((p) => p.z)),
      maxZ: Math.max(...pts.map((p) => p.z)),
    });
    return this;
  }

  build() {
    const group = new THREE.Group();
    group.name = "static-set";
    for (const b of this.buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      b.geos.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    return group;
  }
}

/** Projects UVs from world position by dominant normal axis. */
function worldUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);
    if (ay >= ax && ay >= az) {
      uv.setXY(i, x / su, -z / su);
    } else if (ax >= az) {
      uv.setXY(i, (nx > 0 ? -z : z) / su, y / sv);
    } else {
      uv.setXY(i, (nz > 0 ? x : -x) / su, y / sv);
    }
  }
  uv.needsUpdate = true;
}
