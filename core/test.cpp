#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <unordered_set>
#include <array>
#include <algorithm>

// ---- VoicingGenerator (inline for testing) ----

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
    std::sort(results.begin(), results.end(), [](const std::vector<int>& a, const std::vector<int>& b){
        return (a.back() - a.front()) < (b.back() - b.front());
    });
    return results;
}

void VoicingGenerator::permute(int start) {
    if (start == (int)workingSequence.size() - 1) {
        backtrack(0, 20);
        return;
    }

    std::array<bool, 12> seen = {};

    for (int i = start; i < (int)workingSequence.size(); i++) {
        if (seen[workingSequence[i]])
            continue;

        seen[workingSequence[i]] = true;
        std::swap(workingSequence[start], workingSequence[i]);
        permute(start + 1);
        std::swap(workingSequence[start], workingSequence[i]);
    }
}

void VoicingGenerator::backtrack(int depth, int prevMidi) {
    if (depth == (int)workingSequence.size()) {
        std::string key = toKey(current);
        if (!knownStructures.count(key)) {
            knownStructures.emplace(key);
            results.push_back(current);
        }
        return;
    }

    int pitchClass = workingSequence[depth];
    const std::vector<int>& candidates = midiTable[pitchClass];

    for (int m : candidates) {
        if (m <= prevMidi)
            continue;
        if (m > 108 - ((int)workingSequence.size() - depth - 1))
            break;

        current.push_back(m);
        backtrack(depth + 1, m);
        current.pop_back();
    }
}

std::string VoicingGenerator::toKey(const std::vector<int>& voicing) {
    std::string key = {};
    for (int i = 1; i < (int)voicing.size(); i++) {
        key += std::to_string(voicing[i] - voicing[i-1]);
        if (i < (int)voicing.size() - 1) {
            key += ',';
        }
    }
    return key;
}

// ---- helpers ----

void writeVoicing(std::ofstream& out, const std::vector<int>& voicing) {
    out << "{ ";
    for (int i = 0; i < (int)voicing.size(); i++) {
        out << voicing[i];
        if (i < (int)voicing.size() - 1) out << ", ";
    }
    out << " }";
}

void runTest(std::ofstream& out, const std::string& label, const std::vector<int>& chord) {
    out << "\n=== " << label << " ===\n";
    out << "Input: ";
    writeVoicing(out, chord);
    out << "\n";

    VoicingGenerator gen(chord);
    auto voicings = gen.generate();

    out << "Total unique voicings found: " << voicings.size() << "\n";
    out << "All voicings (sorted by span):\n";
    for (int i = 0; i < (int)voicings.size(); i++) {
        int span = voicings[i].back() - voicings[i].front();
        out << "  ";
        writeVoicing(out, voicings[i]);
        out << "  span=" << span << "\n";
    }
}

int main() {
    std::ofstream out("output.txt");
    if (!out) {
        std::cerr << "Failed to open output.txt\n";
        return 1;
    }

    runTest(out, "C major triad {60,64,67}", {60, 64, 67});
    runTest(out, "C major triad with doubled root {60,64,67,72}", {60, 64, 67, 72});
    runTest(out, "Single note {60}", {60});
    runTest(out, "Perfect fifth {60,67}", {60, 67});

    out.close();
    std::cout << "Results written to output.txt\n";
    return 0;
}