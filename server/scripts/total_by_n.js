const { generateVoicings } = require("../lib/voicings");

function firstNFromC4(n) {
  return Array.from({ length: n }, (_, i) => 60 + i); // C4..B4
}

for (let n = 1; n <= 12; n++) {
  const notes = firstNFromC4(n);
  const res = generateVoicings({ notes });

  if (res.error) {
    console.log(`n=${n} error: ${res.error}`);
    continue;
  }

  console.log(
    `n=${n} input=[${notes.join(",")}] totalFound=${res.totalFound} returned=${res.voicings.length}`
  );
}