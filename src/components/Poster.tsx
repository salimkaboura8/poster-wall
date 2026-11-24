import { memo, useMemo, useState, type CSSProperties } from 'react';
import type { WallMovie } from '../lib/storage';
import { posterUrl } from '../lib/tmdb';
import { hash, rng, spread } from '../lib/random';

type Props = {
  movie: WallMovie;
  index: number;
  seed: number;
  isNew: boolean;
  onOpen: (m: WallMovie) => void;
};

const SIZES = [0.82, 1, 1, 1.12, 1.26];
const PAPERS = ['#e9d9b8', '#d8c7a5', '#c9d3c2', '#e6c9b7', '#cfc6d8'];

/** One poster with its own seeded tilt, offset, size and fastener. */
export const Poster = memo(function Poster({ movie, index, seed, isNew, onOpen }: Props) {
  const [broken, setBroken] = useState(false);

  const look = useMemo(() => {
    const r = rng(hash(`${movie.id}:${seed}`));
    return {
      rot: spread(r) * 6,
      x: spread(r) * 14,
      y: spread(r) * 34,
      scale: SIZES[Math.floor(r() * SIZES.length)],
      z: Math.floor(r() * 8),
      fastener: r() < 0.55 ? 'tape' : 'pin',
      tapeRot: spread(r) * 14,
      tapeX: 50 + spread(r) * 18,
      paper: PAPERS[Math.floor(r() * PAPERS.length)],
      fall: spread(r) * 28,
    };
  }, [movie.id, seed]);

  const style = {
    '--r': `${look.rot.toFixed(2)}deg`,
    '--x': `${look.x.toFixed(1)}px`,
    '--y': `${look.y.toFixed(1)}px`,
    '--s': look.scale,
    '--z': look.z,
    '--fall': `${look.fall.toFixed(1)}deg`,
    '--tape-r': `${look.tapeRot.toFixed(1)}deg`,
    '--tape-x': `${look.tapeX.toFixed(0)}%`,
    '--paper': look.paper,
    '--delay': `${Math.min(index, 24) * 45}ms`,
  } as CSSProperties;

  const src = movie.posterPath && !broken ? posterUrl(movie.posterPath, look.scale > 1.1 ? 'w500' : 'w342') : null;

  return (
    <li className={`poster${isNew ? ' poster--new' : ''}`} style={style}>
      <button type="button" className="poster__card" onClick={() => onOpen(movie)}>
        {src ? (
          <img
            src={src}
            alt=""
            loading={index > 12 ? 'lazy' : 'eager'}
            decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="poster__blank" aria-hidden="true">
            <span>{movie.title}</span>
            {movie.year && <small>{movie.year}</small>}
          </span>
        )}
        <span className="poster__caption" aria-hidden="true">
          <span className="poster__title">{movie.title}</span>
          {movie.year && <span className="poster__year">{movie.year}</span>}
        </span>
        <span className="sr-only">
          {movie.title}
          {movie.year ? ` (${movie.year})` : ''}
        </span>
      </button>
      <span className={`fastener fastener--${look.fastener}`} aria-hidden="true" />
    </li>
  );
});
