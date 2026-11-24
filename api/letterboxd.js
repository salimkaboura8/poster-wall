// Vercel Function: reads a Letterboxd member's public RSS feed (letterboxd.com sends no
// CORS headers, so the browser can't fetch it directly).
export async function GET(request) {
  const user = new URL(request.url).searchParams.get('user') ?? '';
  if (!/^[A-Za-z0-9_]{2,15}$/.test(user)) return new Response('bad user', { status: 400 });

  const upstream = await fetch(`https://letterboxd.com/${user}/rss/`, {
    headers: { 'User-Agent': 'PosterWall/0.3 (+https://github.com/salimkaboura8/poster-wall)' },
  });
  return new Response(upstream.ok ? await upstream.text() : '', {
    status: upstream.status,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': upstream.ok ? 'public, s-maxage=600, stale-while-revalidate=300' : 'no-store',
    },
  });
}
