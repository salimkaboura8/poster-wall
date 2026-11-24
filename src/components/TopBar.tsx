import { useEffect, useRef, useState, type ReactNode } from 'react';

export type ToolAction = {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
};

type Props = {
  brand: ReactNode;
  tools: ToolAction[];
  onShare: () => void;
  canShare: boolean;
};

/**
 * Wide screens: every tool in one glass pill. Phones: the brand, Share and a "⋯" menu,
 * so the bar always stays on one line.
 */
export function TopBar({ brand, tools, onShare, canShare }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const share = (
    <button type="button" className="tool tool--share" disabled={!canShare} onClick={onShare}>
      Share
    </button>
  );

  return (
    <nav className="topbar" aria-label="Wall tools">
      {brand}

      <div className="tools tools--full">
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            className="tool"
            disabled={t.disabled}
            aria-pressed={t.pressed}
            onClick={t.onClick}
          >
            {t.label}
          </button>
        ))}
        {share}
      </div>

      <div className="tools tools--compact">
        {share}
        <button
          ref={buttonRef}
          type="button"
          className="tool tool--more"
          aria-label="More tools"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="5" cy="12" r="1.9" fill="currentColor" />
            <circle cx="12" cy="12" r="1.9" fill="currentColor" />
            <circle cx="19" cy="12" r="1.9" fill="currentColor" />
          </svg>
        </button>
        {open && (
          <div ref={menuRef} className="menu" role="menu" aria-label="Wall tools">
            {tools.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitem"
                disabled={t.disabled}
                onClick={() => {
                  setOpen(false);
                  t.onClick();
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
