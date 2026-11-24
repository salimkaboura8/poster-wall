import { useEffect, useState } from 'react';
import { hasTmdbKey, posterUrl, searchMovies, TmdbError, type SearchResult } from '../lib/tmdb';

type Props = {
  onPick: (m: SearchResult) => void;
  isPinned: (id: number) => boolean;
};

type Status = 'idle' | 'loading' | 'done' | 'error' | 'unauthorized';

export function AddMovie({ onPick, isPinned }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    const q = query.trim();
    if (!q || !hasTmdbKey) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      setStatus('loading');
      searchMovies(q, ctl.signal)
        .then((r) => {
          setResults(r);
          setStatus('done');
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setStatus(e instanceof TmdbError && e.status === 401 ? 'unauthorized' : 'error');
        });
    }, 260);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  if (!hasTmdbKey) {
    return (
      <div className="add">
        <h2 className="add__heading">
          One small thing <em>first.</em>
        </h2>
        <div className="setup">
          <p>Poster Wall reads films and posters from TMDB, which needs a free API key.</p>
          <ol>
            <li>
              Create a key at{' '}
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
                themoviedb.org/settings/api
              </a>
            </li>
            <li>
              Copy <code>.env.example</code> to <code>.env</code> and paste the <b>API Read Access Token</b>
            </li>
            <li>
              Restart <code>npm run dev</code>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="add">
      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const first = results.find((r) => !isPinned(r.id));
          if (first) onPick(first);
        }}
      >
        <svg className="search__icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a film… Paris, Texas"
          aria-label="Search a film by title"
          enterKeyHint="go"
          autoComplete="off"
        />
        {status === 'loading' && <span className="spinner" aria-label="Searching" />}
      </form>

      <div className="results" aria-live="polite">
        {status === 'idle' && <p className="hint">Type a title. Enter pins the first match.</p>}
        {status === 'unauthorized' && (
          <p className="hint hint--warn">TMDB refused the key in .env. Check it and restart the dev server.</p>
        )}
        {status === 'error' && <p className="hint hint--warn">Couldn't reach TMDB. Check your connection.</p>}
        {status === 'done' && results.length === 0 && <p className="hint">Nothing by that name. Try the original title?</p>}
        {results.length > 0 && (
          <ul className="results__list">
            {results.map((r) => {
              const pinned = isPinned(r.id);
              return (
                <li key={r.id}>
                  <button type="button" className="result" onClick={() => onPick(r)} disabled={pinned}>
                    <span className="result__thumb">
                      {r.posterPath ? <img src={posterUrl(r.posterPath, 'w92')} alt="" loading="lazy" /> : <span />}
                    </span>
                    <span className="result__text">
                      <span className="result__title">{r.title}</span>
                      <span className="result__meta">
                        {r.year || 'Year unknown'}
                        {!r.posterPath && ' · no poster'}
                      </span>
                    </span>
                    <span className="result__action">{pinned ? 'On your wall' : 'Pin'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
