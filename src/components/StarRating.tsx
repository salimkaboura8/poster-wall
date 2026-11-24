import { useRef, useState } from 'react';

type Props = {
  value: number | undefined;
  onChange: (rating: number | undefined) => void;
};

const STARS = '★★★★★';

/** Half-star rating as a single slider: pointer anywhere on the stars, or arrow keys. */
export function StarRating({ value, onChange }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const fromPointer = (e: { clientX: number }) => {
    const box = ref.current!.getBoundingClientRect();
    const v = Math.ceil(((e.clientX - box.left) / box.width) * 10) / 2;
    return Math.min(5, Math.max(0.5, v));
  };

  const shown = hover ?? value ?? 0;
  const step = (delta: number) => {
    const next = Math.min(5, Math.max(0, (value ?? 0) + delta));
    onChange(next === 0 ? undefined : next);
  };

  return (
    <div className="rating">
      <div
        ref={ref}
        className={`stars${hover !== null ? ' is-previewing' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Your rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${value} out of 5 stars` : 'Not rated'}
        onPointerMove={(e) => setHover(fromPointer(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onChange(fromPointer(e))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(0.5);
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-0.5);
          else if (e.key === 'Delete' || e.key === 'Backspace') onChange(undefined);
          else return;
          e.preventDefault();
        }}
      >
        <span className="stars__base" aria-hidden="true">
          {STARS}
        </span>
        <span className="stars__fill" style={{ width: `${(shown / 5) * 100}%` }} aria-hidden="true">
          {STARS}
        </span>
      </div>
      {value ? (
        <button type="button" className="rating__clear" onClick={() => onChange(undefined)}>
          clear
        </button>
      ) : (
        <span className="rating__hint">rate it, it grows on the wall</span>
      )}
    </div>
  );
}
