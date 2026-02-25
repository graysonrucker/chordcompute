#pragma once
#include <vector>
#include <string>
#include <unordered_set>

class VoicingGenerator {
public:
    explicit VoicingGenerator(const std::vector<int>& inputChord);
    std::vector<std::vector<int>> generate();

private:
    std::vector<int> pitchClassSequence;
    std::vector<int> workingSequence;
    std::vector<int> current;
    std::vector<int> midiTable[12];
    std::unordered_set<std::string> knownStructures;
    std::vector<std::vector<int>> results;

    void buildMidiTable();
    void permute(int start);
    void backtrack(int depth, int prevMidi);
    std::string toKey(const std::vector<int>& voicing);
};