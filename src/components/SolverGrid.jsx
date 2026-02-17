import Tile from './Tile.jsx';

const TILE_STATES = ['grey', 'yellow', 'green'];

// Timing constants (ms)
const TYPE_SPEED = 80;       // interval between each letter appearing
const TYPE_PHASE = 5 * TYPE_SPEED; // total typing time
const PAUSE = 300;           // pause between typing and flipping
const FLIP_OFFSET = TYPE_PHASE + PAUSE; // when flips start
const FLIP_STAGGER = 100;   // interval between each tile flip

// Exported so App can compute row cycle timing
export const ROW_DURATION = FLIP_OFFSET + 4 * FLIP_STAGGER + 500; // last flip start + flip anim

/**
 * Parse base-3 pattern int into array of 5 tile states.
 */
function patternToStates(pattern) {
  const states = new Array(5);
  for (let i = 4; i >= 0; i--) {
    states[i] = TILE_STATES[pattern % 3];
    pattern = (pattern / 3) | 0;
  }
  return states;
}

/**
 * 6×5 Wordle grid showing solver's guesses.
 * Each row: letters typed in one by one, then tiles flip to reveal colors.
 *
 * @param {Array<{guess: string, pattern: number}>} guesses
 * @param {number} revealedCount - How many rows are currently revealed
 */
export default function SolverGrid({ guesses, revealedCount }) {
  const rows = [];

  for (let r = 0; r < 6; r++) {
    const entry = guesses[r];
    const tiles = [];

    if (entry && r < revealedCount) {
      const states = patternToStates(entry.pattern);
      for (let c = 0; c < 5; c++) {
        tiles.push(
          <Tile
            key={c}
            letter={entry.guess[c]}
            state={states[c]}
            typeDelay={c * TYPE_SPEED}
            flipDelay={FLIP_OFFSET + c * FLIP_STAGGER}
          />
        );
      }
    } else {
      for (let c = 0; c < 5; c++) {
        tiles.push(<Tile key={c} />);
      }
    }

    rows.push(
      <div className="grid-row" key={r}>
        {tiles}
      </div>
    );
  }

  return <div className="solver-grid">{rows}</div>;
}
