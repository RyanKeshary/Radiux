'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, CodingPartner } from '@/lib/types';
import { THEMES, ThemeId } from '@/lib/themes';
import { EditorSettings } from './EditorSettingsModal';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  User, 
  Shield, 
  Palette, 
  Users, 
  Settings as SettingsIcon,
  Check, 
  Loader2, 
  Plus, 
  Trash2, 
  UserPlus, 
  CheckCheck,
  Github,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  initialTab?: 'profile' | 'preferences' | 'partners' | 'account';
}

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onProfileUpdated,
  initialTab = 'profile',
}: UserProfileModalProps) {
  const { updateCurrentUserProfile, linkIdentity } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'partners' | 'account'>(initialTab);

  // Profile fields
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [username, setUsername] = useState(currentUser.username || currentUser.email.split('@')[0]);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [githubUser, setGithubUser] = useState(currentUser.github_username || '');
  const [skills, setSkills] = useState<string[]>(currentUser.skills || ['TypeScript', 'React', 'Node.js']);
  const [skillInput, setSkillInput] = useState('');
  const [languages, setLanguages] = useState<string[]>(currentUser.languages || ['JavaScript', 'TypeScript', 'Python']);
  const [langInput, setLangInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<'google' | 'github' | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Coding Partners
  const [partners, setPartners] = useState<CodingPartner[]>([]);
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [partnerMessage, setPartnerMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loadingPartners, setLoadingPartners] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      setFullName(currentUser.full_name || '');
      setUsername(currentUser.username || currentUser.email.split('@')[0]);
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatar_url || '');
      setGithubUser(currentUser.github_username || '');
      setSkills(currentUser.skills || ['TypeScript', 'React', 'Node.js']);
      setLanguages(currentUser.languages || ['JavaScript', 'TypeScript', 'Python']);

      // Load coding partners
      setLoadingPartners(true);
      DataService.getCodingPartners(currentUser.id).then((list) => {
        setPartners(list);
        setLoadingPartners(false);
      });
    }
  }, [isOpen, initialTab, currentUser]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = {
        full_name: fullName,
        username,
        bio,
        avatar_url: avatarUrl,
        github_username: githubUser,
        skills,
        languages,
      };
      const updated = await DataService.updateProfile(currentUser.id, updates);
      // Also sync to AuthContext so header/avatar update immediately
      try { await updateCurrentUserProfile(updates); } catch (e) {}
      if (onProfileUpdated) onProfileUpdated(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const handleAddLang = () => {
    if (langInput.trim() && !languages.includes(langInput.trim())) {
      setLanguages([...languages, langInput.trim()]);
      setLangInput('');
    }
  };

  const handleSendPartnerRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerInput.trim()) return;
    const res = await DataService.sendPartnerRequest(currentUser, newPartnerInput.trim());
    setPartnerMessage({ text: res.message, success: res.success });
    if (res.success && res.partner) {
      setPartners(prev => [res.partner!, ...prev]);
      setNewPartnerInput('');
    }
    setTimeout(() => setPartnerMessage(null), 3000);
  };

  const handleAcceptPartner = async (partnerId: string) => {
    await DataService.respondToPartnerRequest(partnerId, true);
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, status: 'accepted' } : p));
  };

  const handleDeclinePartner = async (partnerId: string) => {
    await DataService.respondToPartnerRequest(partnerId, false);
    setPartners(prev => prev.filter(p => p.id !== partnerId));
  };

  const handleRemovePartner = async (partnerId: string, partnerName: string) => {
    const ok = window.confirm(`Remove ${partnerName} as a coding partner? This cannot be undone.`);
    if (!ok) return;
    await DataService.removePartner(partnerId);
    setPartners(prev => prev.filter(p => p.id !== partnerId));
  };

  const handleUnsendPartner = async (partnerId: string) => {
    const ok = window.confirm('Cancel this pending partner request?');
    if (!ok) return;
    const res = await DataService.unsendPartnerRequest(partnerId);
    setPartners(prev => prev.filter(p => p.id !== partnerId));
    setPartnerMessage({ text: res.message, success: true });
    setTimeout(() => setPartnerMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="w-full max-w-2xl max-h-[85vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Modal Header */}
        <div 
          className="px-5 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <div className="flex items-center gap-2">
            {activeTab === 'partners' && <Users className="w-4 h-4 text-emerald-400" />}
            {activeTab === 'profile' && <User className="w-4 h-4 text-sky-400" />}
            {activeTab === 'account' && <Shield className="w-4 h-4 text-amber-400" />}
            {activeTab === 'preferences' && <Palette className="w-4 h-4 text-pink-400" />}
            <span className="text-sm font-semibold" style={{ color: 'var(--ide-text)' }}>
              {activeTab === 'partners' && 'Coding Partners & Collaborators'}
              {activeTab === 'profile' && 'Developer Profile & Identity'}
              {activeTab === 'account' && 'Account Credentials & Security'}
              {activeTab === 'preferences' && 'IDE Themes & Preferences'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div 
          className="flex items-center px-4 border-b gap-2"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-sky-500 font-semibold'
                : 'border-transparent hover:opacity-80'
            }`}
            style={{
              color: activeTab === 'profile' ? 'var(--ide-accent)' : 'var(--ide-text-muted)',
            }}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'preferences'
                ? 'border-sky-500 font-semibold'
                : 'border-transparent hover:opacity-80'
            }`}
            style={{
              color: activeTab === 'preferences' ? 'var(--ide-accent)' : 'var(--ide-text-muted)',
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>IDE Themes & Preferences</span>
          </button>

          <button
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'partners'
                ? 'border-sky-500 font-semibold'
                : 'border-transparent hover:opacity-80'
            }`}
            style={{
              color: activeTab === 'partners' ? 'var(--ide-accent)' : 'var(--ide-text-muted)',
            }}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Coding Partners ({partners.filter(p => p.status === 'accepted').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'account'
                ? 'border-sky-500 font-semibold'
                : 'border-transparent hover:opacity-80'
            }`}
            style={{
              color: activeTab === 'account' ? 'var(--ide-accent)' : 'var(--ide-text-muted)',
            }}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 1. Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4 pb-2">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full ring-2 ring-sky-500 object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-sky-600 flex items-center justify-center text-lg font-bold text-white uppercase">
                    {fullName.charAt(0) || 'U'}
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Avatar Image URL</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Display Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Username Handle</label>
                  <div 
                    className="flex items-center border rounded overflow-hidden"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                    }}
                  >
                    <span className="px-2" style={{ color: 'var(--ide-text-muted)' }}>@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      className="w-full bg-transparent py-1.5 pr-2 text-xs focus:outline-none"
                      style={{ color: 'var(--ide-text)' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Bio / Developer Headline</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Full Stack Software Engineer building collaborative tools..."
                  className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500 resize-none"
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                    color: 'var(--ide-text)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Programming Languages */}
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Primary Programming Languages</label>
                  <div className="flex gap-1 mb-2">
                    <input
                      type="text"
                      value={langInput}
                      onChange={(e) => setLangInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLang(); } }}
                      placeholder="e.g. Python, Rust..."
                      className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddLang}
                      className="px-2 py-1 border rounded"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {languages.map(lang => (
                      <span key={lang} className="flex items-center gap-1 bg-sky-500/15 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-[11px]">
                        <span>{lang}</span>
                        <button type="button" onClick={() => setLanguages(languages.filter(l => l !== lang))} className="hover:opacity-80">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills & Frameworks */}
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Skills & Frameworks</label>
                  <div className="flex gap-1 mb-2">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                      placeholder="e.g. React, Next.js, Docker..."
                      className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:border-sky-500"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddSkill}
                      className="px-2 py-1 border rounded"
                      style={{
                        backgroundColor: 'var(--ide-card-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {skills.map(skill => (
                      <span key={skill} className="flex items-center gap-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[11px]">
                        <span>{skill}</span>
                        <button type="button" onClick={() => setSkills(skills.filter(s => s !== skill))} className="hover:opacity-80">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>GitHub Username</label>
                <div 
                  className="flex items-center border rounded overflow-hidden"
                  style={{
                    backgroundColor: 'var(--ide-input-bg)',
                    borderColor: 'var(--ide-border)',
                  }}
                >
                  <span className="px-2 flex items-center gap-1" style={{ color: 'var(--ide-text-muted)' }}>
                    <Github className="w-3 h-3" /> github.com/
                  </span>
                  <input
                    type="text"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="your-github-handle"
                    className="w-full bg-transparent py-1.5 pr-2 text-xs focus:outline-none"
                    style={{ color: 'var(--ide-text)' }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                {savedSuccess ? (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" /> Profile updated successfully!
                  </span>
                ) : <span />}

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}

          {/* 2. Preferences Tab: 8 Themes + Editor Settings */}
          {activeTab === 'preferences' && (
            <div className="space-y-5">
              <div>
                <label className="block font-semibold text-xs mb-2" style={{ color: 'var(--ide-text)' }}>IDE Color Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
                    const t = THEMES[tId];
                    const isSelected = (settings.theme as string) === tId || (tId === 'dark' && (settings.theme as string) === 'vs-dark');
                    return (
                      <div
                        key={tId}
                        onClick={() => onUpdateSettings({ theme: tId })}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'ring-2 ring-sky-500 border-sky-500 bg-sky-500/10'
                            : 'hover:border-sky-400'
                        }`}
                        style={{
                          backgroundColor: isSelected ? undefined : 'var(--ide-card-bg)',
                          borderColor: isSelected ? undefined : 'var(--ide-border)',
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-semibold truncate text-[11.5px]" style={{ color: 'var(--ide-text)' }}>{t.name}</span>
                          {isSelected && <Check className="w-3 h-3 text-sky-400 flex-shrink-0" />}
                        </div>
                        {/* Swatch preview */}
                        <div className="flex items-center gap-1 h-3 rounded overflow-hidden border" style={{ borderColor: 'var(--ide-border)' }}>
                          <span className="w-1/3 h-full" style={{ backgroundColor: t.colors.bg }} />
                          <span className="w-1/3 h-full" style={{ backgroundColor: t.colors.sidebar }} />
                          <span className="w-1/3 h-full" style={{ backgroundColor: t.colors.accent }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t pt-4 grid grid-cols-2 gap-4" style={{ borderColor: 'var(--ide-border)' }}>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Editor Font Size</label>
                  <input
                    type="number"
                    min={10}
                    max={32}
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Tab Indent Size</label>
                  <select
                    value={settings.tabSize}
                    onChange={(e) => onUpdateSettings({ tabSize: Number(e.target.value) })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  >
                    <option value={2}>2 Spaces</option>
                    <option value={4}>4 Spaces</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] mb-1" style={{ color: 'var(--ide-text-muted)' }}>Word Wrap</label>
                  <select
                    value={settings.wordWrap}
                    onChange={(e) => onUpdateSettings({ wordWrap: e.target.value as 'on' | 'off' })}
                    className="w-full border rounded px-2.5 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  >
                    <option value="off">Off (Horizontal Scroll)</option>
                    <option value="on">On (Wrap Lines)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div>
                    <span className="font-medium" style={{ color: 'var(--ide-text)' }}>Code Minimap</span>
                    <p className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>Show overview on editor right</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.minimap}
                    onChange={(e) => onUpdateSettings({ minimap: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Network / Coding Partners Tab */}
          {activeTab === 'partners' && (
            <div className="space-y-5">
              {/* ── Send Request ─── */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(99,102,241,0.06))',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <p className="font-semibold mb-0.5" style={{ color: 'var(--ide-text)' }}>Add a Coding Partner</p>
                <p className="text-[11px] mb-3" style={{ color: 'var(--ide-text-muted)' }}>
                  Connect with developers to quickly invite them to projects and co-edit in real time.
                </p>
                <form onSubmit={handleSendPartnerRequest} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newPartnerInput}
                    onChange={(e) => setNewPartnerInput(e.target.value)}
                    placeholder="Email or @username..."
                    className="flex-1 border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                </form>
                {partnerMessage && (
                  <p className={`text-[11px] mt-2 font-medium ${partnerMessage.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {partnerMessage.text}
                  </p>
                )}
              </div>

              {loadingPartners ? (
                <div className="py-6 flex items-center justify-center gap-2" style={{ color: 'var(--ide-text-muted)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading your network...</span>
                </div>
              ) : (
                <>
                  {/* ── Incoming requests section ─── */}
                  {partners.filter(p => p.status === 'pending' && p.receiver_id === currentUser.id).length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>
                          Incoming Requests ({partners.filter(p => p.status === 'pending' && p.receiver_id === currentUser.id).length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {partners.filter(p => p.status === 'pending' && p.receiver_id === currentUser.id).map(p => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 rounded-xl border"
                            style={{ backgroundColor: 'rgba(251,191,36,0.05)', borderColor: 'rgba(251,191,36,0.25)' }}
                          >
                            <div className="flex items-center gap-2.5">
                              {p.profile?.avatar_url ? (
                                <img src={p.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-400/40" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center font-bold text-white uppercase text-sm">
                                  {(p.profile?.full_name || 'U').charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-xs" style={{ color: 'var(--ide-text)' }}>{p.profile?.full_name || 'Developer'}</p>
                                <p className="text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>@{p.profile?.username || p.profile?.email?.split('@')[0]}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleAcceptPartner(p.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-medium transition-colors"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclinePartner(p.id)}
                                className="px-2.5 py-1 border rounded-lg text-[11px] font-medium transition-colors"
                                style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text-muted)' }}
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Outgoing pending ─── */}
                  {partners.filter(p => p.status === 'pending' && p.requester_id === currentUser.id).length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>
                          Pending ({partners.filter(p => p.status === 'pending' && p.requester_id === currentUser.id).length})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {partners.filter(p => p.status === 'pending' && p.requester_id === currentUser.id).map(p => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border"
                            style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                          >
                            <div className="flex items-center gap-2">
                              {p.profile?.avatar_url ? (
                                <img src={p.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover opacity-70" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-neutral-600 flex items-center justify-center font-bold text-neutral-300 uppercase text-xs">
                                  {(p.profile?.full_name || 'U').charAt(0)}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-[11px]" style={{ color: 'var(--ide-text)' }}>{p.profile?.full_name || 'Developer'}</p>
                                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">Request Sent</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnsendPartner(p.id)}
                              className="text-[10.5px] text-rose-400 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors font-medium"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Accepted Partners — LinkedIn-style grid ─── */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>
                        Coding Partners ({partners.filter(p => p.status === 'accepted').length})
                      </span>
                    </div>

                    {partners.filter(p => p.status === 'accepted').length === 0 ? (
                      <div className="py-8 text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: 'var(--ide-text-muted)' }} />
                        <p className="text-[11px] italic" style={{ color: 'var(--ide-text-muted)' }}>No accepted partners yet. Send a connection request above!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {partners.filter(p => p.status === 'accepted').map(p => (
                          <div
                            key={p.id}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl border text-center group hover:border-emerald-500/40 transition-all"
                            style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                          >
                            {/* Avatar */}
                            <div className="relative">
                              {p.profile?.avatar_url ? (
                                <img
                                  src={p.profile.avatar_url}
                                  alt=""
                                  className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white uppercase text-lg"
                                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}
                                >
                                  {(p.profile?.full_name || 'U').charAt(0)}
                                </div>
                              )}
                              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[var(--ide-card-bg)]" />
                            </div>

                            {/* Info */}
                            <div className="min-w-0 w-full">
                              <p className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>{p.profile?.full_name || 'Developer'}</p>
                              <p className="text-[10px] truncate" style={{ color: 'var(--ide-text-muted)' }}>@{p.profile?.username || p.profile?.email?.split('@')[0]}</p>
                              {p.profile?.skills && p.profile.skills.length > 0 && (
                                <p className="text-[9.5px] mt-0.5 truncate" style={{ color: 'var(--ide-text-muted)' }}>
                                  {p.profile.skills.slice(0, 2).join(' · ')}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <button
                              onClick={() => handleRemovePartner(p.id, p.profile?.full_name || 'this partner')}
                              className="w-full text-[10px] py-1 rounded-lg border transition-colors opacity-0 group-hover:opacity-100"
                              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', background: 'rgba(239,68,68,0.07)' }}
                              title="Remove coding partner"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}


          {/* 4. Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              {linkError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {linkError}
                </div>
              )}

              {/* Account Credentials */}
              <div 
                className="p-3 rounded-lg border space-y-2 text-xs"
                style={{
                  backgroundColor: 'var(--ide-dock-header)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Registered Email</span>
                  <span className="font-mono text-white font-medium">{currentUser.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Account ID</span>
                  <span className="font-mono text-[10.5px] opacity-75">{currentUser.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Member Since</span>
                  <span style={{ color: 'var(--ide-text)' }}>
                    {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Active Developer'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span style={{ color: 'var(--ide-text-muted)' }}>Authentication Mode</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Supabase Cloud Auth
                  </span>
                </div>
              </div>

              {/* Connected OAuth Providers & Identity Linking */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ide-text-muted)' }}>
                  Connected Accounts & Identities
                </h4>
                <div className="space-y-2">
                  {/* Google Identity */}
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <span>Google</span>
                          {(currentUser.provider === 'google' || currentUser.providers?.includes('google')) && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Connected</span>
                          )}
                        </div>
                        <p className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>
                          {(currentUser.provider === 'google' || currentUser.providers?.includes('google'))
                            ? 'Primary or linked OAuth identity'
                            : 'Sign in with your Google account'}
                        </p>
                      </div>
                    </div>

                    {!(currentUser.provider === 'google' || currentUser.providers?.includes('google')) && (
                      <button
                        type="button"
                        onClick={async () => {
                          setLinkingProvider('google');
                          setLinkError(null);
                          const { error } = await linkIdentity('google');
                          if (error) {
                            setLinkError(error.message);
                            setLinkingProvider(null);
                          }
                        }}
                        disabled={linkingProvider !== null}
                        className="text-xs px-2.5 py-1 rounded bg-white hover:bg-neutral-100 text-neutral-900 font-medium transition-colors disabled:opacity-50"
                      >
                        {linkingProvider === 'google' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-800" /> : 'Connect'}
                      </button>
                    )}
                  </div>

                  {/* GitHub Identity */}
                  <div 
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#24292e] border border-[#3c3c3c] flex items-center justify-center text-white shadow-sm">
                        <Github className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                          <span>GitHub</span>
                          {(currentUser.provider === 'github' || currentUser.providers?.includes('github') || currentUser.github_username) && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">Connected</span>
                          )}
                        </div>
                        <p className="text-[10.5px]" style={{ color: 'var(--ide-text-muted)' }}>
                          {currentUser.github_username ? `@${currentUser.github_username}` : 'Sync repositories and code reviews'}
                        </p>
                      </div>
                    </div>

                    {!(currentUser.provider === 'github' || currentUser.providers?.includes('github')) && (
                      <button
                        type="button"
                        onClick={async () => {
                          setLinkingProvider('github');
                          setLinkError(null);
                          const { error } = await linkIdentity('github');
                          if (error) {
                            setLinkError(error.message);
                            setLinkingProvider(null);
                          }
                        }}
                        disabled={linkingProvider !== null}
                        className="text-xs px-2.5 py-1 rounded bg-[#24292e] hover:bg-[#2f363d] text-white border border-[#3c3c3c] font-medium transition-colors disabled:opacity-50"
                      >
                        {linkingProvider === 'github' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
