// Vercel Function: forwards the two TMDB calls the app needs, keeping the key server-side.
// Set TMDB_READ_TOKEN (or TMDB_API_KEY) in the Vercel project's environment variables.
const ALLOWED = /^\/(search\/movie|movie\/\d{1,9})$/;
const PASS = ['query', 'year', 'include_adult', 'page'];

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function GET(request) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path') ?? '';
  if (!ALLOWED.test(path)) return json(400, { error: 'unsupported path' });

  const token = process.env.TMDB_READ_TOKEN?.trim();
  const key = process.env.TMDB_API_KEY?.trim();
  if (!token && !key) return json(500, { error: 'TMDB key not configured' });

  const params = new URLSearchParams();
  for (const name of PASS) {
    const v = url.searchParams.get(name);
    if (v) params.set(name, v.slice(0, 200));
  }
  if (!token) params.set('api_key', key);

  const upstream = await fetch(`https://api.themoviedb.org/3${path}?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}`, accept: 'application/json' } : { accept: 'application/json' },
  });
  // film details barely change: let Vercel's CDN answer repeat requests (shared walls)
  const cache = path.startsWith('/movie/')
    ? 'public, s-maxage=604800, stale-while-revalidate=86400'
    : 'public, s-maxage=3600, stale-while-revalidate=600';
  return new Response(upstream.body, {
    status: upstream.status === 401 ? 502 : upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': upstream.ok ? cache : 'no-store' },
  });
}
