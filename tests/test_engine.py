"""Tests for wordle.engine module."""
import unittest

from wordle.engine import WordleEngine, GameState, GuessResult
from wordle.utils import all_green_pattern


class TestWordleEngine(unittest.TestCase):
    def test_correct_guess(self):
        engine = WordleEngine(secret=b"crane")
        result = engine.guess(b"crane")
        self.assertTrue(result.is_correct)
        self.assertEqual(result.pattern, all_green_pattern(5))
        self.assertEqual(result.turn, 1)
        self.assertTrue(engine.state.won)
        self.assertTrue(engine.state.finished)

    def test_wrong_guess(self):
        engine = WordleEngine(secret=b"crane")
        result = engine.guess(b"slate")
        self.assertFalse(result.is_correct)
        self.assertFalse(engine.state.finished)
        self.assertEqual(engine.state.turns_used, 1)
        self.assertEqual(engine.state.turns_remaining, 5)

    def test_max_turns_exhausted(self):
        engine = WordleEngine(secret=b"crane", max_turns=2)
        engine.guess(b"slate")
        engine.guess(b"world")
        self.assertTrue(engine.state.finished)
        self.assertFalse(engine.state.won)

    def test_guess_after_finish_raises(self):
        engine = WordleEngine(secret=b"crane")
        engine.guess(b"crane")
        with self.assertRaises(ValueError):
            engine.guess(b"slate")

    def test_wrong_length_raises(self):
        engine = WordleEngine(secret=b"crane")
        with self.assertRaises(ValueError):
            engine.guess(b"hi")

    def test_secret_wrong_length_raises(self):
        with self.assertRaises(ValueError):
            WordleEngine(secret=b"hi", word_length=5)

    def test_valid_guesses_enforcement(self):
        engine = WordleEngine(
            secret=b"crane", valid_guesses=[b"crane", b"slate"]
        )
        engine.guess(b"slate")  # Should work
        with self.assertRaises(ValueError):
            engine.guess(b"world")

    def test_multiple_guesses(self):
        engine = WordleEngine(secret=b"crane")
        engine.guess(b"slate")
        engine.guess(b"world")
        engine.guess(b"crane")
        self.assertTrue(engine.state.won)
        self.assertEqual(engine.state.turns_used, 3)

    def test_custom_word_length(self):
        engine = WordleEngine(secret=b"word", word_length=4, max_turns=6)
        result = engine.guess(b"word")
        self.assertTrue(result.is_correct)
        self.assertEqual(result.pattern, all_green_pattern(4))


class TestHardMode(unittest.TestCase):
    def test_hard_mode_green_required(self):
        engine = WordleEngine(secret=b"crane", hard_mode=True)
        # First guess: crane against crane -> all green
        # Actually let's do a partial match first
        engine.guess(b"crate")  # c=G, r=G, a=G, t=0, e=G
        # Next guess must have c at 0, r at 1, a at 2, e at 4
        with self.assertRaises(ValueError):
            engine.guess(b"slate")  # s at pos 0 instead of c

    def test_hard_mode_yellow_required(self):
        engine = WordleEngine(secret=b"crane", hard_mode=True)
        engine.guess(b"react")  # r=Y, e=Y, a=Y, c=Y, t=0
        # Next guess must contain r, e, a, c (but not necessarily at those positions)
        with self.assertRaises(ValueError):
            engine.guess(b"stump")  # missing r, e, a, c


class TestPlayGame(unittest.TestCase):
    def test_play_game_wins(self):
        from wordle.solver import Solver

        # Tiny word set where the solver can definitely win
        solutions = [b"crane", b"crate"]
        guesses = [b"crane", b"crate"]

        engine = WordleEngine(secret=b"crane")
        solver = Solver(
            solutions=solutions,
            guesses=guesses,
            strategy="frequency",
            word_length=5,
            max_turns=6,
        )
        state = engine.play_game(solver)
        self.assertTrue(state.won)
        self.assertLessEqual(state.turns_used, 2)


if __name__ == "__main__":
    unittest.main()
