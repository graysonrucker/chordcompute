#pragma once

#include "FlatHashSet64.h"
#include <cstdint>
#include <unordered_set>
#include <vector>

class VoicingGenerator {
public:
    enum class Status : int32_t {
        Ok = 0,
        EmptyInput = 1,
        Overflow = 2,
        AllocationFailed = 3,
        BadArgs = 4,
        Done = 5
    };

    explicit VoicingGenerator(const std::vector<int>& inputChord);

    // Initialize/resets internal iterator state for batch generation.
    // After begin(), call nextBatch() repeatedly until it returns 0 (Done).
    void begin();

    void beginForSpan(int16_t span);

    // Writes as many flattened records as will fit into `out`.
    // Record format: [len, note1, note2, ...] repeated.
    //
    // Returns:
    //   >0 : number of int32 elements written to `out`
    //    0 : no more output (finished); status becomes Done
    //   <0 : error (status set accordingly)
    
    int32_t nextBatch(int32_t* out, int32_t capInts);

    Status getStatus() const;
    int32_t getLastResultSize() const; // last batch size (ints written)

private:
    std::vector<int32_t> originalInput;

    // midiTable[pc] contains all MIDI notes (21..108) with that pitch class
    std::vector<uint8_t> midiTable[12];

    // --- current search state ---
    int32_t remainingCounts[12] = {0};   // multiset of required pitch classes
    int32_t totalNotes = 0;

    std::vector<int> current;            // chosen MIDI notes (strictly increasing)

    // Structure dedupe
    FlatHashSet64 knownStructures;

    // Resumable iterator stack
    struct Frame {
        int16_t prevMidi;   // previously chosen MIDI (20..108)
        int8_t  chosenPc;   // pitch class consumed when entering this frame (-1 for root)
        uint8_t idx[12];   // per pc cursor into midiTable[pc]
    };

    std::vector<Frame> stack;
    bool finished = false;

    // --- batch output state (set per nextBatch call) ---
    int32_t* outBuf = nullptr;
    int32_t outCap = 0;
    int32_t outPos = 0;

    // --- status ---
    int32_t lastResultsSize = 0;
    Status lastStatus = Status::Ok;

private:
    static inline int pc12(int midi) {
        int r = midi % 12;
        return (r < 0) ? (r + 12) : r;
    }

    void buildMidiTable();

    // Advances the iterator until it either:
    // - emits at least one record, or
    // - fills the output buffer, or
    // - finishes.
    //
    // Returns:
    //  true  => should stop this batch (buffer full or emitted and wants to yield)
    //  false => keep going
    bool step();

    bool pickNextCandidate(Frame& f, int8_t& outPc, int16_t& outMidi);

    // Attempt to emit the current voicing (leaf state) into outBuf.
    // Returns true if the output buffer is full and we should stop.
    bool emitCurrent();

    // Undo the choice associated with the top frame (if any), and pop it.
    void popFrame();

    // Hash of adjacent differences (structure key) for the current voicing.
    uint64_t structureKey(const std::vector<int>& voicing) const;

    int16_t targetSpan = -1; // -1 => no span filtering
};