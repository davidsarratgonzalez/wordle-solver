import { useState, useRef, useEffect, useMemo } from 'react';
import { ALL_GREEN, filterCandidates } from '../solver/feedback.js';
import { Solver } from '../solver/solver.js';
import { WORDS } from '../solver/words.js';
import { ALLOWED } from '../solver/allowed.js';
import TypingTile from './TypingTile.jsx';

const FEEDBACK_CLASSES = ['grey', 'yellow', 'green'];
const TILE_STATES = ['grey', 'yellow', 'green'];
const FULL_POOL = [...WORDS, ...ALLOWED];

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
function replaySolver(history) {
  const solver = new Solver(WORDS, FULL_POOL);
  for (const { guess, pattern } of history) {
    solver.update(guess, pattern);
  }
  return solver;
}

/**
 * Assistant mode: two-panel layout matching Demo.
 * Left: controls (Start, Submit, Back, Reset).
 * Right: solver grid with clickable tiles.
 * Always uses the extended guess pool.
 */
export default function AssistMode() {
  const solverRef = useRef(null);
  const [rows, setRows] = useState([]);           // completed {guess, pattern}
  const [currentGuess, setCurrentGuess] = useState('');
  const [feedback, setFeedback] = useState([0, 0, 0, 0, 0]);
  const [status, setStatus] = useState('idle');    // idle | playing | solved | failed | impossible
  const [animateGuess, setAnimateGuess] = useState(true);

  function handleStart() {
    const solver = new Solver(WORDS, FULL_POOL);
    solverRef.current = solver;
    setRows([]);
    setAnimateGuess(true);
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

    setAnimateGuess(true);
    setCurrentGuess(solver.bestGuess(newRows.length + 1));
    setFeedback([0, 0, 0, 0, 0]);
  }

  function handleBack() {
    if (rows.length === 0) return;
    const prev = rows.slice(0, -1);
    setRows(prev);

    // Rebuild solver from scratch with the remaining history
    const solver = replaySolver(prev);
    solverRef.current = solver;

    const turn = prev.length + 1;
    setAnimateGuess(false);
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
  const previewRemaining = useMemo(() => {
    if (!solverRef.current || !currentGuess) return remaining;
    const pattern = encodePattern(feedback);
    return filterCandidates(solverRef.current.candidates, currentGuess, pattern).length;
  }, [feedback, currentGuess, remaining]);
  const playing = status === 'playing';
  const done = status === 'solved' || status === 'failed' || status === 'impossible';
  const emptyRows = 6 - rows.length - (playing ? 1 : 0);

  return (
    <>
      {/* Left panel */}
      <section className="panel panel-left">
        <h2>Assistant</h2>
        <p className="panel-desc">
          The solver suggests words for your Wordle game, click tiles to report the colors you got back
        </p>

        {status === 'idle' && (
          <button className="solve-btn" onClick={handleStart}>
            Start
          </button>
        )}

        {playing && (
          <>
            <p className="assist-instruction">
              Try <strong>{currentGuess.toUpperCase()}</strong>
            </p>
            <p className="assist-remaining">
              {previewRemaining} candidate{previewRemaining !== 1 ? 's' : ''} remaining
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
              {status === 'impossible' && 'No words match, check your colors'}
            </div>
            <div className="assist-buttons">
              {status === 'impossible' && (
                <button className="solve-btn secondary" onClick={handleBack}>
                  Back
                </button>
              )}
              <button className="solve-btn" onClick={handleReset}>
                Play again
              </button>
            </div>
          </>
        )}
      </section>

      {/* Right panel */}
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

          {/* Current row */}
          {playing && (
            <div className="grid-row" key={currentGuess}>
              {currentGuess.split('').map((letter, c) => (
                <TypingTile
                  key={c}
                  letter={letter}
                  col={c}
                  colorClass={FEEDBACK_CLASSES[feedback[c]]}
                  clickable
                  animate={animateGuess}
                  onClick={() => handleTileClick(c)}
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
