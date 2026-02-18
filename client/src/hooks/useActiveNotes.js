// src/hooks/useActiveNotes.js
import { useCallback, useState } from "react";

export function useActiveNotes(initial = []) {
  const [activeNotes, setActiveNotes] = useState(initial);

  const isActive = useCallback(
    (midi) => activeNotes.includes(midi),
    [activeNotes]
  );

  const toggleMidi = useCallback((midi) => {
    setActiveNotes((prev) =>
      prev.includes(midi) ? prev.filter((n) => n !== midi) : [...prev, midi]
    );
  }, []);

  const clear = useCallback(() => setActiveNotes([]), []);

  return { activeNotes, setActiveNotes, isActive, toggleMidi, clear };
}