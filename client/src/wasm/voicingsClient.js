import createVoicingsModule from "./voicings.mjs";

let modulePromise = null;

async function getModule() {
  if (!modulePromise) {
    modulePromise = createVoicingsModule({
      // Vite-friendly way to locate voicings.wasm next to voicings.mjs
      locateFile: (p) => new URL(`./${p}`, import.meta.url).toString(),
    });
  }
  return modulePromise;
}

export async function generateVoicingsWasm(inputNotes) {
  const Module = await getModule();

  const vg_generate_flat = Module.cwrap(
    "vg_generate_flat",
    "number",
    ["number", "number", "number", "number"]
  );
  const vg_free = Module.cwrap("vg_free", null, ["number"]);

  const notes = Int32Array.from(inputNotes);
  const inPtr = Module._malloc(notes.length * 4);
  Module.HEAP32.set(notes, inPtr >> 2);

  const outSizePtr = Module._malloc(4);
  const outStatusPtr = Module._malloc(4);

  const outPtr = vg_generate_flat(inPtr, notes.length, outSizePtr, outStatusPtr);
  const outSize = Module.HEAP32[outSizePtr >> 2];
  const outStatus = Module.HEAP32[outStatusPtr >> 2];

  // cleanup input/status allocations
  Module._free(inPtr);
  Module._free(outSizePtr);
  Module._free(outStatusPtr);

  if (outStatus !== 0 || !outPtr || outSize <= 0) {
    if (outPtr) vg_free(outPtr);
    return { status: outStatus, voicings: [] };
  }

  const flat = Module.HEAP32.slice(outPtr >> 2, (outPtr >> 2) + outSize);
  vg_free(outPtr);

  // decode: [len, ...notes][len, ...notes]...
  const voicings = [];
  for (let i = 0; i < flat.length; ) {
    const len = flat[i++];
    const arr = Array.from(flat.slice(i, i + len));
    i += len;
    voicings.push({ notes: arr });
  }

  return { status: 0, voicings };
}