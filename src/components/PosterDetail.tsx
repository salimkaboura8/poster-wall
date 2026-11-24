import type { WallMovie } from '../lib/storage';
import { posterUrl, tmdbMovieUrl } from '../lib/tmdb';
import { stars } from '../lib/rating';
import { StarRating } from './StarRating';

type Props = {
  movie: WallMovie;
  onClose: () => void;
} & (
  | { readOnly?: false; onRemove: (id: number) => void; onRate: (id: number, rating: number | undefined) => void }
  | { readOnly: true; onRemove?: never; onRate?: never }
);

const pinnedOn = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

export function PosterDetail(props: Props) {
  const { movie, onClose } = props;
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
        {!props.readOnly && <p className="eyebrow">pinned {pinnedOn(movie.addedAt)}</p>}
        <h2>
          {movie.title} {movie.year && <em>{movie.year}</em>}
        </h2>
        {props.readOnly ? (
          movie.rating ? (
            <p className="rating rating--static" aria-label={`Rated ${movie.rating} out of 5`}>
              {stars(movie.rating)}
            </p>
          ) : null
        ) : (
          <StarRating value={movie.rating} onChange={(r) => props.onRate(movie.id, r)} />
        )}
        {movie.overview && <p className="detail__overview">{movie.overview}</p>}
        <div className="detail__actions">
          {movie.letterboxdUri && (
            <a className="btn btn--ghost" href={movie.letterboxdUri} target="_blank" rel="noreferrer">
              Letterboxd
            </a>
          )}
          <a className="btn btn--ghost" href={tmdbMovieUrl(movie.id)} target="_blank" rel="noreferrer">
            TMDB
          </a>
          {!props.readOnly && (
            <button type="button" className="btn btn--danger" onClick={() => props.onRemove(movie.id)}>
              Unpin
            </button>
          )}
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
