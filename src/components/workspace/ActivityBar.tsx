'use client';

import React from 'react';
import { 
  Files, 
  Search, 
  GitBranch, 
  MonitorPlay, 
  Users, 
  Settings, 
  Keyboard, 
  User,
  MessageSquare,
  Mic,
  Blocks,
  FileCode2,
  Share2,
  GitPullRequest,
  Sparkles,
} from 'lucide-react';


export type ActivityView = 'explorer' | 'search' | 'git' | 'chat' | 'voice' | 'preview' | 'collaborators' | 'extensions' | 'comments';

interface ActivityBarProps {
  activeView: ActivityView | null;
  onSelectView: (view: ActivityView) => void;
  collaboratorCount?: number;
  gitChangedCount?: number;
  unreadChatCount?: number;
  isInVoice?: boolean;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenProfile: () => void;
  onOpenIntegrations?: () => void;
  onOpenReviews?: () => void;
  onToggleAI?: () => void;
  isAIOpen?: boolean;
  userAvatar?: string;
  userName?: string;
}


export function ActivityBar({
  activeView,
  onSelectView,
  collaboratorCount = 0,
  gitChangedCount = 0,
  unreadChatCount = 0,
  isInVoice = false,
  onOpenSettings,
  onOpenShortcuts,
  onOpenProfile,
  onOpenIntegrations,
  onOpenReviews,
  onToggleAI,
  isAIOpen,
  userAvatar,
  userName = 'User',
}: ActivityBarProps) {

  const navItems: { id: ActivityView; label: string; icon: React.ReactNode; shortcut: string; badge?: number; indicator?: boolean }[] = [
    {
      id: 'explorer',
      label: 'Explorer',
      icon: <Files className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+E',
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Search className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+F',
    },
    {
      id: 'git',
      label: 'Source Control & GitHub',
      icon: <GitBranch className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+G',
      badge: gitChangedCount > 0 ? gitChangedCount : undefined,
    },
    {
      id: 'comments',
      label: 'Code Comments & Reviews',
      icon: <FileCode2 className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+M',
    },
    {
      id: 'chat',
      label: 'Project Chat',
      icon: <MessageSquare className="w-5 h-5" />,
      shortcut: 'Ctrl+Alt+C',
      badge: unreadChatCount > 0 ? unreadChatCount : undefined,
    },
    {
      id: 'voice',
      label: 'Voice Channel',
      icon: <Mic className={`w-5 h-5 ${isInVoice ? 'text-emerald-400 animate-pulse' : ''}`} />,
      shortcut: '',
      indicator: isInVoice,
    },
    {
      id: 'collaborators',
      label: 'Collaborators & Presence',
      icon: <Users className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+C',
      badge: collaboratorCount > 1 ? collaboratorCount : undefined,
    },
    {
      id: 'extensions',
      label: 'Extensions & Plugins',
      icon: <Blocks className="w-5 h-5" />,
      shortcut: 'Ctrl+Shift+X',
    },
  ];

  return (
    <aside 
      className="w-12 h-full flex flex-col justify-between items-center py-2 select-none z-30 border-r"
      style={{
        backgroundColor: 'var(--ide-activity)',
        borderColor: 'var(--ide-border)',
      }}
      aria-label="Activity Bar"
    >
      {/* Primary Navigation Views */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* AI Coding Agent Trigger */}
        {onToggleAI && (
          <button
            onClick={onToggleAI}
            className={`relative w-10 h-10 flex items-center justify-center rounded transition-all mb-1 ${
              isAIOpen
                ? 'bg-sky-500/20 text-sky-400 font-semibold border border-sky-500/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="AI Coding Agent (Ctrl+I)"
            aria-label="AI Coding Agent"
          >
            <Sparkles className="w-5 h-5 text-sky-400" />
            {isAIOpen && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-sky-400 rounded-r" />
            )}
          </button>
        )}

        {navItems.map((item) => {

          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative w-10 h-10 flex items-center justify-center rounded transition-all group ${
                isActive
                  ? 'opacity-100 font-semibold'
                  : 'opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
              style={{
                color: isActive ? 'var(--ide-accent)' : 'var(--ide-text)',
              }}
              title={`${item.label} (${item.shortcut})`}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <span 
                  className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r"
                  style={{ backgroundColor: 'var(--ide-accent)' }} 
                />
              )}

              {item.icon}

              {/* Badge */}
              {item.badge !== undefined && (
                <span 
                  className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 text-[9px] font-bold text-white rounded-full flex items-center justify-center leading-none"
                  style={{ backgroundColor: 'var(--ide-accent)' }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Utility Actions */}
      <div className="flex flex-col items-center gap-1 w-full" style={{ color: 'var(--ide-text)' }}>
        {/* Keyboard Shortcuts */}
        <button
          onClick={onOpenShortcuts}
          className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          title="Keyboard Shortcuts (Ctrl+K Ctrl+S)"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard className="w-5 h-5" />
        </button>

        {/* Review Requests */}
        {onOpenReviews && (
          <button
            onClick={onOpenReviews}
            className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            title="Peer Code Review Requests"
            aria-label="Code Reviews"
          >
            <GitPullRequest className="w-5 h-5 text-sky-400" />
          </button>
        )}

        {/* Platform Integrations */}
        {onOpenIntegrations && (
          <button
            onClick={onOpenIntegrations}
            className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
            title="Integrations (GitHub, GitLab, Slack, Linear...)"
            aria-label="Integrations"
          >
            <Share2 className="w-5 h-5 text-violet-400" />
          </button>
        )}

        {/* IDE Preferences & Settings */}
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all"
          title="IDE Settings (Ctrl+,)"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User Account / Profile */}
        <button
          onClick={onOpenProfile}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all mt-1"
          title={`Developer Profile: ${userName}`}
          aria-label="Developer Profile"
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={userName}
              className="w-6 h-6 rounded-full ring-1 ring-neutral-500 object-cover"
            />
          ) : (
            <div 
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white uppercase"
              style={{ backgroundColor: 'var(--ide-accent)' }}
            >
              {userName.charAt(0) || <User className="w-3.5 h-3.5" />}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
