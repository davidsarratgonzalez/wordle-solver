#!/usr/bin/env python3
"""Standalone script to download official Wordle word list.

Usage: python scripts/download_words.py [--force]
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from wordle.wordlist import download_word_lists


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Wordle word list")
    parser.add_argument("--force", action="store_true", help="Re-download even if file exists")
    args = parser.parse_args()

    word_lists = download_word_lists(force=args.force)
    print(f"\nReady: {len(word_lists.solutions)} official Wordle words.")


if __name__ == "__main__":
    main()
