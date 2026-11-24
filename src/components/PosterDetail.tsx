import type { WallMovie } from '../lib/storage';
import { posterUrl, tmdbMovieUrl } from '../lib/tmdb';

type Props = {
  movie: WallMovie;
  onRemove: (id: number) => void;
  onClose: () => void;
};

const pinnedOn = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function PosterDetail({ movie, onRemove, onClose }: Props) {
  return (
    <article className="detail">
      <div className="detail__poster">
        {movie.posterPath ? (
          <img src={posterUrl(movie.posterPath, 'w500')} alt={`Poster of ${movie.title}`} />
        ) : (
          <span className="poster__blank">
            <span>{movie.title}</span>
          </span>
        )}
      </div>
      <div className="detail__text">
        <p className="eyebrow">pinned {pinnedOn(movie.addedAt)}</p>
        <h2>
          {movie.title} {movie.year && <em>{movie.year}</em>}
        </h2>
        {movie.overview && <p className="detail__overview">{movie.overview}</p>}
        <div className="detail__actions">
          <a className="btn btn--ghost" href={tmdbMovieUrl(movie.id)} target="_blank" rel="noreferrer">
            View on TMDB
          </a>
          <button type="button" className="btn btn--danger" onClick={() => onRemove(movie.id)}>
            Unpin
          </button>
        </div>
      </div>
      <button type="button" className="close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </article>
  );
}
