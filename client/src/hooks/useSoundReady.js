import { useEffect, useState } from "react";
import { isReady, isPianoLoading, isPlaying, onLoadChange } from "../lib/playback";

/** Re-renders when the playback load or playing state changes. */
export function useSoundReady() {
  const [ready, setReady] = useState(() => isReady());
  const [loading, setLoading] = useState(() => isPianoLoading());
  const [playing, setPlayingState] = useState(() => isPlaying());

  useEffect(() => {
    const update = () => {
      setReady(isReady());
      setLoading(isPianoLoading());
      setPlayingState(isPlaying());
    };
    return onLoadChange(update);
  }, []);

  return { ready, loading, playing };
}