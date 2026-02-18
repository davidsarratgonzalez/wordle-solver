import { Solver } from './solver.js';
import { WORDS } from './words.js';
import { ALLOWED } from './allowed.js';

const fullPool = [...WORDS, ...ALLOWED];

// Solutions-only (fast)
const g1 = new Solver(WORDS).bestGuess(1);
postMessage({ key: 'solutions', guess: g1 });

// Extended pool (slower)
const g2 = new Solver(WORDS, fullPool).bestGuess(1);
postMessage({ key: 'extended', guess: g2 });
