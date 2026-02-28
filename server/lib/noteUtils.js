const NOTE_NAMES = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function midiToName(m) {
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

function midiArrayToNames(arr) {
  return arr.map(midiToName);
}

module.exports = {
  midiToName,
  midiArrayToNames
};