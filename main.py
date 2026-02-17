"""Command-line interface for the Wordle solver.

Usage:
  python main.py download
  python main.py benchmark --strategy entropy
  python main.py benchmark --strategy entropy --sample 100 --seed 42
  python main.py compare --sample 200
  python main.py solve --strategy entropy
  python main.py play
"""
from __future__ import annotations

import argparse
import random
import sys

from wordle.benchmark import compare_strategies, format_comparison_table, run_benchmark
from wordle.engine import WordleEngine
from wordle.solver import Solver
from wordle.strategies import list_strategies
from wordle.utils import (
    DEFAULT_MAX_TURNS,
    DEFAULT_WORD_LENGTH,
    all_green_pattern,
    pattern_to_compact,
    pattern_to_emoji,
)
from wordle.wordlist import WordLists, download_word_lists, load_word_lists


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="wordle-solver",
        description="Wordle Solver with multiple strategies",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common_args(sub: argparse.ArgumentParser) -> None:
        sub.add_argument("--word-length", "-L", type=int, default=DEFAULT_WORD_LENGTH)
        sub.add_argument("--max-turns", "-T", type=int, default=DEFAULT_MAX_TURNS)
        sub.add_argument("--hard-mode", action="store_true")
        sub.add_argument("--solutions-only", action="store_true",
                         help="Only guess from answer words (no obscure words)")
        sub.add_argument("--words-file", type=str, default=None,
                         help="Custom word list file (one word per line)")

    # download
    dl = subparsers.add_parser("download", help="Download word lists")
    dl.add_argument("--word-length", "-L", type=int, default=DEFAULT_WORD_LENGTH)
    dl.add_argument("--force", action="store_true")

    # benchmark
    bench = subparsers.add_parser("benchmark", help="Benchmark a strategy")
    add_common_args(bench)
    bench.add_argument("--strategy", "-s", default="entropy")
    bench.add_argument(
        "--sample", type=int, default=None, help="Number of words to sample"
    )
    bench.add_argument("--seed", type=int, default=None)

    # compare
    comp = subparsers.add_parser("compare", help="Compare strategies")
    add_common_args(comp)
    comp.add_argument(
        "--strategies",
        nargs="*",
        default=None,
        help=f"Strategies to compare (default: all). Available: {list_strategies()}",
    )
    comp.add_argument("--sample", type=int, default=None)
    comp.add_argument("--seed", type=int, default=None)

    # solve
    solve = subparsers.add_parser("solve", help="Interactive solver")
    add_common_args(solve)
    solve.add_argument("--strategy", "-s", default="entropy")

    # play
    play = subparsers.add_parser("play", help="Play a game with solver assistance")
    add_common_args(play)
    play.add_argument("--strategy", "-s", default="entropy")

    return parser


def parse_feedback(text: str, word_length: int) -> int | None:
    """Parse user-entered feedback string into a pattern int.

    Supported formats:
      "00102"  -> digits (0=grey, 1=yellow, 2=green)
      "..Y.G"  -> dots/letters (.=grey, Y=yellow, G=green)
      "BBYBB"  -> B/Y/G letters
    """
    text = text.strip()
    if len(text) != word_length:
        return None

    tiles = []
    for ch in text:
        if ch in "0.bB":
            tiles.append(0)
        elif ch in "1yY":
            tiles.append(1)
        elif ch in "2gG":
            tiles.append(2)
        else:
            return None

    pattern = 0
    for t in tiles:
        pattern = pattern * 3 + t
    return pattern


def _load_lists(args: argparse.Namespace) -> WordLists:
    wl = load_word_lists(
        word_length=args.word_length,
        solutions_file=getattr(args, "words_file", None),
    )
    if getattr(args, "solutions_only", False):
        wl = WordLists(
            solutions=wl.solutions,
            guesses=list(wl.solutions),
            word_length=wl.word_length,
        )
    return wl


def cmd_download(args: argparse.Namespace) -> None:
    download_word_lists(word_length=args.word_length, force=args.force)
    print("Done.")


def cmd_benchmark(args: argparse.Namespace) -> None:
    word_lists = _load_lists(args)
    print(
        f"Benchmarking '{args.strategy}' on {len(word_lists.solutions)} solutions "
        f"(L={args.word_length}, T={args.max_turns})...\n"
    )
    result = run_benchmark(
        word_lists=word_lists,
        strategy=args.strategy,
        hard_mode=args.hard_mode,
        max_turns=args.max_turns,
        sample_size=args.sample,
        seed=args.seed,
    )
    print(result.summary())


def cmd_compare(args: argparse.Namespace) -> None:
    word_lists = _load_lists(args)
    n = args.sample or len(word_lists.solutions)
    print(
        f"Comparing strategies on {n} words "
        f"(L={args.word_length}, T={args.max_turns})...\n"
    )
    results = compare_strategies(
        word_lists=word_lists,
        strategies=args.strategies,
        hard_mode=args.hard_mode,
        max_turns=args.max_turns,
        sample_size=args.sample,
        seed=args.seed,
    )
    print("\n" + format_comparison_table(results))
    print()
    for r in results:
        print(f"\n--- {r.strategy_name} ---")
        print(r.summary())


def cmd_solve(args: argparse.Namespace) -> None:
    """Interactive solver: suggests guesses, user enters feedback."""
    word_lists = _load_lists(args)
    solver = Solver(
        solutions=word_lists.solutions,
        guesses=word_lists.guesses,
        strategy=args.strategy,
        word_length=args.word_length,
        max_turns=args.max_turns,
        hard_mode=args.hard_mode,
    )

    L = args.word_length
    T = args.max_turns
    win_pattern = all_green_pattern(L)

    print(f"Wordle Solver (L={L}, T={T}, strategy={args.strategy})")
    print(f"Candidates: {solver.remaining_candidates}")
    print(f"Feedback format: {L} chars of 0/1/2 or ./Y/G or B/Y/G")
    print(f"  0 or . or B = grey, 1 or Y = yellow, 2 or G = green")
    print()

    for turn in range(1, T + 1):
        suggestion = solver.best_guess(turn)
        print(f"Turn {turn}/{T} | Candidates: {solver.remaining_candidates}")
        print(f"  Suggestion: {suggestion.decode().upper()}")

        # Let user override the guess
        while True:
            raw = input(f"  Your guess [{suggestion.decode()}]: ").strip().lower()
            if not raw:
                guess = suggestion
                break
            if len(raw) == L and raw.isalpha():
                guess = raw.encode()
                break
            print(f"  Enter a {L}-letter word or press Enter for suggestion.")

        # Get feedback
        while True:
            fb = input(f"  Feedback for {guess.decode().upper()}: ").strip()
            pattern = parse_feedback(fb, L)
            if pattern is not None:
                break
            print(f"  Invalid feedback. Enter {L} chars: 0/1/2 or ./Y/G or B/Y/G")

        print(f"  {pattern_to_emoji(pattern, L)}")

        if pattern == win_pattern:
            print(f"\nSolved in {turn} turn(s)!")
            return

        solver.update(guess, pattern)

        if solver.remaining_candidates == 0:
            print("\nNo candidates remaining. Check your feedback entries.")
            return

    print(f"\nOut of turns. {solver.remaining_candidates} candidates remained.")


def cmd_play(args: argparse.Namespace) -> None:
    """Play a game: engine picks a secret, solver helps."""
    word_lists = _load_lists(args)
    secret = random.choice(word_lists.solutions)

    engine = WordleEngine(
        secret=secret,
        word_length=args.word_length,
        max_turns=args.max_turns,
        hard_mode=args.hard_mode,
    )
    solver = Solver(
        solutions=word_lists.solutions,
        guesses=word_lists.guesses,
        strategy=args.strategy,
        word_length=args.word_length,
        max_turns=args.max_turns,
        hard_mode=args.hard_mode,
    )

    L = args.word_length
    T = args.max_turns
    win_pattern = all_green_pattern(L)

    print(f"Wordle Game (L={L}, T={T}, strategy={args.strategy})")
    print(f"A secret word has been chosen. Good luck!\n")

    for turn in range(1, T + 1):
        suggestion = solver.best_guess(turn)
        print(f"Turn {turn}/{T} | Candidates: {solver.remaining_candidates}")
        print(f"  Solver suggests: {suggestion.decode().upper()}")

        # Let user override
        while True:
            raw = input(f"  Your guess [{suggestion.decode()}]: ").strip().lower()
            if not raw:
                guess = suggestion
                break
            guess_b = raw.encode()
            if len(guess_b) == L and raw.isalpha():
                guess = guess_b
                break
            print(f"  Enter a {L}-letter word or press Enter for suggestion.")

        try:
            result = engine.guess(guess)
        except ValueError as e:
            print(f"  Error: {e}")
            continue

        print(f"  {guess.decode().upper()} -> {pattern_to_emoji(result.pattern, L)} {pattern_to_compact(result.pattern, L)}")

        if result.is_correct:
            print(f"\nCongratulations! Solved in {turn} turn(s)!")
            return

        solver.update(guess, result.pattern)

    print(f"\nGame over! The word was: {secret.decode().upper()}")


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    commands = {
        "download": cmd_download,
        "benchmark": cmd_benchmark,
        "compare": cmd_compare,
        "solve": cmd_solve,
        "play": cmd_play,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
