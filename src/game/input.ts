/** Held-key state, polled from the frame loop. */
export const held = new Set<string>();

export function axis() {
  let x = 0;
  let z = 0;
  if (held.has("KeyA") || held.has("ArrowLeft")) x -= 1;
  if (held.has("KeyD") || held.has("ArrowRight")) x += 1;
  if (held.has("KeyW") || held.has("ArrowUp")) z -= 1;
  if (held.has("KeyS") || held.has("ArrowDown")) z += 1;
  return { x, z, run: held.has("ShiftLeft") || held.has("ShiftRight") };
}
