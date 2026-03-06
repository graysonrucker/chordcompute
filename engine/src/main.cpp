#include "VoicingGenerator.h"
#include <iostream>
#include <vector>

static void printFlat(const int32_t* flat, int32_t nInts) {
    for (int32_t i = 0; i < nInts; ) {
        int32_t len = flat[i++];
        std::cout << "[";
        for (int32_t j = 0; j < len; ++j) {
            std::cout << flat[i + j] << (j + 1 < len ? "," : "");
        }
        std::cout << "]\n";
        i += len;
    }
}

int main() {
    std::vector<int> chord = {60, 64, 67, 71}; // Cmaj7
    VoicingGenerator g(chord);

    int32_t* flat = g.generate();
    auto status = g.getStatus();
    int32_t sz = g.getLastResultSize();

    std::cout << "status=" << (int)status << " ints=" << sz << "\n";
    if (!flat || sz == 0) return 0;

    // Print first ~20 voicings worth of data
    int printed = 0;
    for (int32_t i = 0; i < sz && printed < 20; ) {
        int32_t len = flat[i];
        // print one voicing from the flat buffer
        std::cout << "[";
        for (int32_t j = 0; j < len; ++j) {
            std::cout << flat[i + 1 + j] << (j + 1 < len ? "," : "");
        }
        std::cout << "]\n";
        i += 1 + len;
        printed++;
    }

    g.freeResults(flat);
    return 0;
}