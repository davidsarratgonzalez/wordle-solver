import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import WordInput from './components/WordInput.jsx';
import SolverGrid, { ROW_DURATION } from './components/SolverGrid.jsx';
import AssistMode from './components/AssistMode.jsx';
import RescueMode from './components/RescueMode.jsx';
import { computePattern, ALL_GREEN } from './solver/feedback.js';
import { Solver } from './solver/solver.js';
import { WORDS } from './solver/words.js';
import { ALLOWED } from './solver/allowed.js';
import './styles/wordle.css';
import './App.css';

// Easter egg: "david" → Infinity 2008 lyrics synced to music
const INFINITY_ROWS = [
  'heres', 'mykey', 'philo', 'sophy', 'afrea',
  'klike', 'me   ', ' just', 'needs', 'infi ', ' nity',
].map(guess => ({ guess, pattern: ALL_GREEN }));

// Delay (ms) before the first letter starts typing — adjust to sync with audio start
const EASTER_EGG_DELAY = 750;

// Delay (ms) for each row reveal relative to EASTER_EGG_DELAY, timed to the lyrics:
// Page 1: "here's | my key | philo | sophy | a frea | k like"
// Page 2: "me | just | needs | infi | nity"
// Karaoke refs: "Here's my key" @11.12s, "Philosophy" @12.76s,
//               "A freak like me" @14.52s, "Just needs infinity" @15.91s
const INFINITY_DELAYS = [
  0, 400, 1640, 2200, 3400, 3900, 4300, 4700, 5100, 5500, 5850,
];

// Delay (ms) before each trumpet appears, relative to when the trumpet row shows
const TRUMPET_DELAYS = [1000, 1500, 2000];
// Delay (ms) before each trumpet stops animating (relative to same base)
const TRUMPET_STOP_DELAYS = [1500, 2000, 3500];

// Per-letter neon color, painted by word not by row
// Words: here's | my | key | philosophy | a | freak | like | me | just | needs | infinity
const W = [
  '#ff00ff', '#00ffff', '#39ff14', '#ffe600', '#ff6b00',
  '#bf00ff', '#ff1493', '#00bfff', '#ff3131', '#ff69b4', '#7fff00',
];
const NEON_CELL_COLORS = [
  [W[0],W[0],W[0],W[0],W[0]],       // heres       → here's
  [W[1],W[1],W[2],W[2],W[2]],       // mykey       → my + key
  [W[3],W[3],W[3],W[3],W[3]],       // philo       → philosophy
  [W[3],W[3],W[3],W[3],W[3]],       // sophy       → philosophy
  [W[4],W[5],W[5],W[5],W[5]],       // afrea       → a + freak
  [W[5],W[6],W[6],W[6],W[6]],       // klike       → freak + like
  [W[7],W[7],W[7],W[7],W[7]],       // me___       → me
  [W[8],W[8],W[8],W[8],W[8]],       // _just       → just
  [W[9],W[9],W[9],W[9],W[9]],       // needs       → needs
  [W[10],W[10],W[10],W[10],W[10]],  // infi_       → infinity
  [W[10],W[10],W[10],W[10],W[10]],  // _nity       → infinity
];

export default function App() {
  const [mode, setMode] = useState('demo'); // 'demo' | 'assist' | 'rescue'
  const [guesses, setGuesses] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState(null); // { won, turns }
  const [resetKey, setResetKey] = useState(0);
  const [easterColors, setEasterColors] = useState([]);
  const [showTrumpets, setShowTrumpets] = useState(['hidden', 'hidden', 'hidden']);
  const timersRef = useRef([]);
  const audioRef = useRef(null);

  // Preload easter egg audio in background
  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}infinity.mp3`);
    audio.preload = 'auto';
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  const fullPool = useMemo(() => [...WORDS, ...ALLOWED], []);

  const ROW_GAP = 200;
  const ROW_CYCLE = ROW_DURATION + ROW_GAP;

  const handleSolve = useCallback((secretWord) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setResult(null);
    setSolving(true);

    // Easter egg
    if (secretWord === 'david') {
      const audio = audioRef.current;
      if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }

      setGuesses([]);
      setRevealedCount(0);
      setEasterColors([]);

      INFINITY_ROWS.forEach((row, i) => {
        const posInPage = i % 6;
        const isNewPage = posInPage === 0 && i > 0;

        const timer = setTimeout(() => {
          if (isNewPage) {
            // Wipe grid and start new page
            setGuesses([row]);
            setRevealedCount(1);
            setEasterColors([NEON_CELL_COLORS[i]]);
          } else {
            setGuesses(prev => [...prev, row]);
            setRevealedCount(posInPage + 1);
            setEasterColors(prev => [...prev, NEON_CELL_COLORS[i]]);
          }
        }, INFINITY_DELAYS[i] + EASTER_EGG_DELAY);
        timersRef.current.push(timer);
      });

      const lastDelay = INFINITY_DELAYS[INFINITY_DELAYS.length - 1];
      const trumpetBase = lastDelay + EASTER_EGG_DELAY + 500;
      TRUMPET_DELAYS.forEach((d, ti) => {
        const t = setTimeout(() => {
          setShowTrumpets(prev => { const n = [...prev]; n[ti] = 'playing'; return n; });
        }, trumpetBase + d);
        timersRef.current.push(t);
      });
      TRUMPET_STOP_DELAYS.forEach((d, ti) => {
        const t = setTimeout(() => {
          setShowTrumpets(prev => { const n = [...prev]; n[ti] = 'still'; return n; });
        }, trumpetBase + d);
        timersRef.current.push(t);
      });

      const doneTimer = setTimeout(() => {
        setResult({ won: true, turns: INFINITY_ROWS.length, easter: true });
        setSolving(false);
      }, trumpetBase + TRUMPET_STOP_DELAYS[TRUMPET_STOP_DELAYS.length - 1]);
      timersRef.current.push(doneTimer);
      return;
    }

    const solver = new Solver(WORDS, fullPool);
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
  }, [fullPool]);

  const handleReset = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    setGuesses([]);
    setRevealedCount(0);
    setSolving(false);
    setResult(null);
    setEasterColors([]);
    setShowTrumpets(['hidden', 'hidden', 'hidden']);
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

              {result && (
                <button className="solve-btn" onClick={handleReset} style={{ marginTop: 16 }}>
                  Try another
                </button>
              )}
            </section>

            <section className="panel panel-right">
              <h2>Solver</h2>
              <SolverGrid
                guesses={guesses}
                revealedCount={revealedCount}
                neonColors={easterColors.length ? easterColors : null}
                trumpets={showTrumpets.some(s => s !== 'hidden') ? showTrumpets : null}
              />
              <div className={`result-msg ${result?.easter ? '' : result?.won ? 'win' : result ? 'lose' : ''}`}>
                {!result?.easter && result?.won && `Solved in ${result.turns} turn${result.turns > 1 ? 's' : ''}!`}
                {!result?.easter && result && !result.won && `Failed after 6 turns`}
              </div>
            </section>
          </>
        ) : mode === 'assist' ? (
          <AssistMode />
        ) : (
          <RescueMode />
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
