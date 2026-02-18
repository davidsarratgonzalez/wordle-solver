import { useState, useRef, useEffect } from 'react';
import { WORDS } from '../solver/words.js';

const wordSet = new Set(WORDS);

/**
 * Word input: 5 letter cells with validation.
 * Cursor always sits at the next empty slot (no free cell selection).
 *
 * @param {(word: string) => void} onSolve
 * @param {boolean} disabled
 */
export default function WordInput({ onSolve, disabled }) {
  const [letters, setLetters] = useState(['', '', '', '', '']);
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef()];
  const activeRef = useRef(0);

  const word = letters.join('');
  const isFull = letters.every(l => l !== '');
  const isValid = isFull && wordSet.has(word);

  // Active cell: first empty slot, or last cell if all full
  const emptyIdx = letters.indexOf('');
  const active = emptyIdx === -1 ? 4 : emptyIdx;
  activeRef.current = active;

  useEffect(() => {
    if (!disabled) inputRefs[activeRef.current].current?.focus();
  }, [disabled]);

  function handleBlur() {
    if ('ontouchstart' in window) return;
    setTimeout(() => {
      inputRefs[activeRef.current].current?.focus();
    }, 0);
  }

  function handleChange(index, value) {
    if (index !== activeRef.current || isFull) return;

    const ch = value.slice(-1).toLowerCase();
    if (!ch || !/^[a-z]$/.test(ch)) return;

    const next = [...letters];
    next[index] = ch;
    setLetters(next);

    // Update ref BEFORE focusing so handleFocus sees the right value
    if (index < 4) {
      activeRef.current = index + 1;
      inputRefs[index + 1].current?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cur = activeRef.current;
      if (letters[cur] !== '') {
        // Active cell has content (word is full) — clear it, stay
        const next = [...letters];
        next[cur] = '';
        setLetters(next);
      } else if (cur > 0) {
        // Active cell is empty — clear previous, move there
        const next = [...letters];
        next[cur - 1] = '';
        setLetters(next);
        activeRef.current = cur - 1;
        inputRefs[cur - 1].current?.focus();
      }
    } else if (e.key === 'Enter' && isValid && !disabled) {
      onSolve(word);
    }
  }

  function handleMouseDown(index, e) {
    if (index !== activeRef.current) {
      e.preventDefault();
      inputRefs[activeRef.current].current?.focus();
    }
  }

  function handleFocus(index) {
    if (index !== activeRef.current) {
      inputRefs[activeRef.current].current?.focus();
    }
  }

  function cellClass(index) {
    const base = 'letter-cell';
    if (!isFull) return base;
    return `${base} ${isValid ? 'valid' : 'invalid'}`;
  }

  return (
    <div className="word-input-container">
      <div className="input-row">
        {letters.map((letter, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            className={cellClass(i)}
            type="text"
            maxLength={1}
            value={letter.toUpperCase()}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onMouseDown={(e) => handleMouseDown(i, e)}
            onFocus={() => handleFocus(i)}
            onBlur={handleBlur}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="validation-msg">
        {isFull && !isValid && 'Not a valid Wordle word'}
      </div>

      <button
        className="solve-btn"
        disabled={!isValid || disabled}
        onClick={() => onSolve(word)}
      >
        Solve
      </button>
    </div>
  );
}
