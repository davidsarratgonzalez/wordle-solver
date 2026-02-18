import { useState } from 'react';
import { WORDS } from '../solver/words.js';
import HiddenWordInput from './HiddenWordInput.jsx';

const wordSet = new Set(WORDS);

/**
 * Word input for Demo mode.
 *
 * @param {(word: string) => void} onSolve
 * @param {boolean} disabled
 */
export default function WordInput({ onSolve, disabled }) {
  const [letters, setLetters] = useState(['', '', '', '', '']);

  const word = letters.join('');
  const isFull = letters.every(l => l !== '');
  const isValid = isFull && wordSet.has(word);

  function handleSubmit() {
    if (isValid && !disabled) onSolve(word);
  }

  return (
    <>
      <HiddenWordInput
        letters={letters}
        setLetters={setLetters}
        isFull={isFull}
        isValid={isValid}
        onSubmit={handleSubmit}
        disabled={disabled}
      />
      <button
        className="solve-btn"
        disabled={!isValid || disabled}
        onClick={handleSubmit}
      >
        Solve
      </button>
    </>
  );
}
