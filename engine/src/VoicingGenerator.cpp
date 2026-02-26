#include "VoicingGenerator.h"

#include <array>
#include <algorithm>
#include <climits>   // INT32_MAX
#include <new>       // std::nothrow

static inline int pc12(int midi) {
    // Safe modulo for any integer
    int r = midi % 12;
    return (r < 0) ? (r + 12) : r;
}

VoicingGenerator::VoicingGenerator(const std::vector<int>& inputChord) {
    pitchClassSequence.reserve(inputChord.size());
    for (int midi : inputChord) {
        pitchClassSequence.push_back(pc12(midi));
    }
    buildMidiTable();
}

void VoicingGenerator::buildMidiTable() {
    for (int midi = 21; midi <= 108; ++midi) {
        midiTable[pc12(midi)].push_back(midi);
    }
}

void VoicingGenerator::freeResults(int32_t* ptr) {
    delete[] ptr;
}

int32_t VoicingGenerator::getLastResultSize() const {
    return lastResultsSize;
}

VoicingGenerator::Status VoicingGenerator::getStatus() const {
    return lastStatus;
}

// 64-bit FNV-1a style hash of the adjacent diffs.
uint64_t VoicingGenerator::structureKey(const std::vector<int>& voicing) const {
    // FNV-1a offset basis
    uint64_t h = 1469598103934665603ULL;
    // Mix in each diff as a byte-ish value (but diffs can exceed 255, so mix 4 bytes)
    for (int i = 1; i < (int)voicing.size(); ++i) {
        uint32_t d = (uint32_t)(voicing[i] - voicing[i - 1]);
        // Mix 4 bytes of d
        for (int k = 0; k < 4; ++k) {
            uint8_t b = (uint8_t)((d >> (8 * k)) & 0xFF);
            h ^= (uint64_t)b;
            h *= 1099511628211ULL;
        }
        // Separator byte to reduce ambiguity (optional but helps)
        h ^= 0xFFULL;
        h *= 1099511628211ULL;
    }
    return h;
}

int32_t* VoicingGenerator::flatten(const std::vector<std::vector<int>>& resultsIn) {
    size_t sum = 0;

    for (const std::vector<int>& v : resultsIn) {
        sum += (size_t)v.size() + 1u;  // +1 for length prefix
        if (sum > (size_t)INT32_MAX) {
            lastStatus = Status::Overflow;
            lastResultsSize = 0;
            return nullptr;
        }
    }

    // Allocate with nothrow so we don’t rely on exceptions
    int32_t* out = new (std::nothrow) int32_t[sum];
    if (!out && sum != 0) {
        lastStatus = Status::AllocationFailed;
        lastResultsSize = 0;
        return nullptr;
    }

    size_t i = 0;
    for (const std::vector<int>& v : resultsIn) {
        out[i++] = (int32_t)v.size();
        for (int note : v) {
            out[i++] = (int32_t)note;
        }
    }

    lastStatus = Status::Ok;
    lastResultsSize = (int32_t)sum;
    return out;
}

int32_t* VoicingGenerator::generate() {
    results.clear();
    knownStructures.clear();
    current.clear();

    workingSequence = pitchClassSequence;

    if (workingSequence.empty()) {
        lastStatus = Status::EmptyInput;
        lastResultsSize = 0;
        return nullptr;
    }

    permute(0);

    // Deterministic ordering: span then lexicographic
    /*std::sort(results.begin(), results.end(),
              [](const std::vector<int>& a, const std::vector<int>& b) {
                  int spanA = a.back() - a.front();
                  int spanB = b.back() - b.front();
                  if (spanA != spanB) return spanA < spanB;
                  return a < b;
              });*/

    return flatten(results);
}

// Unique permutations of pitch classes, then backtrack() for each permutation.
void VoicingGenerator::permute(int start) {
    if (start >= (int)workingSequence.size() - 1) {
        backtrack(0, 20); // 20 so first candidate can be 21+
        return;
    }

    std::array<bool, 12> seen{};
    for (int i = start; i < (int)workingSequence.size(); ++i) {
        int pc = workingSequence[i];
        if (seen[pc]) continue;

        seen[pc] = true;
        std::swap(workingSequence[start], workingSequence[i]);
        permute(start + 1);
        std::swap(workingSequence[start], workingSequence[i]);
    }
}

void VoicingGenerator::backtrack(int depth, int prevMidi) {
    if (depth == (int)workingSequence.size()) {
        uint64_t key = structureKey(current);
        if (!knownStructures.count(key)) {
            knownStructures.emplace(key);
            results.push_back(current);
        }
        return;
    }

    int pitchClass = workingSequence[depth];
    const std::vector<int>& candidates = midiTable[pitchClass];

    int remaining = (int)workingSequence.size() - depth - 1;
    int maxThis = 108 - remaining;

    for (int m : candidates) {
        if (m <= prevMidi) continue;
        if (m > maxThis) break;
        current.push_back(m);
        backtrack(depth + 1, m);
        current.pop_back();
    }
}