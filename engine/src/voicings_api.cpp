#include "VoicingGenerator.h"
#include <cstdint>
#include <vector>

/*emcc VoicingGenerator.cpp voicings_api.cpp \
  -O3 -std=c++20 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORT_NAME=createVoicingsModule \
  -sEXPORTED_FUNCTIONS='["_vg_generate_flat","_vg_free","_malloc","_free"]' \
  -sEXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -o ../../client/src/wasm/voicings.mjs*/

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