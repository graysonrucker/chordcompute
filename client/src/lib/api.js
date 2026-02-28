// client/lib/api.js (or wherever this lives)

async function httpJson(url, options) {
  const res = await fetch(url, options);

  if (!res.ok) {
    // Try to extract a useful error message (JSON or text)
    let msg = "";
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        msg = j?.error || j?.message || JSON.stringify(j);
      } else {
        msg = await res.text();
      }
    } catch {
      // ignore
    }
    throw new Error(msg || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Start a generation job
export async function startVoicingsJob(notes) {
  return httpJson("/api/voicings/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
}

// Poll job status
export async function getVoicingsJobStatus(jobId) {
  if (!jobId) throw new Error("Missing jobId");
  return httpJson(`/api/voicings/jobs/${jobId}/status`, { method: "GET" });
}

// Fetch a page of results
// Defaults are helpful so the hook/UI can call this more ergonomically.
export async function getVoicingsJobPage(jobId, offset = 0, limit = 200) {
  if (!jobId) throw new Error("Missing jobId");

  const params = new URLSearchParams({
    offset: String(Math.max(0, Number(offset) || 0)),
    limit: String(Math.max(1, Number(limit) || 200)),
  });

  return httpJson(`/api/voicings/jobs/${jobId}/page?${params.toString()}`, {
    method: "GET",
  });
}

// Optional: cancel/cleanup
export async function cancelVoicingsJob(jobId) {
  if (!jobId) return { ok: true };
  return httpJson(`/api/voicings/jobs/${jobId}`, { method: "DELETE" });
}