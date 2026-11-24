import { useRef } from 'react';
import type { Profile } from '../lib/storage';
import { fileToAvatar } from '../lib/storage';

type Props = {
  profile: Profile;
  count: number;
  onChange: (p: Profile) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '★';
}

export function ProfileHeader({ profile, count, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickAvatar(file: File | undefined) {
    if (!file) return;
    try {
      onChange({ ...profile, avatar: await fileToAvatar(file) });
    } catch {
      /* not an image: ignore */
    }
  }

  return (
    <header className="profile">
      <button
        type="button"
        className="avatar"
        onClick={() => fileRef.current?.click()}
        aria-label={profile.avatar ? 'Change profile photo' : 'Add a profile photo'}
      >
        {profile.avatar ? (
          <img src={profile.avatar} alt="" />
        ) : (
          <span className="avatar__initials" aria-hidden="true">
            {initials(profile.name)}
          </span>
        )}
        <span className="avatar__edit" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15">
            <path
              d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.3-1.8h5.8L16.2 6h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
            <circle cx="12" cy="12.4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pickAvatar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="profile__text">
        <p className="eyebrow">the wall of</p>
        <input
          className="profile__name"
          value={profile.name}
          placeholder="Your name"
          maxLength={40}
          spellCheck={false}
          aria-label="Your name"
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
        />
        <p className="profile__count">
          <span className="count-num">{count}</span>{' '}
          <em>{count === 1 ? 'poster pinned' : 'posters pinned'}</em>
        </p>
      </div>
    </header>
  );
}
