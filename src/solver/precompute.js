/**
 * Precompute first guesses in a Web Worker (separate thread).
 * Results are stored in Solver._globalFirstGuess as they arrive.
 * Callers can await firstGuessReady.solutions / .extended.
 */
import { Solver } from './solver.js';

let resolveSolutions, resolveExtended;

export const firstGuessReady = {
  solutions: new Promise(r => { resolveSolutions = r; }),
  extended:  new Promise(r => { resolveExtended = r; }),
};

const worker = new Worker(
  new URL('./precomputeWorker.js', import.meta.url),
  { type: 'module' }
);

worker.onmessage = (e) => {
  const { key, guess } = e.data;
  Solver._globalFirstGuess.set(key, guess);
  if (key === 'solutions') resolveSolutions(guess);
  if (key === 'extended') resolveExtended(guess);
};
