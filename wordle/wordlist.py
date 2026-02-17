"""Word list loading, downloading, and filtering.

Two word lists are used:
  - solutions (2,315 words): possible daily answers — what the solver narrows down
  - guesses (12,972 words): all valid inputs — what the solver can guess from

Using the full guess pool lets the solver pick more informative probing words,
even if those words could never be the answer.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import NamedTuple

DATA_DIR = Path(__file__).parent.parent / "data"

_WORD_RE = re.compile(rb"^[a-z]+$")

# Public URLs for official Wordle word lists
_SOLUTIONS_URL = (
    "https://gist.githubusercontent.com/"
    "cfreshman/a03ef2cba789d8cf00c08f767e0fad7b/raw/"
    "wordle-answers-alphabetical.txt"
)
_ALLOWED_URL = (
    "https://gist.githubusercontent.com/"
    "cfreshman/cdcdf777450c5b5301e439061d29694c/raw/"
    "wordle-allowed-guesses.txt"
)


class WordLists(NamedTuple):
    """Container for word lists."""

    solutions: list[bytes]  # possible answers (2,315)
    guesses: list[bytes]    # all valid guesses (12,972 = solutions + allowed)
    word_length: int


def load_from_file(filepath: Path | str, word_length: int = 5) -> list[bytes]:
    """Load words from a file (one word per line).

    Filters to lowercase alpha words matching word_length.
    """
    filepath = Path(filepath)
    words = []
    with filepath.open("rb") as f:
        for line in f:
            w = line.strip().lower()
            if len(w) == word_length and _WORD_RE.match(w):
                words.append(w)
    return sorted(set(words))


def load_system_dictionary(word_length: int = 5) -> WordLists:
    """Load words from /usr/share/dict/words as fallback."""
    dict_path = Path("/usr/share/dict/words")
    if not dict_path.exists():
        raise FileNotFoundError(
            "System dictionary not found at /usr/share/dict/words. "
            "Please provide word list files or run 'python main.py download'."
        )
    words = load_from_file(dict_path, word_length)
    return WordLists(solutions=words, guesses=list(words), word_length=word_length)


def download_word_lists(
    word_length: int = 5,
    data_dir: Path = DATA_DIR,
    force: bool = False,
) -> WordLists:
    """Download official Wordle word lists from public GitHub gists.

    Downloads:
      - solutions_5.txt (2,315 possible answers)
      - allowed_5.txt (10,657 additional valid guesses)
      - wordle_words.txt (combined: all 12,972 valid words)
    """
    import urllib.request

    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    if word_length != 5:
        raise ValueError(
            f"Download only supports L=5. For L={word_length}, "
            "provide custom word list files."
        )

    solutions_file = data_dir / "solutions_5.txt"
    allowed_file = data_dir / "allowed_5.txt"
    combined_file = data_dir / "wordle_words.txt"

    def _download(url: str, dest: Path) -> None:
        print(f"Downloading {dest.name}...", file=sys.stderr)
        req = urllib.request.Request(url, headers={"User-Agent": "wordle-solver/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            dest.write_bytes(resp.read())
        print(f"  Saved to {dest}", file=sys.stderr)

    if force or not solutions_file.exists():
        _download(_SOLUTIONS_URL, solutions_file)
    if force or not allowed_file.exists():
        _download(_ALLOWED_URL, allowed_file)

    solutions = load_from_file(solutions_file, word_length)
    allowed = load_from_file(allowed_file, word_length)
    all_guesses = sorted(set(solutions) | set(allowed))

    # Write combined file for convenience
    with combined_file.open("w") as f:
        for w in all_guesses:
            f.write(w.decode() + "\n")

    print(
        f"Loaded {len(solutions)} answers, "
        f"{len(all_guesses)} total valid guesses.",
        file=sys.stderr,
    )
    return WordLists(solutions=solutions, guesses=all_guesses, word_length=word_length)


def load_word_lists(
    word_length: int = 5,
    solutions_file: Path | str | None = None,
    data_dir: Path = DATA_DIR,
) -> WordLists:
    """Load word lists with fallback chain.

    Priority:
      1. Explicit solutions file (guesses = solutions in this case)
      2. Previously downloaded lists in data_dir
      3. /usr/share/dict/words fallback
    """
    # Explicit file
    if solutions_file is not None:
        words = load_from_file(solutions_file, word_length)
        return WordLists(solutions=words, guesses=list(words), word_length=word_length)

    # Previously downloaded (two-file setup)
    sol_path = Path(data_dir) / "solutions_5.txt"
    allowed_path = Path(data_dir) / "allowed_5.txt"
    if sol_path.exists():
        solutions = load_from_file(sol_path, word_length)
        if allowed_path.exists():
            allowed = load_from_file(allowed_path, word_length)
            guesses = sorted(set(solutions) | set(allowed))
        else:
            guesses = list(solutions)
        return WordLists(solutions=solutions, guesses=guesses, word_length=word_length)

    # Fallback
    print(
        "No word lists found. Using system dictionary as fallback.\n"
        "For official Wordle words, run: python main.py download",
        file=sys.stderr,
    )
    return load_system_dictionary(word_length)
