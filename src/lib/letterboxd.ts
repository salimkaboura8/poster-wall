import { strFromU8, unzipSync } from 'fflate';
import { getMovie, normalize, searchMovies, TmdbError, type SearchResult } from './tmdb';

/**
 * Letterboxd has no public API. Two public, terms-friendly sources are used instead:
 *  - the member's RSS feed (recent diary entries, each carrying its TMDB id), read through
 *    a same-origin proxy because letterboxd.com sends no CORS headers;
 *  - the official data export (Settings → Import & Export), a ZIP of CSV files.
 */
const PROXY = (import.meta.env.VITE_LETTERBOXD_PROXY?.trim() || '/letterboxd').replace(/\/$/, '');

export type LbFilm = {
  title: string;
  year: string;
  /** Film page on Letterboxd, e.g. https://letterboxd.com/film/drive-2011/ */
  uri: string;
  /** Watched / logged date (YYYY-MM-DD) when known. */
  date: string;
  tmdbId?: number;
};

export type Matched = SearchResult & { letterboxdUri: string; watched: string };

export class LetterboxdError extends Error {
  constructor(public kind: 'not-found' | 'network' | 'empty' | 'bad-file') {
    super(kind);
  }
}

/** Accepts `name`, `@name` or any letterboxd.com/name/... URL. */
export function parseUsername(input: string): string | null {
  const s = input.trim().replace(/^@/, '');
  const fromUrl = s.match(/letterboxd\.com\/([A-Za-z0-9_]+)/i)?.[1];
  const name = fromUrl ?? s;
  return /^[A-Za-z0-9_]{2,15}$/.test(name) ? name : null;
}

export const profileUrl = (username: string) => `https://letterboxd.com/${username}/`;

const text = (el: Element, localName: string) =>
  el.getElementsByTagNameNS('*', localName)[0]?.textContent?.trim() ?? '';

/** Review/diary links → the film's own page. */
const filmPage = (link: string) => {
  const slug = link.match(/\/film\/([^/]+)\//)?.[1];
  return slug ? `https://letterboxd.com/film/${slug}/` : '';
};

/** Recent diary entries from the member's RSS feed (Letterboxd keeps the latest ~50–100). */
export async function fetchRecent(
  username: string,
  signal?: AbortSignal,
): Promise<{ displayName: string; films: LbFilm[] }> {
  let res: Response;
  try {
    res = await fetch(`${PROXY}/${encodeURIComponent(username)}/rss/`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new LetterboxdError('network');
  }
  if (res.status === 404) throw new LetterboxdError('not-found');
  if (!res.ok) throw new LetterboxdError('network');

  const xml = new DOMParser().parseFromString(await res.text(), 'application/xml');
  if (xml.querySelector('parsererror')) throw new LetterboxdError('network');

  const displayName = (xml.querySelector('channel > title')?.textContent ?? '').replace(/^Letterboxd\s*-\s*/, '').trim();
  const seen = new Set<number>();
  const films: LbFilm[] = [];
  for (const item of Array.from(xml.querySelectorAll('item'))) {
    const tmdbId = Number(text(item, 'movieId'));
    if (!tmdbId || seen.has(tmdbId)) continue; // lists and duplicates (rewatches)
    seen.add(tmdbId);
    films.push({
      tmdbId,
      title: text(item, 'filmTitle'),
      year: text(item, 'filmYear'),
      uri: filmPage(item.querySelector('link')?.textContent ?? ''),
      date: text(item, 'watchedDate'),
    });
  }
  if (films.length === 0) throw new LetterboxdError('empty');
  return { displayName, films };
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = input.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

function filmsFromCsv(csv: string): LbFilm[] {
  const [header, ...rows] = parseCsv(csv);
  if (!header) return [];
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const iName = col('name');
  const iYear = col('year');
  const iUri = col('letterboxd uri');
  const iDate = col('watched date') >= 0 ? col('watched date') : col('date');
  if (iName < 0) return [];
  return rows
    .map((r) => ({
      title: (r[iName] ?? '').trim(),
      year: (r[iYear] ?? '').trim().slice(0, 4),
      uri: (r[iUri] ?? '').trim(),
      date: (r[iDate] ?? '').trim(),
    }))
    .filter((f) => f.title);
}

// Which file of the export to read, best first. `watched.csv` is every film marked as seen.
const PREFERRED = ['watched.csv', 'diary.csv', 'ratings.csv', 'films.csv'];

/** Reads the Letterboxd export ZIP, or a single CSV from it. Newest first, de-duplicated. */
export async function readExport(file: File): Promise<LbFilm[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let csv = '';
  if (isZip) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes, { filter: (f) => PREFERRED.some((n) => f.name.toLowerCase().endsWith(n)) });
    } catch {
      throw new LetterboxdError('bad-file');
    }
    const names = Object.keys(entries);
    // top-level files only (skip lists/*.csv and deleted/*)
    const pick = PREFERRED.map((n) => names.find((k) => k.toLowerCase().split('/').pop() === n && !/(^|\/)(lists|deleted|orphaned)\//i.test(k))).find(Boolean);
    if (pick) csv = strFromU8(entries[pick]);
  } else {
    csv = strFromU8(bytes);
  }

  const films = filmsFromCsv(csv);
  if (films.length === 0) throw new LetterboxdError('bad-file');
  const seen = new Set<string>();
  return films
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((f) => {
      const key = f.uri || `${normalize(f.title)}|${f.year}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findOnTmdb(film: LbFilm, signal: AbortSignal): Promise<SearchResult | null> {
  if (film.tmdbId) return getMovie(film.tmdbId, signal);
  const want = normalize(film.title);
  const close = (r: SearchResult) => !film.year || !r.year || Math.abs(Number(r.year) - Number(film.year)) <= 1;
  const pick = (rs: SearchResult[]) =>
    rs.find((r) => normalize(r.title) === want && r.year === film.year) ??
    rs.find((r) => normalize(r.title) === want && close(r)) ??
    rs.find((r) => r.year === film.year) ??
    null;
  let found = pick(await searchMovies(film.title, signal, film.year || undefined));
  // release years differ between sites now and then: retry without the year, accept ±1
  if (!found && film.year) found = pick(await searchMovies(film.title, signal)) ?? null;
  return found;
}

/**
 * Matches Letterboxd films to TMDB with a small worker pool. Stops early (keeping what was
 * found) when `signal` aborts. Order follows the input.
 */
export async function matchFilms(
  films: LbFilm[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<{ matched: Matched[]; missed: LbFilm[] }> {
  const out: (Matched | null)[] = new Array(films.length).fill(null);
  const missed: LbFilm[] = [];
  let next = 0;
  let done = 0;

  const worker = async () => {
    while (next < films.length && !signal.aborted) {
      const i = next++;
      const film = films[i];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await findOnTmdb(film, signal);
          if (r) out[i] = { ...r, letterboxdUri: film.uri, watched: film.date };
          else missed.push(film);
          break;
        } catch (e) {
          if (signal.aborted) return;
          if (e instanceof TmdbError && e.status === 401) throw e;
          if (attempt === 2) missed.push(film);
          else await sleep(800 * (attempt + 1)); // 429 or a flaky network: back off and retry
        }
      }
      onProgress(++done, films.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(6, films.length) }, worker));
  return { matched: out.filter((m): m is Matched => m !== null), missed };
}
