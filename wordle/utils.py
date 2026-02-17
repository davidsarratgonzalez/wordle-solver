"""Shared constants, types, and helper functions."""
from __future__ import annotations

from enum import IntEnum


class Tile(IntEnum):
    GREY = 0
    YELLOW = 1
    GREEN = 2


DEFAULT_WORD_LENGTH = 5
DEFAULT_MAX_TURNS = 6


def all_green_pattern(word_length: int = DEFAULT_WORD_LENGTH) -> int:
    """Return the all-green pattern (3^L - 1)."""
    return 3 ** word_length - 1


def pattern_to_tiles(pattern: int, word_length: int = DEFAULT_WORD_LENGTH) -> list[int]:
    """Decode a base-3 pattern int into a list of tile values (0/1/2).

    Most-significant digit corresponds to position 0.
    """
    tiles = []
    for _ in range(word_length):
        tiles.append(pattern % 3)
        pattern //= 3
    tiles.reverse()
    return tiles


def tiles_to_pattern(tiles: list[int]) -> int:
    """Encode a list of tile values (0/1/2) into a base-3 pattern int."""
    pattern = 0
    for t in tiles:
        pattern = pattern * 3 + t
    return pattern


def pattern_to_emoji(pattern: int, word_length: int = DEFAULT_WORD_LENGTH) -> str:
    """Convert pattern to emoji string for display."""
    mapping = {0: "\u2b1b", 1: "\U0001f7e8", 2: "\U0001f7e9"}
    return "".join(mapping[t] for t in pattern_to_tiles(pattern, word_length))


def pattern_to_compact(pattern: int, word_length: int = DEFAULT_WORD_LENGTH) -> str:
    """Convert pattern to compact string like '00120'."""
    return "".join(str(t) for t in pattern_to_tiles(pattern, word_length))
