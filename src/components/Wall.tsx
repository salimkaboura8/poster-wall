import { useLayoutEffect, useRef } from 'react';
import type { WallMovie } from '../lib/storage';
import { Poster } from './Poster';

type Props = {
  movies: WallMovie[];
  seed: number;
  /** id → drop delay (ms) for posters that just arrived. */
  drops: Map<number, number>;
  onOpen: (m: WallMovie) => void;
  onAdd: () => void;
  onLetterboxd: () => void;
};

export function Wall({ movies, seed, drops, onOpen, onAdd, onLetterboxd }: Props) {
  const gridRef = useRef<HTMLUListElement>(null);
  const spots = useRef(new Map<number, { x: number; y: number }>());
  const orderKey = movies.map((m) => m.id).join(',');

  // FLIP: when the order changes (reshuffle, sort, a new pin), each poster glides from its
  // old spot to the new one instead of jumping. Layout offsets ignore transforms and scroll.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<number, { x: number; y: number }>();
    Array.from(grid.children as HTMLCollectionOf<HTMLElement>).forEach((li, i) => {
      const id = Number(li.dataset.id);
      const now = { x: li.offsetLeft, y: li.offsetTop };
      next.set(id, now);
      const before = spots.current.get(id);
      if (!before || still) return;
      const dx = before.x - now.x;
      const dy = before.y - now.y;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      li.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], {
        duration: 700,
        delay: Math.min(i, 30) * 12,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        fill: 'backwards',
      });
    });
    spots.current = next;
  }, [orderKey]);

  if (movies.length === 0) {
    return (
      <section className="wall wall--empty" aria-label="Your poster wall">
        <div className="ghosts" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>
          A bare wall, <em>for now.</em>
        </h2>
        <p>Search any film and pin its poster here. Start with the one you could watch forever.</p>
        <div className="empty-actions">
          <button type="button" className="btn btn--accent" onClick={onAdd}>
            Pin your first poster
          </button>
          <button type="button" className="btn btn--ghost" onClick={onLetterboxd}>
            Import from Letterboxd
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="wall" aria-label="Your poster wall">
      <ul className="wall__grid" ref={gridRef}>
        {movies.map((m, i) => (
          <Poster key={m.id} movie={m} index={i} seed={seed} dropDelay={drops.get(m.id)} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
