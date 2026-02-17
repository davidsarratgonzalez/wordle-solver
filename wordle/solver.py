"""Wordle solver: picks the best guess each turn using a pluggable strategy."""
from __future__ import annotations

from wordle.feedback import filter_candidates
from wordle.strategies import StrategyFn, get_strategy, score_frequency_batch
from wordle.utils import DEFAULT_MAX_TURNS, DEFAULT_WORD_LENGTH

# Cache for first-guess computation (keyed by strategy + word_length + solutions hash)
_first_guess_cache: dict[tuple[str, int, int], bytes] = {}


class Solver:
    """Wordle solver with pluggable strategy.

    Maintains the candidate set, filters after each guess, and selects
    the next guess using the configured scoring strategy.
    """

    def __init__(
        self,
        solutions: list[bytes],
        guesses: list[bytes],
        strategy: str = "entropy",
        word_length: int = DEFAULT_WORD_LENGTH,
        max_turns: int = DEFAULT_MAX_TURNS,
        hard_mode: bool = False,
    ):
        self.word_length = word_length
        self.max_turns = max_turns
        self.hard_mode = hard_mode
        self.strategy_name = strategy
        self._strategy_fn: StrategyFn = get_strategy(strategy)
        self._initial_solutions = list(solutions)
        self._initial_guesses = list(guesses)
        self.candidates: list[bytes] = list(solutions)
        self.guess_pool: list[bytes] = list(guesses)
        self.history: list[tuple[bytes, int]] = []
        # Hash for cache keying
        self._solutions_hash = hash(tuple(solutions))

    def reset(self) -> None:
        """Reset solver state for a new game."""
        self.candidates = list(self._initial_solutions)
        self.guess_pool = list(self._initial_guesses)
        self.history = []

    def best_guess(self, turn: int = 1) -> bytes:
        """Select the best guess for the current turn."""
        n = len(self.candidates)

        if n == 0:
            raise ValueError("No candidates remaining — puzzle state is inconsistent.")

        if n == 1:
            return self.candidates[0]

        if n == 2:
            return self.candidates[0]

        # Check first-guess cache (turn 1 with full candidate set)
        if turn == 1 and n == len(self._initial_solutions):
            cache_key = (self.strategy_name, self.word_length, self._solutions_hash)
            if cache_key in _first_guess_cache:
                return _first_guess_cache[cache_key]

        # Decide which pool to score
        pool = self._select_guess_pool(turn)

        # Use batch scoring for frequency strategy (precomputes stats once)
        if self.strategy_name == "frequency":
            best = score_frequency_batch(
                pool, self.candidates, self.word_length
            )
        else:
            best = self._score_pool(pool, turn)

        # Cache first guess
        if turn == 1 and n == len(self._initial_solutions):
            cache_key = (self.strategy_name, self.word_length, self._solutions_hash)
            _first_guess_cache[cache_key] = best

        return best

    def _score_pool(self, pool: list[bytes], turn: int) -> bytes:
        """Score all guesses in pool and return the best one."""
        best_score = float("-inf")
        best_guess = pool[0]
        best_is_candidate = False
        candidate_set = set(self.candidates)

        for g in pool:
            score = self._score_guess(g, turn)
            g_is_candidate = g in candidate_set

            if (
                score > best_score
                or (score == best_score and g_is_candidate and not best_is_candidate)
            ):
                best_score = score
                best_guess = g
                best_is_candidate = g_is_candidate

        return best_guess

    def update(self, guess: bytes, pattern: int) -> None:
        """Update state after receiving feedback."""
        self.history.append((guess, pattern))
        self.candidates = filter_candidates(
            self.candidates, guess, pattern, self.word_length
        )
        if self.hard_mode:
            self.guess_pool = filter_candidates(
                self.guess_pool, guess, pattern, self.word_length
            )

    @property
    def remaining_candidates(self) -> int:
        return len(self.candidates)

    def _score_guess(self, guess: bytes, turn: int) -> float:
        """Score a single guess using the configured strategy."""
        return self._strategy_fn(
            guess=guess,
            candidates=self.candidates,
            word_length=self.word_length,
            turn=turn,
            max_turns=self.max_turns,
        )

    def _select_guess_pool(self, turn: int) -> list[bytes]:
        """Determine which words to score as potential guesses.

        Performance-aware: use candidates-only when the full pool would
        be too expensive. The full pool is only beneficial when candidates
        are moderately sized (enough to split, but not so many that
        scoring all guesses is prohibitive).
        """
        n = len(self.candidates)
        full_pool_size = len(self.guess_pool)

        # Very small candidate set: just score candidates
        if n <= 2:
            return self.candidates

        # Large candidate set: scoring full pool is too expensive in pure Python.
        # Use candidates only (still O(n^2) which is manageable for n < 3000).
        if n > 300:
            return self.candidates

        # Medium candidate set: use full pool for information-theoretic strategies
        # (the extra guesses can help split remaining candidates).
        # But cap the pool size to keep computation reasonable.
        if self.strategy_name in ("entropy", "expected_size", "hybrid", "minimax"):
            # O(pool * candidates) pattern computations
            cost = full_pool_size * n
            if cost <= 2_000_000:  # ~2-3 seconds in pure Python
                return self.guess_pool

        return self.candidates
