import { hash, rng, spread } from './random';
import { ratingScale, stars, UNRATED_SCALE } from './rating';
import type { Profile, WallMovie } from './storage';
import { posterUrl } from './tmdb';

export type CollageFormat = 'story' | 'square' | 'wall';

export const FORMATS: Record<CollageFormat, { label: string; hint: string }> = {
  story: { label: 'Story', hint: '9:16 · Instagram & Facebook stories' },
  square: { label: 'Square', hint: '1:1 · X, Instagram & Facebook posts' },
  wall: { label: 'Full wall', hint: 'Every poster, one tall image' },
};

type Spec = { width: number; height: number | null; base: number; take: number; pad: number };

const SPECS: Record<CollageFormat, Spec> = {
  story: { width: 1080, height: 1920, base: 230, take: 16, pad: 64 },
  square: { width: 1080, height: 1080, base: 200, take: 10, pad: 56 },
  wall: { width: 1600, height: null, base: 150, take: 600, pad: 80 },
};

const C = {
  bg: '#0e0d0b',
  bg2: '#1a1712',
  ink: '#f3ede2',
  ink2: '#b9b1a3',
  ink3: '#8a8377',
  accent: '#ffd23f',
  accentInk: '#1a1504',
};
const DISPLAY = '"Bricolage Grotesque Variable", "Bricolage Grotesque", system-ui, sans-serif';
const SERIF = '"Instrument Serif", Georgia, serif';

type Placed = { movie: WallMovie; x: number; y: number; w: number; h: number; rot: number; img?: HTMLImageElement };

const scaleOf = (m: WallMovie) => (m.rating ? ratingScale(m.rating) : UNRATED_SCALE);

function loadImage(src: string, timeout = 12000): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // TMDB's CDN allows it, so the canvas stays exportable
    const t = window.setTimeout(() => resolve(undefined), timeout);
    img.onload = () => {
      window.clearTimeout(t);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(t);
      resolve(undefined);
    };
    img.src = src;
  });
}

/** Wrap posters into centred rows (like the wall's flexbox), stopping at `maxBottom`. */
function pack(movies: WallMovie[], spec: Spec, top: number, maxBottom: number, seed: number): Placed[] {
  const inner = spec.width - spec.pad * 2;
  const overlap = spec.base * 0.08;
  const placed: Placed[] = [];
  let row: Placed[] = [];
  let rowWidth = 0;
  let y = top;

  const closeRow = () => {
    if (!row.length) return true;
    const rowH = Math.max(...row.map((p) => p.h));
    if (y + rowH > maxBottom) return false;
    let x = spec.pad + (inner - rowWidth) / 2;
    for (const p of row) {
      p.x = x;
      p.y = y + (rowH - p.h) * 0.15 + p.y; // p.y holds the seeded jitter until now
      x += p.w - overlap;
      placed.push(p);
    }
    y += rowH * 0.97;
    row = [];
    rowWidth = 0;
    return true;
  };

  for (const movie of movies) {
    const r = rng(hash(`${movie.id}:${seed}:img`));
    const w = Math.min(spec.base * scaleOf(movie), inner * 0.48);
    const p: Placed = { movie, x: 0, y: spread(r) * 14, w, h: w * 1.5, rot: spread(r) * 5 };
    if (row.length && rowWidth + w - overlap > inner) {
      if (!closeRow()) return placed;
    }
    rowWidth += row.length ? w - overlap : w;
    row.push(p);
  }
  closeRow();
  return placed;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = 160;
  const t = tile.getContext('2d')!;
  const data = t.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 14;
  }
  t.putImageData(data, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!;
  ctx.fillRect(0, 0, w, h);
}

function drawPoster(ctx: CanvasRenderingContext2D, p: Placed, seed: number) {
  const r = rng(hash(`${p.movie.id}:${seed}:pin`));
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((p.rot * Math.PI) / 180);
  const x = -p.w / 2;
  const y = -p.h / 2;

  // shadow + card
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = p.w * 0.16;
  ctx.shadowOffsetY = p.w * 0.07;
  ctx.fillStyle = '#221f19';
  ctx.fillRect(x, y, p.w, p.h);
  ctx.shadowColor = 'transparent';

  if (p.img) {
    // cover-fit
    const ir = p.img.width / p.img.height;
    const cr = p.w / p.h;
    let sw = p.img.width;
    let sh = p.img.height;
    if (ir > cr) sw = sh * cr;
    else sh = sw / cr;
    ctx.drawImage(p.img, (p.img.width - sw) / 2, (p.img.height - sh) / 2, sw, sh, x, y, p.w, p.h);
  } else {
    ctx.fillStyle = '#e9d9b8';
    ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = '#1b1711';
    ctx.font = `800 ${p.w * 0.11}px ${DISPLAY}`;
    ctx.fillText(p.movie.title.toUpperCase().slice(0, 22), x + p.w * 0.08, y + p.h * 0.9, p.w * 0.84);
  }

  // sheen
  const g = ctx.createLinearGradient(x, y, x + p.w, y + p.h);
  g.addColorStop(0, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, p.w, p.h);

  // fastener
  if (r() < 0.55) {
    ctx.save();
    ctx.translate(x + p.w * (0.5 + spread(r) * 0.15), y + 2);
    ctx.rotate((spread(r) * 12 * Math.PI) / 180);
    ctx.fillStyle = 'rgba(245, 228, 175, 0.62)';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 3;
    ctx.fillRect(-p.w * 0.21, -11, p.w * 0.42, 22);
    ctx.restore();
  } else {
    const px = x + p.w / 2;
    const py = y + p.w * 0.07;
    const rad = Math.max(6, p.w * 0.045);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    const pin = ctx.createRadialGradient(px - rad * 0.3, py - rad * 0.4, rad * 0.1, px, py, rad);
    pin.addColorStop(0, '#fff6c8');
    pin.addColorStop(0.35, C.accent);
    pin.addColorStop(1, '#b78a00');
    ctx.fillStyle = pin;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
  }

  // rating ticket
  if (p.movie.rating) {
    const fs = Math.max(13, Math.min(30, p.w * 0.075));
    ctx.font = `700 ${fs}px ${DISPLAY}`;
    const label = stars(p.movie.rating);
    const tw = ctx.measureText(label).width + fs * 1.1;
    const th = fs * 1.55;
    ctx.save();
    ctx.translate(x + p.w * 0.06, y + p.h * 0.95 - th);
    ctx.rotate((-3 * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = C.accent;
    roundRect(ctx, 0, 0, tw, th, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.accentInk;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, fs * 0.55, th / 2 + 1);
    ctx.restore();
  }
  ctx.restore();
}

async function drawAvatar(ctx: CanvasRenderingContext2D, profile: Profile, x: number, y: number, d: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + d / 2, y + d / 2, d / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = C.accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + d / 2, y + d / 2, d / 2 + 2, 0, Math.PI * 2);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + d / 2, y + d / 2, d / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  const img = profile.avatar ? await loadImage(profile.avatar) : undefined;
  if (img) ctx.drawImage(img, x, y, d, d);
  else {
    ctx.fillStyle = '#221e17';
    ctx.fillRect(x, y, d, d);
    ctx.fillStyle = C.accent;
    ctx.font = `italic ${d * 0.5}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((profile.name.trim()[0] ?? '★').toUpperCase(), x + d / 2, y + d / 2 + d * 0.04);
  }
  ctx.restore();
}

/** Fits text to a width by shrinking the font size. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 24) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export type CollageInput = { profile: Profile; movies: WallMovie[]; seed: number; siteHost: string | null };

/**
 * Renders the shareable image. Story and square show your best-rated films (biggest first);
 * the full wall keeps the wall's own order.
 */
export async function renderCollage(format: CollageFormat, input: CollageInput): Promise<Blob> {
  const spec = SPECS[format];
  await Promise.all([
    document.fonts.load(`800 80px ${DISPLAY}`),
    document.fonts.load(`italic 40px ${SERIF}`),
  ]).catch(() => undefined);

  const pool = input.movies.filter((m) => m.posterPath);
  const chosen =
    format === 'wall'
      ? pool.slice(0, spec.take)
      : [...pool].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.addedAt - a.addedAt).slice(0, spec.take);
  // interleave big and small so the collage doesn't read as a ranking
  const arranged = format === 'wall' ? chosen : interleave(chosen);

  const headerH = format === 'story' ? 470 : format === 'square' ? 250 : 300;
  const footerH = format === 'story' ? 150 : 100;
  const height = spec.height ?? 0;
  // fixed formats: shrink the base size until the chosen films fit (sizes stay relative)
  let placed = pack(arranged, spec, headerH, spec.height ? height - footerH : Infinity, input.seed);
  for (let base = spec.base * 0.92; spec.height && placed.length < arranged.length && base > 60; base *= 0.92) {
    placed = pack(arranged, { ...spec, base }, headerH, height - footerH, input.seed);
  }
  const contentBottom = placed.length ? Math.max(...placed.map((p) => p.y + p.h)) : headerH;
  const H = spec.height ?? Math.ceil(contentBottom + footerH + 40);

  // centre the poster block vertically in fixed formats
  if (spec.height && placed.length) {
    const free = height - footerH - 20 - contentBottom;
    if (free > 0) for (const p of placed) p.y += free / 2;
  }

  // images: bigger posters get the sharper size
  await Promise.all(
    placed.map(async (p) => {
      // own cache key: the wall's <img> copies were cached without CORS headers
      p.img = await loadImage(`${posterUrl(p.movie.posterPath!, p.w > 260 ? 'w500' : 'w342')}?canvas=1`);
    }),
  );

  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bg2);
  bg.addColorStop(0.45, C.bg);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, spec.width, H);
  const glow = ctx.createRadialGradient(spec.width * 0.15, 0, 0, spec.width * 0.15, 0, spec.width * 0.9);
  glow.addColorStop(0, 'rgba(255,210,63,0.12)');
  glow.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, spec.width, H);

  // header
  const pad = spec.pad;
  const story = format === 'story';
  const avatarD = story ? 150 : 112;
  const headerTop = story ? 130 : 64;
  await drawAvatar(ctx, input.profile, pad, headerTop, avatarD);
  const tx = pad + avatarD + (story ? 44 : 36);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `italic ${story ? 44 : 34}px ${SERIF}`;
  ctx.fillText('the wall of', tx, headerTop + (story ? 34 : 26));
  ctx.fillStyle = C.ink;
  const name = input.profile.name.trim() || 'My';
  const nameSize = fitFont(ctx, name, '800', story ? 118 : 92, DISPLAY, spec.width - tx - pad);
  ctx.fillText(name, tx - nameSize * 0.04, headerTop + (story ? 34 : 26) + nameSize * 0.95);

  // count chip + letterboxd
  const metaY = headerTop + avatarD + (story ? 70 : 52);
  const count = String(input.movies.length);
  ctx.font = `700 ${story ? 38 : 30}px ${DISPLAY}`;
  const cw = ctx.measureText(count).width + 24;
  const ch = story ? 52 : 42;
  ctx.fillStyle = C.accent;
  roundRect(ctx, pad, metaY - ch * 0.78, cw, ch, 10);
  ctx.fill();
  ctx.fillStyle = C.accentInk;
  ctx.fillText(count, pad + 12, metaY);
  ctx.fillStyle = C.ink2;
  ctx.font = `italic ${story ? 42 : 34}px ${SERIF}`;
  const label = input.movies.length === 1 ? 'film on the wall' : 'films on the wall';
  ctx.fillText(label, pad + cw + 14, metaY);
  if (input.profile.letterboxd) {
    const lb = `letterboxd @${input.profile.letterboxd}`;
    ctx.font = `500 ${story ? 32 : 26}px ${DISPLAY}`;
    ctx.fillStyle = C.ink3;
    ctx.textAlign = 'right';
    ctx.fillText(lb, spec.width - pad, metaY);
    ctx.textAlign = 'left';
  }

  // posters: lowest rated first so favourites land on top
  const seed = input.seed;
  for (const p of [...placed].sort((a, b) => (a.movie.rating ?? 0) - (b.movie.rating ?? 0))) drawPoster(ctx, p, seed);

  // footer
  const fy = H - (story ? 70 : 44);
  ctx.font = `800 ${story ? 40 : 32}px ${DISPLAY}`;
  ctx.fillStyle = C.ink;
  ctx.fillText('poster', pad, fy);
  const pw = ctx.measureText('poster').width;
  ctx.font = `italic ${story ? 52 : 42}px ${SERIF}`;
  ctx.fillStyle = C.accent;
  ctx.fillText('wall', pad + pw + 2, fy);
  ctx.textAlign = 'right';
  ctx.font = `500 ${story ? 30 : 24}px ${DISPLAY}`;
  ctx.fillStyle = C.ink3;
  const more = input.movies.length - placed.length;
  const right = [more > 0 && format !== 'wall' ? `+${more} more` : '', input.siteHost ?? ''].filter(Boolean).join('  ·  ');
  ctx.fillText(right, spec.width - pad, fy);
  ctx.textAlign = 'left';

  grain(ctx, spec.width, H);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export the image'))), 'image/jpeg', 0.92),
  );
}

/** [1,2,3,4,5,6] → [1,4,2,5,3,6]: alternate the top half with the rest. */
function interleave<T>(items: T[]): T[] {
  const half = Math.ceil(items.length / 2);
  const out: T[] = [];
  for (let i = 0; i < half; i++) {
    out.push(items[i]);
    if (items[half + i]) out.push(items[half + i]);
  }
  return out;
}
