#include "VoicingGenerator.h"
#include <array>
#include <algorithm>

VoicingGenerator::VoicingGenerator(const std::vector<int>& inputChord) {
    for (int midi : inputChord) {
        pitchClassSequence.push_back(midi % 12);
    }
    buildMidiTable();
}

void VoicingGenerator::buildMidiTable() {
    for (int midi = 21; midi <= 108; midi++) {
        midiTable[midi % 12].push_back(midi);
    }
}

std::vector<std::vector<int>> VoicingGenerator::generate() {
    results.clear();
    knownStructures.clear();
    current.clear();
    workingSequence = pitchClassSequence;
    permute(0);
    return results;
}

void VoicingGenerator::permute(int start) {
    if(start == workingSequence.size() - 1){
        backtrack(0, 20);
        return;
    }

    std::array<bool, 12> seen = {};

    for(int i = start; i < workingSequence.size(); i++){
        if(seen[workingSequence[i]])
            continue;

        seen[workingSequence[i]] = true;
        std::swap(workingSequence[start], workingSequence[i]);
        permute(start + 1);
        std::swap(workingSequence[start], workingSequence[i]);
    }
}

void VoicingGenerator::backtrack(int depth, int prevMidi) {
    if(depth == workingSequence.size()){
        std::string key = toKey(current);
        if(!knownStructures.count(key)){
            knownStructures.emplace(key);
            results.push_back(current);
        }
        return;
    }

    int pitchClass = workingSequence[depth];
    const std::vector<int>& candidates = midiTable[pitchClass];

    for(int m : candidates){
        if(m <= prevMidi)
            continue;
        if(m > 108 - (workingSequence.size() - depth - 1)){
            break;
        }
        current.push_back(m);
        backtrack(depth + 1, m);
        current.pop_back();
    }
}

std::string VoicingGenerator::toKey(const std::vector<int>& voicing) {
    std::string key = {};
    for(int i = 1; i < voicing.size(); i++){
        key += std::to_string(voicing[i] - voicing[i-1]);
        if(i < voicing.size()-1){
            key += ',';
        }
    }
    return key;
}