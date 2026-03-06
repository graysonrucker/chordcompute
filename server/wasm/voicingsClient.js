const path = require("path");
const fs = require("fs");
const createVoicingsModule = require("./voicings.node.js");

let modulePromise = null;

async function getModule() {
  if (!modulePromise) {
    const wasmPath = path.join(__dirname, "voicings.node.wasm");
    const wasmBinary = fs.readFileSync(wasmPath);

    modulePromise = createVoicingsModule({
      wasmBinary,
      locateFile: (p) => path.join(__dirname, p),
    });
  }
  return modulePromise;
}

/**
 * Create a batch generator. Caller must call gen.close() when done.
 *
 * Supports span-by-span generation if wasm exports:
 *   vg_create_no_begin, vg_begin_span
 *
 * Usage (single-span):
 *   const gen = await createGenerator(inputNotes, { capInts: 2_097_152, span: 12 });
 *   for (;;) { const {status, chunk} = gen.next(); ... }
 *   gen.close();
 *
 * Usage (loop spans efficiently):
 *   const gen = await createGenerator(inputNotes, { capInts: 2_097_152 });
 *   for (let span = 0; span <= 87; ++span) {
 *     gen.beginSpan(span);
 *     for (;;) { ... gen.next() ... }
 *   }
 *   gen.close();
 */
async function createGenerator(inputNotes, opts = {}) {
  const Module = await getModule();

  // New exports (span-by-span)
  const vg_create_no_begin = Module.cwrap("vg_create_no_begin", "number", [
    "number",
    "number",
    "number",
  ]);
  const vg_begin_span = Module.cwrap("vg_begin_span", "number", [
    "number",
    "number",
    "number",
  ]);

  // Old exports (backward compatible)
  const vg_create = Module.cwrap("vg_create", "number", ["number", "number", "number"]);
  const vg_next_batch = Module.cwrap("vg_next_batch", "number", [
    "number",
    "number",
    "number",
    "number",
  ]);
  const vg_destroy = Module.cwrap("vg_destroy", null, ["number"]);

  const notes = Int32Array.from(inputNotes);

  // Allocate and write input notes
  const inPtr = Module._malloc(notes.length * 4);
  Module.HEAP32.set(notes, inPtr >> 2);

  const statusPtr = Module._malloc(4);

  // Output buffer (reused each batch)
  const capInts = opts.capInts ?? 262144; // int32 count
  const outPtr = Module._malloc(capInts * 4);

  // Create generator handle
  // If span mode is desired (opts.span provided) OR caller might call beginSpan later,
  // use vg_create_no_begin so we can begin per span.
  const wantsSpan =
    Number.isFinite(opts.span) || opts.enableSpanMode === true;

  let handle = 0;
  let createStatus = 0;

  if (wantsSpan) {
    handle = vg_create_no_begin(inPtr, notes.length, statusPtr);
    createStatus = Module.HEAP32[statusPtr >> 2];
  } else {
    handle = vg_create(inPtr, notes.length, statusPtr);
    createStatus = Module.HEAP32[statusPtr >> 2];
  }

  // Input buffer no longer needed after create
  Module._free(inPtr);

  if (!handle || createStatus !== 0) {
    Module._free(outPtr);
    Module._free(statusPtr);
    return {
      next: () => ({ status: createStatus || -1, chunk: null }),
      beginSpan: () => {},
      close: () => {},
    };
  }

  let closed = false;

  function beginSpan(span) {
    if (closed) return -1;
    if (!Number.isFinite(span) || span < 0 || span > 87) {
      // bad args
      return -1;
    }

    const rc = vg_begin_span(handle, span | 0, statusPtr);
    const st = Module.HEAP32[statusPtr >> 2];

    // rc < 0 is error; st holds generator status enum
    if (rc < 0 || st !== 0) return st || -1;
    return 0;
  }

  // If opts.span is provided, begin immediately
  if (Number.isFinite(opts.span)) {
    const st = beginSpan(opts.span);
    if (st !== 0) {
      // fail fast, but keep a close() that releases resources
      return {
        next: () => ({ status: st || -1, chunk: null }),
        beginSpan,
        close,
      };
    }
  }

  function next() {
    if (closed) return { status: -1, chunk: null };

    const written = vg_next_batch(handle, outPtr, capInts, statusPtr);
    const st = Module.HEAP32[statusPtr >> 2];

    if (written < 0) {
      return { status: st || -1, chunk: null };
    }

    if (written === 0) {
      // done for this run/span
      return { status: 0, chunk: null };
    }

    // Copy the batch out of WASM memory.
    const start = outPtr >> 2;
    const chunk = Module.HEAP32.slice(start, start + written);
    return { status: 0, chunk };
  }

  function close() {
    if (closed) return;
    closed = true;

    vg_destroy(handle);
    Module._free(outPtr);
    Module._free(statusPtr);
  }

  return { next, beginSpan, close };
}

module.exports = { createGenerator };