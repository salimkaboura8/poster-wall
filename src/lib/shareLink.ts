import { deflateSync, inflateSync } from 'fflate';
import type { WallState } from './storage';

/**
 * A share link carries the wall itself (no database): name, Letterboxd username and every
 * film as a TMDB id + half-star rating, packed as varints, deflated and base64url-encoded in
 * the URL *fragment* (#w=…), which browsers never send to the server.
 * Titles and posters are fetched from TMDB again by whoever opens the link.
 */
export type SharedFilm = { id: number; rating?: number };
export type SharedWall = { name: string; letterboxd: string | null; films: SharedFilm[] };

const VERSION = 1;
const MAX_FILMS = 5000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function writeVarint(out: number[], n: number) {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

function writeString(out: number[], s: string) {
  const bytes = enc.encode(s);
  writeVarint(out, bytes.length);
  out.push(...bytes);
}

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export function encodeWall(wall: Pick<WallState, 'profile' | 'movies'>, order = wall.movies): string {
  const out: number[] = [VERSION];
  writeString(out, wall.profile.name.trim().slice(0, 40));
  writeString(out, wall.profile.letterboxd ?? '');
  const films = order.slice(0, MAX_FILMS);
  writeVarint(out, films.length);
  for (const f of films) {
    writeVarint(out, f.id);
    out.push(f.rating ? Math.round(f.rating * 2) : 0);
  }
  return toBase64Url(deflateSync(Uint8Array.from(out), { level: 9 }));
}

export function decodeWall(code: string): SharedWall | null {
  try {
    const bytes = inflateSync(fromBase64Url(code));
    let i = 0;
    const varint = () => {
      let n = 0;
      let mul = 1;
      for (let k = 0; k < 5; k++) {
        const b = bytes[i++];
        if (b === undefined) throw new Error('truncated');
        n += (b & 0x7f) * mul;
        if (!(b & 0x80)) return n;
        mul *= 128;
      }
      throw new Error('varint too long');
    };
    const string = (max: number) => {
      const len = varint();
      if (len > max * 4) throw new Error('string too long');
      const s = dec.decode(bytes.subarray(i, i + len));
      i += len;
      return s.slice(0, max);
    };

    if (bytes[i++] !== VERSION) return null;
    const name = string(40);
    const lb = string(15);
    const count = varint();
    if (count > MAX_FILMS) return null;
    const films: SharedFilm[] = [];
    const seen = new Set<number>();
    for (let k = 0; k < count; k++) {
      const id = varint();
      const half = bytes[i++];
      if (half === undefined) throw new Error('truncated');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      films.push(half >= 1 && half <= 10 ? { id, rating: half / 2 } : { id });
    }
    return { name, letterboxd: /^[A-Za-z0-9_]{2,15}$/.test(lb) ? lb : null, films };
  } catch {
    return null;
  }
}

export const shareUrl = (code: string) => `${location.origin}${location.pathname}#w=${code}`;

export const codeFromHash = (hash = location.hash) => (hash.startsWith('#w=') ? hash.slice(3) : null);

/** True on a dev machine: links made here won't open for anyone else. */
export const isLocalOrigin = () => /^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(location.hostname);
