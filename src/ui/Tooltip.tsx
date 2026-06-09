import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

interface Pos {
  left: number;
  top: number;
}

const GAP = 10;
const MARGIN = 8;

/**
 * Hover/focus tooltip. The card is rendered in a body portal with position:fixed
 * and clamped to the viewport with edge-flip, so it is never clipped by scroll or
 * overflow:hidden containers.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ left: -9999, top: -9999 });

  const place = useCallback(() => {
    const a = anchorRef.current;
    const c = cardRef.current;
    if (!a || !c) return;
    const ar = a.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer above the anchor; flip below if it would clip the top.
    let top = ar.top - cr.height - GAP;
    if (top < MARGIN) top = ar.bottom + GAP;
    // Clamp to bottom too (small viewports).
    if (top + cr.height > vh - MARGIN) top = Math.max(MARGIN, vh - MARGIN - cr.height);

    // Center horizontally on the anchor, clamped to the viewport.
    let left = ar.left + ar.width / 2 - cr.width / 2;
    left = Math.max(MARGIN, Math.min(left, vw - MARGIN - cr.width));

    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, place]);

  return (
    <span
      ref={anchorRef}
      className={`tip-anchor ${className ?? ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open &&
        createPortal(
          <div className="tip-card" ref={cardRef} style={{ left: pos.left, top: pos.top }} role="tooltip">
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
