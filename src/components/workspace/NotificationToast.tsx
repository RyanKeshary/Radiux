'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Bell, 
  UserPlus, 
  FolderGit2, 
  AtSign, 
  Check, 
  X, 
  Sparkles,
  Users,
  FileCode,
} from 'lucide-react';

export interface NotificationToastItem {
  id: string;
  type: 'partner_request' | 'project_invite' | 'mention' | 'file_event' | 'member_event' | 'system';
  title: string;
  message: string;
  senderName?: string;
  senderAvatar?: string;
  projectId?: string;
  partnerRequestId?: string;
  createdAt?: string;
  durationMs?: number;
}

interface NotificationToastContainerProps {
  toasts: NotificationToastItem[];
  onDismiss: (id: string) => void;
  onAcceptPartner?: (requestId: string, notificationId?: string) => void;
  onDeclinePartner?: (requestId: string, notificationId?: string) => void;
  onOpenCenter?: () => void;
  onOpenTimeline?: () => void;
}

export function NotificationToastContainer({
  toasts,
  onDismiss,
  onAcceptPartner,
  onDeclinePartner,
  onOpenCenter,
  onOpenTimeline,
}: NotificationToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notification Toasts"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 items-end pointer-events-none"
      style={{ maxWidth: '360px', width: '100%' }}
    >
      {toasts.map((toast) => (
        <SingleNotificationToast
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onAccept={() => onAcceptPartner && toast.partnerRequestId && onAcceptPartner(toast.partnerRequestId, toast.id)}
          onDecline={() => onDeclinePartner && toast.partnerRequestId && onDeclinePartner(toast.partnerRequestId, toast.id)}
          onOpenCenter={onOpenCenter}
          onOpenTimeline={onOpenTimeline}
        />
      ))}
    </aside>
  );
}

// ─── Phase types ────────────────────────────────────────────────────────────
type ToastPhase = 'entering' | 'full' | 'bubble' | 'exiting';

// ─── Timing ─────────────────────────────────────────────────────────────────
const ENTER_MS = 350;
const FULL_MS  = 3000;
const BUBBLE_MS = 2000;
const EXIT_MS  = 300;

function SingleNotificationToast({
  toast,
  onDismiss,
  onAccept,
  onDecline,
  onOpenCenter,
  onOpenTimeline,
}: {
  toast: NotificationToastItem;
  onDismiss: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onOpenCenter?: () => void;
  onOpenTimeline?: () => void;
}) {
  const [phase, setPhase] = useState<ToastPhase>('entering');
  const [isPaused, setIsPaused] = useState(false);
  const pausedRef = useRef(false);
  const dismissed = useRef(false);

  // Drag-to-dismiss state
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDeltaX = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleDismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    setPhase('exiting');
    setTimeout(onDismiss, EXIT_MS);
  }, [onDismiss]);

  const handleOpenCenter = useCallback(() => {
    if (onOpenCenter) onOpenCenter();
    handleDismiss();
  }, [onOpenCenter, handleDismiss]);

  // Phase progression timers
  useEffect(() => {
    let enterTimer: ReturnType<typeof setTimeout>;
    let fullTimer: ReturnType<typeof setTimeout>;
    let bubbleTimer: ReturnType<typeof setTimeout>;

    enterTimer = setTimeout(() => {
      setPhase('full');

      // Poll for pause
      let elapsed = 0;
      const pollInterval = 50;
      fullTimer = setInterval(() => {
        if (!pausedRef.current) {
          elapsed += pollInterval;
        }
        if (elapsed >= FULL_MS) {
          clearInterval(fullTimer);
          if (!dismissed.current) setPhase('bubble');

          let bElapsed = 0;
          bubbleTimer = setInterval(() => {
            if (!pausedRef.current) {
              bElapsed += pollInterval;
            }
            if (bElapsed >= BUBBLE_MS) {
              clearInterval(bubbleTimer);
              handleDismiss();
            }
          }, pollInterval) as unknown as ReturnType<typeof setTimeout>;
        }
      }, pollInterval) as unknown as ReturnType<typeof setTimeout>;
    }, ENTER_MS);

    return () => {
      clearTimeout(enterTimer);
      clearInterval(fullTimer);
      clearInterval(bubbleTimer);
    };
  }, [handleDismiss]);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  // ── Drag handling ─────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return; // don't intercept button clicks
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    dragDeltaX.current = 0;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragDeltaX.current = dx;
    setDragOffset(dx);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    const dx = dragDeltaX.current;
    dragStartX.current = null;
    dragDeltaX.current = 0;

    if (Math.abs(dx) > 80) {
      // Swiped enough — dismiss
      setDragOffset(dx > 0 ? 400 : -400);
      setTimeout(handleDismiss, 180);
    } else {
      // Snap back
      setDragOffset(0);
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'partner_request': return <UserPlus className="w-4 h-4 text-purple-400" />;
      case 'project_invite': return <FolderGit2 className="w-4 h-4 text-sky-400" />;
      case 'mention': return <AtSign className="w-4 h-4 text-cyan-400" />;
      case 'member_event': return <Users className="w-4 h-4 text-amber-400" />;
      case 'file_event': return <FileCode className="w-4 h-4 text-emerald-400" />;
      default: return <Bell className="w-4 h-4 text-sky-400" />;
    }
  };

  const getAccentColor = () => {
    switch (toast.type) {
      case 'partner_request': return 'rgba(168,85,247,0.5)';
      case 'project_invite': return 'rgba(56,189,248,0.5)';
      case 'member_event': return 'rgba(251,191,36,0.5)';
      case 'file_event': return 'rgba(52,211,153,0.5)';
      default: return 'rgba(99,102,241,0.4)';
    }
  };

  const getGlowColor = () => {
    switch (toast.type) {
      case 'partner_request': return 'rgba(168,85,247,0.2)';
      case 'project_invite': return 'rgba(56,189,248,0.2)';
      case 'member_event': return 'rgba(251,191,36,0.2)';
      case 'file_event': return 'rgba(52,211,153,0.2)';
      default: return 'rgba(99,102,241,0.15)';
    }
  };

  const isBubble = phase === 'bubble';
  const isExiting = phase === 'exiting';
  const isEntering = phase === 'entering';

  // ── Shared styles ─────────────────────────────────────────────────────────
  const baseStyle: React.CSSProperties = {
    transition: isDragging
      ? 'box-shadow 0.1s'
      : 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease, width 0.4s cubic-bezier(0.34,1.56,0.64,1), height 0.4s cubic-bezier(0.34,1.56,0.64,1), border-radius 0.4s ease, box-shadow 0.3s ease',
    transform: `translateX(${dragOffset}px) translateY(${isEntering ? '30px' : '0px'}) scale(${isExiting ? 0.85 : isEntering ? 0.9 : 1})`,
    opacity: isExiting ? 0 : isEntering ? 0 : 1,
    pointerEvents: isExiting ? 'none' : 'auto',
    cursor: isBubble ? 'pointer' : 'grab',
  };

  // ── BUBBLE phase ──────────────────────────────────────────────────────────
  if (isBubble) {
    return (
      <div
        role="status"
        aria-live="polite"
        onClick={handleOpenCenter}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          ...baseStyle,
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'var(--ide-card-bg)',
          border: `2px solid ${getAccentColor()}`,
          boxShadow: `0 0 18px 4px ${getGlowColor()}, 0 8px 32px rgba(0,0,0,0.5)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
        }}
        title={`${toast.title} — ${toast.message} (click to open)`}
      >
        {/* Pulse ring */}
        <span
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '50%',
            border: `2px solid ${getAccentColor()}`,
            animation: 'radiux-toast-pulse 1.8s ease-out infinite',
            pointerEvents: 'none',
          }}
        />
        {toast.senderAvatar ? (
          <img src={toast.senderAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span>{getIcon()}</span>
        )}
        {/* Tiny unread dot */}
        <span
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            border: '2px solid var(--ide-card-bg)',
          }}
        />
        <style>{`
          @keyframes radiux-toast-pulse {
            0% { opacity: 0.8; transform: scale(1); }
            100% { opacity: 0; transform: scale(1.6); }
          }
        `}</style>
      </div>
    );
  }

  // ── FULL card phase ───────────────────────────────────────────────────────
  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        ...baseStyle,
        width: '100%',
        maxWidth: '340px',
        borderRadius: '14px',
        backgroundColor: 'var(--ide-card-bg)',
        border: `1px solid ${getAccentColor()}`,
        boxShadow: `0 0 24px 2px ${getGlowColor()}, 0 12px 40px rgba(0,0,0,0.55)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Top gradient bar */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '2px',
          background: `linear-gradient(90deg, transparent, ${getAccentColor()}, transparent)`,
        }}
      />

      {/* Shrink progress bar at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0,
          height: '2px',
          width: '100%',
          background: 'rgba(255,255,255,0.06)',
        }}
      >
        <div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${getAccentColor()}, rgba(56,189,248,0.6))`,
            animation: `radiux-shrink ${FULL_MS}ms linear forwards`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>

      <style>{`
        @keyframes radiux-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>

      <div className="p-3.5 flex items-start gap-3">
        {/* Avatar / Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {toast.senderAvatar ? (
            <img
              src={toast.senderAvatar}
              alt=""
              className="w-9 h-9 rounded-full object-cover ring-2"
              style={{ ringColor: getAccentColor() } as any}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${getGlowColor()}, rgba(255,255,255,0.04))`,
                border: `1px solid ${getAccentColor()}`,
              }}
            >
              {getIcon()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
              {toast.title}
            </span>
            <span className="text-[10px] opacity-40 flex-shrink-0">
              {toast.createdAt || 'Just now'}
            </span>
          </div>
          <p className="text-[11.5px] leading-relaxed line-clamp-2" style={{ color: 'var(--ide-text-muted)' }}>
            {toast.message}
          </p>

          {/* Action buttons — only in full phase, only for interactive types */}
          {toast.type === 'partner_request' && toast.partnerRequestId && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); onDismiss(); }}
                className="px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1 transition-colors"
                style={{
                  background: 'rgba(52,211,153,0.2)',
                  border: '1px solid rgba(52,211,153,0.4)',
                  color: '#4ade80',
                }}
              >
                <Check className="w-3 h-3" />
                Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDecline(); onDismiss(); }}
                className="px-2.5 py-1 rounded-md font-medium text-[11px] flex items-center gap-1 transition-colors"
                style={{
                  border: '1px solid var(--ide-border)',
                  color: 'var(--ide-text-muted)',
                }}
              >
                Decline
              </button>
              <span className="text-[10px] opacity-40 ml-auto">drag to dismiss</span>
            </div>
          )}

          {toast.type !== 'partner_request' && (
            <div className="mt-1.5">
              <span className="text-[10px] opacity-30">tap to view · swipe to dismiss</span>
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg opacity-30 hover:opacity-100 transition-all"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" style={{ color: 'var(--ide-text)' }} />
        </button>
      </div>
    </div>
  );
}
