import { useRef, useEffect } from 'react';

/**
 * Shared word-input component: hidden <input> + 5 display <div> cells.
 * Captures all keyboard input through a single off-screen input element,
 * eliminating mobile fast-typing issues caused by focus-switching between cells.
 */
export default function HiddenWordInput({
  letters,
  setLetters,
  isFull,
  isValid,
  onSubmit,
  disabled = false,
  focusTrigger = 0,
}) {
  const hiddenRef = useRef(null);
  const initialRender = useRef(true);

  const emptyIdx = letters.indexOf('');
  const active = emptyIdx === -1 ? 4 : emptyIdx;

  // Auto-focus on mount for desktop only
  useEffect(() => {
    if ('ontouchstart' in window) return;
    if (!disabled) hiddenRef.current?.focus();
  }, []);

  // Focus when focusTrigger changes (skips mount)
  useEffect(() => {
    if (initialRender.current) { initialRender.current = false; return; }
    if (!disabled) hiddenRef.current?.focus();
  }, [focusTrigger]);

  // Keep cursor at end of input (mobile resets cursor to 0 on controlled value updates)
  useEffect(() => {
    const el = hiddenRef.current;
    if (!el || document.activeElement !== el) return;
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [letters]);

  function handleRowClick() {
    if (!disabled) hiddenRef.current?.focus();
  }

  function handleChange(e) {
    const raw = e.target.value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
    const next = ['', '', '', '', ''];
    for (let i = 0; i < raw.length; i++) {
      next[i] = raw[i];
    }
    setLetters(next);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isFull && isValid && !disabled) onSubmit();
    }
  }

  function handleBlur() {
    if ('ontouchstart' in window) return;
    if (!disabled) setTimeout(() => hiddenRef.current?.focus(), 0);
  }

  function cellClass(i) {
    const base = 'letter-cell';
    if (!isFull) return `${base}${i === active ? ' active' : ''}`;
    return `${base} ${isValid ? 'valid' : 'invalid'}`;
  }

  return (
    <div className="word-input-container">
      <div className="input-row" onClick={handleRowClick}>
        {letters.map((letter, i) => (
          <div key={i} className={cellClass(i)}>
            {letter.toUpperCase()}
          </div>
        ))}
      </div>

      <input
        ref={hiddenRef}
        className="hidden-input"
        type="text"
        inputMode="text"
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={5}
        value={letters.join('')}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled}
      />

      <div className="validation-msg">
        {isFull && !isValid && 'Not a valid Wordle word'}
      </div>
    </div>
  );
}
