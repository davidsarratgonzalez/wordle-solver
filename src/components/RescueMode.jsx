import { useState, useRef, useEffect } from 'react';
import { ALL_GREEN } from '../solver/feedback.js';
import { Solver } from '../solver/solver.js';
import { WORDS } from '../solver/words.js';
import { ALLOWED } from '../solver/allowed.js';

const FEEDBACK_CLASSES = ['grey', 'yellow', 'green'];
const TILE_STATES = ['grey', 'yellow', 'green'];
const allValidWords = new Set([...WORDS, ...ALLOWED]);
const FULL_POOL = [...WORDS, ...ALLOWED];

function patternToStates(pattern) {
  const states = new Array(5);
  for (let i = 4; i >= 0; i--) {
    states[i] = TILE_STATES[pattern % 3];
    pattern = (pattern / 3) | 0;
  }
  return states;
}

function encodeFeedback(fb) {
  return fb[0] * 81 + fb[1] * 27 + fb[2] * 9 + fb[3] * 3 + fb[4];
}

function replaySolver(history) {
  const solver = new Solver(WORDS, FULL_POOL);
  for (const { guess, pattern } of history) {
    solver.update(guess, pattern);
  }
  return solver;
}

/**
 * Rescue mode: user types past guesses, clicks grid tiles to set colors,
 * then the solver picks up from there.
 * Always uses the extended guess pool.
 */
export default function RescueMode() {
  // --- Input phase ---
  const [entries, setEntries] = useState([]);  // [{guess, feedback: [0,0,0,0,0]}]
  const [letters, setLetters] = useState(['', '', '', '', '']);

  // --- Solver phase ---
  const solverRef = useRef(null);
  const [phase, setPhase] = useState('input'); // input | playing | solved | failed | impossible
  const [solverRows, setSolverRows] = useState([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [solveFeedback, setSolveFeedback] = useState([0, 0, 0, 0, 0]);

  // --- Letter input ---
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef()];
  const activeRef = useRef(0);

  const word = letters.join('');
  const isFull = letters.every(l => l !== '');
  const isValid = isFull && allValidWords.has(word);

  const emptyIdx = letters.indexOf('');
  const active = emptyIdx === -1 ? 4 : emptyIdx;
  activeRef.current = active;

  useEffect(() => {
    if (phase === 'input' && !('ontouchstart' in window)) {
      inputRefs[activeRef.current].current?.focus();
    }
  }, [phase, entries]);

  function handleChange(index, value) {
    if (index !== activeRef.current || isFull) return;
    const ch = value.slice(-1).toLowerCase();
    if (!ch || !/^[a-z]$/.test(ch)) return;
    const next = [...letters];
    next[index] = ch;
    setLetters(next);
    if (index < 4) {
      activeRef.current = index + 1;
      inputRefs[index + 1].current?.focus();
    }
  }

  function handleInputKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cur = activeRef.current;
      if (letters[cur] !== '') {
        const next = [...letters];
        next[cur] = '';
        setLetters(next);
      } else if (cur > 0) {
        const next = [...letters];
        next[cur - 1] = '';
        setLetters(next);
        activeRef.current = cur - 1;
        inputRefs[cur - 1].current?.focus();
      }
    } else if (e.key === 'Enter' && isValid) {
      addWord();
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

  function handleBlur() {
    if ('ontouchstart' in window) return;
    if (phase === 'input') {
      setTimeout(() => inputRefs[activeRef.current].current?.focus(), 0);
    }
  }

  // --- Add / remove words ---
  function addWord() {
    if (!isValid || entries.length >= 6) return;
    setEntries(prev => [...prev, { guess: word, feedback: [0, 0, 0, 0, 0] }]);
    setLetters(['', '', '', '', '']);
  }

  function removeLastWord() {
    setEntries(prev => prev.slice(0, -1));
  }

  // --- Click grid tile to cycle color ---
  function handleGridTileClick(rowIdx, colIdx) {
    if (phase !== 'input') return;
    setEntries(prev => {
      const next = prev.map((e, i) =>
        i === rowIdx
          ? { ...e, feedback: e.feedback.map((f, c) => c === colIdx ? (f + 1) % 3 : f) }
          : e
      );
      return next;
    });
  }

  // --- Rescue ---
  function handleRescue() {
    const history = entries.map(e => ({
      guess: e.guess,
      pattern: encodeFeedback(e.feedback),
    }));

    const solver = replaySolver(history);
    solverRef.current = solver;

    if (solver.remaining === 0) {
      setPhase('impossible');
      return;
    }

    const turn = history.length + 1;
    if (turn > 6) {
      setPhase('failed');
      return;
    }

    setSolverRows([]);
    setCurrentGuess(solver.bestGuess(turn));
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('playing');
  }

  // --- Solver interaction ---
  function handleSolveTileClick(index) {
    if (phase !== 'playing') return;
    setSolveFeedback(prev => {
      const next = [...prev];
      next[index] = (next[index] + 1) % 3;
      return next;
    });
  }

  function handleSubmit() {
    if (phase !== 'playing') return;
    const pattern = encodeFeedback(solveFeedback);
    const newSolverRows = [...solverRows, { guess: currentGuess, pattern }];
    setSolverRows(newSolverRows);

    if (pattern === ALL_GREEN) {
      setPhase('solved');
      setCurrentGuess('');
      return;
    }

    const totalTurns = entries.length + newSolverRows.length;
    if (totalTurns >= 6) {
      setPhase('failed');
      setCurrentGuess('');
      return;
    }

    solverRef.current.update(currentGuess, pattern);

    if (solverRef.current.remaining === 0) {
      setPhase('impossible');
      setCurrentGuess('');
      return;
    }

    setCurrentGuess(solverRef.current.bestGuess(totalTurns + 1));
    setSolveFeedback([0, 0, 0, 0, 0]);
  }

  function handleSolverBack() {
    if (solverRows.length === 0) {
      // Go back to input
      setSolverRows([]);
      setCurrentGuess('');
      setSolveFeedback([0, 0, 0, 0, 0]);
      setPhase('input');
      solverRef.current = null;
      return;
    }
    const prev = solverRows.slice(0, -1);
    setSolverRows(prev);
    const allHistory = [
      ...entries.map(e => ({ guess: e.guess, pattern: encodeFeedback(e.feedback) })),
      ...prev,
    ];
    const solver = replaySolver(allHistory);
    solverRef.current = solver;
    setCurrentGuess(solver.bestGuess(allHistory.length + 1));
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('playing');
  }

  function handleFullReset() {
    setEntries([]);
    setLetters(['', '', '', '', '']);
    setSolverRows([]);
    setCurrentGuess('');
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('input');
    solverRef.current = null;
  }

  // --- Enter key ---
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return;
      if (phase === 'playing') handleSubmit();
      else if (phase !== 'input') handleFullReset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Derived ---
  const playing = phase === 'playing';
  const done = phase === 'solved' || phase === 'failed' || phase === 'impossible';
  const remaining = solverRef.current?.remaining ?? '?';
  const turnsLeft = 6 - entries.length;
  const totalUsed = entries.length + solverRows.length + (playing ? 1 : 0);
  const emptyRows = Math.max(0, 6 - totalUsed);
  const canAddMore = phase === 'input' && entries.length < 5; // leave at least 1 for solver

  return (
    <>
      {/* Left panel */}
      <section className="panel panel-left">
        <h2>Rescue</h2>
        <p className="panel-desc">
          Type your past guesses, click the tiles on the grid to set colors, then hit Rescue
        </p>

        {phase === 'input' && (
          <>
            {canAddMore && (
              <div className="word-input-container">
                <div className="input-row">
                  {letters.map((letter, i) => (
                    <input
                      key={i}
                      ref={inputRefs[i]}
                      className={`letter-cell ${isFull ? (isValid ? 'valid' : 'invalid') : ''}`}
                      type="text"
                      maxLength={1}
                      value={letter.toUpperCase()}
                      onChange={(e) => handleChange(i, e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(i, e)}
                      onMouseDown={(e) => handleMouseDown(i, e)}
                      onFocus={() => handleFocus(i)}
                      onBlur={handleBlur}
                    />
                  ))}
                </div>
                <div className="validation-msg">
                  {isFull && !isValid && 'Not a valid Wordle word'}
                </div>
                <button className="solve-btn" onClick={addWord} disabled={!isValid}>
                  Add
                </button>
              </div>
            )}

            <div className="assist-buttons">
              {entries.length > 0 && (
                <button className="solve-btn" onClick={handleRescue}>
                  Rescue ({turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left)
                </button>
              )}
              {entries.length > 0 && (
                <button className="solve-btn secondary" onClick={removeLastWord}>
                  Undo
                </button>
              )}
            </div>
          </>
        )}

        {playing && (
          <>
            <p className="assist-instruction">
              Try <strong>{currentGuess.toUpperCase()}</strong>
            </p>
            <p className="assist-remaining">
              {remaining} candidate{remaining !== 1 ? 's' : ''} remaining
            </p>
            <div className="assist-buttons">
              <button className="solve-btn" onClick={handleSubmit}>Submit</button>
              <button className="solve-btn secondary" onClick={handleSolverBack}>Back</button>
              <button className="solve-btn secondary" onClick={handleFullReset}>Reset</button>
            </div>
          </>
        )}

        {done && (
          <>
            <div className={`result-msg ${phase === 'solved' ? 'win' : 'lose'}`}>
              {phase === 'solved' && `Rescued in ${entries.length + solverRows.length} total turns!`}
              {phase === 'failed' && 'Failed, no turns left'}
              {phase === 'impossible' && 'No words match, check your colors'}
            </div>
            <div className="assist-buttons">
              {phase === 'impossible' && (
                <button className="solve-btn secondary" onClick={handleSolverBack}>
                  Back
                </button>
              )}
              <button className="solve-btn" onClick={handleFullReset}>Try again</button>
            </div>
          </>
        )}
      </section>

      {/* Right panel */}
      <section className="panel panel-right">
        <h2>Solver</h2>
        <div className="solver-grid">
          {/* User entries */}
          {entries.map((entry, r) => (
            <div className="grid-row" key={`h${r}`}>
              {entry.guess.split('').map((letter, c) => (
                <div
                  className="tile"
                  key={c}
                  onClick={phase === 'input' ? () => handleGridTileClick(r, c) : undefined}
                >
                  <div className={`tile-inner ${FEEDBACK_CLASSES[entry.feedback[c]]}${phase === 'input' ? ' clickable' : ''}`}>
                    {letter.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Solver completed rows */}
          {solverRows.map((row, r) => {
            const states = patternToStates(row.pattern);
            return (
              <div className="grid-row" key={`s${r}`}>
                {row.guess.split('').map((letter, c) => (
                  <div className="tile" key={c}>
                    <div className={`tile-inner ${states[c]}`}>
                      {letter.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Solver current row */}
          {playing && (
            <div className="grid-row">
              {currentGuess.split('').map((letter, c) => (
                <div className="tile" key={c} onClick={() => handleSolveTileClick(c)}>
                  <div className={`tile-inner ${FEEDBACK_CLASSES[solveFeedback[c]]} clickable`}>
                    {letter.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty rows */}
          {Array.from({ length: emptyRows }, (_, i) => (
            <div className="grid-row" key={`e${i}`}>
              {Array.from({ length: 5 }, (_, c) => (
                <div className="tile" key={c}>
                  <div className="tile-inner" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
