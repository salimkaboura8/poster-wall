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
      <ul className="wall__grid">
        {movies.map((m, i) => (
          <Poster key={m.id} movie={m} index={i} seed={seed} dropDelay={drops.get(m.id)} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
