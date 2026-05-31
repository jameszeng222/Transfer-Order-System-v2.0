import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  maxWidth?: number;
}

export function Tooltip({ content, children, maxWidth = 240 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - maxWidth - 12),
    });
  }, [visible, maxWidth]);

  useEffect(() => {
    if (!visible) return;
    const handle = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="cursor-default"
      >
        {children}
      </span>
      {visible && pos && (
        <div
          ref={panelRef}
          className="fixed z-[100] bg-bg-card border border-border rounded-lg shadow-xl px-3 py-2 text-[12px] text-text-primary max-h-[280px] overflow-y-auto"
          style={{ top: pos.top, left: pos.left, maxWidth }}
        >
          {content}
        </div>
      )}
    </>
  );
}
