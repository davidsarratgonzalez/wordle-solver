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
 *
 * @param {Array<{guess: string, pattern: number}>} guesses
 * @param {number} revealedCount - How many rows are currently revealed
 * @param {string[][]|null} neonColors - Per-cell neon color hex strings [row][col] (easter egg)
 * @param {boolean} trumpets - Show trumpet row at first empty slot
 */
export default function SolverGrid({ guesses, revealedCount, neonColors, trumpets }) {
  const rows = [];
  let trumpetRendered = false;

  for (let r = 0; r < 6; r++) {
    const entry = guesses[r];
    const tiles = [];
    let rowKey;

    if (entry && r < revealedCount) {
      const rowColors = neonColors?.[r] || null;
      const states = patternToStates(entry.pattern);
      let letterIdx = 0;
      for (let c = 0; c < 5; c++) {
        const isSpace = rowColors && entry.guess[c] === ' ';
        tiles.push(
          <Tile
            key={c}
            letter={isSpace ? '' : entry.guess[c]}
            state={isSpace ? 'empty' : states[c]}
            neonColor={isSpace ? null : (rowColors?.[c] || null)}
            typeDelay={rowColors ? (isSpace ? 0 : letterIdx * TYPE_SPEED) : c * TYPE_SPEED}
            flipDelay={rowColors ? 0 : FLIP_OFFSET + c * FLIP_STAGGER}
          />
        );
        if (!isSpace) letterIdx++;
      }
      rowKey = (neonColors && entry) ? `n-${entry.guess}` : r;
    } else if (trumpets && !trumpetRendered) {
      trumpetRendered = true;
      let ti = 0;
      for (let c = 0; c < 5; c++) {
        if (c % 2 === 0) {
          const state = trumpets[ti];
          tiles.push(
            <div className="tile" key={c}>
              <div className="tile-inner trumpet-cell">
                {state !== 'hidden' && (
                  <span
                    className={`trumpet-emoji${state === 'playing' ? ' playing' : ''}`}
                    style={{ '--intensity': ti + 1 }}
                  >🎺</span>
                )}
              </div>
            </div>
          );
          ti++;
        } else {
          tiles.push(<Tile key={c} />);
        }
      }
      rowKey = 'trumpets';
    } else {
      for (let c = 0; c < 5; c++) {
        tiles.push(<Tile key={c} />);
      }
      rowKey = r;
    }

    rows.push(
      <div className="grid-row" key={rowKey}>
        {tiles}
      </div>
    );
  }

  return <div className="solver-grid">{rows}</div>;
}
