#include "VoicingGenerator.h"
#include <cstdint>
#include <vector>
#include <new>
#include <cstddef> // uintptr_t

/*mkdir -p ../../server/wasm

emcc voicings_api.cpp VoicingGenerator.cpp \
  -O3 \
  -s MODULARIZE=1 \
  -s ENVIRONMENT=node \
  -s EXPORT_NAME=createVoicingsModule \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_vg_create","_vg_next_batch","_vg_destroy"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=2147483648 \
  -s ASSERTIONS=1 \
  -o ../../server/wasm/voicings.node.js*/

struct VGState {
    VoicingGenerator gen;
    explicit VGState(const std::vector<int>& input) : gen(input) {}
};

extern "C" {

int32_t vg_create(const int32_t* notes, int32_t n, int32_t* outStatus) {
    std::vector<int> input;
    input.reserve(n);
    for (int32_t i = 0; i < n; ++i) input.push_back((int)notes[i]);

    VGState* st = new (std::nothrow) VGState(input);
    if (!st) {
        if (outStatus) *outStatus = (int32_t)VoicingGenerator::Status::AllocationFailed;
        return 0;
    }

    st->gen.begin();
    if (outStatus) *outStatus = (int32_t)st->gen.getStatus();

    return (int32_t)(uintptr_t)st;
}

int32_t vg_next_batch(int32_t handle, int32_t* out, int32_t capInts, int32_t* outStatus) {
    VGState* st = (VGState*)(uintptr_t)handle;
    if (!st || !out || capInts <= 0) {
        if (outStatus) *outStatus = (int32_t)VoicingGenerator::Status::BadArgs;
        return -1;
    }

    int32_t written = st->gen.nextBatch(out, capInts);
    if (outStatus) *outStatus = (int32_t)st->gen.getStatus();
    return written;
}

void vg_destroy(int32_t handle) {
    VGState* st = (VGState*)(uintptr_t)handle;
    delete st;
}

}