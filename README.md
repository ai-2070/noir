# Noir — The Larkin Job

A small three.js detective vignette that renders a real 3D scene as pixel art:
a cutaway, three-room office (lobby, private office, darkroom) seen from a high
3/4 camera. The lighting, palette and characters aim for a moodier, more grown-up
take on cosy cutaway pixel art.

```bash
bun install
bun dev        # http://localhost:3000
```

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | walk (`Shift` to hurry) |
| `E` | examine / talk; `E`, `Space` or `Enter` advance dialogue |
| `1` `2` `3` `4` | toggle pixelation, outlines, palette, dither (compare against the raw render) |
| `[` `]` | change the pixel scale (starts on *auto*, fitted to ~270 art lines) |

Find the four clues, then take the stairs down.

## How the look is made

All in `src/game/components/PixelRenderer.tsx`, which takes over R3F's render loop:

1. **Low-res render.** The scene draws into a small HDR target. The camera distance is
   chosen so one world unit is 16 art pixels, matching the 16-texel-per-unit textures.
2. **Normal + depth pass** of the same view, used for outlines.
3. **Composite** at full resolution with nearest sampling. Per art pixel it applies:
   - depth-edge silhouettes, drawn as a darker shade of the surface's own colour (selective outlining)
   - normal-crease highlights on convex edges
   - a vignette, a soft exponential tone map, 4×4 Bayer dithering and a snap to a
     ~60-colour hue-shifted palette (3D LUT in OKLab, `src/game/palette.ts`)
4. **Pixel-stable camera.** The camera moves only in whole art pixels. The leftover
   fraction slides the upscaled image, so panning is smooth and texels never swim.
   The dither pattern is anchored to the same grid.

Lighting is stepped toon shading (`materials.ts`) with hard, low-resolution shadow maps.
Practical lights flicker, and the window throws moonlight striped by a venetian-blind cookie.
Textures are drawn procedurally on canvases (`textures.ts`). Static props are built
from primitives and merged by material (`kit.ts`, `props.ts`, `level.ts`), so the
whole set costs a few dozen draw calls per pass.

## Layout

```
src/game/
  Game.tsx              canvas, keyboard, overlay wiring
  components/
    PixelRenderer.tsx   render pipeline + camera rig
    World.tsx           lights, city-through-the-window shader, dust
    Actors.tsx          Cole (player), Vera, the cat, cigarette smoke
    Overlay.tsx         HUD, prompt, dialogue, title/end cards
  level.ts / props.ts   the set, colliders, interactables
  story.ts / store.ts   dialogue, clues, game state (zustand)
```
