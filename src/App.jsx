import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import WordInput from './components/WordInput.jsx';
import SolverGrid, { ROW_DURATION } from './components/SolverGrid.jsx';
import AssistMode from './components/AssistMode.jsx';
import RescueMode from './components/RescueMode.jsx';
import { computePattern, ALL_GREEN } from './solver/feedback.js';
import { Solver } from './solver/solver.js';
import { WORDS } from './solver/words.js';
import { ALLOWED } from './solver/allowed.js';
import { firstGuessReady } from './solver/precompute.js';
import './styles/wordle.css';
import './App.css';

export default function App() {
  const [mode, setMode] = useState('demo'); // 'demo' | 'assist' | 'rescue'
  const [guesses, setGuesses] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState(null); // { won, turns }
  const [resetKey, setResetKey] = useState(0);
  const [hardMode, setHardMode] = useState(false);
  const timersRef = useRef([]);

  const fullPool = useMemo(() => [...WORDS, ...ALLOWED], []);

  const ROW_GAP = 200;
  const ROW_CYCLE = ROW_DURATION + ROW_GAP;

  const handleSolve = useCallback(async (secretWord) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setResult(null);
    setSolving(true);

    await firstGuessReady[hardMode ? 'extended' : 'solutions'];

    const solver = new Solver(WORDS, hardMode ? fullPool : null);
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

    results.forEach((_, i) => {
      const revealAt = i * ROW_CYCLE;
      const timer = setTimeout(() => setRevealedCount(i + 1), revealAt);
      timersRef.current.push(timer);

      if (i === results.length - 1) {
        const doneTimer = setTimeout(() => {
          const won = results[results.length - 1].pattern === ALL_GREEN;
          setResult({ won, turns: results.length });
          setSolving(false);
        }, revealAt + ROW_DURATION);
        timersRef.current.push(doneTimer);
      }
    });
  }, [hardMode, fullPool]);

  const handleReset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setGuesses([]);
    setRevealedCount(0);
    setSolving(false);
    setResult(null);
    setResetKey(k => k + 1);
  }, []);

  const handleModeChange = useCallback((newMode) => {
    setMode(newMode);
    handleReset();
  }, [handleReset]);

  // Enter = "Try another" when demo result is showing
  useEffect(() => {
    if (!result || mode !== 'demo') return;
    function onKey(e) {
      if (e.key === 'Enter') handleReset();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, handleReset, mode]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Wordle Solver</h1>
        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'demo' ? 'active' : ''}`}
            onClick={() => handleModeChange('demo')}
          >
            Demo
          </button>
          <button
            className={`mode-tab ${mode === 'assist' ? 'active' : ''}`}
            onClick={() => handleModeChange('assist')}
          >
            Assistant
          </button>
          <button
            className={`mode-tab ${mode === 'rescue' ? 'active' : ''}`}
            onClick={() => handleModeChange('rescue')}
          >
            Rescue
          </button>
        </div>
      </header>

      <main className="app-main">
        {mode === 'demo' ? (
          <>
            <section className="panel panel-left">
              <h2>Choose a word</h2>
              <p className="panel-desc">
                Enter any valid Wordle word and watch the solver find it
              </p>
              <WordInput key={resetKey} onSolve={handleSolve} disabled={solving || !!result} />

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={hardMode}
                  onChange={(e) => setHardMode(e.target.checked)}
                  disabled={solving || !!result}
                />
                <span>Extended guess pool</span>
              </label>
              <p className="toggle-desc">
                {hardMode
                  ? 'Solver can guess from all 12,972 valid words'
                  : 'Solver guesses only from the 2,315 solution words'}
              </p>

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
          </>
        ) : mode === 'assist' ? (
          <AssistMode
            hardMode={hardMode}
            onHardModeChange={setHardMode}
          />
        ) : (
          <RescueMode
            hardMode={hardMode}
            onHardModeChange={setHardMode}
          />
        )}
      </main>

      <footer className="app-footer">
        Made with ❤️ by{' '}
        <a href="https://davidsarratgonzalez.github.io/" target="_blank" rel="noopener noreferrer">
          David Sarrat González
        </a>
      </footer>
    </div>
  );
}
