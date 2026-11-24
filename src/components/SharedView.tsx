import { useEffect, useMemo, useState } from 'react';
import { profileUrl } from '../lib/letterboxd';
import type { SharedWall } from '../lib/shareLink';
import type { WallMovie } from '../lib/storage';
import { getMovie } from '../lib/tmdb';
import { PosterDetail } from './PosterDetail';
import { Sheet } from './Sheet';
import { Wall } from './Wall';

type Props = {
  wall: SharedWall;
  onExit: () => void;
};

const NO_DROPS = new Map<number, number>();

/** Someone else's wall, opened from a share link. Read-only; films load from TMDB. */
export function SharedView({ wall, onExit }: Props) {
  const placeholders = useMemo<WallMovie[]>(
    () =>
      wall.films.map((f, i) => ({
        id: f.id,
        title: '',
        year: '',
        posterPath: null,
        overview: '',
        addedAt: wall.films.length - i,
        ...(f.rating ? { rating: f.rating } : {}),
      })),
    [wall],
  );
  const [loaded, setLoaded] = useState<Map<number, Partial<WallMovie>>>(new Map());
  const [selected, setSelected] = useState<WallMovie | null>(null);

  // fetch details 6 at a time, in wall order, flushing to state in small batches
  useEffect(() => {
    const ctl = new AbortController();
    let next = 0;
    let pending = new Map<number, Partial<WallMovie>>();
    const flush = () => {
      if (pending.size === 0) return;
      const batch = pending;
      pending = new Map();
      setLoaded((prev) => new Map([...prev, ...batch]));
    };
    const timer = window.setInterval(flush, 250);
    const worker = async () => {
      while (next < wall.films.length && !ctl.signal.aborted) {
        const { id } = wall.films[next++];
        try {
          const m = await getMovie(id, ctl.signal);
          pending.set(id, { title: m.title, year: m.year, posterPath: m.posterPath, overview: m.overview });
        } catch {
          /* missing film: it stays a blank card */
        }
      }
    };
    void Promise.all(Array.from({ length: 6 }, worker)).then(flush);
    return () => {
      ctl.abort();
      window.clearInterval(timer);
    };
  }, [wall]);

  const movies = useMemo(
    () => placeholders.map((p) => ({ ...p, ...loaded.get(p.id) }) as WallMovie),
    [placeholders, loaded],
  );
  const name = wall.name || 'Someone';
  const initial = name.trim()[0]?.toUpperCase() ?? '★';

  return (
    <>
      <div className="shared-banner" role="note">
        <span>
          You're looking at <b>{name}</b>'s poster wall.
        </span>
        <button type="button" className="btn btn--accent btn--small" onClick={onExit}>
          Make your own
        </button>
      </div>

      <main>
        <header className="profile">
          <div className="avatar" aria-hidden="true">
            <span className="avatar__initials">{initial}</span>
          </div>
          <div className="profile__text">
            <p className="eyebrow">the wall of</p>
            <h1 className="profile__name">{name}</h1>
            <div className="profile__meta">
              <p className="profile__count">
                <span className="count-num">{wall.films.length}</span>{' '}
                <em>{wall.films.length === 1 ? 'poster pinned' : 'posters pinned'}</em>
              </p>
              {wall.letterboxd && (
                <a className="lb-chip" href={profileUrl(wall.letterboxd)} target="_blank" rel="noreferrer">
                  <em>letterboxd</em> @{wall.letterboxd}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>
          </div>
        </header>
        <Wall
          movies={movies}
          seed={7}
          drops={NO_DROPS}
          onOpen={(m) => m.title && setSelected(m)}
          onAdd={onExit}
          onLetterboxd={onExit}
        />
      </main>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} label={selected?.title ?? 'Poster'}>
        {selected && <PosterDetail movie={selected} readOnly onClose={() => setSelected(null)} />}
      </Sheet>
    </>
  );
}
