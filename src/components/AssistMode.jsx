import { useState, useRef, useEffect } from 'react';
import { ALL_GREEN } from '../solver/feedback.js';
import { Solver } from '../solver/solver.js';
import { WORDS } from '../solver/words.js';
import { ALLOWED } from '../solver/allowed.js';
import { firstGuessReady } from '../solver/precompute.js';

const FEEDBACK_CLASSES = ['grey', 'yellow', 'green'];
const TILE_STATES = ['grey', 'yellow', 'green'];

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

/**
 * Recreate a Solver and replay a list of past turns.
 */
function replaySolver(pool, history) {
  const solver = new Solver(WORDS, pool);
  for (const { guess, pattern } of history) {
    solver.update(guess, pattern);
  }
  return solver;
}

/**
 * Assistant mode: two-panel layout matching Demo.
 * Left: controls (Start, Submit, Back, Reset, toggle).
 * Right: solver grid with clickable tiles.
 */
export default function AssistMode({ hardMode, onHardModeChange }) {
  const solverRef = useRef(null);
  const [rows, setRows] = useState([]);           // completed {guess, pattern}
  const [currentGuess, setCurrentGuess] = useState('');
  const [feedback, setFeedback] = useState([0, 0, 0, 0, 0]);
  const [status, setStatus] = useState('idle');    // idle | playing | solved | failed | impossible

  function getPool() {
    return hardMode ? [...WORDS, ...ALLOWED] : null;
  }

  async function handleStart() {
    const pool = getPool();
    await firstGuessReady[pool ? 'extended' : 'solutions'];
    const solver = new Solver(WORDS, pool);
    solverRef.current = solver;
    setRows([]);
    setCurrentGuess(solver.bestGuess(1));
    setFeedback([0, 0, 0, 0, 0]);
    setStatus('playing');
  }

  function handleTileClick(index) {
    if (status !== 'playing') return;
    setFeedback(prev => {
      const next = [...prev];
      next[index] = (next[index] + 1) % 3;
      return next;
    });
  }

  function handleSubmit() {
    if (status !== 'playing') return;

    const pattern = encodePattern(feedback);
    const newRows = [...rows, { guess: currentGuess, pattern }];
    setRows(newRows);

    if (pattern === ALL_GREEN) {
      setStatus('solved');
      setCurrentGuess('');
      return;
    }

    if (newRows.length >= 6) {
      setStatus('failed');
      setCurrentGuess('');
      return;
    }

    const solver = solverRef.current;
    solver.update(currentGuess, pattern);

    if (solver.remaining === 0) {
      setStatus('impossible');
      setCurrentGuess('');
      return;
    }

    setCurrentGuess(solver.bestGuess(newRows.length + 1));
    setFeedback([0, 0, 0, 0, 0]);
  }

  function handleBack() {
    if (rows.length === 0) return;
    const prev = rows.slice(0, -1);
    setRows(prev);

    // Rebuild solver from scratch with the remaining history
    const solver = replaySolver(getPool(), prev);
    solverRef.current = solver;

    const turn = prev.length + 1;
    setCurrentGuess(solver.bestGuess(turn));
    setFeedback([0, 0, 0, 0, 0]);
    setStatus('playing');
  }

  function handleReset() {
    setRows([]);
    setCurrentGuess('');
    setFeedback([0, 0, 0, 0, 0]);
    setStatus('idle');
    solverRef.current = null;
  }

  // Enter key
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Enter') return;
      if (status === 'idle') handleStart();
      else if (status === 'playing') handleSubmit();
      else handleReset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const remaining = solverRef.current?.remaining ?? WORDS.length;
  const playing = status === 'playing';
  const done = status === 'solved' || status === 'failed' || status === 'impossible';
  const emptyRows = 6 - rows.length - (playing ? 1 : 0);

  return (
    <>
      {/* Left panel — controls */}
      <section className="panel panel-left">
        <h2>Assistant</h2>
        <p className="panel-desc">
          The solver suggests words for your Wordle game — click tiles to report the colors you got back
        </p>

        {status === 'idle' && (
          <>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={hardMode}
                onChange={(e) => onHardModeChange(e.target.checked)}
              />
              <span>Extended guess pool</span>
            </label>
            <p className="toggle-desc">
              {hardMode
                ? 'Solver can guess from all 12,972 valid words'
                : 'Solver guesses only from the 2,315 solution words'}
            </p>
            <button className="solve-btn" onClick={handleStart}>
              Start
            </button>
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
                onClick={handleBack}
                disabled={rows.length === 0}
              >
                Back
              </button>
              <button className="solve-btn secondary" onClick={handleReset}>
                Reset
              </button>
            </div>
          </>
        )}

        {done && (
          <>
            <div className={`result-msg ${status === 'solved' ? 'win' : 'lose'}`}>
              {status === 'solved' && `Solved in ${rows.length} turn${rows.length > 1 ? 's' : ''}!`}
              {status === 'failed' && 'Failed after 6 turns'}
              {status === 'impossible' && 'No words match — check your colors'}
            </div>
            <button className="solve-btn" onClick={handleReset}>
              Play again
            </button>
          </>
        )}
      </section>

      {/* Right panel — grid */}
      <section className="panel panel-right">
        <h2>Solver</h2>
        <div className="solver-grid">
          {/* Completed rows */}
          {rows.map((row, r) => {
            const states = patternToStates(row.pattern);
            return (
              <div className="grid-row" key={r}>
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

          {/* Current row — clickable */}
          {playing && (
            <div className="grid-row">
              {currentGuess.split('').map((letter, c) => (
                <div className="tile" key={c} onClick={() => handleTileClick(c)}>
                  <div className={`tile-inner ${FEEDBACK_CLASSES[feedback[c]]} clickable`}>
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
