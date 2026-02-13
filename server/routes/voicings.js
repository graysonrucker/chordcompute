// server/routes/voicings.js
const express = require("express");
const { generateVoicings } = require("../lib/voicings");
const { midiArrayToNames } = require("../lib/noteUtils");

const router = express.Router();

/*
POST 
Body:
{
  "notes": [35,39,47],
  "rangeLow": 48,
  "rangeHigh": 72,
  "minNotes": 3,
  "maxNotes": 5,
  "maxSpan": 16,
  "limit": 200
}
 */
router.post("/", (req, res) => {
  const result = generateVoicings(req.body);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }
  console.log(
  result.voicings.slice(0, 5).map(v => ({
        midi: v.notes,
        names: midiArrayToNames(v.notes),
        score: v.score
      }))
  );
  console.log("Total voicings found:", result.totalFound);
  res.json(result);
});

module.exports = router;