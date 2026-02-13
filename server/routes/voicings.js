// server/routes/voicings.js
const express = require("express");
const { generateVoicings } = require("../lib/voicings");

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

  res.json(result);
});

module.exports = router;