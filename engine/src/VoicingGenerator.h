#pragma once

#include <vector>
#include <unordered_set>
#include <cstdint>

class VoicingGenerator {
public:
    enum class Status : int32_t {
        Ok = 0,
        EmptyInput = 1,
        Overflow = 2,
        AllocationFailed = 3
    };

    explicit VoicingGenerator(const std::vector<int>& inputChord);

    // Returns a flattened int32 buffer allocated with new[].
    // Format: [len, note1, note2, ...][len, note1, ...]...
    // On failure, returns nullptr; check getStatus().
    int32_t* generate();

    // Frees a buffer previously returned by generate().
    void freeResults(int32_t* ptr);

    // Number of int32_t elements in the flattened buffer from last generate().
    int32_t getLastResultSize() const;

    // Status of the last generate() call.
    Status getStatus() const;

private:
    std::vector<int32_t> originalInput;
    std::vector<uint8_t> pitchClassSequence;
    std::vector<uint8_t> workingSequence;
    std::vector<int> current;

    std::vector<uint8_t> midiTable[12];

    // WASM-friendly: store compact keys instead of strings
    std::unordered_set<uint64_t> knownStructures;

    std::vector<std::vector<int>> results;

    int32_t lastResultsSize = 0;
    Status lastStatus = Status::Ok;

    void buildMidiTable();
    void permute(int start);
    void backtrack(int depth, int prevMidi);

    // Hash of adjacent differences (structure key)
    uint64_t structureKey(const std::vector<int>& voicing) const;

    // Flattens results into new[] buffer; updates lastResultsSize/status.
    int32_t* flatten(const std::vector<std::vector<int>>& resultsIn);
};