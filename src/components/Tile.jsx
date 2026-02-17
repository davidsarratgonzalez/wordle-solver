import { useState, useEffect } from 'react';

/**
 * Single Wordle tile with typing + flip animation.
 *
 * Phase 1 (typing):  letter appears with a pop at `typeDelay`
 * Phase 2 (reveal):  tile flips to show color at `flipDelay`
 *
 * @param {string}  letter    - The letter to display (or '' for empty)
 * @param {'empty'|'tbd'|'green'|'yellow'|'grey'} state
 * @param {number}  typeDelay - ms before letter appears (typing effect)
 * @param {number}  flipDelay - ms before flip animation starts
 */
export default function Tile({ letter = '', state = 'empty', typeDelay = 0, flipDelay = 0 }) {
  const [showLetter, setShowLetter] = useState(false);
  const [pop, setPop] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [colorClass, setColorClass] = useState('');

  useEffect(() => {
    if (state === 'empty') {
      setShowLetter(false);
      setPop(false);
      setFlipped(false);
      setColorClass('');
      return;
    }

    if (state === 'tbd') {
      setShowLetter(true);
      setColorClass('tbd');
      return;
    }

    const timers = [];

    // Phase 1: letter appears with pop
    timers.push(setTimeout(() => {
      setShowLetter(true);
      setColorClass('tbd');
      setPop(true);
    }, typeDelay));

    // Remove pop class after animation
    timers.push(setTimeout(() => setPop(false), typeDelay + 150));

    // Phase 2: flip
    timers.push(setTimeout(() => setFlipped(true), flipDelay));

    // Color at flip midpoint
    timers.push(setTimeout(() => setColorClass(state), flipDelay + 250));

    return () => timers.forEach(clearTimeout);
  }, [state, typeDelay, flipDelay]);

  const innerClass = [
    'tile-inner',
    colorClass,
    pop ? 'pop' : '',
    flipped ? 'flip' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="tile">
      <div className={innerClass}>
        {showLetter ? letter.toUpperCase() : ''}
      </div>
    </div>
  );
}
