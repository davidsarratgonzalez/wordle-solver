"""Benchmark runner for evaluating solver strategies."""
from __future__ import annotations

import random
import sys
import time
from dataclasses import dataclass, field
from typing import TextIO

from wordle.engine import WordleEngine
from wordle.solver import Solver
from wordle.strategies import list_strategies
from wordle.utils import DEFAULT_MAX_TURNS, DEFAULT_WORD_LENGTH
from wordle.wordlist import WordLists


@dataclass
class BenchmarkResult:
    """Aggregate results from benchmarking a solver."""

    strategy_name: str
    total_games: int
    wins: int
    failures: int
    total_guesses: int
    guess_distribution: dict[int, int] = field(default_factory=dict)
    failure_words: list[bytes] = field(default_factory=list)
    elapsed_seconds: float = 0.0

    @property
    def failure_rate(self) -> float:
        return self.failures / self.total_games if self.total_games else 0.0

    @property
    def average_guesses(self) -> float:
        return self.total_guesses / self.wins if self.wins else float("inf")

    def summary(self) -> str:
        lines = [
            f"Strategy: {self.strategy_name}",
            f"Games: {self.total_games}",
            f"Wins: {self.wins} ({100 * (1 - self.failure_rate):.1f}%)",
            f"Failures: {self.failures} ({100 * self.failure_rate:.1f}%)",
            f"Average guesses (wins): {self.average_guesses:.3f}",
            f"Time: {self.elapsed_seconds:.1f}s",
            "",
            "Distribution:",
        ]
        lines.append(self.distribution_bar_chart())
        if self.failure_words:
            decoded = [w.decode() for w in self.failure_words[:20]]
            lines.append(f"\nFailed words (first 20): {', '.join(decoded)}")
        return "\n".join(lines)

    def distribution_bar_chart(self, width: int = 40) -> str:
        if not self.guess_distribution:
            return "  (no data)"
        max_count = max(self.guess_distribution.values())
        lines = []
        for k in sorted(self.guess_distribution.keys()):
            count = self.guess_distribution[k]
            bar_len = int(count / max_count * width) if max_count > 0 else 0
            bar = "\u2588" * bar_len
            pct = 100 * count / self.total_games
            lines.append(f"  {k}: {bar} {count} ({pct:.1f}%)")
        return "\n".join(lines)


def run_benchmark(
    word_lists: WordLists,
    strategy: str = "entropy",
    hard_mode: bool = False,
    max_turns: int = DEFAULT_MAX_TURNS,
    sample_size: int | None = None,
    seed: int | None = None,
    progress: bool = True,
    stream: TextIO = sys.stderr,
) -> BenchmarkResult:
    """Run benchmark: solver plays every solution word."""
    solutions = list(word_lists.solutions)
    if sample_size is not None and sample_size < len(solutions):
        rng = random.Random(seed)
        solutions = rng.sample(solutions, sample_size)

    solver = Solver(
        solutions=word_lists.solutions,
        guesses=word_lists.guesses,
        strategy=strategy,
        word_length=word_lists.word_length,
        max_turns=max_turns,
        hard_mode=hard_mode,
    )

    result = BenchmarkResult(
        strategy_name=strategy,
        total_games=len(solutions),
        wins=0,
        failures=0,
        total_guesses=0,
    )

    start = time.time()
    for i, secret in enumerate(solutions):
        if progress and (i + 1) % 50 == 0:
            elapsed = time.time() - start
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            print(
                f"\r  [{strategy}] {i + 1}/{len(solutions)} "
                f"({rate:.1f} games/s, avg {result.average_guesses:.3f})",
                end="",
                file=stream,
                flush=True,
            )

        engine = WordleEngine(
            secret=secret,
            word_length=word_lists.word_length,
            max_turns=max_turns,
            hard_mode=hard_mode,
        )
        state = engine.play_game(solver)

        if state.won:
            result.wins += 1
            result.total_guesses += state.turns_used
            result.guess_distribution[state.turns_used] = (
                result.guess_distribution.get(state.turns_used, 0) + 1
            )
        else:
            result.failures += 1
            result.failure_words.append(secret)
            # Count failures in distribution as max_turns + 1
            fail_key = max_turns + 1
            result.guess_distribution[fail_key] = (
                result.guess_distribution.get(fail_key, 0) + 1
            )

    result.elapsed_seconds = time.time() - start
    if progress:
        print(file=stream)

    return result


def compare_strategies(
    word_lists: WordLists,
    strategies: list[str] | None = None,
    hard_mode: bool = False,
    max_turns: int = DEFAULT_MAX_TURNS,
    sample_size: int | None = None,
    seed: int | None = None,
    progress: bool = True,
) -> list[BenchmarkResult]:
    """Run benchmark for multiple strategies and return comparison."""
    if strategies is None:
        strategies = list_strategies()

    results = []
    for strat in strategies:
        if progress:
            print(f"\nBenchmarking '{strat}'...", file=sys.stderr)
        result = run_benchmark(
            word_lists=word_lists,
            strategy=strat,
            hard_mode=hard_mode,
            max_turns=max_turns,
            sample_size=sample_size,
            seed=seed,
            progress=progress,
        )
        results.append(result)

    results.sort(key=lambda r: r.average_guesses)
    return results


def format_comparison_table(results: list[BenchmarkResult]) -> str:
    """Format comparison results as an aligned text table."""
    header = f"{'Strategy':<16} {'Avg Guesses':>12} {'Wins':>6} {'Fails':>6} {'Fail%':>7} {'Time':>8}"
    sep = "-" * len(header)
    lines = [header, sep]
    for r in results:
        lines.append(
            f"{r.strategy_name:<16} {r.average_guesses:>12.3f} "
            f"{r.wins:>6} {r.failures:>6} {r.failure_rate:>6.1%} "
            f"{r.elapsed_seconds:>7.1f}s"
        )
    return "\n".join(lines)
