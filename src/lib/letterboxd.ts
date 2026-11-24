import { strFromU8, unzipSync } from 'fflate';
import { getMovie, normalize, searchMovies, TmdbError, type SearchResult } from './tmdb';

/**
 * Letterboxd has no public API. Two public, terms-friendly sources are used instead:
 *  - the member's RSS feed (recent diary entries, each carrying its TMDB id), read through
 *    a same-origin proxy because letterboxd.com sends no CORS headers;
 *  - the official data export (Settings → Import & Export), a ZIP of CSV files.
 */
const CUSTOM_PROXY = import.meta.env.VITE_LETTERBOXD_PROXY?.trim().replace(/\/$/, '');

/** Dev: Vite's /letterboxd proxy. Production: the /api/letterboxd function (or your own proxy). */
const feedUrl = (user: string) =>
  CUSTOM_PROXY
    ? `${CUSTOM_PROXY}/${user}/rss/`
    : import.meta.env.DEV
      ? `/letterboxd/${user}/rss/`
      : `/api/letterboxd?user=${user}`;

export type LbFilm = {
  title: string;
  year: string;
  /** Film page on Letterboxd, e.g. https://letterboxd.com/film/drive-2011/ */
  uri: string;
  /** Watched / logged date (YYYY-MM-DD) when known. */
  date: string;
  tmdbId?: number;
  /** Member rating, 0.5–5 in half stars. */
  rating?: number;
};

export type Matched = SearchResult & { letterboxdUri: string; watched: string; rating?: number };

/** Fresh Letterboxd data for a film that is already on the wall. */
export type LbUpdate = { id: number; rating?: number; letterboxdUri?: string };

export type ImportSource = 'feed' | 'export';

/** Half-star rating in 0.5–5, or undefined. */
export function toRating(raw: string | undefined): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0.5 && n <= 5 ? Math.round(n * 2) / 2 : undefined;
}

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
    res = await fetch(feedUrl(encodeURIComponent(username)), { signal });
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
      rating: toRating(text(item, 'memberRating')),
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
  const iRating = col('rating');
  if (iName < 0) return [];
  return rows
    .map((r) => ({
      title: (r[iName] ?? '').trim(),
      year: (r[iYear] ?? '').trim().slice(0, 4),
      uri: (r[iUri] ?? '').trim(),
      date: (r[iDate] ?? '').trim(),
      rating: iRating >= 0 ? toRating(r[iRating]) : undefined,
    }))
    .filter((f) => f.title);
}

const filmKey = (f: LbFilm) => `${normalize(f.title)}|${f.year}`;

/**
 * Reads the Letterboxd export ZIP, or a single CSV from it. Uses `watched.csv` (every film
 * marked as seen) and layers ratings from `ratings.csv`, then `diary.csv`. Newest first,
 * de-duplicated.
 */
export async function readExport(file: File): Promise<LbFilm[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const csvs: Record<string, string> = {};
  if (isZip) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes, { filter: (f) => /\.csv$/i.test(f.name) });
    } catch {
      throw new LetterboxdError('bad-file');
    }
    for (const [path, data] of Object.entries(entries)) {
      if (/(^|\/)(lists|deleted|orphaned)\//i.test(path)) continue; // top-level files only
      csvs[path.toLowerCase().split('/').pop()!] = strFromU8(data);
    }
  } else {
    csvs['watched.csv'] = strFromU8(bytes); // a single CSV: whatever it is, use it as the list
  }

  const base = ['watched.csv', 'diary.csv', 'ratings.csv', 'films.csv'].map((n) => csvs[n]).find(Boolean);
  const films = base ? filmsFromCsv(base) : [];
  if (films.length === 0) throw new LetterboxdError('bad-file');

  // ratings: ratings.csv is the member's current rating; diary entries fill the gaps
  const ratings = new Map<string, number>();
  for (const name of ['diary.csv', 'ratings.csv']) {
    if (!csvs[name]) continue;
    for (const f of filmsFromCsv(csvs[name]).sort((a, b) => a.date.localeCompare(b.date))) {
      if (f.rating === undefined) continue;
      ratings.set(filmKey(f), f.rating);
      if (f.uri) ratings.set(f.uri, f.rating);
    }
  }

  const seen = new Set<string>();
  return films
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((f) => {
      const key = f.uri || filmKey(f);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((f) => ({ ...f, rating: ratings.get(f.uri) ?? ratings.get(filmKey(f)) ?? f.rating }));
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
          if (r) out[i] = { ...r, letterboxdUri: film.uri, watched: film.date, rating: film.rating };
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
