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
 * Usage:
 *   const gen = await createGenerator(inputNotes, { capInts: 262144 });
 *   for (;;) {
 *     const { status, chunk } = gen.next(); // chunk is Int32Array view copy
 *     if (status !== 0) throw ...
 *     if (!chunk) break; // done
 *     ...process chunk...
 *   }
 *   gen.close();
 */
async function createGenerator(inputNotes, opts = {}) {
  const Module = await getModule();

  const vg_create = Module.cwrap("vg_create", "number", ["number", "number", "number"]);
  const vg_next_batch = Module.cwrap("vg_next_batch", "number", ["number", "number", "number", "number"]);
  const vg_destroy = Module.cwrap("vg_destroy", null, ["number"]);

  const notes = Int32Array.from(inputNotes);

  // Allocate and write input notes
  const inPtr = Module._malloc(notes.length * 4);
  Module.HEAP32.set(notes, inPtr >> 2);

  const statusPtr = Module._malloc(4);

  // Create generator handle
  const handle = vg_create(inPtr, notes.length, statusPtr);
  const createStatus = Module.HEAP32[statusPtr >> 2];

  // Input buffer no longer needed after create
  Module._free(inPtr);

  if (!handle || createStatus !== 0) {
    Module._free(statusPtr);
    return {
      next: () => ({ status: createStatus || -1, chunk: null }),
      close: () => {},
    };
  }

  // Output buffer (reused each batch)
  const capInts = opts.capInts ?? 262144; // ~1MB of int32 (4 bytes each)
  const outPtr = Module._malloc(capInts * 4);

  let closed = false;

  function next() {
    if (closed) return { status: -1, chunk: null };

    const written = vg_next_batch(handle, outPtr, capInts, statusPtr);
    const st = Module.HEAP32[statusPtr >> 2];

    if (written < 0) {
      // error
      return { status: st || -1, chunk: null };
    }

    if (written === 0) {
      // done
      return { status: 0, chunk: null };
    }

    // Copy the batch out of WASM memory.
    // IMPORTANT: must copy because WASM memory will be reused next call.
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

  return { next, close };
}

module.exports = { createGenerator };