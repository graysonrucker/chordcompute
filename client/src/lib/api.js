import { generateVoicingsWasm } from "../wasm/voicingsClient";

export async function fetchVoicings(payload) {
  // Expect payload like: { notes: number[] }
  const inputNotes = payload?.notes;

  if (!Array.isArray(inputNotes) || inputNotes.length === 0) {
    throw new Error("Invalid payload: expected { notes: number[] }");
  }

  const { status, voicings } = await generateVoicingsWasm(inputNotes);

  if (status !== 0) {
    throw new Error(`WASM voicing generation failed (status=${status})`);
  }

  // Return the same shape your UI uses: results.voicings
  return { voicings };
}