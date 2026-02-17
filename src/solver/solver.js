/**
 * Wordle solver using entropy-based strategy.
 *
 * Picks the guess that maximizes Shannon entropy of the feedback
 * pattern distribution across remaining candidates.
 */

import { ALL_GREEN, bucketSizes, filterCandidates } from './feedback.js';

/**
 * Score a guess by its Shannon entropy over remaining candidates.
 * H = -sum(p * log2(p))
 * @param {string} guess
 * @param {string[]} candidates
 * @returns {number}
 */
function scoreEntropy(guess, candidates) {
  const n = candidates.length;
  if (n <= 1) return 0;

  const buckets = bucketSizes(guess, candidates);
  let entropy = 0;
  for (const count of buckets.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export class Solver {
  /**
   * @param {string[]} words - The solutions list (candidates)
   * @param {string[]} [guessPool] - Optional full guess pool. If omitted, uses words.
   */
  constructor(words, guessPool) {
    this.words = words;
    this.guessPool = guessPool || null;
    this.candidates = [...words];
    this.history = [];
    this._firstGuessCache = null;
  }

  /** Reset for a new game. */
  reset() {
    this.candidates = [...this.words];
    this.history = [];
  }

  /**
   * Pick the best guess for the current turn.
   * @param {number} turn - Current turn (1-indexed)
   * @returns {string}
   */
  bestGuess(turn) {
    const n = this.candidates.length;
    if (n === 0) throw new Error('No candidates remaining');
    if (n === 1) return this.candidates[0];
    if (n === 2) return this.candidates[0];

    // Cache first guess (always the same)
    if (turn === 1 && n === this.words.length && this._firstGuessCache) {
      return this._firstGuessCache;
    }

    const pool = this.guessPool || this.candidates;
    const candidateSet = new Set(this.candidates);

    let bestScore = -Infinity;
    let bestGuess = pool[0];
    let bestIsCandidate = false;

    for (let i = 0; i < pool.length; i++) {
      const g = pool[i];
      const score = scoreEntropy(g, this.candidates);
      const isCandidate = candidateSet.has(g);

      if (score > bestScore || (score === bestScore && isCandidate && !bestIsCandidate)) {
        bestScore = score;
        bestGuess = g;
        bestIsCandidate = isCandidate;
      }
    }

    // Cache first guess
    if (turn === 1 && n === this.words.length) {
      this._firstGuessCache = bestGuess;
    }

    return bestGuess;
  }

  /**
   * Update state after receiving feedback.
   * @param {string} guess
   * @param {number} pattern
   */
  update(guess, pattern) {
    this.history.push({ guess, pattern });
    this.candidates = filterCandidates(this.candidates, guess, pattern);
  }

  /** Number of remaining candidates. */
  get remaining() {
    return this.candidates.length;
  }
}
