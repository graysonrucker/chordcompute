# ChordCompute

ChordCompute is a full-stack web application for generating and browsing every valid piano voicing of a given chord across a configurable keyboard range.

**Live at [chordcompute.com](https://chordcompute.com)**

---

## What It Does

Select any combination of notes on the interactive piano keyboard and click **Generate**. Inverter computes all voicings of that chord across your selected keyboard range, preserving the exact pitch class multiplicity of your input — a C major triad with one C, one E, and one G will only return voicings containing exactly one of each. Results are deduplicated by interval structure, paginated, and displayed as mini piano diagrams.

Results are browsable immediately during generation for large jobs.

---

## Architecture

```
client/          React + Vite + TailwindCSS
server/          Node.js + Express
  routes/        REST API
  workers/       Node worker_threads (job execution)
  lib/           Shared utilities
  wasm/          Compiled VoicingGenerator (C++ → WebAssembly)
engine/          C++ source for the voicing engine
```

### Generation Engine

The core algorithm is written in C++ and compiled to WebAssembly. Given an input chord, the generator builds a MIDI table restricted to the user's selected piano range, then performs a depth-first k-way merge over pitch class candidates — preserving the multiplicity of each pitch class from the input — pruning by span and deduplicating by interval structure using a FlatHashSet.

### Job System

Generation runs as a background job in a `worker_threads` worker. The server returns a `jobId` immediately; the client polls status and pages results without blocking.

For large chords (estimated 50M+ candidate voicings), the engine switches to **span mode**: 88 passes — one per semitone span — distributed across a pool of parallel span workers, each owning its own WASM instance. Running one span at a time keeps peak memory flat, since the deduplication hash set only needs to hold the voicings for a single span rather than the entire result set. Results are committed to disk span-by-span using zstd-compressed frame-indexed binary files, so the client can begin paging results before generation is complete.

For smaller chords, a single-pass mode buckets voicings by span on the fly before writing a sorted output file.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/voicings/jobs` | Start a generation job. Body: `{ notes, rangeLow, rangeHigh }` |
| `GET` | `/api/voicings/jobs/:id/status` | Poll job state, count, available |
| `GET` | `/api/voicings/jobs/:id/page` | Fetch a page of results. Params: `offset`, `limit` |
| `DELETE` | `/api/voicings/jobs/:id` | Cancel and clean up a job |
| `GET` | `/api/health` | Health check + disk space diagnostics |

---

## Storage Safety

Large jobs write significant data to disk. Two thresholds are enforced on the server:

- **Reject threshold (default 60 GB):** Span-mode jobs are refused at submission time if free disk space is below this limit.
- **Halt threshold (default 30 GB):** A running span-mode job is stopped after each committed span if free space drops below this limit. Any voicings already committed remain available to browse.

Both thresholds can be overridden at startup via environment variables for testing:

```bash
DISK_REJECT_GB=300 DISK_HALT_GB=200 node index.js
```

---

## Running Locally

Requires Node.js 20+.

```bash
# Clone
git clone https://github.com/graysonrucker/Inverter.git
cd Inverter

# Install and start the backend
cd server && npm install && npm start

# In a separate terminal — install and start the frontend
cd client && npm install && npm run dev
```

Backend: http://localhost:3000  
Frontend (dev): http://localhost:5173

---

## Planned Features

- Human-playability filters
- Note doubling options
- Chord identification for selected notes and generated voicings
- Root + quality + extension templates for note selection
- Additional sorting and filtering options for results