// server/wasm/voicingsClient.js
const path = require("path");
const fs = require("fs");
const createVoicingsModule = require("./voicings.node.js");

let modulePromise = null;

async function getModule() {
  if (!modulePromise) {
    const wasmPath = path.join(__dirname, "voicings.node.wasm");
    const wasmBinary = fs.readFileSync(wasmPath);

    modulePromise = createVoicingsModule({
      wasmBinary, // avoids fetch() issues
      locateFile: (p) => path.join(__dirname, p),
    });
  }
  return modulePromise;
}

async function generateFlat(inputNotes) {
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

  Module._free(inPtr);
  Module._free(outSizePtr);
  Module._free(outStatusPtr);

  if (outStatus !== 0 || !outPtr || outSize <= 0) {
    if (outPtr) vg_free(outPtr);
    return { status: outStatus, flat: null };
  }

  const flat = Module.HEAP32.slice(outPtr >> 2, (outPtr >> 2) + outSize);
  vg_free(outPtr);

  return { status: 0, flat };
}

module.exports = { generateFlat };