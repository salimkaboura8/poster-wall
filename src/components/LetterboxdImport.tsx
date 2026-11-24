import { useEffect, useRef, useState } from 'react';
import {
  fetchRecent,
  LetterboxdError,
  matchFilms,
  parseUsername,
  profileUrl,
  readExport,
  type ImportSource,
  type LbFilm,
  type LbUpdate,
  type Matched,
} from '../lib/letterboxd';
import { hasTmdbKey, TmdbError } from '../lib/tmdb';

type Props = {
  username: string | null;
  isPinned: (tmdbId: number) => boolean;
  onLink: (username: string, displayName: string) => void;
  onImport: (films: Matched[], updates: LbUpdate[], missed: number, source: ImportSource) => void;
};

type Phase =
  | { kind: 'form'; error?: string }
  | { kind: 'reading'; label: string }
  | { kind: 'matching'; label: string; done: number; total: number };

const ERRORS: Record<LetterboxdError['kind'], string> = {
  'not-found': 'No Letterboxd member by that name.',
  empty: 'No films in their recent diary yet. Try the full export below.',
  network: "Couldn't reach Letterboxd right now. Try again, or use the export file below.",
  'bad-file': "That doesn't look like a Letterboxd export. Use the .zip, or watched.csv from it.",
};

export function LetterboxdImport({ username, isPinned, onLink, onImport }: Props) {
  const [value, setValue] = useState(username ?? '');
  const [phase, setPhase] = useState<Phase>({ kind: 'form' });
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const fail = (e: unknown) => {
    if (abortRef.current?.signal.aborted) return;
    const error =
      e instanceof LetterboxdError
        ? ERRORS[e.kind]
        : e instanceof TmdbError && e.status === 401
          ? 'TMDB refused the key in .env.'
          : 'Something went wrong. Try again.';
    setPhase({ kind: 'form', error });
  };

  async function run(label: string, source: ImportSource, load: (signal: AbortSignal) => Promise<LbFilm[]>) {
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      setPhase({ kind: 'reading', label });
      const all = await load(ctl.signal);
      // films already on the wall need no TMDB lookup when Letterboxd gave us the id:
      // they only refresh their rating and Letterboxd link
      const known = (f: LbFilm) => Boolean(f.tmdbId && isPinned(f.tmdbId));
      const updates: LbUpdate[] = all
        .filter(known)
        .map((f) => ({ id: f.tmdbId!, rating: f.rating, letterboxdUri: f.uri || undefined }));
      const films = all.filter((f) => !known(f));
      if (films.length === 0) {
        onImport([], updates, 0, source);
        return;
      }
      setPhase({ kind: 'matching', label, done: 0, total: films.length });
      const { matched, missed } = await matchFilms(
        films,
        (done, total) => setPhase({ kind: 'matching', label, done, total }),
        ctl.signal,
      );
      for (const m of matched.filter((m) => isPinned(m.id))) {
        updates.push({ id: m.id, rating: m.rating, letterboxdUri: m.letterboxdUri || undefined });
      }
      onImport(
        matched.filter((m) => !isPinned(m.id)),
        updates,
        missed.length,
        source,
      );
    } catch (e) {
      fail(e);
    }
  }

  function pullRecent() {
    const name = parseUsername(value);
    if (!name) {
      setPhase({ kind: 'form', error: 'Enter a Letterboxd username or profile link.' });
      return;
    }
    void run(`Reading @${name}'s diary`, 'feed', async (signal) => {
      const { displayName, films } = await fetchRecent(name, signal);
      onLink(name, displayName);
      return films;
    });
  }

  function importFile(file: File | undefined) {
    if (!file) return;
    void run(`Reading ${file.name}`, 'export', () => readExport(file));
  }

  if (!hasTmdbKey) {
    return (
      <div className="lb">
        <p className="hint hint--warn">Add your TMDB key first: films are matched to TMDB posters.</p>
      </div>
    );
  }

  if (phase.kind !== 'form') {
    const pct = phase.kind === 'matching' ? Math.round((phase.done / Math.max(phase.total, 1)) * 100) : 0;
    return (
      <div className="lb lb--busy" aria-live="polite">
        <p className="eyebrow">{phase.label}</p>
        {phase.kind === 'matching' ? (
          <>
            <h2 className="lb__count">
              <span>{phase.done}</span> <em>of {phase.total} films matched</em>
            </h2>
            <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <button type="button" className="btn btn--ghost" onClick={() => abortRef.current?.abort()}>
              Stop and pin what's found
            </button>
          </>
        ) : (
          <h2 className="lb__count">
            <em>one moment…</em>
          </h2>
        )}
      </div>
    );
  }

  return (
    <div className="lb">
      <h2 className="add__heading">
        Bring your <em>Letterboxd.</em>
      </h2>

      <section className="lb__card">
        <h3>Recent films</h3>
        <p>
          Links your profile and pins your <b>latest diary entries</b> with your ratings. Letterboxd only shares
          the most recent ~50 this way.
        </p>
        <form
          className="search lb__user"
          onSubmit={(e) => {
            e.preventDefault();
            pullRecent();
          }}
        >
          <span className="lb__at" aria-hidden="true">
            letterboxd.com/
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="username"
            aria-label="Letterboxd username or profile link"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" className="btn btn--accent btn--small">
            Pull films
          </button>
        </form>
        {username && (
          <p className="lb__linked">
            Linked to{' '}
            <a href={profileUrl(username)} target="_blank" rel="noreferrer">
              @{username}
            </a>
          </p>
        )}
      </section>

      <section
        className={`lb__card lb__drop${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          importFile(e.dataTransfer.files[0]);
        }}
      >
        <h3>
          Every film you've seen <span className="tag">full history</span>
        </h3>
        <ol>
          <li>
            On Letterboxd, open{' '}
            <a href="https://letterboxd.com/settings/data/" target="_blank" rel="noreferrer">
              Settings → Data
            </a>{' '}
            and click <b>Export your data</b>. It downloads in seconds.
          </li>
          <li>
            Drop the <code>.zip</code> here. Every watched film gets pinned, sized by your ratings.
          </li>
        </ol>
        <button type="button" className="btn btn--ghost" onClick={() => fileRef.current?.click()}>
          Choose export file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.csv,application/zip,text/csv"
          hidden
          onChange={(e) => {
            importFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </section>

      {phase.error && <p className="hint hint--warn lb__error">{phase.error}</p>}
    </div>
  );
}
