import { useState, useEffect } from 'react';

/**
 * Single Wordle tile with flip animation.
 * Letter is hidden until the flip starts — no pre-reveal.
 *
 * @param {string} letter - The letter to display (or '' for empty)
 * @param {'empty'|'tbd'|'green'|'yellow'|'grey'} state - Tile color state
 * @param {number} delay - Delay in ms before flip animation starts
 */
export default function Tile({ letter = '', state = 'empty', delay = 0 }) {
  const [flipped, setFlipped] = useState(false);
  const [colorClass, setColorClass] = useState('');
  const [showLetter, setShowLetter] = useState(false);

  useEffect(() => {
    if (state === 'empty' || state === 'tbd') {
      setFlipped(false);
      setColorClass(state === 'tbd' ? 'tbd' : '');
      setShowLetter(state === 'tbd');
      return;
    }

    // Show letter + start flip at the same time
    const flipTimer = setTimeout(() => {
      setShowLetter(true);
      setFlipped(true);
    }, delay);

    // Apply color at midpoint of flip (250ms into the 500ms animation)
    const colorTimer = setTimeout(() => {
      setColorClass(state);
    }, delay + 250);

    return () => {
      clearTimeout(flipTimer);
      clearTimeout(colorTimer);
    };
  }, [state, delay]);

  const innerClass = ['tile-inner', colorClass, flipped ? 'flip' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="tile">
      <div className={innerClass}>
        {showLetter ? letter.toUpperCase() : ''}
      </div>
    </div>
  );
}
