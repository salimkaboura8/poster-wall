import { useCallback, useEffect, useRef, useState } from 'react';
import { AddMovie } from './components/AddMovie';
import { PosterDetail } from './components/PosterDetail';
import { ProfileHeader } from './components/ProfileHeader';
import { Sheet } from './components/Sheet';
import { Wall } from './components/Wall';
import { downloadJson, loadWall, parseWall, saveWall, type WallMovie, type WallState } from './lib/storage';
import type { SearchResult } from './lib/tmdb';

export default function App() {
  const [wall, setWall] = useState<WallState>(loadWall);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<WallMovie | null>(null);
  const [newId, setNewId] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => saveWall(wall), [wall]);

  // "N" or "+" opens the search from anywhere (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, dialog') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'n' || e.key === '+') {
        e.preventDefault();
        setAdding(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const pin = useCallback((r: SearchResult) => {
    setWall((w) =>
      w.movies.some((m) => m.id === r.id) ? w : { ...w, movies: [{ ...r, addedAt: Date.now() }, ...w.movies] },
    );
    setNewId(r.id);
    setAdding(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        />
        <Wall movies={wall.movies} seed={wall.seed} newId={newId} onOpen={setSelected} onAdd={() => setAdding(true)} />
      </main>

      <footer className="credits">
        <p>
          Film data and posters from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>

      <button type="button" className="fab" onClick={() => setAdding(true)} aria-label="Pin a film (N)">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <Sheet open={adding} onClose={() => setAdding(false)} label="Pin a film" className="sheet--search">
        <AddMovie onPick={pin} isPinned={(id) => wall.movies.some((m) => m.id === id)} />
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
