import { useEffect, useMemo, useState } from 'react';
import { FORMATS, renderCollage, type CollageFormat, type CollageInput } from '../lib/collage';
import { encodeWall, isLocalOrigin, shareUrl } from '../lib/shareLink';
import type { WallMovie, WallState } from '../lib/storage';

type Props = {
  wall: WallState;
  /** The wall in its displayed order (used for the link and the full-wall image). */
  ordered: WallMovie[];
  onDone: (message: string) => void;
};

type Rendered = { blob: Blob; url: string; file: File };
type PhotoFormat = Exclude<CollageFormat, 'story'>;

const fileName = (name: string, format: CollageFormat) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my'}-poster-wall-${format}.jpg`;

const canShareFiles = (file: File) => Boolean(navigator.canShare?.({ files: [file] }));

const ready = (r: Rendered | 'failed' | undefined) => (r && r !== 'failed' ? r : undefined);

/** Renders one collage format; re-renders when the format changes. */
function useCollage(format: CollageFormat, input: CollageInput, name: string): Rendered | 'failed' | undefined {
  const [state, setState] = useState<{ format: CollageFormat; value: Rendered | 'failed' } | null>(null);
  useEffect(() => {
    let alive = true;
    let url = '';
    renderCollage(format, input)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        const file = new File([blob], fileName(name, format), { type: 'image/jpeg' });
        setState({ format, value: { blob, url, file } });
      })
      .catch(() => alive && setState({ format, value: 'failed' }));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // the sheet mounts fresh each time it opens, so the wall can't change underneath it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);
  return state?.format === format ? state.value : undefined;
}

const download = (r: Rendered) => {
  const a = document.createElement('a');
  a.href = r.url;
  a.download = r.file.name;
  a.click();
};

export function ShareSheet({ wall, ordered, onDone }: Props) {
  const [photo, setPhoto] = useState<PhotoFormat>('square');
  const local = isLocalOrigin();

  const link = useMemo(() => shareUrl(encodeWall(wall, ordered)), [wall, ordered]);
  const who = wall.profile.name.trim();
  const text = `${who ? `${who}'s` : 'My'} poster wall: ${wall.movies.length} films, sized by how much I loved them.`;

  // The story renders as soon as the sheet opens, so the Instagram button can share on the
  // first tap (browsers only allow sharing right after a tap); the photo renders on demand.
  const input = { profile: wall.profile, movies: ordered, seed: wall.seed, siteHost: local ? null : location.host };
  const images: Partial<Record<CollageFormat, Rendered | 'failed'>> = {
    story: useCollage('story', input, wall.profile.name),
    [photo]: useCollage(photo, input, wall.profile.name),
  };

  const story = ready(images.story);
  const shot = ready(images[photo]);
  const storyNative = story ? canShareFiles(story.file) : false;

  const shareStory = async () => {
    if (!story) return;
    if (storyNative) {
      try {
        await navigator.share({ files: [story.file] });
      } catch {
        /* closed the share sheet */
      }
      return;
    }
    download(story);
    onDone('Story image saved: add it to your Instagram story from your phone');
  };

  const sharePhoto = async () => {
    if (!shot) return;
    try {
      await navigator.share({ files: [shot.file], title: 'My poster wall', text });
    } catch {
      /* cancelled */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      onDone(local ? 'Link copied (it only opens on this computer until the site is deployed)' : 'Link copied');
    } catch {
      onDone("Couldn't copy: select the link and copy it by hand");
    }
  };

  const popup = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=640,height=640');

  return (
    <div className="share">
      <h2 className="add__heading">
        Show off your <em>wall.</em>
      </h2>

      {/* 1 · Instagram story: the headline option */}
      <section className="share__card share__story">
        <div className="share__story-thumb">
          {story ? (
            <img src={story.url} alt="Your story image" />
          ) : (
            <span>{images.story === 'failed' ? '!' : '…'}</span>
          )}
        </div>
        <div className="share__story-text">
          <h3>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" />
            </svg>
            Instagram story
          </h3>
          {storyNative ? (
            <p>
              Tap below, choose <b>Instagram</b>, then <b>Story</b>. Your top-rated posters, made for a 9:16 story.
            </p>
          ) : (
            <ol>
              <li>Save the 9:16 story image.</li>
              <li>
                In Instagram on your phone, tap <b>+</b> → <b>Story</b> and pick it.
              </li>
            </ol>
          )}
          <button type="button" className="btn btn--accent share__story-btn" onClick={shareStory} disabled={!story}>
            {storyNative ? 'Share to story' : 'Save story image'}
          </button>
          {!storyNative && (
            <p className="share__tip">On your phone, this button sends the story straight to Instagram.</p>
          )}
        </div>
      </section>

      {/* 2 · Photo for posts */}
      <section className="share__card">
        <div className="share__head">
          <h3>Photo</h3>
          <div className="segmented" role="radiogroup" aria-label="Photo format">
            {(['square', 'wall'] as PhotoFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={photo === f}
                className={photo === f ? 'is-on' : ''}
                onClick={() => setPhoto(f)}
              >
                {FORMATS[f].label}
              </button>
            ))}
          </div>
        </div>
        <p className="share__hint">{FORMATS[photo].hint}</p>
        <div className={`share__preview share__preview--${photo}`}>
          {shot ? (
            <img src={shot.url} alt={`Preview of your ${FORMATS[photo].label.toLowerCase()} image`} />
          ) : (
            <span className="share__loading">
              {images[photo] === 'failed' ? "Couldn't draw the image. Try again." : 'Pinning your posters…'}
            </span>
          )}
        </div>
        <div className="share__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={!shot}
            onClick={() => {
              if (!shot) return;
              download(shot);
              onDone('Photo saved');
            }}
          >
            Save photo
          </button>
          {shot && canShareFiles(shot.file) && (
            <button type="button" className="btn btn--ghost" onClick={sharePhoto}>
              Share photo…
            </button>
          )}
        </div>
      </section>

      {/* 3 · Link, X, Facebook */}
      <section className="share__card">
        <h3>Link to your wall</h3>
        <div className="share__row">
          <input readOnly value={link} aria-label="Link to your wall" onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn--ghost btn--small" onClick={copy}>
            Copy
          </button>
        </div>
        <div className="share__social">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() =>
              popup(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`)
            }
          >
            Post on X
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => popup(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)}
          >
            Share on Facebook
          </button>
        </div>
        <p className="share__note">
          {local
            ? 'You are on localhost: links open for others on the deployed site.'
            : 'The link holds your films and ratings, read-only. Share again after changes.'}
        </p>
      </section>
    </div>
  );
}
