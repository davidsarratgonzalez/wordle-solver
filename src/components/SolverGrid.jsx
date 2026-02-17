import Tile from './Tile.jsx';

const TILE_STATES = ['grey', 'yellow', 'green'];

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
 * Rows go directly from empty to revealed (flip animation).
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
      // Revealed row — tiles flip to show letter + color
      const states = patternToStates(entry.pattern);
      for (let c = 0; c < 5; c++) {
        tiles.push(
          <Tile
            key={c}
            letter={entry.guess[c]}
            state={states[c]}
            delay={c * 100}
          />
        );
      }
    } else {
      // Empty row
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
