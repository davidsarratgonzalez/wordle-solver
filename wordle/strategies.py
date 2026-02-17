"""Solver strategies for scoring candidate guesses.

Each strategy is a function returning a float score (higher = better).
Strategies are registered by name for CLI lookup.
"""
from __future__ import annotations

import math
from typing import Callable

from wordle.feedback import bucket_sizes

StrategyFn = Callable[..., float]

STRATEGIES: dict[str, StrategyFn] = {}


def register(name: str):
    """Decorator to register a strategy function by name."""

    def decorator(fn: StrategyFn) -> StrategyFn:
        STRATEGIES[name] = fn
        return fn

    return decorator


def get_strategy(name: str) -> StrategyFn:
    """Look up a strategy by name."""
    if name not in STRATEGIES:
        raise KeyError(
            f"Unknown strategy '{name}'. Available: {list(STRATEGIES.keys())}"
        )
    return STRATEGIES[name]


def list_strategies() -> list[str]:
    """Return list of registered strategy names."""
    return list(STRATEGIES.keys())


@register("frequency")
def score_frequency(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
    **kwargs,
) -> float:
    """Score based on letter frequency among remaining candidates.

    Combines:
      - Positional frequency: how often each letter appears at each position
      - Global presence: how many candidates contain each letter
      - Duplicate penalty: repeated letters in the guess
      - Candidate bonus: prefer guesses that are themselves candidates
    """
    n = len(candidates)
    if n == 0:
        return 0.0

    # Compute positional frequencies
    pos_freq = [{} for _ in range(word_length)]
    presence_count: dict[int, int] = {}
    for w in candidates:
        seen = set()
        for i in range(word_length):
            c = w[i]
            pos_freq[i][c] = pos_freq[i].get(c, 0) + 1
            if c not in seen:
                presence_count[c] = presence_count.get(c, 0) + 1
                seen.add(c)

    # Score the guess
    score = 0.0
    seen_in_guess: set[int] = set()
    w_pos = 1.0
    w_presence = 0.5
    w_dup = 0.3

    for i in range(word_length):
        c = guess[i]
        score += w_pos * pos_freq[i].get(c, 0) / n
        if c not in seen_in_guess:
            score += w_presence * presence_count.get(c, 0) / n
            seen_in_guess.add(c)

    duplicates = word_length - len(seen_in_guess)
    score -= w_dup * duplicates

    # Small bonus for being a candidate
    if guess in candidates:
        score += 0.1

    return score


def score_frequency_batch(
    pool: list[bytes],
    candidates: list[bytes],
    word_length: int = 5,
) -> bytes:
    """Score all guesses in pool using frequency strategy, precomputing stats once.

    Returns the best guess (highest score). Much faster than calling
    score_frequency per guess, since letter stats are computed once.
    """
    n = len(candidates)
    if n == 0:
        return pool[0]

    # Precompute positional and presence frequencies
    pos_freq = [{} for _ in range(word_length)]
    presence_count: dict[int, int] = {}
    for w in candidates:
        seen = set()
        for i in range(word_length):
            c = w[i]
            pos_freq[i][c] = pos_freq[i].get(c, 0) + 1
            if c not in seen:
                presence_count[c] = presence_count.get(c, 0) + 1
                seen.add(c)

    candidate_set = set(candidates)
    w_pos = 1.0
    w_presence = 0.5
    w_dup = 0.3

    best_score = float("-inf")
    best_guess = pool[0]
    best_is_candidate = False

    for guess in pool:
        score = 0.0
        seen_in_guess: set[int] = set()
        for i in range(word_length):
            c = guess[i]
            score += w_pos * pos_freq[i].get(c, 0) / n
            if c not in seen_in_guess:
                score += w_presence * presence_count.get(c, 0) / n
                seen_in_guess.add(c)
        duplicates = word_length - len(seen_in_guess)
        score -= w_dup * duplicates
        if guess in candidate_set:
            score += 0.1

        g_is_candidate = guess in candidate_set
        if (
            score > best_score
            or (score == best_score and g_is_candidate and not best_is_candidate)
        ):
            best_score = score
            best_guess = guess
            best_is_candidate = g_is_candidate

    return best_guess


@register("entropy")
def score_entropy(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
    **kwargs,
) -> float:
    """Score based on Shannon entropy of the pattern distribution.

    H = -sum(p_i * log2(p_i))
    Higher entropy = more informative guess.
    """
    n = len(candidates)
    if n <= 1:
        return 0.0

    buckets = bucket_sizes(guess, candidates, word_length)
    entropy = 0.0
    for count in buckets.values():
        p = count / n
        entropy -= p * math.log2(p)
    return entropy


@register("expected_size")
def score_expected_size(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
    **kwargs,
) -> float:
    """Minimize expected remaining candidate set size.

    E[|S'|] = sum(c^2) / N
    Returns negative so higher score = smaller expected set.
    """
    n = len(candidates)
    if n <= 1:
        return 0.0

    buckets = bucket_sizes(guess, candidates, word_length)
    sum_sq = sum(c * c for c in buckets.values())
    return -(sum_sq / n)


@register("minimax")
def score_minimax(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
    **kwargs,
) -> float:
    """Minimize worst-case bucket size.

    Returns -max(bucket_size) so higher score = smaller worst case.
    """
    if not candidates:
        return 0.0

    buckets = bucket_sizes(guess, candidates, word_length)
    return -max(buckets.values())


@register("hybrid")
def score_hybrid(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
    turn: int = 1,
    max_turns: int = 6,
    **kwargs,
) -> float:
    """Turn-aware hybrid: entropy early, minimax late.

    - Turns 1 through (max_turns - 2): entropy scoring
    - Last 2 turns: minimax to avoid failures
    - Tiebreak: prefer candidates over non-candidates
    """
    turns_left = max_turns - turn + 1
    if turns_left <= 2:
        base = score_minimax(guess, candidates, word_length)
    else:
        base = score_entropy(guess, candidates, word_length)

    # Small tiebreak: prefer candidates
    if guess in candidates:
        base += 1e-6
    return base
