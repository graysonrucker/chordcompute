#include "VoicingGenerator.h"
#include <cstdint>
#include <vector>

/*mkdir -p ../../server/wasm

emcc voicings_api.cpp VoicingGenerator.cpp \
  -O3 \
  -s MODULARIZE=1 \
  -s ENVIRONMENT=node \
  -s EXPORT_NAME=createVoicingsModule \
  -s EXPORTED_RUNTIME_METHODS='["cwrap","ccall"]' \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_vg_generate_flat","_vg_free"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MAXIMUM_MEMORY=2147483648 \
  -s ASSERTIONS=1 \
  -o ../../server/wasm/voicings.node.js*/

extern "C" {

int32_t* vg_generate_flat(const int32_t* notes, int32_t n, int32_t* outSize, int32_t* outStatus) {
    std::vector<int> input;
    input.reserve(n);
    for (int32_t i = 0; i < n; ++i) input.push_back((int)notes[i]);

    VoicingGenerator g(input);
    int32_t* ptr = g.generate();
    *outSize = g.getLastResultSize();
    *outStatus = (int32_t)g.getStatus();
    return ptr;
}

void vg_free(int32_t* ptr) { delete[] ptr; }

}