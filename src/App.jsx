import { useState, useCallback, useRef } from 'react';
import WordInput from './components/WordInput.jsx';
import SolverGrid from './components/SolverGrid.jsx';
import { computePattern, ALL_GREEN } from './solver/feedback.js';
import { Solver } from './solver/solver.js';
import { WORDS } from './solver/words.js';
import './styles/wordle.css';
import './App.css';

export default function App() {
  const [guesses, setGuesses] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState(null); // { won, turns }
  const [resetKey, setResetKey] = useState(0);
  const timersRef = useRef([]);

  // Timing: 500ms flip + 4×100ms stagger = 900ms per row, 200ms gap between rows
  const FLIP_TIME = 900;
  const ROW_GAP = 200;
  const ROW_CYCLE = FLIP_TIME + ROW_GAP;

  const handleSolve = useCallback((secretWord) => {
    // Clear previous
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setResult(null);
    setSolving(true);

    // Run solver synchronously (fast in JS)
    const solver = new Solver(WORDS);
    const results = [];

    for (let turn = 1; turn <= 6; turn++) {
      const guess = solver.bestGuess(turn);
      const pattern = computePattern(guess, secretWord);
      results.push({ guess, pattern });

      if (pattern === ALL_GREEN) break;
      solver.update(guess, pattern);
    }

    setGuesses(results);
    setRevealedCount(0);

    // Reveal rows one at a time, waiting for previous flip to finish
    results.forEach((_, i) => {
      const revealAt = i * ROW_CYCLE;
      const timer = setTimeout(() => setRevealedCount(i + 1), revealAt);
      timersRef.current.push(timer);

      // After last row flip finishes, show result
      if (i === results.length - 1) {
        const doneTimer = setTimeout(() => {
          const won = results[results.length - 1].pattern === ALL_GREEN;
          setResult({ won, turns: results.length });
          setSolving(false);
        }, revealAt + FLIP_TIME);
        timersRef.current.push(doneTimer);
      }
    });
  }, []);

  const handleReset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setGuesses([]);
    setRevealedCount(0);
    setSolving(false);
    setResult(null);
    setResetKey(k => k + 1);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Wordle Solver</h1>
      </header>

      <main className="app-main">
        <section className="panel panel-left">
          <h2>Choose a word</h2>
          <p className="panel-desc">
            Enter any valid Wordle word and watch the solver find it
          </p>
          <WordInput key={resetKey} onSolve={handleSolve} disabled={solving || !!result} />
          {result && (
            <button className="solve-btn" onClick={handleReset} style={{ marginTop: 16 }}>
              Try another
            </button>
          )}
        </section>

        <section className="panel panel-right">
          <h2>Solver</h2>
          <SolverGrid guesses={guesses} revealedCount={revealedCount} />
          <div className={`result-msg ${result?.won ? 'win' : result ? 'lose' : ''}`}>
            {result?.won && `Solved in ${result.turns} turn${result.turns > 1 ? 's' : ''}!`}
            {result && !result.won && `Failed after 6 turns`}
          </div>
        </section>
      </main>
    </div>
  );
}
