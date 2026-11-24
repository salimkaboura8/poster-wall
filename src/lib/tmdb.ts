const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

// Local dev talks to TMDB directly with the key from `.env`. Production builds never read
// that key (the DEV guard lets the bundler drop it) and go through the /api/tmdb function,
// which holds the key server-side.
const token = import.meta.env.DEV ? import.meta.env.VITE_TMDB_READ_TOKEN?.trim() : undefined;
const apiKey = import.meta.env.DEV ? import.meta.env.VITE_TMDB_API_KEY?.trim() : undefined;
const direct = Boolean(token || apiKey);
const PROXY = import.meta.env.VITE_TMDB_PROXY?.trim() || (import.meta.env.PROD ? '/api/tmdb' : '');

/** True when films can be searched: a local key, or the production proxy. */
export const hasTmdbKey = direct || Boolean(PROXY);

export type SearchResult = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  overview: string;
};

type TmdbMovie = {
  id: number;
  title: string;
  release_date?: string;
  poster_path: string | null;
  overview?: string;
  popularity?: number;
};

export class TmdbError extends Error {
  constructor(public status: number) {
    super(status === 401 ? 'TMDB rejected the API key.' : `TMDB request failed (${status}).`);
  }
}

async function get<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const qs = new URLSearchParams(params);
  let res: Response;
  if (direct) {
    if (!token && apiKey) qs.set('api_key', apiKey);
    res = await fetch(`${API}${path}?${qs}`, {
      signal,
      headers: token ? { Authorization: `Bearer ${token}`, accept: 'application/json' } : undefined,
    });
  } else {
    qs.set('path', path);
    res = await fetch(`${PROXY}?${qs}`, { signal });
  }
  if (!res.ok) throw new TmdbError(res.status);
  return (await res.json()) as T;
}

const toResult = (m: TmdbMovie): SearchResult => ({
  id: m.id,
  title: m.title,
  year: m.release_date?.slice(0, 4) ?? '',
  posterPath: m.poster_path,
  overview: m.overview ?? '',
});

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Title search. TMDB's own order favours text relevance; exact titles, posters and popular
 * films are nudged up so "Drive" finds the 2011 film and Enter pins what people mean.
 * `year` (optional) narrows to that release year.
 */
export async function searchMovies(query: string, signal?: AbortSignal, year?: string): Promise<SearchResult[]> {
  const params: Record<string, string> = { query, include_adult: 'false', page: '1' };
  if (year) params.year = year;
  const body = await get<{ results: TmdbMovie[] }>('/search/movie', params, signal);
  const wanted = normalize(query);
  const score = (m: TmdbMovie) =>
    (normalize(m.title) === wanted ? 1000 : 0) +
    (year && m.release_date?.startsWith(year) ? 500 : 0) +
    (m.poster_path ? 200 : 0) +
    Math.min(m.popularity ?? 0, 400);
  return body.results
    .slice(0, 20)
    .map((m, i) => ({ m, s: score(m) - i * 4 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(({ m }) => toResult(m));
}

/** A single film by TMDB id (used when Letterboxd already gives us the id). */
export async function getMovie(id: number, signal?: AbortSignal): Promise<SearchResult> {
  return toResult(await get<TmdbMovie>(`/movie/${id}`, {}, signal));
}

export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780';

export function posterUrl(path: string, size: PosterSize = 'w342'): string {
  return `${IMG}/${size}${path}`;
}

export function tmdbMovieUrl(id: number): string {
  return `https://www.themoviedb.org/movie/${id}`;
}
