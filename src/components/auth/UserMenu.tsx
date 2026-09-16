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
  Code2,
  Users
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
  onOpenDiscoveryModal?: () => void;
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
  onViewPublicProfile,
  onOpenDiscoveryModal
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

      {/* Enhanced Compact Dropdown Menu */}
      {isDropdownOpen && (
        <div 
          className="absolute right-0 mt-1.5 w-60 rounded-xl border shadow-2xl z-50 p-1.5 text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-150 select-none"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        >
          {/* User Header Profile Card */}
          <div 
            className="p-2.5 rounded-lg border mb-1.5 flex items-center gap-2.5"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow ring-1 ring-white/15 overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name || 'User'} className="w-full h-full object-cover" />
                ) : (
                  user.full_name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <span 
                className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-[var(--ide-dock-header)]" 
                title="Online" 
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
                {user.full_name || 'Anonymous Developer'}
              </div>
              <div className="text-[10.5px] truncate opacity-60 font-mono" style={{ color: 'var(--ide-text-muted)' }}>
                @{user.username || user.email.split('@')[0]}
              </div>
            </div>
          </div>

          {/* Action Links - Sleek Single Line */}
          <div className="space-y-0.5">
            <button
              onClick={handleViewPublicProfile}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span className="font-medium text-xs truncate">Public Profile</span>
            </button>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                if (onOpenDiscoveryModal) {
                  onOpenDiscoveryModal();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/profile/' + (user.username || user.id);
                }
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-medium text-xs truncate">Discover Developers</span>
            </button>

            <button
              onClick={handleOpenProfile}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <User className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="font-medium text-xs truncate">Profile & Banner</span>
            </button>

            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Settings className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span className="font-medium text-xs truncate">IDE Settings</span>
              </div>
              <kbd 
                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border opacity-60"
                style={{
                  borderColor: 'var(--ide-border)',
                  backgroundColor: 'var(--ide-dock-header)',
                  color: 'var(--ide-text-muted)',
                }}
              >
                Ctrl+,
              </kbd>
            </button>

            <button
              onClick={handleOpenShortcuts}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Keyboard className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="font-medium text-xs truncate">Shortcuts</span>
              </div>
              <kbd 
                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border opacity-60"
                style={{
                  borderColor: 'var(--ide-border)',
                  backgroundColor: 'var(--ide-dock-header)',
                  color: 'var(--ide-text-muted)',
                }}
              >
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="my-1 border-t" style={{ borderColor: 'var(--ide-border)' }} />

          {/* Sign Out */}
          <button
            onClick={() => {
              setIsDropdownOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors text-left font-medium text-xs"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Sign Out</span>
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
