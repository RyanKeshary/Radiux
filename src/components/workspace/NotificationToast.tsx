'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  UserPlus, 
  FolderGit2, 
  AtSign, 
  Check, 
  X, 
  ExternalLink, 
  Sparkles,
  Users,
  FileCode,
  Info
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
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-auto select-none"
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
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.durationMs || 6500;

  useEffect(() => {
    if (isPaused) return;
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, duration, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'partner_request':
        return <UserPlus className="w-4 h-4 text-purple-400" />;
      case 'project_invite':
        return <FolderGit2 className="w-4 h-4 text-sky-400" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-cyan-400" />;
      case 'member_event':
        return <Users className="w-4 h-4 text-amber-400" />;
      case 'file_event':
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-sky-400" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'partner_request':
        return 'rgba(168, 85, 247, 0.4)';
      case 'project_invite':
        return 'rgba(56, 189, 248, 0.4)';
      case 'member_event':
        return 'rgba(251, 191, 36, 0.4)';
      case 'file_event':
        return 'rgba(52, 211, 153, 0.4)';
      default:
        return 'rgba(255, 255, 255, 0.15)';
    }
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden rounded-xl border p-3.5 shadow-2xl backdrop-blur-xl transition-all duration-200 animate-in slide-in-from-bottom-3 fade-in group"
      style={{
        backgroundColor: 'var(--ide-card-bg)',
        borderColor: getBorderColor(),
        color: 'var(--ide-text)',
      }}
    >
      {/* Progress Bar */}
      <div 
        className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 transition-all duration-75"
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-start gap-3">
        {/* Type / Avatar Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {toast.senderAvatar ? (
            <img 
              src={toast.senderAvatar} 
              alt="" 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-purple-500/30" 
            />
          ) : (
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--ide-border)',
              }}
            >
              {getIcon()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
              {toast.title}
            </span>
            <span className="text-[10px] opacity-40 flex-shrink-0">
              {toast.createdAt || 'Just now'}
            </span>
          </div>

          <p className="text-[11.5px] opacity-80 mt-1 line-clamp-2 leading-relaxed">
            {toast.message}
          </p>

          {/* Action Buttons */}
          <div className="mt-2.5 flex items-center gap-2">
            {toast.type === 'partner_request' && toast.partnerRequestId ? (
              <>
                <button
                  onClick={() => {
                    onAccept();
                    onDismiss();
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Accept</span>
                </button>
                <button
                  onClick={() => {
                    onDecline();
                    onDismiss();
                  }}
                  className="px-2.5 py-1 rounded border hover:bg-white/10 text-[11px] font-medium transition-colors"
                  style={{ borderColor: 'var(--ide-border)' }}
                >
                  <span>Decline</span>
                </button>
              </>
            ) : toast.type === 'member_event' || toast.type === 'file_event' ? (
              onOpenTimeline && (
                <button
                  onClick={() => {
                    onOpenTimeline();
                    onDismiss();
                  }}
                  className="px-2 py-0.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 text-[10.5px] font-medium transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  <span>View Timeline</span>
                </button>
              )
            ) : (
              onOpenCenter && (
                <button
                  onClick={() => {
                    onOpenCenter();
                    onDismiss();
                  }}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-[10.5px] font-medium transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  <span>Open Center</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-md opacity-40 hover:opacity-100 hover:bg-white/10 transition-all text-neutral-400 hover:text-white"
          title="Dismiss notification"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
