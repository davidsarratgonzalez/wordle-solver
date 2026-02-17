"""Feedback computation using two-pass algorithm with base-3 pattern encoding.

The pattern is encoded as a base-3 integer where each digit (MSB to LSB)
corresponds to a position: 0=GREY, 1=YELLOW, 2=GREEN.

For L=5, patterns range from 0 (all grey) to 242 (all green).

Two-pass algorithm:
  Pass 1: Mark greens (exact matches), decrement letter counts.
  Pass 2: Mark yellows left-to-right using remaining counts.
This correctly handles duplicate letters.
"""
from __future__ import annotations

_ORD_A = ord("a")


def compute_pattern(guess: bytes, secret: bytes, word_length: int = 5) -> int:
    """Compute the feedback pattern for guess against secret.

    Args:
        guess: The guessed word as lowercase ASCII bytes.
        secret: The secret word as lowercase ASCII bytes.
        word_length: Length of the words.

    Returns:
        Base-3 encoded pattern int in [0, 3^word_length).
    """
    counts = [0] * 26
    result = [0] * word_length

    # Count letters in secret
    for i in range(word_length):
        counts[secret[i] - _ORD_A] += 1

    # Pass 1: greens
    for i in range(word_length):
        if guess[i] == secret[i]:
            result[i] = 2
            counts[guess[i] - _ORD_A] -= 1

    # Pass 2: yellows
    for i in range(word_length):
        if result[i] == 0:
            idx = guess[i] - _ORD_A
            if counts[idx] > 0:
                result[i] = 1
                counts[idx] -= 1

    # Encode as base-3 integer (MSB = position 0)
    pattern = 0
    for v in result:
        pattern = pattern * 3 + v
    return pattern


def compute_pattern_batch(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
) -> list[int]:
    """Compute patterns for one guess against many candidates."""
    a = _ORD_A
    patterns = []
    for secret in candidates:
        counts = [0] * 26
        result = [0] * word_length
        for i in range(word_length):
            counts[secret[i] - a] += 1
        for i in range(word_length):
            if guess[i] == secret[i]:
                result[i] = 2
                counts[guess[i] - a] -= 1
        for i in range(word_length):
            if result[i] == 0:
                idx = guess[i] - a
                if counts[idx] > 0:
                    result[i] = 1
                    counts[idx] -= 1
        p = 0
        for v in result:
            p = p * 3 + v
        patterns.append(p)
    return patterns


def bucket_sizes(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
) -> dict[int, int]:
    """Partition candidates by pattern and return counts only.

    More memory-efficient than bucket_by_pattern for scoring.
    """
    a = _ORD_A
    buckets: dict[int, int] = {}
    for secret in candidates:
        counts = [0] * 26
        result = [0] * word_length
        for i in range(word_length):
            counts[secret[i] - a] += 1
        for i in range(word_length):
            if guess[i] == secret[i]:
                result[i] = 2
                counts[guess[i] - a] -= 1
        for i in range(word_length):
            if result[i] == 0:
                idx = guess[i] - a
                if counts[idx] > 0:
                    result[i] = 1
                    counts[idx] -= 1
        p = 0
        for v in result:
            p = p * 3 + v
        buckets[p] = buckets.get(p, 0) + 1
    return buckets


def bucket_by_pattern(
    guess: bytes,
    candidates: list[bytes],
    word_length: int = 5,
) -> dict[int, list[bytes]]:
    """Partition candidates into buckets keyed by feedback pattern."""
    a = _ORD_A
    buckets: dict[int, list[bytes]] = {}
    for secret in candidates:
        counts = [0] * 26
        result = [0] * word_length
        for i in range(word_length):
            counts[secret[i] - a] += 1
        for i in range(word_length):
            if guess[i] == secret[i]:
                result[i] = 2
                counts[guess[i] - a] -= 1
        for i in range(word_length):
            if result[i] == 0:
                idx = guess[i] - a
                if counts[idx] > 0:
                    result[i] = 1
                    counts[idx] -= 1
        p = 0
        for v in result:
            p = p * 3 + v
        if p in buckets:
            buckets[p].append(secret)
        else:
            buckets[p] = [secret]
    return buckets


def filter_candidates(
    candidates: list[bytes],
    guess: bytes,
    pattern: int,
    word_length: int = 5,
) -> list[bytes]:
    """Return candidates consistent with the given guess/pattern feedback."""
    a = _ORD_A
    result_list = []
    for secret in candidates:
        counts = [0] * 26
        result = [0] * word_length
        for i in range(word_length):
            counts[secret[i] - a] += 1
        for i in range(word_length):
            if guess[i] == secret[i]:
                result[i] = 2
                counts[guess[i] - a] -= 1
        for i in range(word_length):
            if result[i] == 0:
                idx = guess[i] - a
                if counts[idx] > 0:
                    result[i] = 1
                    counts[idx] -= 1
        p = 0
        for v in result:
            p = p * 3 + v
        if p == pattern:
            result_list.append(secret)
    return result_list
