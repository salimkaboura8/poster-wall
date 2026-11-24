import type { WallMovie } from '../lib/storage';
import { Poster } from './Poster';

type Props = {
  movies: WallMovie[];
  seed: number;
  newId: number | null;
  onOpen: (m: WallMovie) => void;
  onAdd: () => void;
};

export function Wall({ movies, seed, newId, onOpen, onAdd }: Props) {
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
        <button type="button" className="btn btn--accent" onClick={onAdd}>
          Pin your first poster
        </button>
      </section>
    );
  }

  return (
    <section className="wall" aria-label="Your poster wall">
      <ul className="wall__grid">
        {movies.map((m, i) => (
          <Poster key={m.id} movie={m} index={i} seed={seed} isNew={m.id === newId} onOpen={onOpen} />
        ))}
      </ul>
    </section>
  );
}
