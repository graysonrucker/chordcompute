import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import createVoicingsModule from "../../client/src/wasm/voicings.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const wasmPath = path.join(__dirname, "voicings.wasm");

const Module = await createVoicingsModule({
  // Emscripten will call this instead of using fetch()
  instantiateWasm(imports, successCallback) {
    const wasmBytes = fs.readFileSync(wasmPath);
    WebAssembly.instantiate(wasmBytes, imports).then(({ instance, module }) => {
      successCallback(instance, module);
    });
    return {}; // per Emscripten convention
  },
});

const vg_generate_flat = Module.cwrap(
  "vg_generate_flat",
  "number",
  ["number", "number", "number", "number"]
);

const vg_free = Module.cwrap("vg_free", null, ["number"]);

// ---- TEST INPUT ----
const input = Int32Array.from([60, 64, 67, 71]); // Cmaj7
const inPtr = Module._malloc(input.length * 4);
Module.HEAP32.set(input, inPtr >> 2);

const outSizePtr = Module._malloc(4);
const outStatusPtr = Module._malloc(4);

// ---- CALL WASM ----
const outPtr = vg_generate_flat(inPtr, input.length, outSizePtr, outStatusPtr);

const outSize = Module.HEAP32[outSizePtr >> 2];
const outStatus = Module.HEAP32[outStatusPtr >> 2];

console.log({ outStatus, outSize });

// ---- DECODE FIRST 10 VOICINGS ----
if (outPtr && outSize > 0) {
  const flat = Module.HEAP32.slice(outPtr >> 2, (outPtr >> 2) + outSize);

  let printed = 0;
  for (let i = 0; i < flat.length && printed < 10; ) {
    const len = flat[i++];
    const notes = Array.from(flat.slice(i, i + len));
    i += len;
    console.log(notes);
    printed++;
  }

  vg_free(outPtr);
}

// ---- CLEANUP ----
Module._free(inPtr);
Module._free(outSizePtr);
Module._free(outStatusPtr);