#include "VoicingGenerator.h"
#include "FlatHashSet64.h"

#include <cstdint>

// 64-bit FNV-1a step
static inline uint64_t fnv1a64_step(uint64_t h, uint64_t x) {
    h ^= x;
    h *= 1099511628211ULL;
    return h;
}

VoicingGenerator::VoicingGenerator(const std::vector<int>& inputChord) {
    originalInput.assign(inputChord.begin(), inputChord.end());
    buildMidiTable();
    lastStatus = Status::Ok;
    lastResultsSize = 0;
}

void VoicingGenerator::buildMidiTable() {
    // Clear in case constructor is ever reused differently
    for (int pc = 0; pc < 12; ++pc) midiTable[pc].clear();

    for (int midi = 21; midi <= 108; ++midi) {
        // midi fits in uint8_t (21..108)
        midiTable[pc12(midi)].push_back((uint8_t)midi);
    }
}

int32_t VoicingGenerator::getLastResultSize() const {
    return lastResultsSize;
}

VoicingGenerator::Status VoicingGenerator::getStatus() const {
    return lastStatus;
}

uint64_t VoicingGenerator::structureKey(const std::vector<int>& voicing) const {
    uint64_t h = 1469598103934665603ULL;

    const int n = (int)voicing.size();
    if (n <= 1) return fnv1a64_step(h, (uint64_t)n);

    h = fnv1a64_step(h, (uint64_t)(n - 1));

    for (int i = 1; i < n; ++i) {
        const uint8_t d = (uint8_t)(voicing[i] - voicing[i - 1]); // voicing sorted
        h = fnv1a64_step(h, (uint64_t)d);
    }
    return h;
}

void VoicingGenerator::begin() {
    // Keep capacity for speed across runs. If you want to free memory between runs:
    // knownStructures.reset();
    knownStructures.reset();

    current.clear();
    stack.clear();

    finished = false;
    lastStatus = Status::Ok;
    lastResultsSize = 0;

    if (originalInput.empty()) {
        finished = true;
        lastStatus = Status::EmptyInput;
        return;
    }

    for (int pc = 0; pc < 12; ++pc) remainingCounts[pc] = 0;
    for (int midi : originalInput) remainingCounts[pc12(midi)]++;

    totalNotes = (int32_t)originalInput.size();

    Frame root{};
    root.prevMidi = 20;
    root.chosenPc = -1;
    for (int pc = 0; pc < 12; ++pc) root.idx[pc] = 0;

    stack.push_back(root);
}

// --- k-way merge helper ---
// Chooses the smallest next MIDI among pitch classes with remainingCounts[pc] > 0,
// subject to m > f.prevMidi.
// Advances f.idx[pc] past <= prevMidi and consumes one candidate (increments idx) for chosen pc.
bool VoicingGenerator::pickNextCandidate(Frame& f, int8_t& outPc, int16_t& outMidi) {
    int bestMidi = 1000000000;
    int bestPc = -1;

    for (int pc = 0; pc < 12; ++pc) {
        if (remainingCounts[pc] <= 0) continue;

        const auto& vec = midiTable[pc];

        uint8_t i = f.idx[pc];
        while (i < (uint8_t)vec.size() && vec[i] <= f.prevMidi) ++i;
        f.idx[pc] = i;

        if (i >= (uint8_t)vec.size()) continue;

        int m = (int)vec[i];
        if (m < bestMidi) {
            bestMidi = m;
            bestPc = pc;
        }
    }

    if (bestPc < 0) return false;

    // Consume this candidate at this depth
    f.idx[bestPc]++;

    outPc = (int8_t)bestPc;
    outMidi = (int16_t)bestMidi;
    return true;
}

int32_t VoicingGenerator::nextBatch(int32_t* out, int32_t capInts) {
    if (finished) {
        lastStatus = Status::Done;
        lastResultsSize = 0;
        return 0;
    }

    if (!out || capInts <= 0) {
        lastStatus = Status::BadArgs;
        lastResultsSize = 0;
        return -1;
    }

    outBuf = out;
    outCap = capInts;
    outPos = 0;

    while (!finished) {
        bool shouldStop = step(); // true => buffer full; stop batch
        if (shouldStop) break;
    }

    lastResultsSize = outPos;

    if (outPos == 0 && finished && lastStatus == Status::Ok) {
        lastStatus = Status::Done;
        return 0;
    }

    // If it wrote something, status is OK
    lastStatus = Status::Ok;
    return outPos;
}

bool VoicingGenerator::step() {
    while (!stack.empty()) {
        int depth = (int)current.size();

        // Leaf: we have totalNotes chosen
        if (depth == totalNotes) {
            if (emitCurrent()) return true; // buffer full
            popFrame();                     // backtrack
            continue;
        }

        Frame& f = stack.back();

        int8_t pc;
        int16_t m;
        if (!pickNextCandidate(f, pc, m)) {
            // No more candidates at this depth
            popFrame();
            continue;
        }

        // Choose (pc, m)
        remainingCounts[pc]--;
        current.push_back((int)m);

        // Child inherits the parent's cursor state (k-way merge resume)
        Frame child = f;        // copies idx[12]
        child.prevMidi = m;
        child.chosenPc = pc;

        stack.push_back(child);
    }

    finished = true;
    return false;
}

void VoicingGenerator::popFrame() {
    Frame f = stack.back();
    stack.pop_back();

    if (f.chosenPc != -1) {
        remainingCounts[(int)f.chosenPc]++;
        current.pop_back();
    }
}

bool VoicingGenerator::emitCurrent() {
    uint64_t key = structureKey(current);

    // Exact dedupe, lower memory than std::unordered_set in wasm
    if (!knownStructures.insert(key)) return false;

    const int n = (int)current.size();
    if (outPos + 1 + n > outCap) return true; // buffer full

    outBuf[outPos++] = (int32_t)n;
    for (int note : current) outBuf[outPos++] = (int32_t)note;

    return false;
}