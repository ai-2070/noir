<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Noir — The Larkin Job

A three.js (React Three Fiber) detective vignette that renders a real 3D scene as
pixel art. Read this before touching the look: most of what makes it read as
hand-made pixel art is an invariant spread across several files, and breaking
one of them (a smooth filter, an off-palette colour, a camera that moves by
fractions of a pixel) breaks the illusion everywhere.

Stack: Next.js 16 (Turbopack, React Compiler), R3F 9, three 0.186, zustand 5,
bun, TypeScript 7. `bun dev` to run, `bun run build` to check types.
`bun run lint` currently fails because typescript-eslint doesn't support TS 7 yet;
that problem was already in the repo and isn't ours.

## Art direction

The reference is cosy cutaway pixel art: a lit interior floating in a dark void,
seen from a high 3/4 view, with dark outlines and chunky texels. This project is
the **mature take** on it:

- **Setting.** It's 1947, at night, in a private eye's office. The story turns on
  money, a missing man and a photograph. Keep it adult and understated, with no
  cartoon gags.
- **Low-key lighting.** Light comes from practical sources: banker's lamp, floor
  lamp, sconces, neon through the windows, moonlight through venetian blinds and
  a red darkroom safelight. Pools of warm light sit against cool blue-violet
  shadow, and most of the frame should be in shade.
- **Realistic proportions.** Characters are adults: Cole is about 2.5 units to
  the crown, his head is small, he wears a long coat and his fedora is tipped low.
  Don't make them chibi or give them big heads.
- **A restrained, hue-shifted palette.** Shadows drift toward violet and blue,
  and highlights drift toward amber. Saturation is low, except for neon and the
  safelight, which are used sparingly as accents.
- **Restrained dithering.** Dithering is a soft ordered stipple in light falloff
  and gradients. It should never look like noise, and it never appears in the void.
- **Selective outlines.** A silhouette is a darker shade of the surface's own
  hue, never flat black. Convex creases get a one-pixel catch-light.
- **Cutaway set.** The front edge of every room is cut open at z = 3 (`FRONT`).
  There are no ceilings. Wall tops get a dark cap, which reads as the cut section.
  Everything outside the set is one flat ink colour (`C.ink1`).

## Pixel-art invariants (don't break these)

1. **16 texels per world unit** (`TPU` in `textures.ts`). Every procedural texture
   is authored at this density, and the camera distance is solved so that one
   world unit equals 16 art pixels at the focus. Walls are `WALL_H = 4.6` units
   high, and wall textures are exactly `WALL_H * TPU` pixels tall.
2. **Nearest filtering everywhere.** Textures and render targets use
   `NearestFilter`, have no mipmaps and set `imageSmoothingEnabled = false` on
   their canvases. The Canvas is created with `antialias: false` and `flat`.
3. **The palette is law.** Author colours from `C` in `palette.ts` (about 60
   inks). The composite snaps every pixel to `PALETTE` through a 32³ OKLab
   lookup table with chroma weighted ×1.4. When you add a colour, add it to
   `PALETTE` too. If a lit surface snaps to the wrong hue family, the usual fix
   is to add an intermediate ink to that ramp, as the lamplit orange-browns were.
   Don't add more dither.
4. **Pixel-snapped camera.** The camera translates only in whole art pixels. The
   sub-pixel remainder (`rig.sub`) is applied as a UV offset in the composite,
   and the Bayer origin (`uDitherOrigin`) is anchored to the same snap, so
   texels and dither never swim. Anything projected to the DOM, such as the
   interaction prompt, must go through `worldToScreen` and snap to `--px`.
5. **Integer upscale only.** The scale is `max(2, round(bufferHeight / 270))`
   (`TARGET_LINES = 270`), or the value the user picks with `[` `]`. The low-res
   target has a 2-pixel margin so the sub-pixel slide never shows an edge.
6. **Lighting is stepped.** Lit surfaces use `toon()` from `materials.ts`
   (MeshToonMaterial with a 4-step gradient `[0, 34, 150, 255]`) and are cached
   by key. Bulbs and glowing glass use `glow(color, boost)`, which is unlit and
   pushed into HDR so the tonemap blooms them. Don't use MeshStandardMaterial.
7. **Shadows are hard and low resolution.** Use `shadows="basic"`
   (BasicShadowMap) and never PCF or soft shadows.

## Render pipeline (`components/PixelRenderer.tsx`)

This file takes over R3F's loop with `useFrame(..., 1)`. Each frame it:

1. Renders the scene into a low-res HalfFloat target.
2. Renders the same view again with a `MeshNormalMaterial` override into a
   second target that has a `DepthTexture`.
3. Draws a full-screen GLSL3 composite at screen resolution. It must declare
   `layout(location = 0) out highp vec4 fragColor;`, because three r186 does not
   provide `gl_FragColor` under GLSL3. Per art texel, via `texelFetch`, it:
   - outputs flat `uVoid` wherever depth ≥ 0.99999;
   - draws depth-edge silhouettes as `col * 0.22` plus a violet bias;
   - multiplies normal-crease highlights by 1.55;
   - applies a vignette;
   - applies exposure (1.25) and the tonemap `1 - exp(-x)`. ACES crushed the
     low-key shadows into one ink, so don't go back to it;
   - adds 4×4 Bayer dither at amplitude 0.026 and looks the result up in the
     palette LUT.

Keys 1–4 toggle pixelation, outlines, palette and dither (`fx` in the store),
which lets you compare against the raw render.

Layer `NO_OUTLINE` (1) is visible to the main camera but excluded from the
normal/depth pass. Use it for smoke, dust, blob shadows, the moon occluder and
anything else that shouldn't draw outlines.

## Lighting (`components/World.tsx`, `level.ts`)

- **Ambient.** A hemisphere light (`#46557a` sky, `#24182a` ground, 3.2) gives
  cool night fill. Everything else is a `LightDef` in `level.ts`.
- **Practicals.** These are warm point lights (`#ffc27a` to `#ffd59a`) with a
  decay of about 1.6. Only a few cast shadows (the desk lamp and the safelight),
  because every shadow-casting point light costs six extra renders.
- **Flicker.** `flicker: "bulb" | "neon" | "safelight"` uses the curves in
  `rig.ts`. A neon light and the city-window shader share a `seed` so they
  stutter together.
- **Moonlight.** A cool `SpotLight` (`#9fbde0`) shines through the office window.
  A venetian-blind `cookie` projects the slat stripes (`blindsCookie()`, with an
  8 px period). The 3D blinds are drawn rolled up, because real slats read as a
  grey box. Spot cookies only work with `castShadow`.
- **Moon occluder.** Rooms have no ceilings, so an invisible box above the back
  wall stops moonlight from spilling over it. It is `colorWrite`/`depthWrite`
  false, on `NO_OUTLINE`, with `castShadow`. three culls shadow casters by the
  *view* camera's layers, so a shadow-only layer doesn't work.
- **Player key light.** Cole carries a dim personal light so he never vanishes
  into shade.
- **Windows.** `CityWindow` is a shader with a skyline, lit windows, a neon blade
  sign and rain. `DustMotes` are one-art-pixel points; divide the size by the
  pixel ratio.

## Building the set (`kit.ts`, `props.ts`, `level.ts`)

- **Built from primitives.** Static geometry is all primitives built through
  `Kit`: `push(x, y, z, rotY)` and `pop()` form a transform stack, `box()` puts
  its *bottom* at y, and the other builders are `cyl`, `sphere`, `panel`
  (textured quad) and `decal`. Call `collide()` to add an XZ AABB. `build()`
  merges geometry by material, which keeps the whole set to a few dozen draw
  calls. Don't add per-prop meshes for static things.
- **World-space UVs.** `worldUV: [u, v]` projects texture coordinates in world
  space, so planks and wallpaper line up across separate boxes and keep 16 TPU.
- **Prop functions.** A prop is a function `(k: Kit, …)` that builds around the
  current frame's origin. Shared materials live in `M` in `props.ts`, and
  wood-grain materials come from `grainTexture`.
- **Textures.** Every texture is procedural, drawn on a canvas by
  `textures.ts`, and seeded with `rng(seed)`. Text uses the 3×5 bitmap font in
  `pixelFont.ts`; it's legible at 1 texel per pixel. There are no image assets.
- **Rooms.** Walls are `T = 0.7` thick. The front edge is z = 3.
  - Office: x 3 to 19, z −12 to 3.
  - Reception/lobby: x −12 to 3, z −10 to 3.
  - Darkroom: x −22 to −12, z −8 to 3.
  - Stairs: x −5 to −2, descending out of the front edge. `heightAt()` ramps the
    stairs, and `anchors.exitZ` marks the way out.
- **Camera.** The camera focus follows `player.z - 4.5` and is clamped to
  `cameraBounds`, so the frame never drifts into void. Keep important props
  toward the front of each room: the 56° pitch and FOV 20 show only a limited
  depth.

## Characters (`components/Actors.tsx`)

- **Cole (the player).** He wears a tan coat (`#a8845a`) and a dark fedora. He
  has a walk cycle and a coat-skirt sway, walks at 5.8 and runs at 9.5 with
  Shift. He collides as a circle against the AABBs.
- **Interaction.** Cole picks the nearest interactable, biased toward the one he
  is facing. The default reach is 2.9; set a per-item `reach` for things behind
  furniture (Vera's is 4.9).
- **Vera.** She is the receptionist. She types and turns her head to watch Cole.
- **Ink.** Ink is the cat; its eyes glow when Cole is near.
- **Other actors.** `Smoke` (16 vertex-alpha points) rises from an ashtray, and
  `BlobShadow` puts a soft disc under each character, on `NO_OUTLINE`.

## Game, story, UI

- **State.** State lives in a zustand store (`store.ts`): the phase
  (`title`/`play`/`end`), clues, flags, dialogue, nearby, toast, fx and pixel
  scale. The `endedAt` field is set when the end card appears, and Enter only
  restarts after 2.5 s so mashed keys don't skip the ending.
- **Story** (`story.ts`). There are four clues (matchbook, calendar, ledger,
  photo). The calendar gates the safe's combination, Vera gives hints and
  `tryLeave` blocks the stairs until the case is complete. Write dialogue in a
  terse, hard-boiled first person.
- **UI** (`Overlay.tsx`, `globals.css`).
  - All UI is pixel-sized. The renderer sets the CSS variable `--px` to one art
    pixel in CSS pixels, so size borders, padding and shadows in multiples of
    `var(--px)`.
  - Fonts are Silkscreen (`--font-display`, for headings and labels) and VT323
    (`--font-body`, for dialogue).
  - UI colours come from the palette inks.
  - Dialogue types out at 52 characters per second. There is a reduced-motion
    rule.
- **Controls.**
  - WASD or the arrow keys move, and Shift hurries.
  - E interacts. E, Space or Enter advances dialogue.
  - 1–4 toggle the effects, and `[` `]` change the pixel scale.

## Testing

- **Dev handle.** In development, `window.__noir = { scene, rig, level, game }`
  is exposed. Set `rig.warp = new Vector3(...)` to teleport Cole on the next
  frame.
- **Headless runs.** Visual checks use puppeteer-core with the local Chrome
  against `bun dev`, driving key presses and taking screenshots. Check changes
  to look or lighting at 1080p with all of fx on and off.
- **Performance.** The target is a steady 60 fps at 1080p. Each extra
  shadow-casting light, or an unmerged static mesh, multiplies across the colour,
  normal and shadow passes.
