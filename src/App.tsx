import { useCallback, useEffect, useRef, useState } from 'react';
import { AddMovie } from './components/AddMovie';
import { LetterboxdImport } from './components/LetterboxdImport';
import { PosterDetail } from './components/PosterDetail';
import { ProfileHeader } from './components/ProfileHeader';
import { Sheet } from './components/Sheet';
import { Wall } from './components/Wall';
import type { Matched } from './lib/letterboxd';
import { downloadJson, loadWall, parseWall, saveWall, type WallMovie, type WallState } from './lib/storage';
import type { SearchResult } from './lib/tmdb';

/** id → drop delay (ms) for posters that should fall onto the wall. */
type Drops = Map<number, number>;

export default function App() {
  const [wall, setWall] = useState<WallState>(loadWall);
  const [sheet, setSheet] = useState<'add' | 'letterboxd' | null>(null);
  const [selected, setSelected] = useState<WallMovie | null>(null);
  const [drops, setDrops] = useState<Drops>(new Map());
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number>(undefined);

  useEffect(() => saveWall(wall), [wall]);

  // "N" or "+" opens the search from anywhere (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === '+') {
        e.preventDefault();
        setSheet('add');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (text: string, ms = 2600) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = window.setTimeout(() => setNotice(''), ms);
  };

  const isPinned = useCallback((id: number) => wall.movies.some((m) => m.id === id), [wall.movies]);

  const pin = useCallback((r: SearchResult) => {
    setWall((w) =>
      w.movies.some((m) => m.id === r.id) ? w : { ...w, movies: [{ ...r, addedAt: Date.now() }, ...w.movies] },
    );
    setDrops(new Map([[r.id, 0]]));
    setSheet(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  /** Letterboxd import: newest first, then a cascade of drops over ~2 s whatever the count. */
  const pinMany = (films: Matched[], missed: number) => {
    const have = new Set(wall.movies.map((m) => m.id));
    const seen = new Set<number>();
    const fresh = films.filter((f) => !have.has(f.id) && !seen.has(f.id) && seen.add(f.id));
    const now = Date.now();
    const movies: WallMovie[] = fresh.map((f, i) => ({
      id: f.id,
      title: f.title,
      year: f.year,
      posterPath: f.posterPath,
      overview: f.overview.slice(0, 700),
      addedAt: Date.parse(f.watched) || now - i,
      ...(f.letterboxdUri ? { letterboxdUri: f.letterboxdUri } : {}),
    }));
    const step = Math.max(28, Math.min(110, 2200 / Math.max(movies.length, 1)));
    setDrops(new Map(movies.map((m, i) => [m.id, Math.min(i, 40) * step])));
    setWall((w) => ({ ...w, movies: [...movies, ...w.movies] }));
    setSheet(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const n = movies.length;
    flash(
      `Pinned ${n} film${n === 1 ? '' : 's'} from Letterboxd` + (missed ? ` · ${missed} not found on TMDB` : ''),
      4200,
    );
  };

  const unpin = (id: number) => {
    setWall((w) => ({ ...w, movies: w.movies.filter((m) => m.id !== id) }));
    setSelected(null);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseWall(JSON.parse(await file.text()));
      if (!parsed) throw new Error();
      setWall(parsed);
      flash(`Imported ${parsed.movies.length} posters`);
    } catch {
      flash('That file is not a Poster Wall export');
    }
  };

  return (
    <div className="app">
      <nav className="topbar" aria-label="Wall tools">
        <span className="brand">
          poster<span>wall</span>
        </span>
        <div className="tools">
          <button type="button" className="tool tool--lb" onClick={() => setSheet('letterboxd')}>
            Letterboxd
          </button>
          <button
            type="button"
            className="tool"
            disabled={wall.movies.length < 2}
            onClick={() => setWall((w) => ({ ...w, seed: Math.floor(Math.random() * 1e6) }))}
          >
            Reshuffle
          </button>
          <button type="button" className="tool" disabled={wall.movies.length === 0} onClick={() => downloadJson(wall)}>
            Export
          </button>
          <button type="button" className="tool" onClick={() => importRef.current?.click()}>
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </nav>

      <main>
        <ProfileHeader
          profile={wall.profile}
          count={wall.movies.length}
          onChange={(profile) => setWall((w) => ({ ...w, profile }))}
          onLinkLetterboxd={() => setSheet('letterboxd')}
        />
        <Wall
          movies={wall.movies}
          seed={wall.seed}
          drops={drops}
          onOpen={setSelected}
          onAdd={() => setSheet('add')}
          onLetterboxd={() => setSheet('letterboxd')}
        />
      </main>

      <footer className="credits">
        <p>
          Film data and posters from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB. Not affiliated with Letterboxd.
        </p>
      </footer>

      <button type="button" className="fab" onClick={() => setSheet('add')} aria-label="Pin a film (N)">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} label="Pin a film" className="sheet--search">
        <AddMovie onPick={pin} isPinned={isPinned} />
      </Sheet>

      <Sheet
        open={sheet === 'letterboxd'}
        onClose={() => setSheet(null)}
        label="Import from Letterboxd"
        className="sheet--search"
      >
        <LetterboxdImport
          username={wall.profile.letterboxd}
          isPinned={isPinned}
          onLink={(letterboxd, displayName) =>
            setWall((w) => ({
              ...w,
              profile: { ...w.profile, letterboxd, name: w.profile.name || displayName.slice(0, 40) },
            }))
          }
          onImport={pinMany}
        />
      </Sheet>

      <Sheet open={selected !== null} onClose={() => setSelected(null)} label={selected?.title ?? 'Poster'}>
        {selected && <PosterDetail movie={selected} onRemove={unpin} onClose={() => setSelected(null)} />}
      </Sheet>

      <div className={`toast${notice ? ' toast--on' : ''}`} role="status">
        {notice}
      </div>
    </div>
  );
}
