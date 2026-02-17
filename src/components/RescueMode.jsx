import { useState, useRef, useEffect } from 'react';
import { ALL_GREEN } from '../solver/feedback.js';
import { Solver } from '../solver/solver.js';
import { WORDS } from '../solver/words.js';
import { ALLOWED } from '../solver/allowed.js';

const FEEDBACK_CLASSES = ['grey', 'yellow', 'green'];
const TILE_STATES = ['grey', 'yellow', 'green'];
const allValidWords = new Set([...WORDS, ...ALLOWED]);

function patternToStates(pattern) {
  const states = new Array(5);
  for (let i = 4; i >= 0; i--) {
    states[i] = TILE_STATES[pattern % 3];
    pattern = (pattern / 3) | 0;
  }
  return states;
}

function encodePattern(fb) {
  return fb[0] * 81 + fb[1] * 27 + fb[2] * 9 + fb[3] * 3 + fb[4];
}

function replaySolver(pool, history) {
  const solver = new Solver(WORDS, pool);
  for (const { guess, pattern } of history) {
    solver.update(guess, pattern);
  }
  return solver;
}

/**
 * Rescue mode: user inputs past guesses with feedback,
 * then the solver picks up and tries to save the game.
 *
 * Phases: input → playing → solved/failed/impossible
 */
export default function RescueMode({ hardMode, onHardModeChange }) {
  // --- Input phase state ---
  const [history, setHistory] = useState([]);             // user's past guesses
  const [letters, setLetters] = useState(['', '', '', '', '']);
  const [pendingFeedback, setPendingFeedback] = useState([0, 0, 0, 0, 0]);
  const [wordConfirmed, setWordConfirmed] = useState(false); // word typed, setting colors

  // --- Solver phase state ---
  const solverRef = useRef(null);
  const [phase, setPhase] = useState('input');            // input | playing | solved | failed | impossible
  const [solverRows, setSolverRows] = useState([]);       // solver's completed turns
  const [currentGuess, setCurrentGuess] = useState('');
  const [solveFeedback, setSolveFeedback] = useState([0, 0, 0, 0, 0]);

  // --- Input helpers ---
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef()];
  const activeRef = useRef(0);

  const word = letters.join('');
  const isFull = letters.every(l => l !== '');
  const isValid = isFull && allValidWords.has(word);

  const emptyIdx = letters.indexOf('');
  const active = emptyIdx === -1 ? 4 : emptyIdx;
  activeRef.current = active;

  // Focus input on mount and after adding a guess
  useEffect(() => {
    if (phase === 'input' && !wordConfirmed) {
      inputRefs[activeRef.current].current?.focus();
    }
  }, [phase, wordConfirmed, history]);

  function handleChange(index, value) {
    if (index !== activeRef.current || isFull || wordConfirmed) return;
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

  function handleKeyDown(index, e) {
    if (wordConfirmed) return;
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
    } else if (e.key === 'Enter' && isValid && !wordConfirmed) {
      setWordConfirmed(true);
    }
  }

  function handleMouseDown(index, e) {
    if (wordConfirmed) return;
    if (index !== activeRef.current) {
      e.preventDefault();
      inputRefs[activeRef.current].current?.focus();
    }
  }

  function handleFocus(index) {
    if (wordConfirmed) return;
    if (index !== activeRef.current) {
      inputRefs[activeRef.current].current?.focus();
    }
  }

  function handleBlur() {
    if (phase === 'input' && !wordConfirmed) {
      setTimeout(() => inputRefs[activeRef.current].current?.focus(), 0);
    }
  }

  // --- Word confirmed → set colors ---
  function handlePendingTileClick(index) {
    setPendingFeedback(prev => {
      const next = [...prev];
      next[index] = (next[index] + 1) % 3;
      return next;
    });
  }

  function handleAddGuess() {
    const pattern = encodePattern(pendingFeedback);
    setHistory(prev => [...prev, { guess: word, pattern }]);
    setLetters(['', '', '', '', '']);
    setPendingFeedback([0, 0, 0, 0, 0]);
    setWordConfirmed(false);
  }

  function handleRemoveLastGuess() {
    setHistory(prev => prev.slice(0, -1));
  }

  function handleCancelWord() {
    setWordConfirmed(false);
    setPendingFeedback([0, 0, 0, 0, 0]);
  }

  // --- Rescue: solver picks up ---
  function getPool() {
    return hardMode ? [...WORDS, ...ALLOWED] : null;
  }

  function handleRescue() {
    const solver = replaySolver(getPool(), history);
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

  // --- Solver phase handlers (same as AssistMode) ---
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
    const pattern = encodePattern(solveFeedback);
    const newSolverRows = [...solverRows, { guess: currentGuess, pattern }];
    setSolverRows(newSolverRows);

    if (pattern === ALL_GREEN) {
      setPhase('solved');
      setCurrentGuess('');
      return;
    }

    const totalTurns = history.length + newSolverRows.length;
    if (totalTurns >= 6) {
      setPhase('failed');
      setCurrentGuess('');
      return;
    }

    const solver = solverRef.current;
    solver.update(currentGuess, pattern);

    if (solver.remaining === 0) {
      setPhase('impossible');
      setCurrentGuess('');
      return;
    }

    setCurrentGuess(solver.bestGuess(totalTurns + 1));
    setSolveFeedback([0, 0, 0, 0, 0]);
  }

  function handleSolverBack() {
    if (solverRows.length === 0) return;
    const prev = solverRows.slice(0, -1);
    setSolverRows(prev);
    const allHistory = [...history, ...prev];
    const solver = replaySolver(getPool(), allHistory);
    solverRef.current = solver;
    setCurrentGuess(solver.bestGuess(allHistory.length + 1));
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('playing');
  }

  function handleFullReset() {
    setHistory([]);
    setLetters(['', '', '', '', '']);
    setPendingFeedback([0, 0, 0, 0, 0]);
    setWordConfirmed(false);
    setSolverRows([]);
    setCurrentGuess('');
    setSolveFeedback([0, 0, 0, 0, 0]);
    setPhase('input');
    solverRef.current = null;
  }

  function handleBackToInput() {
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
      if (phase === 'input' && wordConfirmed) handleAddGuess();
      else if (phase === 'playing') handleSubmit();
      else if (phase !== 'input') handleFullReset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // --- Derived ---
  const playing = phase === 'playing';
  const done = phase === 'solved' || phase === 'failed' || phase === 'impossible';
  const remaining = solverRef.current?.remaining ?? '?';
  const totalRows = history.length + solverRows.length + (playing ? 1 : 0);
  const emptyRows = Math.max(0, 6 - totalRows - (phase === 'input' && wordConfirmed ? 1 : 0));
  const turnsLeft = 6 - history.length;

  // --- Render ---
  return (
    <>
      {/* Left panel — controls */}
      <section className="panel panel-left">
        <h2>Rescue</h2>
        <p className="panel-desc">
          Enter the guesses you've already made with their colors, then let the solver save your game
        </p>

        {phase === 'input' && !wordConfirmed && (
          <>
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
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onMouseDown={(e) => handleMouseDown(i, e)}
                  onFocus={() => handleFocus(i)}
                  onBlur={handleBlur}
                />
              ))}
            </div>

            <div className="validation-msg">
              {isFull && !isValid && 'Not a valid Wordle word'}
            </div>

            <button
              className="solve-btn"
              disabled={!isValid}
              onClick={() => setWordConfirmed(true)}
            >
              Set colors
            </button>
          </>
        )}

        {phase === 'input' && wordConfirmed && (
          <>
            <p className="assist-instruction">
              Click tiles to set the colors for <strong>{word.toUpperCase()}</strong>
            </p>

            <div className="grid-row">
              {word.split('').map((letter, c) => (
                <div className="tile" key={c} onClick={() => handlePendingTileClick(c)}>
                  <div className={`tile-inner ${FEEDBACK_CLASSES[pendingFeedback[c]]} clickable`}>
                    {letter.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            <div className="assist-buttons">
              <button className="solve-btn" onClick={handleAddGuess}>
                Add guess
              </button>
              <button className="solve-btn secondary" onClick={handleCancelWord}>
                Cancel
              </button>
            </div>
          </>
        )}

        {phase === 'input' && !wordConfirmed && history.length > 0 && (
          <div className="assist-buttons" style={{ marginTop: 8 }}>
            <button className="solve-btn" onClick={handleRescue} disabled={turnsLeft === 0}>
              Rescue ({turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left)
            </button>
            <button className="solve-btn secondary" onClick={handleRemoveLastGuess}>
              Undo last
            </button>
          </div>
        )}

        {phase === 'input' && (
          <>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={hardMode}
                onChange={(e) => onHardModeChange(e.target.checked)}
                disabled={phase !== 'input'}
              />
              <span>Extended guess pool</span>
            </label>
            <p className="toggle-desc">
              {hardMode
                ? 'Solver can guess from all 12,972 valid words'
                : 'Solver guesses only from the 2,315 solution words'}
            </p>
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
              <button className="solve-btn" onClick={handleSubmit}>
                Submit
              </button>
              <button
                className="solve-btn secondary"
                onClick={solverRows.length > 0 ? handleSolverBack : handleBackToInput}
              >
                Back
              </button>
              <button className="solve-btn secondary" onClick={handleFullReset}>
                Reset
              </button>
            </div>
          </>
        )}

        {done && (
          <>
            <div className={`result-msg ${phase === 'solved' ? 'win' : 'lose'}`}>
              {phase === 'solved' && `Rescued in ${history.length + solverRows.length} total turn${history.length + solverRows.length > 1 ? 's' : ''}!`}
              {phase === 'failed' && 'Failed — no turns left'}
              {phase === 'impossible' && 'No words match — check your colors'}
            </div>
            <button className="solve-btn" onClick={handleFullReset}>
              Try again
            </button>
          </>
        )}
      </section>

      {/* Right panel — grid */}
      <section className="panel panel-right">
        <h2>Solver</h2>
        <div className="solver-grid">
          {/* User's past guesses */}
          {history.map((row, r) => {
            const states = patternToStates(row.pattern);
            return (
              <div className="grid-row" key={`h${r}`}>
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

          {/* Pending word being colored (input phase) */}
          {phase === 'input' && wordConfirmed && (
            <div className="grid-row">
              {word.split('').map((letter, c) => (
                <div className="tile" key={c} onClick={() => handlePendingTileClick(c)}>
                  <div className={`tile-inner ${FEEDBACK_CLASSES[pendingFeedback[c]]} clickable`}>
                    {letter.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Solver's completed rows */}
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

          {/* Solver's current row — clickable */}
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
