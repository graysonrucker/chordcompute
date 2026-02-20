import { useState, useCallback } from "react";
import { fetchVoicings } from "../lib/api";

export function useVoicingsQuery() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async (activeNotes) => {
    if (!activeNotes || activeNotes.length === 0) return;

    setLoading(true);
    setError("");

    try {
      const data = await fetchVoicings({ notes: activeNotes });
      setResults(data);
    } catch (e) {
      setResults(null);
      setError(e.message || "Failed to generate voicings");
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults(null);
    setError("");
  }, []);

  return {
    results,
    loading,
    error,
    generate,
    clear,
  };
}