import { WHITE_W } from "./pianoLayout";

const BASE_START = 60; // C4
const BASE_END = 71; //B4

export function makeIsActiveFromNotes(noteList){
    const set = new Set(noteList);
    return (midi) => set.has(midi);
}

export function computeResultRange(voicingNotes){
    const minNote = Math.min(...voicingNotes);
    const maxNote = Math.max(...voicingNotes);

    const leftOctaves = Math.max(0, Math.ceil((BASE_START - minNote) / 12));
    const rightOctaves = Math.max(0, Math.ceil((maxNote - BASE_END) / 12));

    const startMidi = BASE_START - leftOctaves * 12;
    const endMidi = BASE_END + rightOctaves * 12;
    
    const octaveCount = 1 + leftOctaves + rightOctaves;
    const naturalWidth = octaveCount * 7 * WHITE_W;
    
    return { startMidi, endMidi, naturalWidth };
}

export function computeExpandedRange(notes) {
  const minNote = Math.min(...notes);
  const maxNote = Math.max(...notes);

  const leftOctaves = Math.max(0, Math.ceil((BASE_START - minNote) / 12));
  const rightOctaves = Math.max(0, Math.ceil((maxNote - BASE_END) / 12));

  const startMidi = BASE_START - leftOctaves * 12;
  const endMidi = BASE_END + rightOctaves * 12;

  return { startMidi, endMidi, leftOctaves, rightOctaves, minNote, maxNote };
}