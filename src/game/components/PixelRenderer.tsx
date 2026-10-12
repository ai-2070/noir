"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { buildPaletteLUT, C } from "../palette";
import { getLevel, rig } from "../rig";
import { useGame } from "../store";
import { TPU } from "../textures";

/** Objects on this layer are drawn in colour but skipped by the normal/depth pass (no outlines). */
export const NO_OUTLINE = 1;

/** Target art-pixel height of the screen; the integer scale is fitted to it. */
const TARGET_LINES = 270;

const vertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
precision highp sampler3D;

uniform sampler2D tColor;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform sampler3D tLUT;
uniform vec2 uLow;
uniform vec2 uScreen;
uniform float uScale;
uniform vec2 uOffset;
uniform vec2 uDitherOrigin;
uniform float uNear;
uniform float uFar;
uniform float uOutline;
uniform float uPalette;
uniform float uDither;
uniform float uExposure;
uniform vec3 uVoid;

layout(location = 0) out highp vec4 fragColor;

float depthAt(ivec2 p) {
  float d = texelFetch(tDepth, p, 0).r;
  return (uNear * uFar) / (uFar - d * (uFar - uNear));
}

vec3 normalAt(ivec2 p) {
  return texelFetch(tNormal, p, 0).rgb * 2.0 - 1.0;
}

const float bayer[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

// Exponential shoulder: highlights roll off, but unlike ACES it has no toe,
// so the low-key shadows keep enough value to land on distinct palette inks.
vec3 tonemap(vec3 x) {
  return 1.0 - exp(-x);
}

vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Every screen pixel inside one art pixel resolves to the same texel, so
  // all the work below is effectively done at art resolution.
  vec2 q = gl_FragCoord.xy / uScale + uOffset;
  ivec2 t = clamp(ivec2(floor(q)), ivec2(1), ivec2(uLow) - 2);
  vec3 col = texelFetch(tColor, t, 0).rgb;
  // Empty space around the cutaway: one flat palette ink, never dithered.
  if (texelFetch(tDepth, t, 0).r >= 0.99999) {
    fragColor = vec4(uVoid, 1.0);
    return;
  }

  if (uOutline > 0.5) {
    float d = depthAt(t);
    vec3 n = normalAt(t);
    ivec2 offs[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));
    float diff = 0.0;
    float crease = 0.0;
    for (int i = 0; i < 4; i++) {
      ivec2 tp = t + offs[i];
      float nd = depthAt(tp);
      diff += clamp(nd - d, 0.0, 4.0);
      vec3 nn = normalAt(tp);
      float side = clamp(smoothstep(-0.01, 0.01, dot(n - nn, vec3(1.0))), 0.0, 1.0);
      float shallower = clamp(sign((nd - d) * 0.25 + 0.0025), 0.0, 1.0);
      crease += (1.0 - dot(n, nn)) * side * shallower;
    }
    if (diff > 0.2 + d * 0.004) {
      // Silhouette: a darker, hue-kept version of the surface (selective
      // outlining) rather than flat black.
      col = col * 0.22 + vec3(0.004, 0.003, 0.007);
    } else if (crease > 0.12) {
      // Convex edge catch-light.
      col *= 1.55;
    }
  }

  // Vignette, evaluated at the texel centre so it dithers on the art grid.
  vec2 uv = ((vec2(t) + 0.5 - uOffset) * uScale) / uScreen;
  vec2 vc = (uv - 0.5) * vec2(uScreen.x / uScreen.y, 1.0);
  col *= 1.0 - 0.5 * smoothstep(0.38, 1.0, length(vc));

  col = toSRGB(tonemap(col * uExposure));

  if (uPalette > 0.5) {
    if (uDither > 0.5) {
      ivec2 dp = (t + ivec2(uDitherOrigin)) & 3;
      float b = bayer[dp.x + dp.y * 4] / 16.0 - 0.47;
      col += b * 0.026;
    }
    col = texture(tLUT, clamp(col, 0.0, 1.0) * (31.0 / 32.0) + 0.5 / 32.0).rgb;
  }

  fragColor = vec4(col, 1.0);
}
`;

function createPipeline() {
  const opts = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  };
  const colorRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, type: THREE.HalfFloatType });
  const normalRT = new THREE.WebGLRenderTarget(4, 4, { ...opts, type: THREE.UnsignedByteType });
  normalRT.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);

  const normalMat = new THREE.MeshNormalMaterial();
  const lut = buildPaletteLUT(32);

  const uniforms = {
    tColor: { value: colorRT.texture },
    tNormal: { value: normalRT.texture },
    tDepth: { value: normalRT.depthTexture },
    tLUT: { value: lut },
    uLow: { value: new THREE.Vector2(4, 4) },
    uScreen: { value: new THREE.Vector2(4, 4) },
    uScale: { value: 3 },
    uOffset: { value: new THREE.Vector2() },
    uDitherOrigin: { value: new THREE.Vector2() },
    uNear: { value: rig.camera.near },
    uFar: { value: rig.camera.far },
    uOutline: { value: 1 },
    uPalette: { value: 1 },
    uDither: { value: 1 },
    uExposure: { value: 1.25 },
    uVoid: { value: new THREE.Color(C.ink1) },
  };
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    colorRT,
    normalRT,
    normalMat,
    uniforms,
    quadScene,
    quadCam,
    dispose() {
      colorRT.dispose();
      normalRT.dispose();
      normalRT.depthTexture?.dispose();
      normalMat.dispose();
      lut.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}

const damp = (a: number, b: number, lambda: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

/**
 * Takes over R3F's render loop:
 *   1. scene → low-res HDR colour target (with shadows)
 *   2. scene → low-res normal + depth target (outline source)
 *   3. full-screen composite: nearest upscale with sub-pixel camera
 *      offset, outlines, tone map, ordered dither, palette snap.
 */
export function PixelRenderer() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const fx = useGame((s) => s.fx);
  const pixelScale = useGame((s) => s.pixelScale);
  const pipe = useMemo(createPipeline, []);

  useEffect(() => () => pipe.dispose(), [pipe]);

  useLayoutEffect(() => {
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const auto = Math.max(2, Math.round(buf.y / TARGET_LINES));
    const framing = pixelScale ?? auto;
    const rtScale = fx.pixel ? framing : 1;
    const m = rig.margin;
    const lw = Math.ceil(buf.x / rtScale) + m * 2;
    const lh = Math.ceil(buf.y / rtScale) + m * 2;
    pipe.colorRT.setSize(lw, lh);
    pipe.normalRT.setSize(lw, lh);

    const cam = rig.camera;
    cam.aspect = lw / lh;
    const worldPerTexel = rtScale / (TPU * framing);
    rig.distance = (lh * worldPerTexel) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    cam.updateProjectionMatrix();

    rig.rtScale = rtScale;
    rig.rtSize.set(lw, lh);
    rig.dpr = dpr;
    rig.cssHeight = size.height;

    const u = pipe.uniforms;
    u.uLow.value.set(lw, lh);
    u.uScreen.value.copy(buf);
    u.uScale.value = rtScale;
    useGame.getState().setActiveScale(framing);
    document.documentElement.style.setProperty("--px", `${framing / dpr}px`);
  }, [gl, size, dpr, fx.pixel, pixelScale, pipe]);

  useEffect(() => {
    const u = pipe.uniforms;
    u.uOutline.value = fx.outline ? 1 : 0;
    u.uPalette.value = fx.palette ? 1 : 0;
    u.uDither.value = fx.dither ? 1 : 0;
  }, [fx, pipe]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const cam = rig.camera;
    const b = getLevel().cameraBounds;

    // --- follow ---------------------------------------------------------
    // look a little past Cole, toward the back wall, like the reference framing
    const tx = THREE.MathUtils.clamp(rig.target.x, b.minX, b.maxX);
    const tz = THREE.MathUtils.clamp(rig.target.z - 4.5, b.minZ, b.maxZ);
    rig.focus.x = damp(rig.focus.x, tx, 3.2, dt);
    rig.focus.y = damp(rig.focus.y, rig.target.y * 0.6, 3.2, dt);
    rig.focus.z = damp(rig.focus.z, tz, 3.2, dt);

    const up = new THREE.Vector3(0, Math.cos(rig.pitch), -Math.sin(rig.pitch));
    const back = new THREE.Vector3(0, Math.sin(rig.pitch), Math.cos(rig.pitch));
    cam.position.copy(rig.focus).addScaledVector(back, rig.distance);
    cam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), up, back));

    // --- snap to the texel grid ----------------------------------------
    // Move the camera only in whole art pixels (so texels don't swim), and
    // hand the remainder to the composite, which slides the upscaled image
    // by that fraction for smooth scrolling.
    const texelWorld = (2 * rig.distance * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / rig.rtSize.y;
    const cx = cam.position.x / texelWorld;
    const cy = cam.position.dot(up) / texelWorld;
    const sx = Math.round(cx);
    const sy = Math.round(cy);
    cam.position.x += (sx - cx) * texelWorld;
    cam.position.addScaledVector(up, (sy - cy) * texelWorld);
    cam.updateMatrixWorld();
    rig.sub.set(cx - sx, cy - sy);

    const u = pipe.uniforms;
    u.uOffset.value.set(rig.margin + rig.sub.x, rig.margin + rig.sub.y);
    u.uDitherOrigin.value.set(((sx % 4) + 4) % 4, ((sy % 4) + 4) % 4);

    // --- 1. colour --------------------------------------------------------
    cam.layers.enable(NO_OUTLINE);
    gl.setRenderTarget(pipe.colorRT);
    gl.render(scene, cam);

    // --- 2. normals + depth --------------------------------------------
    const bg = scene.background;
    scene.background = null;
    scene.overrideMaterial = pipe.normalMat;
    cam.layers.disable(NO_OUTLINE);
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(pipe.normalRT);
    gl.setClearColor(0x8080ff, 1);
    gl.clear();
    gl.render(scene, cam);
    gl.shadowMap.autoUpdate = true;
    scene.overrideMaterial = null;
    scene.background = bg;
    cam.layers.enable(NO_OUTLINE);

    // --- 3. composite -----------------------------------------------------
    gl.setRenderTarget(null);
    gl.render(pipe.quadScene, pipe.quadCam);
  }, 1);

  return null;
}
