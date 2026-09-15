'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from './AuthModal';
import { 
  LogOut, 
  User, 
  ChevronDown, 
  Settings, 
  Keyboard, 
  ExternalLink,
  ShieldCheck,
  Code2
} from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { EditorSettingsModal, EditorSettings } from '@/components/workspace/EditorSettingsModal';
import { UserProfileModal } from '@/components/workspace/UserProfileModal';
import { PublicProfileModal } from '@/components/workspace/PublicProfileModal';
import { KeyboardShortcutsModal } from '@/components/workspace/KeyboardShortcutsModal';
import { applyThemeVariables, ThemeId } from '@/lib/themes';

export interface UserMenuProps {
  onOpenProfileModal?: () => void;
  onOpenSettingsModal?: () => void;
  onOpenShortcutsModal?: () => void;
  onViewPublicProfile?: () => void;
}

const DEFAULT_SETTINGS: EditorSettings = {
  theme: 'dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
};

export function UserMenu({ 
  onOpenProfileModal, 
  onOpenSettingsModal, 
  onOpenShortcutsModal, 
  onViewPublicProfile 
}: UserMenuProps = {}) {
  const { user, loading, signOut } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const menuRef = useRef<HTMLDivElement>(null);

  // Self-contained fallback modals if parent doesn't provide handlers
  const [isLocalProfileOpen, setIsLocalProfileOpen] = useState(false);
  const [isLocalSettingsOpen, setIsLocalSettingsOpen] = useState(false);
  const [isLocalShortcutsOpen, setIsLocalShortcutsOpen] = useState(false);
  const [isLocalPublicProfileOpen, setIsLocalPublicProfileOpen] = useState(false);

  // Local settings instance for fallback modal
  const [localSettings, setLocalSettings] = useState<EditorSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('codecollab_editor_settings');
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateLocalSettings = (newSettings: Partial<EditorSettings>) => {
    setLocalSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('codecollab_editor_settings', JSON.stringify(updated));
        } catch (e) {}
      }
      if (newSettings.theme) {
        applyThemeVariables(newSettings.theme as ThemeId);
      }
      return updated;
    });
  };

  useClickOutside(menuRef, () => setIsDropdownOpen(false), isDropdownOpen);

  if (loading) {
    return (
      <div 
        className="w-28 h-7 animate-pulse rounded border"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setAuthMode('signin');
            setIsAuthModalOpen(true);
          }}
          className="px-2.5 py-1 text-xs font-medium rounded border transition-all hover:opacity-85 shadow-sm"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        >
          Sign In
        </button>
        <button
          onClick={() => {
            setAuthMode('signup');
            setIsAuthModalOpen(true);
          }}
          className="px-2.5 py-1 text-xs font-medium text-white rounded transition-all shadow-sm hover:brightness-110"
          style={{ backgroundColor: 'var(--ide-accent)' }}
        >
          Sign Up
        </button>
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          defaultMode={authMode}
        />
      </div>
    );
  }

  const handleOpenProfile = () => {
    setIsDropdownOpen(false);
    if (onOpenProfileModal) {
      onOpenProfileModal();
    } else {
      setIsLocalProfileOpen(true);
    }
  };

  const handleOpenSettings = () => {
    setIsDropdownOpen(false);
    if (onOpenSettingsModal) {
      onOpenSettingsModal();
    } else {
      setIsLocalSettingsOpen(true);
    }
  };

  const handleOpenShortcuts = () => {
    setIsDropdownOpen(false);
    if (onOpenShortcutsModal) {
      onOpenShortcutsModal();
    } else {
      setIsLocalShortcutsOpen(true);
    }
  };

  const handleViewPublicProfile = () => {
    setIsDropdownOpen(false);
    if (onViewPublicProfile) {
      onViewPublicProfile();
    } else {
      setIsLocalPublicProfileOpen(true);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger Button - Dynamically Themed */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-2.5 py-1 rounded border text-xs font-medium transition-all shadow-sm hover:opacity-90 active:scale-[0.98]"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        title={user.full_name || user.email}
      >
        <div className="relative flex-shrink-0">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm overflow-hidden ring-1 ring-white/10">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || 'User'} className="w-full h-full object-cover" />
            ) : (
              user.full_name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-[var(--ide-card-bg)]" />
        </div>

        <span className="truncate max-w-[130px] font-medium">
          {user.full_name || user.email.split('@')[0]}
        </span>

        <ChevronDown 
          className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--ide-text-muted)' }}
        />
      </button>

      {/* Enhanced Dropdown Menu */}
      {isDropdownOpen && (
        <div 
          className="absolute right-0 mt-2 w-72 rounded-xl border shadow-2xl z-50 p-2 text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 select-none"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        >
          {/* User Header Profile Card */}
          <div 
            className="p-3 rounded-lg border mb-2 flex items-center gap-3"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow ring-2 ring-white/10 overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name || 'User'} className="w-full h-full object-cover" />
                ) : (
                  user.full_name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <span 
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--ide-dock-header)]" 
                title="Online" 
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[13px] truncate" style={{ color: 'var(--ide-text)' }}>
                {user.full_name || 'Anonymous Developer'}
              </div>
              <div className="text-[11px] truncate opacity-75" style={{ color: 'var(--ide-text-muted)' }}>
                {user.email}
              </div>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span 
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    backgroundColor: 'rgba(14, 165, 233, 0.15)',
                    color: 'var(--ide-accent)',
                  }}
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Developer
                </span>
                {user.username && (
                  <span className="text-[10.5px] opacity-60">@{user.username}</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="space-y-0.5">
            {/* 1. View Public Profile */}
            <button
              onClick={handleViewPublicProfile}
              className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-sky-500/10 text-sky-400 group-hover:scale-105 transition-transform">
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium text-[12px]" style={{ color: 'var(--ide-text)' }}>View Public Profile</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>Public developer bio & activity</div>
                </div>
              </div>
            </button>

            {/* 2. Developer Profile & Account Preferences */}
            <button
              onClick={handleOpenProfile}
              className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium text-[12px]" style={{ color: 'var(--ide-text)' }}>Profile & Account</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>Avatar, bio, skills & handles</div>
                </div>
              </div>
            </button>

            {/* 3. Editor & IDE Settings */}
            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Settings className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium text-[12px]" style={{ color: 'var(--ide-text)' }}>Settings</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>Font size, theme & indentation</div>
                </div>
              </div>
              <kbd 
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                style={{
                  borderColor: 'var(--ide-border)',
                  backgroundColor: 'var(--ide-dock-header)',
                  color: 'var(--ide-text-muted)',
                }}
              >
                Ctrl+,
              </kbd>
            </button>

            {/* 4. Keyboard Shortcuts */}
            <button
              onClick={handleOpenShortcuts}
              className="w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                  <Keyboard className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-medium text-[12px]" style={{ color: 'var(--ide-text)' }}>Keyboard Shortcuts</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>Shortcuts & keybindings guide</div>
                </div>
              </div>
              <kbd 
                className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                style={{
                  borderColor: 'var(--ide-border)',
                  backgroundColor: 'var(--ide-dock-header)',
                  color: 'var(--ide-text-muted)',
                }}
              >
                Ctrl+Shift+P
              </kbd>
            </button>
          </div>

          {/* Divider */}
          <div className="my-1.5 border-t" style={{ borderColor: 'var(--ide-border)' }} />

          {/* Sign Out */}
          <button
            onClick={async () => {
              await signOut();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 transition-colors text-left font-medium"
          >
            <div className="p-1.5 rounded-md bg-rose-500/10 text-rose-500">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            <span className="text-[12px]">Sign Out</span>
          </button>
        </div>
      )}

      {/* Embedded Modals if not handled by external parent */}
      {isLocalProfileOpen && user && (
        <UserProfileModal
          isOpen={isLocalProfileOpen}
          onClose={() => setIsLocalProfileOpen(false)}
          currentUser={user}
          settings={localSettings}
          onUpdateSettings={updateLocalSettings}
        />
      )}

      {isLocalSettingsOpen && (
        <EditorSettingsModal
          isOpen={isLocalSettingsOpen}
          onClose={() => setIsLocalSettingsOpen(false)}
          settings={localSettings}
          onUpdateSettings={updateLocalSettings}
        />
      )}

      {isLocalPublicProfileOpen && user && (
        <PublicProfileModal
          isOpen={isLocalPublicProfileOpen}
          userId={user.id}
          currentUserId={user.id}
          onClose={() => setIsLocalPublicProfileOpen(false)}
        />
      )}

      {isLocalShortcutsOpen && (
        <KeyboardShortcutsModal
          isOpen={isLocalShortcutsOpen}
          onClose={() => setIsLocalShortcutsOpen(false)}
        />
      )}
    </div>
  );
}
