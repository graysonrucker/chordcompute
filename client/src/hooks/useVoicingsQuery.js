import { useState, useCallback, useRef } from "react";
import {
  startVoicingsJob,
  getVoicingsJobStatus,
  getVoicingsJobPage,
  cancelVoicingsJob,
} from "../lib/api";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useVoicingsQuery() {
  const [results, setResults] = useState(null);
  // results shape:
  // {
  //   jobId, voicings, n, offset, limit, count, state
  // }

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  const jobIdRef = useRef(null);
  const canceledRef = useRef(false);

  const fetchPage = useCallback(async (offset) => {
    const jobId = jobIdRef.current;
    if (!jobId) return;

    setPageLoading(true);
    setError("");

    try {
      // keep page size consistent with whatever you want in UI
      const limit = results?.limit ?? 500;

      const page = await getVoicingsJobPage(jobId, offset, limit);

      setResults((prev) => {
        if (!prev || prev.jobId !== jobId) return prev;
        return {
          ...prev,
          voicings: page.items,
          offset: page.offset,
          n: page.n,
        };
      });
    } catch (e) {
      setError(e?.message || "Failed to fetch page");
    } finally {
      setPageLoading(false);
    }
  }, [results?.limit]);

  const generate = useCallback(async (activeNotes) => {
    if (!activeNotes || activeNotes.length === 0) return;

    canceledRef.current = false;

    // cancel any prior job
    if (jobIdRef.current) {
      try {
        await cancelVoicingsJob(jobIdRef.current);
      } catch {}
      jobIdRef.current = null;
    }

    setLoading(true);
    setPageLoading(false);
    setError("");
    setResults(null);

    await new Promise(requestAnimationFrame);

    try {
      const { jobId } = await startVoicingsJob(activeNotes);
      jobIdRef.current = jobId;

      let lastStatus = null;

      // Poll until done
      while (true) {
        if (canceledRef.current) return;

        const status = await getVoicingsJobStatus(jobId);
        lastStatus = status;

        if (status.state === "error") {
          throw new Error(status.error || "Job failed");
        }
        if (status.state === "done") break;

        await sleep(250);
      }

      const limit = 500; // <-- your UI page size (200/500/1000 etc.)
      const firstPage = await getVoicingsJobPage(jobId, 0, limit);

      setResults({
        jobId,
        voicings: firstPage.items,
        n: firstPage.n,
        offset: firstPage.offset,
        limit,
        count: lastStatus?.count ?? 0,
        state: lastStatus?.state ?? "done",
      });
    } catch (e) {
      setError(e?.message || "Failed to generate voicings");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const nextPage = useCallback(async () => {
    if (!results) return;
    const nextOffset = results.offset + results.limit;
    if (nextOffset >= results.count) return;
    await fetchPage(nextOffset);
  }, [results, fetchPage]);

  const prevPage = useCallback(async () => {
    if (!results) return;
    const prevOffset = Math.max(0, results.offset - results.limit);
    if (prevOffset === results.offset) return;
    await fetchPage(prevOffset);
  }, [results, fetchPage]);

  const clear = useCallback(async () => {
    canceledRef.current = true;
    setResults(null);
    setError("");
    setLoading(false);
    setPageLoading(false);

    if (jobIdRef.current) {
      try {
        await cancelVoicingsJob(jobIdRef.current);
      } catch {}
      jobIdRef.current = null;
    }
  }, []);

  const canPrev = !!results && results.offset > 0;
  const canNext =
    !!results && results.offset + results.limit < (results.count ?? 0);

  return {
    results,
    loading,
    pageLoading,
    error,
    generate,
    clear,
    nextPage,
    prevPage,
    fetchPage, // optional if you want jump-to-page
    canPrev,
    canNext,
  };
}