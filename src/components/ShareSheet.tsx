import { useEffect, useMemo, useState } from 'react';
import { FORMATS, renderCollage, type CollageFormat } from '../lib/collage';
import { encodeWall, isLocalOrigin, shareUrl } from '../lib/shareLink';
import type { WallMovie, WallState } from '../lib/storage';

type Props = {
  wall: WallState;
  /** The wall in its displayed order (used for the link and the full-wall image). */
  ordered: WallMovie[];
  onDone: (message: string) => void;
};

const fileName = (name: string, format: CollageFormat) =>
  `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'my'}-poster-wall-${format}.jpg`;

export function ShareSheet({ wall, ordered, onDone }: Props) {
  const [format, setFormat] = useState<CollageFormat>('story');
  const [image, setImage] = useState<{ blob: Blob; url: string; format: CollageFormat } | null>(null);
  const [error, setError] = useState('');
  const local = isLocalOrigin();

  const link = useMemo(() => shareUrl(encodeWall(wall, ordered)), [wall, ordered]);
  const text = `${wall.profile.name.trim() ? `${wall.profile.name.trim()}'s` : 'My'} poster wall: ${wall.movies.length} films, sized by how much I loved them.`;

  useEffect(() => {
    let alive = true;
    let url = '';
    setError('');
    renderCollage(format, {
      profile: wall.profile,
      movies: ordered,
      seed: wall.seed,
      siteHost: local ? null : location.host,
    })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url, format });
      })
      .catch(() => alive && setError("Couldn't draw the image. Check your connection and try again."));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [format, wall.profile, wall.seed, ordered, local]);

  const ready = image?.format === format ? image : null;
  const file = ready ? new File([ready.blob], fileName(wall.profile.name, format), { type: 'image/jpeg' }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  const save = () => {
    if (!ready || !file) return;
    const a = document.createElement('a');
    a.href = ready.url;
    a.download = file.name;
    a.click();
    onDone('Photo saved');
  };

  const shareFile = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'My poster wall', text });
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

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer,width=640,height=640');

  return (
    <div className="share">
      <h2 className="add__heading">
        Show off your <em>wall.</em>
      </h2>

      <div className="segmented" role="radiogroup" aria-label="Image format">
        {(Object.keys(FORMATS) as CollageFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={format === f}
            className={format === f ? 'is-on' : ''}
            onClick={() => setFormat(f)}
          >
            {FORMATS[f].label}
          </button>
        ))}
      </div>
      <p className="share__hint">{FORMATS[format].hint}</p>

      <div className={`share__preview share__preview--${format}`}>
        {ready ? (
          <img src={ready.url} alt={`Preview of your ${FORMATS[format].label.toLowerCase()} image`} />
        ) : (
          <span className="share__loading">{error || 'Pinning your posters…'}</span>
        )}
      </div>

      <div className="share__actions">
        <button type="button" className="btn btn--accent" onClick={save} disabled={!ready}>
          Save photo
        </button>
        {canShareFile && (
          <button type="button" className="btn btn--ghost" onClick={shareFile} disabled={!ready}>
            Share…
          </button>
        )}
      </div>
      <p className="share__note">
        For an Instagram story, save the <b>Story</b> photo and add it from the Instagram app.
      </p>

      <div className="share__link">
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
              open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`)
            }
          >
            Post on X
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`)}
          >
            Share on Facebook
          </button>
        </div>
        <p className="share__note">
          {local
            ? 'You are on localhost: links open for others on the deployed site.'
            : 'The link holds your films and ratings, read-only. It updates only when you share again.'}
        </p>
      </div>
    </div>
  );
}
