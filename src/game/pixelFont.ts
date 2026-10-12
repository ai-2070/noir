/**
 * A 3×5 bitmap font for in-world signage (nameplates, calendar, labels).
 * Canvas fillText anti-aliases, which turns to mush at 16 texels per unit;
 * these glyphs land on exact texels.
 */
const GLYPHS: Record<string, string> = {
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "110001010100111",
  "3": "110001010001110",
  "4": "101101111001001",
  "5": "111100110001110",
  "6": "011100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001110",
  ".": "000000000000010",
  ",": "000000000010100",
  "-": "000000111000000",
  "'": "010010000000000",
  "!": "010010010000010",
  "&": "010101010101011",
  ":": "000010000010000",
  "/": "001001010100100",
  "#": "101111101111101",
  " ": "000000000000000",
};

export function textWidth(text: string, spacing = 1) {
  return text.length * (3 + spacing) - spacing;
}

/** Draws text with its top-left corner at (x, y) in texel coordinates. */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  spacing = 1,
) {
  ctx.fillStyle = color;
  let cx = Math.round(x);
  for (const ch of text.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    for (let i = 0; i < 15; i++) {
      if (g[i] === "1") ctx.fillRect(cx + (i % 3), Math.round(y) + Math.floor(i / 3), 1, 1);
    }
    cx += 3 + spacing;
  }
}
