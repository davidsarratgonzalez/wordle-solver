import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePattern, filterCandidates, bucketSizes, ALL_GREEN, patternToEmoji, patternToCompact } from '../src/solver/feedback.js';
import { Solver } from '../src/solver/solver.js';
import { WORDS } from '../src/solver/words.js';

// Helper: encode tiles [0,1,2,...] to base-3 int
function tiles(arr) {
  return arr[0] * 81 + arr[1] * 27 + arr[2] * 9 + arr[3] * 3 + arr[4];
}

describe('computePattern', () => {
  it('all green', () => {
    assert.equal(computePattern('crane', 'crane'), ALL_GREEN);
  });

  it('all grey', () => {
    assert.equal(computePattern('glyph', 'stunk'), 0);
  });

  it('greens and yellows', () => {
    // CRANE vs TRACE: c=Y, r=G, a=G, n=0, e=G
    assert.equal(computePattern('crane', 'trace'), tiles([1, 2, 2, 0, 2]));
  });

  it('exact positions get green not yellow', () => {
    // SLATE vs CRANE: s=0, l=0, a=G, t=0, e=G
    assert.equal(computePattern('slate', 'crane'), tiles([0, 0, 2, 0, 2]));
  });

  it('duplicate in guess, one in secret — first gets yellow', () => {
    // LLAMA vs WORLD: first l=Y, second l=0, a=0, m=0, a=0
    assert.equal(computePattern('llama', 'world'), tiles([1, 0, 0, 0, 0]));
  });

  it('duplicate in guess — green consumes letter first', () => {
    // SPEED vs ABIDE: s=0, p=0, e=Y, e=0, d=Y
    assert.equal(computePattern('speed', 'abide'), tiles([0, 0, 1, 0, 1]));
  });

  it('green prevents extra yellow', () => {
    // PROOF vs AFOOT: p=0, r=0, o=G, o=G, f=Y
    assert.equal(computePattern('proof', 'afoot'), tiles([0, 0, 2, 2, 1]));
  });

  it('all same letter guess', () => {
    // AAAAA vs CRANE: only pos2 is green
    assert.equal(computePattern('aaaaa', 'crane'), tiles([0, 0, 2, 0, 0]));
  });

  it('multiple same in secret', () => {
    // EEEEE vs GEESE: e at pos 1,2,4 = green
    assert.equal(computePattern('eeeee', 'geese'), tiles([0, 2, 2, 0, 2]));
  });

  it('duplicate in secret, two in guess', () => {
    // ABYSS vs BANAL: a=Y, b=Y, y=0, s=0, s=0
    assert.equal(computePattern('abyss', 'banal'), tiles([1, 1, 0, 0, 0]));
  });
});

describe('bucketSizes', () => {
  it('sum equals total candidates', () => {
    const candidates = ['crane', 'slate', 'trace', 'world', 'afoot'];
    const buckets = bucketSizes('crane', candidates);
    let sum = 0;
    for (const v of buckets.values()) sum += v;
    assert.equal(sum, candidates.length);
  });

  it('all-green bucket has count 1 for the guess word', () => {
    const candidates = ['crane', 'slate', 'world'];
    const buckets = bucketSizes('crane', candidates);
    assert.equal(buckets.get(ALL_GREEN), 1);
  });
});

describe('filterCandidates', () => {
  it('keeps only consistent candidates', () => {
    const candidates = ['slate', 'crane', 'trace', 'world', 'afoot'];
    const pattern = computePattern('crane', 'trace');
    const filtered = filterCandidates(candidates, 'crane', pattern);
    assert.ok(filtered.includes('trace'));
    for (const w of filtered) {
      assert.equal(computePattern('crane', w), pattern);
    }
  });

  it('returns empty when nothing matches', () => {
    const filtered = filterCandidates(['slate', 'world'], 'crane', ALL_GREEN);
    assert.equal(filtered.length, 0);
  });
});

describe('patternToEmoji', () => {
  it('all green', () => {
    assert.equal(patternToEmoji(ALL_GREEN), '\ud83d\udfe9\ud83d\udfe9\ud83d\udfe9\ud83d\udfe9\ud83d\udfe9');
  });

  it('all grey', () => {
    assert.equal(patternToEmoji(0), '\u2b1b\u2b1b\u2b1b\u2b1b\u2b1b');
  });
});

describe('patternToCompact', () => {
  it('all green', () => {
    assert.equal(patternToCompact(ALL_GREEN), '22222');
  });

  it('mixed', () => {
    assert.equal(patternToCompact(tiles([0, 1, 2, 0, 1])), '01201');
  });
});

describe('Solver', () => {
  it('solves a known word', () => {
    const solver = new Solver(WORDS);
    const secret = 'crane';
    for (let turn = 1; turn <= 6; turn++) {
      const guess = solver.bestGuess(turn);
      const pattern = computePattern(guess, secret);
      if (pattern === ALL_GREEN) {
        assert.ok(turn <= 6, `Solved in ${turn}`);
        return;
      }
      solver.update(guess, pattern);
    }
    assert.fail('Failed to solve "crane" in 6 turns');
  });

  it('solves with tiny word set', () => {
    const words = ['crane', 'crate', 'trace'];
    const solver = new Solver(words);
    const secret = 'trace';
    for (let turn = 1; turn <= 6; turn++) {
      const guess = solver.bestGuess(turn);
      const pattern = computePattern(guess, secret);
      if (pattern === ALL_GREEN) return;
      solver.update(guess, pattern);
    }
    assert.fail('Failed to solve');
  });

  it('reset clears state', () => {
    const solver = new Solver(WORDS);
    solver.update('crane', computePattern('crane', 'slate'));
    assert.ok(solver.remaining < WORDS.length);
    solver.reset();
    assert.equal(solver.remaining, WORDS.length);
  });

  it('words list loaded', () => {
    assert.equal(WORDS.length, 2315);
    assert.ok(WORDS.includes('crane'));
    assert.ok(WORDS.includes('slate'));
  });
});
