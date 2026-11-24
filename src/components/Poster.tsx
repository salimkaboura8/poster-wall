import { memo, useMemo, useState, type CSSProperties } from 'react';
import type { WallMovie } from '../lib/storage';
import { posterUrl } from '../lib/tmdb';
import { hash, rng, spread } from '../lib/random';
import { ratingScale, stars, UNRATED_SCALE } from '../lib/rating';

type Props = {
  movie: WallMovie;
  index: number;
  seed: number;
  /** Set when the poster just arrived: it falls onto the wall after this many ms. */
  dropDelay?: number;
  onOpen: (m: WallMovie) => void;
};

const PAPERS = ['#e9d9b8', '#d8c7a5', '#c9d3c2', '#e6c9b7', '#cfc6d8'];

/** One poster with its own seeded tilt, offset, size and fastener. */
export const Poster = memo(function Poster({ movie, index, seed, dropDelay, onOpen }: Props) {
  const [broken, setBroken] = useState(false);

  const look = useMemo(() => {
    const r = rng(hash(`${movie.id}:${seed}`));
    return {
      rot: spread(r) * 6,
      x: spread(r) * 14,
      y: spread(r) * 20,
      // size comes only from your rating (and so does who wins an overlap)
      scale: movie.rating ? ratingScale(movie.rating) : UNRATED_SCALE,
      z: movie.rating ? Math.round(movie.rating * 2) : 0,
      fastener: r() < 0.55 ? 'tape' : 'pin',
      tapeRot: spread(r) * 14,
      tapeX: 50 + spread(r) * 18,
      paper: PAPERS[Math.floor(r() * PAPERS.length)],
      fall: spread(r) * 28,
    };
  }, [movie.id, movie.rating, seed]);

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
    '--drop-delay': `${dropDelay ?? 0}ms`,
  } as CSSProperties;
  const isNew = dropDelay !== undefined;

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
          <span className="poster__year">
            {movie.rating ? <span className="poster__stars">{stars(movie.rating)}</span> : movie.year}
          </span>
        </span>
        <span className="sr-only">
          {movie.title}
          {movie.year ? ` (${movie.year})` : ''}
          {movie.rating ? `, rated ${movie.rating} out of 5` : ''}
        </span>
      </button>
      {movie.rating ? (
        <span className="poster__stub" aria-hidden="true">
          {stars(movie.rating)}
        </span>
      ) : null}
      <span className={`fastener fastener--${look.fastener}`} aria-hidden="true" />
    </li>
  );
});
