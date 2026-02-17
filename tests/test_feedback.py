"""Tests for wordle.feedback module."""
import unittest

from wordle.feedback import (
    bucket_by_pattern,
    bucket_sizes,
    compute_pattern,
    compute_pattern_batch,
    filter_candidates,
)
from wordle.utils import all_green_pattern, tiles_to_pattern


class TestComputePattern(unittest.TestCase):
    """Test the two-pass feedback algorithm."""

    def test_all_green(self):
        self.assertEqual(compute_pattern(b"crane", b"crane"), all_green_pattern(5))

    def test_all_grey(self):
        # No letters in common
        self.assertEqual(compute_pattern(b"glyph", b"stunk"), tiles_to_pattern([0, 0, 0, 0, 0]))

    def test_simple_yellow(self):
        # guess=SLATE, secret=CRANE
        # pos2: a==a -> GREEN; pos4: e==e -> GREEN
        # s,l,t not in crane -> GREY
        self.assertEqual(
            compute_pattern(b"slate", b"crane"),
            tiles_to_pattern([0, 0, 2, 0, 2]),
        )

    def test_simple_green_and_yellow(self):
        # guess=CRANE, secret=TRACE
        # pos1: r==r -> GREEN; pos2: a==a -> GREEN; pos4: e==e -> GREEN
        # pos0: c -> c in trace(pos3) -> YELLOW; pos3: n -> not in trace -> GREY
        self.assertEqual(
            compute_pattern(b"crane", b"trace"),
            tiles_to_pattern([1, 2, 2, 0, 2]),
        )

    def test_duplicate_letter_green_consumes_first(self):
        # guess=SPEED, secret=ABIDE
        # s=0, p=0, e=1(e in abide pos4), e=2(exact at pos3), d=1(d in abide)
        # Wait: secret=ABIDE => a,b,i,d,e
        # guess=SPEED => s,p,e,e,d
        # pos0: s!=a => check later; pos1: p!=b; pos2: e!=i; pos3: e!=d; pos4: d!=e
        # No greens. Yellows: s(0)->not in abide->0; p(0)->not in abide->0;
        # e(1)->e in abide, remaining[e]=1, mark yellow, remaining[e]=0;
        # e(0)->remaining[e]=0->grey;
        # d(1)->d in abide, remaining[d]=1, mark yellow, remaining[d]=0
        self.assertEqual(
            compute_pattern(b"speed", b"abide"),
            tiles_to_pattern([0, 0, 1, 0, 1]),
        )

    def test_duplicate_in_guess_one_in_secret(self):
        # guess=LLAMA, secret=WORLD
        # l=0, l=1(l in world), a=0, m=0, a=0
        # pos0: l!=w; pos1: l!=o; pos2: a!=r; pos3: m!=l; pos4: a!=d
        # No greens. Yellows L-to-R:
        # l: l in world(pos3), remaining[l]=1 -> yellow, remaining[l]=0
        # l: remaining[l]=0 -> grey
        # a: not in world -> grey; m: not in world -> grey; a: grey
        self.assertEqual(
            compute_pattern(b"llama", b"world"),
            tiles_to_pattern([1, 0, 0, 0, 0]),
        )

    def test_duplicate_in_secret_two_in_guess(self):
        # secret=BANAL has two A's (pos1, pos3)
        # guess=ABYSS: a=1(a in banal), b=1(b in banal), y=0, s=0, s=0
        # pos0: a!=b; pos1: b!=a; pos2: y!=n; pos3: s!=a; pos4: s!=l
        # No greens. Yellows: a->remaining[a]=2, yellow, remaining[a]=1;
        # b->remaining[b]=1, yellow, remaining[b]=0; y->0; s->0; s->0
        self.assertEqual(
            compute_pattern(b"abyss", b"banal"),
            tiles_to_pattern([1, 1, 0, 0, 0]),
        )

    def test_green_prevents_extra_yellow(self):
        # secret=AFOOT: a,f,o,o,t. guess=PROOF: p,r,o,o,f
        # Greens: pos2 o==o, pos3 o==o -> both GREEN, remaining[o]=0
        # Yellows: p->0; r->0; f->remaining[f]=1->YELLOW
        self.assertEqual(
            compute_pattern(b"proof", b"afoot"),
            tiles_to_pattern([0, 0, 2, 2, 1]),
        )

    def test_all_same_letter_guess(self):
        # guess=AAAAA, secret=CRANE (one A at pos2)
        # Greens: pos2 a==a -> green, remaining[a]=0
        # Yellows: pos0 a->remaining[a]=0->grey; all others grey
        self.assertEqual(
            compute_pattern(b"aaaaa", b"crane"),
            tiles_to_pattern([0, 0, 2, 0, 0]),
        )

    def test_all_same_letter_multiple_in_secret(self):
        # guess=EEEEE, secret=GEESE (e at pos1,2,4 = 3 e's)
        # Greens: pos1 e==e, pos2 e==e, pos4 e==e -> 3 greens, remaining[e]=0
        # Yellows: pos0 e->remaining=0->grey; pos3 e->remaining=0->grey
        self.assertEqual(
            compute_pattern(b"eeeee", b"geese"),
            tiles_to_pattern([0, 2, 2, 0, 2]),
        )

    def test_different_word_length(self):
        # 4-letter words
        self.assertEqual(
            compute_pattern(b"word", b"word", word_length=4),
            all_green_pattern(4),
        )
        self.assertEqual(
            compute_pattern(b"abcd", b"efgh", word_length=4),
            0,
        )


class TestComputePatternBatch(unittest.TestCase):
    def test_batch_matches_individual(self):
        guess = b"crane"
        candidates = [b"slate", b"crane", b"trace", b"world", b"afoot"]
        batch = compute_pattern_batch(guess, candidates)
        individual = [compute_pattern(guess, c) for c in candidates]
        self.assertEqual(batch, individual)


class TestBucketSizes(unittest.TestCase):
    def test_single_candidate(self):
        buckets = bucket_sizes(b"crane", [b"slate"])
        self.assertEqual(sum(buckets.values()), 1)

    def test_sum_equals_total(self):
        candidates = [b"slate", b"crane", b"trace", b"world", b"afoot"]
        buckets = bucket_sizes(b"crane", candidates)
        self.assertEqual(sum(buckets.values()), len(candidates))

    def test_all_green_bucket(self):
        candidates = [b"crane", b"slate", b"world"]
        buckets = bucket_sizes(b"crane", candidates)
        green = all_green_pattern(5)
        self.assertEqual(buckets.get(green, 0), 1)


class TestBucketByPattern(unittest.TestCase):
    def test_consistent_with_sizes(self):
        candidates = [b"slate", b"crane", b"trace", b"world", b"afoot"]
        guess = b"crane"
        sizes = bucket_sizes(guess, candidates)
        by_pattern = bucket_by_pattern(guess, candidates)
        for pat, words in by_pattern.items():
            self.assertEqual(len(words), sizes[pat])


class TestFilterCandidates(unittest.TestCase):
    def test_filter_keeps_consistent(self):
        candidates = [b"slate", b"crane", b"trace", b"world", b"afoot"]
        guess = b"crane"
        pattern = compute_pattern(guess, b"trace")
        filtered = filter_candidates(candidates, guess, pattern)
        self.assertIn(b"trace", filtered)
        for w in filtered:
            self.assertEqual(compute_pattern(guess, w), pattern)

    def test_filter_empty_result(self):
        candidates = [b"slate", b"world"]
        guess = b"crane"
        pattern = all_green_pattern(5)  # only crane matches this
        filtered = filter_candidates(candidates, guess, pattern)
        self.assertEqual(filtered, [])

    def test_filter_preserves_order(self):
        candidates = [b"crane", b"trace", b"crate"]
        guess = b"crate"
        pattern = compute_pattern(guess, b"crane")
        filtered = filter_candidates(candidates, guess, pattern)
        # Check order is preserved
        indices = [candidates.index(w) for w in filtered]
        self.assertEqual(indices, sorted(indices))


if __name__ == "__main__":
    unittest.main()
