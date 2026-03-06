import { useState, useCallback, useEffect, useRef } from "react";
import {
  startVoicingsJob,
  getVoicingsJobStatus,
  getVoicingsJobPage,
  cancelVoicingsJob,
  cancelVoicingsJobOnUnload,
} from "../lib/api";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useVoicingsQuery() {
  const [results, setResults] = useState(null);
  // results shape:
  // {
  //   jobId, voicings, n, offset, limit, count, available, state
  // }
  // `available` is the safe paging ceiling (advances per completed span for
  // span mode; equals count for standard mode once done).

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  const jobIdRef = useRef(null);
  const canceledRef = useRef(false);

  // Cancel the active job if the user closes or refreshes the page.
  // keepalive: true in cancelVoicingsJobOnUnload lets the request survive unload.
  useEffect(() => {
    const handleUnload = () => cancelVoicingsJobOnUnload(jobIdRef.current);
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []); // registers once; reads jobIdRef.current at unload time

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
          // Refresh available from the page response too — it's the freshest
          // value returned from the server at this moment.
          available: page.available ?? prev.available,
        };
      });
    } catch (e) {
      setError(e?.message || "Failed to fetch page");
    } finally {
      setPageLoading(false);
    }
  }, [results?.limit]);

  const generate = useCallback(async (activeNotes, rangeLow, rangeHigh) => {
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
      const { jobId, mode } = await startVoicingsJob(activeNotes, rangeLow, rangeHigh);
      jobIdRef.current = jobId;

      const limit = 500; // <-- your UI page size (200/500/1000 etc.)
      let lastStatus = null;
      let firstPageShown = false;

      // Poll until done.
      // For span mode: load and show the first page as soon as any spans are
      // committed, then keep updating count/available while running.
      // For standard mode: wait for done, then fetch — unchanged behavior.
      while (true) {
        if (canceledRef.current) return;

        const status = await getVoicingsJobStatus(jobId);
        lastStatus = status;

        if (status.state === "error") {
          throw new Error(status.error || "Job failed");
        }

        const available = status.available ?? 0;

        if (mode === "span" && !firstPageShown && available > 0) {
          // First span(s) are ready — fetch and display immediately.
          const firstPage = await getVoicingsJobPage(jobId, 0, limit);
          if (!canceledRef.current) {
            firstPageShown = true;
            setLoading(false);
            setResults({
              jobId,
              voicings: firstPage.items,
              n: firstPage.n,
              offset: firstPage.offset,
              limit,
              count: status.count ?? available,
              available: firstPage.available ?? available,
              state: status.state,
            });
          }
        } else if (firstPageShown) {
          // Keep count/available fresh in the results while more spans land.
          setResults((prev) => {
            if (!prev || prev.jobId !== jobId) return prev;
            return {
              ...prev,
              count: status.count ?? prev.count,
              available: available > prev.available ? available : prev.available,
              state: status.state,
            };
          });
        }

        if (status.state === "done") break;

        await sleep(250);
      }

      if (!firstPageShown) {
        // Standard mode path (or span mode that somehow finished before first
        // poll caught available > 0): fetch first page now that job is done.
        const firstPage = await getVoicingsJobPage(jobId, 0, limit);
        setResults({
          jobId,
          voicings: firstPage.items,
          n: firstPage.n,
          offset: firstPage.offset,
          limit,
          count: lastStatus?.count ?? 0,
          available: lastStatus?.count ?? 0,
          state: "done",
        });
      } else {
        // Ensure final state reflects done with full count.
        setResults((prev) => {
          if (!prev || prev.jobId !== jobId) return prev;
          return {
            ...prev,
            count: lastStatus?.count ?? prev.count,
            available: lastStatus?.count ?? prev.available,
            state: "done",
          };
        });
      }
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
    if (nextOffset >= results.available) return;
    await fetchPage(nextOffset);
  }, [results, fetchPage]);

  const prevPage = useCallback(async () => {
    if (!results) return;
    const prevOffset = Math.max(0, results.offset - results.limit);
    if (prevOffset === results.offset) return;
    await fetchPage(prevOffset);
  }, [results, fetchPage]);

  // Jump to any 0-based page index clamped to available pages
  const goToPage = useCallback(async (pageIndex) => {
    if (!results) return;
    const offset = pageIndex * results.limit;
    if (offset < 0 || offset >= results.available) return;
    await fetchPage(offset);
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
  // Ceiling is `available` not `count`, which
  // may include voicings still buffered in the worker during span mode.
  const canNext =
    !!results && results.offset + results.limit < (results.available ?? 0);

  const currentPage = results ? Math.floor(results.offset / results.limit) : 0;
  const availablePages = results
    ? Math.ceil((results.available ?? 0) / results.limit)
    : 0;
  const totalPages = results
    ? results.state === "done"
      ? Math.ceil((results.count ?? 0) / results.limit)
      : availablePages
    : 0;
  const isStreaming = !!results && results.state !== "done";

  return {
    results,
    loading,
    pageLoading,
    error,
    generate,
    clear,
    nextPage,
    prevPage,
    goToPage,
    fetchPage,
    canPrev,
    canNext,
    currentPage,
    availablePages,
    totalPages,
    isStreaming,
  };
}