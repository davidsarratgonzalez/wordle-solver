import { useState, useRef, useEffect, useMemo } from 'react';
import { ALL_GREEN, filterCandidates } from '../solver/feedback.js';
import { Solver } from '../solver/solver.js';
import { WORDS } from '../solver/words.js';
import { ALLOWED } from '../solver/allowed.js';
import TypingTile from './TypingTile.jsx';

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
  const [animateGuess, setAnimateGuess] = useState(true);

  const lastEntryIdx = useRef(-1);
  const [focusCount, setFocusCount] = useState(0);
  const mountedRef = useRef(false);

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
    if (!mountedRef.current) {
      mountedRef.current = true;
      if ('ontouchstart' in window) return;
    }
    if (phase === 'input') inputRefs[activeRef.current].current?.focus();
  }, [focusCount]);

  function handleChange(index, value) {
    const ch = value.slice(-1).toLowerCase();
    if (!ch || !/^[a-z]$/.test(ch)) return;
    const cur = activeRef.current;
    setLetters(prev => {
      if (prev.every(l => l !== '')) return prev;
      const next = [...prev];
      next[cur] = ch;
      return next;
    });
    if (cur < 4) {
      activeRef.current = cur + 1;
      inputRefs[cur + 1].current?.focus();
    }
  }

  function handleInputKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cur = activeRef.current;
      if (letters[cur] !== '') {
        setLetters(prev => {
          const next = [...prev];
          next[cur] = '';
          return next;
        });
      } else if (cur > 0) {
        setLetters(prev => {
          const next = [...prev];
          next[cur - 1] = '';
          return next;
        });
        activeRef.current = cur - 1;
        inputRefs[cur - 1].current?.focus();
      }
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
    lastEntryIdx.current = entries.length;
    setEntries(prev => [...prev, { guess: word, feedback: [0, 0, 0, 0, 0] }]);
    setLetters(['', '', '', '', '']);
    setFocusCount(c => c + 1);
  }

  function removeLastWord() {
    if (entries.length === 1) setFocusCount(c => c + 1);
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

    // Already solved if last entry is all green
    if (history.length > 0 && history[history.length - 1].pattern === ALL_GREEN) {
      setPhase('solved');
      return;
    }

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
    setAnimateGuess(true);
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

    setAnimateGuess(true);
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
    setAnimateGuess(false);
    setCurrentGuess(solver.bestGuess(allHistory.length + 1));
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('playing');
  }

  function handleFullReset() {
    lastEntryIdx.current = -1;
    setEntries([]);
    setLetters(['', '', '', '', '']);
    setSolverRows([]);
    setCurrentGuess('');
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('input');
    solverRef.current = null;
    setFocusCount(c => c + 1);
  }

  // --- Global keyboard ---
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter') {
        if (phase === 'input' && isValid && canAddMore) addWord();
        else if (phase === 'playing') handleSubmit();
        else if (phase !== 'input') handleFullReset();
        return;
      }

      // Letters and backspace: desktop only, input phase, when input not focused
      if ('ontouchstart' in window) return;
      if (phase !== 'input' || !canAddMore) return;
      if (document.activeElement?.tagName === 'INPUT') return;

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        const ch = e.key.toLowerCase();
        const cur = activeRef.current;
        setLetters(prev => {
          if (prev.every(l => l !== '')) return prev;
          const next = [...prev];
          next[cur] = ch;
          return next;
        });
        if (cur < 4) activeRef.current = cur + 1;
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setLetters(prev => {
          const cur = activeRef.current;
          const next = [...prev];
          if (prev[cur] !== '') {
            next[cur] = '';
          } else if (cur > 0) {
            next[cur - 1] = '';
            activeRef.current = cur - 1;
          } else {
            return prev;
          }
          return next;
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Derived ---
  const playing = phase === 'playing';
  const done = phase === 'solved' || phase === 'failed' || phase === 'impossible';
  const remaining = solverRef.current?.remaining ?? '?';
  const inputCandidates = useMemo(() => {
    if (entries.length === 0) return WORDS.length;
    const solver = new Solver(WORDS, FULL_POOL);
    for (const e of entries) {
      solver.update(e.guess, encodeFeedback(e.feedback));
    }
    return solver.remaining;
  }, [entries]);
  const solvePreviewRemaining = useMemo(() => {
    if (!solverRef.current || !currentGuess) return remaining;
    const pattern = encodeFeedback(solveFeedback);
    if (pattern === ALL_GREEN) return WORDS.includes(currentGuess) ? 1 : 0;
    return filterCandidates(solverRef.current.candidates, currentGuess, pattern).length;
  }, [solveFeedback, currentGuess, remaining]);
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

            {entries.length > 0 && (
              <p className="assist-remaining">
                {inputCandidates} candidate{inputCandidates !== 1 ? 's' : ''} remaining
              </p>
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
              {solvePreviewRemaining} candidate{solvePreviewRemaining !== 1 ? 's' : ''} remaining
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
              {(phase === 'impossible' || phase === 'solved') && (
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
                <TypingTile
                  key={c}
                  letter={letter}
                  col={c}
                  colorClass={FEEDBACK_CLASSES[entry.feedback[c]]}
                  clickable={phase === 'input'}
                  animate={r === lastEntryIdx.current}
                  onClick={phase === 'input' ? () => handleGridTileClick(r, c) : undefined}
                />
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
            <div className="grid-row" key={currentGuess}>
              {currentGuess.split('').map((letter, c) => (
                <TypingTile
                  key={c}
                  letter={letter}
                  col={c}
                  colorClass={FEEDBACK_CLASSES[solveFeedback[c]]}
                  clickable
                  animate={animateGuess}
                  onClick={() => handleSolveTileClick(c)}
                />
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
