export const WHITE_W = 64;
export const BLACK_W = 40;
export const WHITE_H = 220;
export const BLACK_H = 140;

export function keyDimensions(octaveCount) {
  const maxW = 64;
  const minW = 28;

  const whiteW = octaveCount <= 3
    ? maxW
    : Math.round(maxW - (maxW - minW) * (Math.min(octaveCount, 7) - 3) / 4);

  const scale = whiteW / maxW;

  return {
    whiteW,
    blackW: Math.round(40 * scale),
    whiteH: Math.round(220 * scale),
    blackH: Math.round(140 * scale),
  };
}

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E",
  "F", "F#", "G", "G#", "A", "A#", "B",
];

export function pcName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  return NOTE_NAMES[pc];
}

export function isWhitePc(pc) {
  return (
    pc === 0 ||
    pc === 2 ||
    pc === 4 ||
    pc === 5 ||
    pc === 7 ||
    pc === 9 ||
    pc === 11
  );
}