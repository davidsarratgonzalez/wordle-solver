"""Tests for wordle.solver module."""
import unittest

from wordle.feedback import compute_pattern
from wordle.solver import Solver
from wordle.utils import all_green_pattern


class TestSolver(unittest.TestCase):
    def setUp(self):
        self.solutions = [b"crane", b"crate", b"slate", b"trace", b"world"]
        self.guesses = list(self.solutions)

    def test_single_candidate(self):
        solver = Solver(
            solutions=[b"crane"],
            guesses=[b"crane"],
            strategy="frequency",
        )
        self.assertEqual(solver.best_guess(1), b"crane")

    def test_two_candidates(self):
        solver = Solver(
            solutions=[b"crane", b"crate"],
            guesses=[b"crane", b"crate"],
            strategy="entropy",
        )
        guess = solver.best_guess(1)
        self.assertIn(guess, [b"crane", b"crate"])

    def test_update_filters(self):
        solver = Solver(
            solutions=self.solutions,
            guesses=self.guesses,
            strategy="frequency",
        )
        initial_count = solver.remaining_candidates
        # Guess "crane" against secret "crate"
        pattern = compute_pattern(b"crane", b"crate")
        solver.update(b"crane", pattern)
        self.assertLess(solver.remaining_candidates, initial_count)
        # "crate" should still be a candidate
        self.assertIn(b"crate", solver.candidates)

    def test_reset(self):
        solver = Solver(
            solutions=self.solutions,
            guesses=self.guesses,
            strategy="frequency",
        )
        pattern = compute_pattern(b"crane", b"crate")
        solver.update(b"crane", pattern)
        solver.reset()
        self.assertEqual(solver.remaining_candidates, len(self.solutions))

    def test_all_strategies_produce_valid_guess(self):
        for strategy in ["frequency", "entropy", "expected_size", "minimax", "hybrid"]:
            solver = Solver(
                solutions=self.solutions,
                guesses=self.guesses,
                strategy=strategy,
            )
            guess = solver.best_guess(1)
            self.assertIn(guess, self.guesses, f"Strategy '{strategy}' returned invalid guess")

    def test_solver_solves_known_game(self):
        """Solver should eventually find the answer."""
        from wordle.engine import WordleEngine

        secret = b"crane"
        engine = WordleEngine(secret=secret)
        solver = Solver(
            solutions=self.solutions,
            guesses=self.guesses,
            strategy="entropy",
        )
        state = engine.play_game(solver)
        self.assertTrue(state.won, f"Solver failed to find {secret!r}")

    def test_no_candidates_raises(self):
        solver = Solver(
            solutions=[b"crane"],
            guesses=[b"crane"],
            strategy="frequency",
        )
        # Force empty candidates
        solver.candidates = []
        with self.assertRaises(ValueError):
            solver.best_guess(1)

    def test_hard_mode_filters_guess_pool(self):
        solver = Solver(
            solutions=self.solutions,
            guesses=self.guesses,
            strategy="frequency",
            hard_mode=True,
        )
        initial_pool = len(solver.guess_pool)
        pattern = compute_pattern(b"crane", b"slate")
        solver.update(b"crane", pattern)
        # Guess pool should be filtered in hard mode
        self.assertLessEqual(len(solver.guess_pool), initial_pool)


if __name__ == "__main__":
    unittest.main()
