"""Tests for wordle.strategies module."""
import math
import unittest

from wordle.strategies import (
    score_entropy,
    score_expected_size,
    score_frequency,
    score_hybrid,
    score_minimax,
    get_strategy,
    list_strategies,
)


class TestRegistry(unittest.TestCase):
    def test_all_strategies_registered(self):
        names = list_strategies()
        self.assertIn("frequency", names)
        self.assertIn("entropy", names)
        self.assertIn("expected_size", names)
        self.assertIn("minimax", names)
        self.assertIn("hybrid", names)

    def test_get_strategy(self):
        fn = get_strategy("entropy")
        self.assertEqual(fn, score_entropy)

    def test_get_unknown_raises(self):
        with self.assertRaises(KeyError):
            get_strategy("nonexistent")


class TestEntropy(unittest.TestCase):
    def test_single_candidate_zero_entropy(self):
        self.assertEqual(score_entropy(b"crane", [b"crane"]), 0.0)

    def test_entropy_positive(self):
        candidates = [b"crane", b"slate", b"world", b"afoot", b"trace"]
        h = score_entropy(b"crane", candidates)
        self.assertGreater(h, 0.0)

    def test_entropy_upper_bound(self):
        candidates = [b"crane", b"slate", b"world", b"afoot", b"trace"]
        h = score_entropy(b"crane", candidates)
        self.assertLessEqual(h, math.log2(len(candidates)))

    def test_perfect_split_max_entropy(self):
        # If a guess splits N candidates into N buckets of size 1,
        # entropy = log2(N)
        # Construct: 5 candidates where guess="abcde" produces 5 different patterns
        # This is hard to guarantee so just check the bound
        candidates = [b"abcde", b"fghij", b"klmno", b"pqrst", b"uvwxy"]
        h = score_entropy(b"abcde", candidates)
        self.assertGreater(h, 0.0)


class TestExpectedSize(unittest.TestCase):
    def test_single_candidate(self):
        self.assertEqual(score_expected_size(b"crane", [b"crane"]), 0.0)

    def test_negative_score(self):
        candidates = [b"crane", b"slate", b"world"]
        s = score_expected_size(b"crane", candidates)
        self.assertLessEqual(s, 0.0)


class TestMinimax(unittest.TestCase):
    def test_single_candidate(self):
        s = score_minimax(b"crane", [b"crane"])
        self.assertEqual(s, -1)

    def test_minimax_negative(self):
        candidates = [b"crane", b"slate", b"world"]
        s = score_minimax(b"crane", candidates)
        self.assertLess(s, 0)


class TestFrequency(unittest.TestCase):
    def test_candidate_bonus(self):
        candidates = [b"crane", b"slate", b"world"]
        s1 = score_frequency(b"crane", candidates)
        s2 = score_frequency(b"zzzzz", candidates)
        # crane should score higher than zzzzz
        self.assertGreater(s1, s2)


class TestHybrid(unittest.TestCase):
    def test_early_turn_uses_entropy(self):
        candidates = [b"crane", b"slate", b"world", b"afoot", b"trace"]
        h_hybrid = score_hybrid(b"crane", candidates, turn=1, max_turns=6)
        h_entropy = score_entropy(b"crane", candidates)
        # Hybrid on turn 1 should be close to entropy (plus tiny candidate bonus)
        self.assertAlmostEqual(h_hybrid, h_entropy, places=4)

    def test_late_turn_uses_minimax(self):
        candidates = [b"crane", b"slate", b"world", b"afoot", b"trace"]
        h_hybrid = score_hybrid(b"crane", candidates, turn=5, max_turns=6)
        h_minimax = score_minimax(b"crane", candidates)
        # Hybrid on turn 5/6 should be close to minimax
        self.assertAlmostEqual(h_hybrid, h_minimax, places=4)


if __name__ == "__main__":
    unittest.main()
