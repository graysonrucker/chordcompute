import { Chord } from "tonal";
import { Midi }  from "tonal";

export function detectChord(notes, preferSharps){
    let noteSet = new Array();
    for(let i = 0; i < notes.length; i++){
        noteSet[i] = Midi.midiToNoteName(notes[i], {pitchClass: true, sharps: preferSharps});
    }

    const names = Chord.detect(noteSet);

    if(names.length === 0){
        return null;
    }

    return names[0];
}


