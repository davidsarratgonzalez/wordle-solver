import { useState, useEffect } from 'react';

const TYPE_SPEED = 80;

/**
 * Tile with typing (pop-in) animation.
 *
 * - Letters appear one-by-one based on column index.
 * - Tile becomes clickable only after its letter has appeared.
 */
export default function TypingTile({ letter, col, colorClass = '', clickable = false, animate = false, onClick }) {
  const [shown, setShown] = useState(!animate);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!animate) {
      setShown(true);
      return;
    }
    setShown(false);
    setPop(false);
    const t1 = setTimeout(() => {
      setShown(true);
      setPop(true);
    }, col * TYPE_SPEED);
    const t2 = setTimeout(() => setPop(false), col * TYPE_SPEED + 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [letter, col, animate]);

  const isClickable = clickable && shown;

  const classes = [
    'tile-inner',
    shown ? (colorClass || 'tbd') : '',
    pop ? 'pop' : '',
    isClickable ? 'clickable' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="tile" onClick={isClickable ? onClick : undefined}>
      <div className={classes}>
        {shown ? letter.toUpperCase() : ''}
      </div>
    </div>
  );
}
