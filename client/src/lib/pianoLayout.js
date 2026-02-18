export const WHITE_W = 64;
export const BLACK_W = 40;
export const WHITE_H = 220;
export const BLACK_H = 140;

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