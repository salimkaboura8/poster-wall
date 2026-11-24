export type WallMovie = {
  id: number;
  title: string;
  year: string;
  posterPath: string | null;
  overview: string;
  addedAt: number;
  /** Film page on Letterboxd, when the film came from a Letterboxd import. */
  letterboxdUri?: string;
  /** Your rating, 0.5–5 in half stars (from Letterboxd or set here). Drives poster size. */
  rating?: number;
};

export type Profile = {
  name: string;
  /** Small JPEG data URL (resized client-side). */
  avatar: string | null;
  /** Letterboxd username (shown as a link under the name). */
  letterboxd: string | null;
};

export type WallState = {
  version: 1;
  profile: Profile;
  movies: WallMovie[];
  /** Changing the seed re-shuffles the collage. */
  seed: number;
};

const STORAGE_KEY = 'poster-wall:v1';

/** Film pages (from the RSS feed) or boxd.it short links (from the CSV export). */
export const LETTERBOXD_URI = /^https:\/\/(letterboxd\.com\/film\/[\w-]+\/|boxd\.it\/\w+)$/;

export const emptyWall = (): WallState => ({
  version: 1,
  profile: { name: '', avatar: null, letterboxd: null },
  movies: [],
  seed: Math.floor(Math.random() * 1e6),
});

function isMovie(m: unknown): m is WallMovie {
  if (!m || typeof m !== 'object') return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.id === 'number' &&
    typeof o.title === 'string' &&
    (o.posterPath === null || typeof o.posterPath === 'string')
  );
}

/** Validates untrusted JSON (localStorage or an imported file). */
export function parseWall(raw: unknown): WallState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.movies)) return null;
  const p = (o.profile ?? {}) as Record<string, unknown>;
  const avatar = typeof p.avatar === 'string' && p.avatar.startsWith('data:image/') ? p.avatar : null;
  return {
    version: 1,
    profile: {
      name: typeof p.name === 'string' ? p.name.slice(0, 60) : '',
      avatar,
      letterboxd: typeof p.letterboxd === 'string' && /^[A-Za-z0-9_]{2,15}$/.test(p.letterboxd) ? p.letterboxd : null,
    },
    movies: o.movies.filter(isMovie).map((m) => ({
      id: m.id,
      title: String(m.title).slice(0, 200),
      year: typeof m.year === 'string' ? m.year.slice(0, 4) : '',
      posterPath: m.posterPath && /^\/[\w.-]+$/.test(m.posterPath) ? m.posterPath : null,
      overview: typeof m.overview === 'string' ? m.overview.slice(0, 2000) : '',
      addedAt: typeof m.addedAt === 'number' ? m.addedAt : Date.now(),
      ...(typeof m.letterboxdUri === 'string' && LETTERBOXD_URI.test(m.letterboxdUri)
        ? { letterboxdUri: m.letterboxdUri }
        : {}),
      ...(typeof m.rating === 'number' && m.rating >= 0.5 && m.rating <= 5 ? { rating: Math.round(m.rating * 2) / 2 } : {}),
    })),
    seed: typeof o.seed === 'number' ? o.seed : 1,
  };
}

export function loadWall(): WallState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return (text && parseWall(JSON.parse(text))) || emptyWall();
  } catch {
    return emptyWall();
  }
}

export function saveWall(state: WallState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode: the wall still works for this visit */
  }
}

/** Resizes an image file to a square JPEG data URL (keeps localStorage small). */
export function fileToAvatar(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas unavailable'));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not an image'));
    };
    img.src = url;
  });
}

export function downloadJson(state: WallState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const who = state.profile.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my';
  a.download = `${who}-poster-wall.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
