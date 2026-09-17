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
  Users,
  Compass
} from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { EditorSettingsModal, EditorSettings } from '@/components/workspace/EditorSettingsModal';
import { UserProfileModal } from '@/components/workspace/UserProfileModal';
import { PublicProfileModal } from '@/components/workspace/PublicProfileModal';
import { KeyboardShortcutsModal } from '@/components/workspace/KeyboardShortcutsModal';
import { applyThemeVariables, ThemeId } from '@/lib/themes';

export interface UserMenuProps {
  onOpenProfileModal?: (tab?: 'profile' | 'preferences' | 'partners' | 'account') => void;
  onOpenPartnersModal?: () => void;
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
  onOpenPartnersModal,
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
  const [localProfileTab, setLocalProfileTab] = useState<'profile' | 'preferences' | 'partners' | 'account'>('profile');
  const [isLocalSettingsOpen, setIsLocalSettingsOpen] = useState(false);
  const [isLocalShortcutsOpen, setIsLocalShortcutsOpen] = useState(false);
  const [isLocalPublicProfileOpen, setIsLocalPublicProfileOpen] = useState(false);

  // Local settings instance for fallback modal
  const [localSettings, setLocalSettings] = useState<EditorSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return DEFAULT_SETTINGS;
  });

  const updateLocalSettings = (newSettings: Partial<EditorSettings>) => {
    setLocalSettings((prev) => {
      const next = { ...prev, ...newSettings };
      if (typeof window !== 'undefined') {
        localStorage.setItem('radiux_editor_settings', JSON.stringify(next));
        if (next.theme) {
          localStorage.setItem('radiux_theme', next.theme);
          applyThemeVariables(next.theme as ThemeId);
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (user && isAuthModalOpen) {
      setIsAuthModalOpen(false);
    }
  }, [user, isAuthModalOpen]);

  useClickOutside(menuRef, () => setIsDropdownOpen(false));

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-neutral-400">
        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
        <span className="hidden sm:inline">Loading...</span>
      </div>
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
          className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
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
      onOpenProfileModal('profile');
    } else {
      setLocalProfileTab('profile');
      setIsLocalProfileOpen(true);
    }
  };

  const handleOpenPartners = () => {
    setIsDropdownOpen(false);
    if (onOpenPartnersModal) {
      onOpenPartnersModal();
    } else if (onOpenProfileModal) {
      onOpenProfileModal('partners');
    } else {
      setLocalProfileTab('partners');
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
    } else if (typeof window !== 'undefined' && user) {
      window.location.href = `/profile/${user.username || user.id}`;
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

      {/* Compact Elegant Dropdown Menu */}
      {isDropdownOpen && (
        <div 
          className="absolute right-0 mt-1.5 w-60 rounded-xl border shadow-2xl z-50 p-1.5 text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-100 select-none"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
            color: 'var(--ide-text)',
          }}
        >
          {/* User Header Profile Card */}
          <div 
            className="p-2 rounded-lg border mb-1.5 flex items-center gap-2.5"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              borderColor: 'var(--ide-border)',
            }}
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow ring-1 ring-white/10 overflow-hidden">
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
              <div className="text-[10px] truncate opacity-70" style={{ color: 'var(--ide-text-muted)' }}>
                {user.email}
              </div>
            </div>
          </div>

          {/* Action Links */}
          <div className="space-y-0.5">
            {/* 1. Public Profile */}
            <button
              onClick={handleViewPublicProfile}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Public Profile</span>
            </button>

            {/* 2. Coding Partners */}
            <button
              onClick={handleOpenPartners}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Coding Partners</span>
            </button>

            {/* 3. Discover Developers */}
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                if (onOpenDiscoveryModal) {
                  onOpenDiscoveryModal();
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/profile/' + (user.username || user.id);
                }
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <Compass className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Discover Developers</span>
            </button>

            {/* 4. Profile & Account */}
            <button
              onClick={handleOpenProfile}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <User className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Profile & Account</span>
            </button>

            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Settings</span>
              </div>
              <kbd 
                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border"
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
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-black/5 dark:hover:bg-white/5 group"
            >
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span className="font-medium text-[11.5px]" style={{ color: 'var(--ide-text)' }}>Shortcuts</span>
              </div>
              <kbd 
                className="px-1.5 py-0.2 rounded text-[9.5px] font-mono border"
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

          {/* Divider */}
          <div className="my-1.5 border-t" style={{ borderColor: 'var(--ide-border)' }} />

          {/* Sign Out */}
          <button
            onClick={() => {
              setIsDropdownOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-left text-rose-400 hover:bg-rose-500/10 font-medium text-[11.5px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      {/* Embedded Modals if not handled by external parent */}
      {isLocalProfileOpen && user && (
        <UserProfileModal
          isOpen={isLocalProfileOpen}
          initialTab={localProfileTab}
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
