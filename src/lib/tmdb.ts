const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const token = import.meta.env.VITE_TMDB_READ_TOKEN?.trim();
const apiKey = import.meta.env.VITE_TMDB_API_KEY?.trim();

/** True when a TMDB credential is configured in `.env`. */
export const hasTmdbKey = Boolean(token || apiKey);

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

export async function searchMovies(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams({ query, include_adult: 'false', page: '1' });
  if (!token && apiKey) params.set('api_key', apiKey);
  const res = await fetch(`${API}/search/movie?${params}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}`, accept: 'application/json' } : undefined,
  });
  if (!res.ok) throw new TmdbError(res.status);
  const body = (await res.json()) as { results: TmdbMovie[] };
  // TMDB's own order favours text relevance; nudge exact titles, posters and popular films up
  // so "Drive" finds the 2011 film and Enter pins what people mean.
  const wanted = normalize(query);
  const score = (m: TmdbMovie) =>
    (normalize(m.title) === wanted ? 1000 : 0) + (m.poster_path ? 200 : 0) + Math.min(m.popularity ?? 0, 400);
  const ranked = body.results
    .slice(0, 20)
    .map((m, i) => ({ m, s: score(m) - i * 4 }))
    .sort((a, b) => b.s - a.s)
    .map(({ m }) => m);
  return ranked.slice(0, 12).map((m) => ({
    id: m.id,
    title: m.title,
    year: m.release_date?.slice(0, 4) ?? '',
    posterPath: m.poster_path,
    overview: m.overview ?? '',
  }));
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export type PosterSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780';

export function posterUrl(path: string, size: PosterSize = 'w342'): string {
  return `${IMG}/${size}${path}`;
}

export function tmdbMovieUrl(id: number): string {
  return `https://www.themoviedb.org/movie/${id}`;
}
