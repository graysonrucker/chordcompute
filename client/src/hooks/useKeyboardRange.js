import { useMemo, useState } from "react";

const MIDI_MIN = 21;   // A0
const MIDI_MAX = 108;  // C8
const BASE_START = 60; // C4
const BASE_END = 71;   // B4

export function useKeyboardRange() {
  const [leftOctaves, setLeftOctaves] = useState(0);
  const [rightOctaves, setRightOctaves] = useState(0);

  const maxLeftOctaves = useMemo(
    () => Math.ceil((BASE_START - MIDI_MIN) / 12),
    []
  );
  const maxRightOctaves = useMemo(
    () => Math.ceil((MIDI_MAX - BASE_END) / 12),
    []
  );

  const unclampedStart = BASE_START - 12 * leftOctaves;
  const unclampedEnd = BASE_END + 12 * rightOctaves;

  const startMidi = Math.max(MIDI_MIN, unclampedStart);
  const endMidi = Math.min(MIDI_MAX, unclampedEnd);

  const canAddLeft = leftOctaves < maxLeftOctaves;
  const canAddRight = rightOctaves < maxRightOctaves;

  const addLeft = () => setLeftOctaves(v => Math.min(maxLeftOctaves, v + 1));
  const removeLeft = () => setLeftOctaves(v => Math.max(0, v - 1));
  const addRight = () => setRightOctaves(v => Math.min(maxRightOctaves, v + 1));
  const removeRight = () => setRightOctaves(v => Math.max(0, v - 1));

  return {
    startMidi,
    endMidi,
    leftOctaves,
    rightOctaves,
    canAddLeft,
    canAddRight,
    addLeft,
    removeLeft,
    addRight,
    removeRight,
  };
}