#pragma once
#include <cstdint>
#include <vector>
#include <limits>
#include <cstdlib>

class FlatHashSet64 {
public:
    FlatHashSet64() = default;

    void clear() {
        // Keep capacity to avoid realloc churn; just mark all empty.
        // If you want to free memory between runs, call reset().
        std::fill(table.begin(), table.end(), 0ULL);
        size_ = 0;
    }

    void reset() {
        table.clear();
        size_ = 0;
        mask_ = 0;
        maxFill_ = 0;
    }

    uint64_t size() const { return size_; }

    // Returns true if inserted (was not already present).
    bool insert(uint64_t key) {
        // Remap so 0 can be used as the empty sentinel.
        uint64_t k = key + 1ULL;

        if (table.empty()) reservePow2(1024); // initial capacity (tune if you want)
        if (size_ + 1 > maxFill_) grow();

        uint64_t idx = hash64(k) & mask_;
        for (;;) {
            uint64_t &slot = table[(size_t)idx];
            if (slot == 0ULL) { slot = k; ++size_; return true; }
            if (slot == k)    { return false; }
            idx = (idx + 1) & mask_;
        }
    }

    bool contains(uint64_t key) const {
        if (table.empty()) return false;
        uint64_t k = key + 1ULL;

        uint64_t idx = hash64(k) & mask_;
        for (;;) {
            uint64_t slot = table[(size_t)idx];
            if (slot == 0ULL) return false;
            if (slot == k)    return true;
            idx = (idx + 1) & mask_;
        }
    }

    // Optional: pre-reserve expected number of elements to avoid rehash cost.
    void reserveFor(uint64_t expected) {
        // maintain load factor ~0.7
        uint64_t cap = 1;
        uint64_t need = (expected * 10) / 7 + 1; // expected / 0.7
        while (cap < need) cap <<= 1;
        reservePow2(cap);
        // note: reservePow2 clears table; call this before first use
    }

private:
    std::vector<uint64_t> table; // stores (key+1); 0 means empty
    uint64_t size_ = 0;
    uint64_t mask_ = 0;    // table.size()-1
    uint64_t maxFill_ = 0; // threshold before grow (load factor)

    static uint64_t hash64(uint64_t x) {
        // SplitMix64: fast, good distribution for open addressing.
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }

    void reservePow2(uint64_t capPow2) {
        if (capPow2 < 8) capPow2 = 8;
        // must be power of two
        if ((capPow2 & (capPow2 - 1)) != 0) {
            // round up to power of two
            uint64_t c = 1;
            while (c < capPow2) c <<= 1;
            capPow2 = c;
        }
        table.assign((size_t)capPow2, 0ULL);
        mask_ = capPow2 - 1;
        size_ = 0;
        // load factor 0.70
        maxFill_ = (capPow2 * 7) / 10;
        if (maxFill_ == 0) maxFill_ = 1;
    }

    void grow() {
        // Double capacity and reinsert existing keys.
        std::vector<uint64_t> old = std::move(table);
        uint64_t newCap = (old.size() == 0) ? 1024ULL : (uint64_t)old.size() * 2ULL;
        reservePow2(newCap);

        for (uint64_t v : old) {
            if (v == 0ULL) continue;
            uint64_t idx = hash64(v) & mask_;
            for (;;) {
                uint64_t &slot = table[(size_t)idx];
                if (slot == 0ULL) { slot = v; ++size_; break; }
                idx = (idx + 1) & mask_;
            }
        }
    }
};