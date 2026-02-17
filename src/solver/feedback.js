/**
 * Wordle feedback computation using two-pass algorithm.
 *
 * Pattern is a base-3 integer (0-242) where each digit is:
 *   0 = grey, 1 = yellow, 2 = green
 *
 * Two-pass algorithm:
 *   Pass 1: Mark greens (exact matches), decrement letter counts.
 *   Pass 2: Mark yellows left-to-right using remaining counts.
 */

const A = 97; // 'a'.charCodeAt(0)

/** All-green pattern = 3^5 - 1 = 242 */
export const ALL_GREEN = 242;

/**
 * Compute feedback pattern for a guess against a secret.
 * @param {string} guess - 5-letter guess
 * @param {string} secret - 5-letter secret
 * @returns {number} Base-3 pattern (0-242)
 */
export function computePattern(guess, secret) {
  const counts = new Int8Array(26);
  const result = new Int8Array(5);

  for (let i = 0; i < 5; i++) {
    counts[secret.charCodeAt(i) - A]++;
  }

  // Pass 1: greens
  for (let i = 0; i < 5; i++) {
    if (guess.charCodeAt(i) === secret.charCodeAt(i)) {
      result[i] = 2;
      counts[guess.charCodeAt(i) - A]--;
    }
  }

  // Pass 2: yellows
  for (let i = 0; i < 5; i++) {
    if (result[i] === 0) {
      const idx = guess.charCodeAt(i) - A;
      if (counts[idx] > 0) {
        result[i] = 1;
        counts[idx]--;
      }
    }
  }

  return result[0] * 81 + result[1] * 27 + result[2] * 9 + result[3] * 3 + result[4];
}

/**
 * Get bucket sizes (pattern -> count) for a guess against candidates.
 * @param {string} guess
 * @param {string[]} candidates
 * @returns {Map<number, number>}
 */
export function bucketSizes(guess, candidates) {
  const buckets = new Map();
  const counts = new Int8Array(26);
  const result = new Int8Array(5);
  const gc = [
    guess.charCodeAt(0) - A,
    guess.charCodeAt(1) - A,
    guess.charCodeAt(2) - A,
    guess.charCodeAt(3) - A,
    guess.charCodeAt(4) - A,
  ];

  for (let c = 0; c < candidates.length; c++) {
    const secret = candidates[c];
    counts.fill(0);
    result.fill(0);

    for (let i = 0; i < 5; i++) {
      counts[secret.charCodeAt(i) - A]++;
    }
    for (let i = 0; i < 5; i++) {
      if (gc[i] === secret.charCodeAt(i) - A) {
        result[i] = 2;
        counts[gc[i]]--;
      }
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] === 0 && counts[gc[i]] > 0) {
        result[i] = 1;
        counts[gc[i]]--;
      }
    }

    const p = result[0] * 81 + result[1] * 27 + result[2] * 9 + result[3] * 3 + result[4];
    buckets.set(p, (buckets.get(p) || 0) + 1);
  }

  return buckets;
}

/**
 * Filter candidates to those consistent with a guess/pattern.
 * @param {string[]} candidates
 * @param {string} guess
 * @param {number} pattern
 * @returns {string[]}
 */
export function filterCandidates(candidates, guess, pattern) {
  const result = [];
  for (let i = 0; i < candidates.length; i++) {
    if (computePattern(guess, candidates[i]) === pattern) {
      result.push(candidates[i]);
    }
  }
  return result;
}

/**
 * Convert pattern to emoji string.
 * @param {number} pattern
 * @returns {string}
 */
export function patternToEmoji(pattern) {
  const tiles = ['', '', '', '', ''];
  const map = ['\u2b1b', '\ud83d\udfe8', '\ud83d\udfe9'];
  for (let i = 4; i >= 0; i--) {
    tiles[i] = map[pattern % 3];
    pattern = (pattern / 3) | 0;
  }
  return tiles.join('');
}

/**
 * Convert pattern to compact string like "00120".
 * @param {number} pattern
 * @returns {string}
 */
export function patternToCompact(pattern) {
  const digits = ['', '', '', '', ''];
  for (let i = 4; i >= 0; i--) {
    digits[i] = String(pattern % 3);
    pattern = (pattern / 3) | 0;
  }
  return digits.join('');
}
