<div align="center">

# poster *wall*

**Your films, pinned like posters on a bedroom wall.**

A small, personal take on the film diary: no ratings and no reviews, just a page with your name, your face and a messy, lovingly crooked collage of the posters of every film you care about.

[Features](#features) · [Run it](#run-it-locally) · [TMDB key](#get-a-tmdb-api-key) · [Letterboxd](#import-from-letterboxd) · [How it works](#how-the-wall-works) · [Credits](#credits)

<img src="docs/wall.jpg" alt="A profile page: a round avatar, the name Salim in large type, and below it a collage of tilted movie posters held with tape and push pins on a dark wall" width="100%">

</div>

---

## Features

- **One page, one person.** Your name (click to edit) and profile photo (click the avatar) on top, your poster wall below.
- **A wall that isn't a grid.** Every poster gets its own tilt, offset and size, and is held up with a strip of torn masking tape or a yellow push pin. Neighbours overlap a little, like a real wall.
- **Pinning takes two seconds.** Hit the yellow **+** (or press <kbd>N</kbd>), type a title and press <kbd>Enter</kbd>. The film you meant comes first: exact titles and well-known films rank above obscure namesakes.
- **Motion that feels physical.** A new poster drops from above, overshoots, wobbles and settles, and its tape lands last. Hovering lifts and straightens a poster. All motion is turned off under `prefers-reduced-motion`.
- **Bring your Letterboxd.** Link your username (it shows as a chip under your name) to pin the films from your latest diary entries, or drop your Letterboxd export `.zip` to pin *everything* you've ever watched. Imported posters rain onto the wall in a cascade.
- **Reshuffle.** Don't like how the wall landed? Re-throw every poster. The layout is seeded, so it stays put between visits until you reshuffle.
- **Poster details.** Click a poster for a bigger view, the synopsis, the date you pinned it, a link to TMDB and *Unpin*.
- **Yours, locally.** No account and no server: the wall lives in your browser (`localStorage`). **Export** downloads it as JSON and **Import** restores it on any device.
- **Keyboard and screen-reader friendly.** Native `<dialog>` sheets (focus trap, <kbd>Esc</kbd>), visible focus rings and labelled controls.

<table>
  <tr>
    <td width="50%"><img src="docs/search.jpg" alt="The search sheet: a glass panel listing films titled Before Sunrise with small posters, years and Pin buttons"></td>
    <td width="50%"><img src="docs/detail.jpg" alt="The poster detail sheet for Moonlight (2016), with the synopsis and View on TMDB and Unpin buttons"></td>
  </tr>
  <tr>
    <td><img src="docs/hover.jpg" alt="A poster lifted and straightened under the cursor, with a glass caption showing its title and year"></td>
    <td><img src="docs/empty.jpg" alt="The empty state: three dashed poster outlines and the line A bare wall, for now"></td>
  </tr>
</table>

<p align="center"><img src="docs/letterboxd.jpg" alt="The Letterboxd sheet: a username field with a Pull films button, and a dashed drop zone for the Letterboxd data export" width="80%"></p>

<p align="center"><img src="docs/mobile.jpg" alt="The wall on a phone: the same collage in three loose columns" width="300"></p>

## Design

| | |
|---|---|
| **Mood** | A dark room, warm light, a wall you actually live with. Glass panels for the tools, paper and tape for the posters. |
| **Colour** | Near-black warm background `#0e0d0b`, bone text `#f3ede2`, one accent: marquee yellow `#ffd23f`. A faint film grain sits over everything. |
| **Type** | [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) for the expressive, heavy headings and UI, and [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) italic for the small handwritten-feeling asides (*the wall of*, *posters pinned*, years). Both are self-hosted through Fontsource. |
| **Motion** | Spring easing for anything you touch, a slower ease-out for things that fall. Nothing loops. |

## Run it locally

Requires **Node 20+**.

```bash
git clone https://github.com/salimkaboura8/poster-wall.git
cd poster-wall
npm install
cp .env.example .env    # then paste your TMDB token in .env (see below)
npm run dev             # http://localhost:5178
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then build the static site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript only |

## Get a TMDB API key

Film data and posters come from [The Movie Database (TMDB)](https://www.themoviedb.org/). The API is free for personal, non-commercial use.

1. Create an account at [themoviedb.org](https://www.themoviedb.org/signup) and confirm your email.
2. Go to **Settings → API** ([direct link](https://www.themoviedb.org/settings/api)), click **Create** and choose **Developer**.
3. Fill in the short form (type of use: *Personal*, a name and summary for your app, your contact details).
4. Copy the **API Read Access Token** (the long one that starts with `eyJ`) into `.env`:

```dotenv
VITE_TMDB_READ_TOKEN=eyJhbGciOi...
# or, alternatively, the short v3 key:
# VITE_TMDB_API_KEY=0123456789abcdef...
```

5. Restart `npm run dev`. Vite only reads `.env` at startup.

> [!NOTE]
> `.env` is git-ignored, so your key never gets committed. On Windows, make sure the file is really called `.env` and not `.env.txt` (Notepad adds `.txt` by default).

> [!WARNING]
> Variables prefixed with `VITE_` are embedded in the built JavaScript. That's fine on your own machine. If you deploy the site publicly, anyone can read the token, so use a dedicated key or put a tiny proxy in front of TMDB.

## Import from Letterboxd

Letterboxd has no public API, so Poster Wall uses the two public ways to read your films:

| | Recent films (username) | Everything (data export) |
|---|---|---|
| **How** | Type your username (or paste your profile link) and press **Pull films** | Letterboxd → [Settings → Data](https://letterboxd.com/settings/data/) → **Export your data**, then drop the `.zip` (or just `watched.csv`) |
| **What you get** | Films from your latest diary entries (the RSS feed keeps roughly the last 50–100) | Every film you've marked as watched |
| **Matching** | Exact: each feed entry carries its TMDB id | By title + release year on TMDB (±1 year tolerance); unmatched films are counted in the toast |
| **Needs** | A proxy, because letterboxd.com sends no CORS headers. `npm run dev` and `npm run preview` include one at `/letterboxd`. | Nothing: the file never leaves your browser |

Films already on your wall are skipped, the import can be stopped half-way (*Stop and pin what's found*), and each imported poster's detail view links back to the film on Letterboxd.

> [!NOTE]
> **Deploying?** The built-in proxy only exists in Vite's dev/preview servers. On a static host, point `VITE_LETTERBOXD_PROXY` at any small proxy that forwards `/<username>/rss/` to `https://letterboxd.com/<username>/rss/` (a few lines on Cloudflare Workers or a Vercel function). The export-file import works everywhere without it.

## How the wall works

The collage is a wrapping flex row with **negative margins**, which is why posters overlap. Each poster is then pushed off the grid by CSS custom properties:

```ts
// src/components/Poster.tsx
const r = rng(hash(`${movie.id}:${seed}`)); // deterministic per film + wall seed
rot:   spread(r) * 6,     // tilt, ±6°
x:     spread(r) * 14,    // horizontal nudge, px
y:     spread(r) * 34,    // vertical drift, px
scale: SIZES[...],        // 0.82× – 1.26×
fastener: r() < 0.55 ? 'tape' : 'pin',
```

`hash` is FNV-1a and `rng` is mulberry32 (`src/lib/random.ts`). Because the numbers come from the film id plus a per-wall seed, the wall looks hand-made but never jumps around on reload. **Reshuffle** just picks a new seed, and the CSS transition carries every poster to its new spot.

The drop-in is a single keyframe animation that reads the same variables, so it lands exactly where that poster's resting transform is:

```css
@keyframes drop {
  0%   { transform: translate(var(--x), -70vh) rotate(var(--fall)) scale(1.35); }
  55%  { transform: translate(var(--x), calc(var(--y) + 10px)) rotate(calc(var(--r) * -0.6)); }
  75%  { transform: translate(var(--x), calc(var(--y) - 5px))  rotate(calc(var(--r) * 1.25)); }
  100% { transform: translate(var(--x), var(--y)) rotate(var(--r)); }
}
```

### Project structure

```
src/
├─ App.tsx                 page shell, state, keyboard shortcut, import/export
├─ components/
│  ├─ ProfileHeader.tsx    avatar (resized to 256 px JPEG), editable name, count
│  ├─ Wall.tsx             collage + empty state
│  ├─ Poster.tsx           one seeded poster with tape or pin
│  ├─ AddMovie.tsx         debounced TMDB search, Enter pins the top match
│  ├─ LetterboxdImport.tsx username + export import, progress, cancel
│  ├─ PosterDetail.tsx     big poster, synopsis, unpin
│  └─ Sheet.tsx            native <dialog> wrapper
├─ lib/
│  ├─ tmdb.ts              search + result ranking + image URLs
│  ├─ letterboxd.ts        RSS feed, export ZIP/CSV parsing, TMDB matching pool
│  ├─ storage.ts           localStorage, validated import, avatar resize
│  └─ random.ts            FNV-1a hash + mulberry32 PRNG
└─ styles.css              tokens, collage, motion, glass
```

**Stack:** React 19, TypeScript, Vite, and [fflate](https://github.com/101arrowz/fflate) to unzip the Letterboxd export. No UI kit and no state library: the whole app is about 2,600 lines, half of it CSS.

## Credits

<a href="https://www.themoviedb.org/"><img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB logo" height="18"></a>

**This product uses the TMDB API but is not endorsed or certified by TMDB.** Poster Wall is not affiliated with Letterboxd; it only reads public RSS feeds and the export file you choose to give it. All film titles, synopses and poster images are provided by [TMDB](https://www.themoviedb.org/) and belong to their respective owners. They are shown here for personal, non-commercial use under the [TMDB API terms](https://www.themoviedb.org/api-terms-of-use).

Fonts: Bricolage Grotesque (Mathieu Triay) and Instrument Serif (Instrument), both under the SIL Open Font License.

## License

[MIT](LICENSE) for the code. Movie data and images remain subject to TMDB's terms.
