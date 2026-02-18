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
export default function Tile({ letter = '', state = 'empty', typeDelay = 0, flipDelay = 0, neonColor = null, neonGlow = 1 }) {
  const [showLetter, setShowLetter] = useState(false);
  const [pop, setPop] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [colorClass, setColorClass] = useState('');
  const [glowing, setGlowing] = useState(false);

  useEffect(() => {
    if (!neonColor && state === 'empty') {
      setShowLetter(false);
      setPop(false);
      setFlipped(false);
      setColorClass('');
      setGlowing(false);
      return;
    }

    if (!neonColor && state === 'tbd') {
      setShowLetter(true);
      setColorClass('tbd');
      return;
    }

    const timers = [];

    if (neonColor) {
      // Neon mode: typing animation only, no flip
      setGlowing(false);
      timers.push(setTimeout(() => {
        setShowLetter(true);
        setColorClass('neon');
        setPop(true);
      }, typeDelay));
      timers.push(setTimeout(() => setPop(false), typeDelay + 150));
      if (neonGlow > 1) {
        timers.push(setTimeout(() => setGlowing(true), typeDelay + 150));
      }
      return () => timers.forEach(clearTimeout);
    }

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
  }, [state, typeDelay, flipDelay, neonColor]);

  const innerClass = [
    'tile-inner',
    colorClass,
    pop ? 'pop' : '',
    flipped ? 'flip' : '',
    glowing ? 'glow-pulse' : '',
  ].filter(Boolean).join(' ');

  const neonStyle = (colorClass === 'neon' && neonColor) ? {
    color: neonColor,
    '--neon-color': neonColor,
    textShadow: `0 0 6px ${neonColor}`,
    borderColor: '#3a3a3c',
  } : undefined;

  return (
    <div className="tile">
      <div className={innerClass} style={neonStyle}>
        {showLetter ? letter.toUpperCase() : ''}
      </div>
    </div>
  );
}
