"use strict";

const fs = require("fs");
const { execSync } = require("child_process");

/**
 * Returns free disk space in GiB for the filesystem containing `dirPath`.
 * @param {string} dirPath  Any path on the target filesystem (file or directory).
 * @returns {number}        Free space in GiB, or Infinity if undeterminable.
 */
function getFreeGb(dirPath) {
  // Prefer fs.statfsSync — zero-dependency, synchronous, available in Node 19.6+.
  if (typeof fs.statfsSync === "function") {
    try {
      const stat = fs.statfsSync(dirPath);
      const freeBytes = stat.bavail * stat.bsize;
      return freeBytes / (1024 ** 3);
    } catch {
      // Fall through to df fallback.
    }
  }

 
  try {
    const output = execSync(`df -k "${dirPath}"`, {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = output.trim().split("\n");
    // Last line contains the mount entry for the path.
    // POSIX df columns: Filesystem  1K-blocks  Used  Available  Use%  Mounted-on
    const parts = lines[lines.length - 1].split(/\s+/);
    const availKb = parseInt(parts[3], 10);
    if (!isNaN(availKb)) {
      return availKb / (1024 ** 2); // 1K-blocks → GiB
    }
  } catch {
    // Ignore — return Infinity below.
  }

  return Infinity;
}

/**
 * Returns a human-readable string for a GiB value (e.g. "42.3 GB").
 * Infinity → "unknown".
 * @param {number} gb
 * @returns {string}
 */
function formatGb(gb) {
  if (!isFinite(gb)) return "unknown";
  return `${gb.toFixed(1)} GB`;
}

module.exports = { getFreeGb, formatGb };