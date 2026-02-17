"""Wordle game engine for simulation and interactive play."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, NamedTuple

from wordle.feedback import compute_pattern, filter_candidates
from wordle.utils import DEFAULT_MAX_TURNS, DEFAULT_WORD_LENGTH, all_green_pattern

if TYPE_CHECKING:
    from wordle.solver import Solver


class GuessResult(NamedTuple):
    """Result of a single guess."""

    guess: bytes
    pattern: int
    is_correct: bool
    turn: int


@dataclass
class GameState:
    """Complete state of a Wordle game."""

    secret: bytes
    word_length: int
    max_turns: int
    guesses: list[GuessResult] = field(default_factory=list)
    finished: bool = False
    won: bool = False

    @property
    def turns_used(self) -> int:
        return len(self.guesses)

    @property
    def turns_remaining(self) -> int:
        return self.max_turns - self.turns_used


class WordleEngine:
    """Simulates a Wordle game."""

    def __init__(
        self,
        secret: bytes,
        word_length: int = DEFAULT_WORD_LENGTH,
        max_turns: int = DEFAULT_MAX_TURNS,
        hard_mode: bool = False,
        valid_guesses: list[bytes] | None = None,
    ):
        if len(secret) != word_length:
            raise ValueError(
                f"Secret '{secret!r}' length {len(secret)} != word_length {word_length}"
            )
        self.secret = secret
        self.word_length = word_length
        self.max_turns = max_turns
        self.hard_mode = hard_mode
        self.valid_guesses = set(valid_guesses) if valid_guesses else None
        self._win_pattern = all_green_pattern(word_length)
        self._state = GameState(
            secret=secret, word_length=word_length, max_turns=max_turns
        )
        # For hard mode validation
        self._known_green: dict[int, int] = {}  # pos -> letter byte
        self._known_yellow: dict[int, set[int]] = {}  # letter byte -> required positions excluded
        self._required_letters: dict[int, int] = {}  # letter byte -> min count

    def guess(self, word: bytes) -> GuessResult:
        """Submit a guess and receive feedback."""
        if self._state.finished:
            raise ValueError("Game is already finished.")
        if len(word) != self.word_length:
            raise ValueError(
                f"Guess '{word!r}' length {len(word)} != word_length {self.word_length}"
            )
        if self.valid_guesses is not None and word not in self.valid_guesses:
            raise ValueError(f"Guess '{word!r}' is not in the valid guess list.")

        if self.hard_mode and self._state.guesses:
            self._validate_hard_mode(word)

        pattern = compute_pattern(word, self.secret, self.word_length)
        is_correct = pattern == self._win_pattern
        turn = self._state.turns_used + 1

        result = GuessResult(
            guess=word, pattern=pattern, is_correct=is_correct, turn=turn
        )
        self._state.guesses.append(result)

        if is_correct:
            self._state.won = True
            self._state.finished = True
        elif turn >= self.max_turns:
            self._state.finished = True

        # Update hard mode constraints
        if self.hard_mode:
            self._update_hard_mode_constraints(word, pattern)

        return result

    def _validate_hard_mode(self, word: bytes) -> None:
        """Check hard mode constraints."""
        # Green letters must stay in place
        for pos, letter in self._known_green.items():
            if word[pos] != letter:
                raise ValueError(
                    f"Hard mode: position {pos} must be "
                    f"'{chr(letter)}' but got '{chr(word[pos])}'"
                )

        # Required letters must appear in the guess
        word_counts: dict[int, int] = {}
        for b in word:
            word_counts[b] = word_counts.get(b, 0) + 1
        for letter, min_count in self._required_letters.items():
            if word_counts.get(letter, 0) < min_count:
                raise ValueError(
                    f"Hard mode: guess must contain at least {min_count} "
                    f"'{chr(letter)}'"
                )

    def _update_hard_mode_constraints(self, word: bytes, pattern: int) -> None:
        """Update hard mode constraints from a guess result."""
        from wordle.utils import pattern_to_tiles

        tiles = pattern_to_tiles(pattern, self.word_length)
        letter_counts: dict[int, int] = {}

        for i, tile in enumerate(tiles):
            c = word[i]
            if tile == 2:
                self._known_green[i] = c
                letter_counts[c] = letter_counts.get(c, 0) + 1
            elif tile == 1:
                letter_counts[c] = letter_counts.get(c, 0) + 1

        # Update minimum required counts
        for letter, count in letter_counts.items():
            self._required_letters[letter] = max(
                self._required_letters.get(letter, 0), count
            )

    @property
    def state(self) -> GameState:
        return self._state

    def play_game(self, solver: Solver) -> GameState:
        """Run a complete game: solver picks guesses until win or loss."""
        solver.reset()
        while not self._state.finished:
            turn = self._state.turns_used + 1
            word = solver.best_guess(turn)
            result = self.guess(word)
            solver.update(word, result.pattern)
        return self._state
