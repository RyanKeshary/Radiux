'use client';

import React, { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick?: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
}

export function ContextMenu({
  x,
  y,
  isOpen,
  onClose,
  items,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Clamping to screen boundaries
  const menuWidth = 190;
  const menuHeight = items.length * 30 + 16;
  const clampedX = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - menuWidth - 8) : x;
  const clampedY = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - menuHeight - 8) : y;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-xl border shadow-2xl p-1.5 min-w-[190px] text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: clampedX,
        top: clampedY,
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: 'var(--ide-border)',
        color: 'var(--ide-text)',
      }}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return (
            <div
              key={`div-${idx}`}
              className="my-1 border-t"
              style={{ borderColor: 'var(--ide-border)' }}
            />
          );
        }

        return (
          <button
            key={item.id || idx}
            disabled={item.disabled}
            onClick={() => {
              if (item.onClick) item.onClick();
              onClose();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors text-[11.5px] ${
              item.disabled
                ? 'opacity-40 cursor-not-allowed'
                : item.danger
                ? 'hover:bg-rose-500/10 text-rose-500 dark:text-rose-400'
                : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.icon && <span className="opacity-80 flex-shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </div>

            {item.shortcut && (
              <span className="text-[10px] font-mono opacity-50 ml-3 flex-shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
