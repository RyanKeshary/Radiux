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
  Github
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onProfileUpdated,
}: UserProfileModalProps) {
  const { updateCurrentUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'partners' | 'account'>('profile');

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

  // Coding Partners
  const [partners, setPartners] = useState<CodingPartner[]>([]);
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [partnerMessage, setPartnerMessage] = useState<{ text: string; success: boolean } | null>(null);
  const [loadingPartners, setLoadingPartners] = useState(false);

  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, currentUser]);

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

  const handleRemovePartner = async (partnerId: string) => {
    await DataService.removePartner(partnerId);
    setPartners(prev => prev.filter(p => p.id !== partnerId));
  };

  const handleUnsendPartner = async (partnerId: string) => {
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
            <User className="w-4 h-4 text-sky-400" />
            <span className="text-sm font-semibold" style={{ color: 'var(--ide-text)' }}>Developer Profile & Settings</span>
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

          {/* 3. Coding Partners Tab */}
          {activeTab === 'partners' && (
            <div className="space-y-4">
              <div 
                className="p-3 rounded border"
                style={{
                  backgroundColor: 'var(--ide-dock-header)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <p className="font-medium mb-1" style={{ color: 'var(--ide-text)' }}>Collaborative Coding Partners</p>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ide-text-muted)' }}>
                  Add developers as coding partners to quickly invite them to projects, see their availability, and jump into real-time collaboration.
                </p>

                <form onSubmit={handleSendPartnerRequest} className="flex gap-2 mt-3">
                  <input
                    type="text"
                    required
                    value={newPartnerInput}
                    onChange={(e) => setNewPartnerInput(e.target.value)}
                    placeholder="Enter developer email or @username..."
                    className="flex-1 border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                    style={{
                      backgroundColor: 'var(--ide-input-bg)',
                      borderColor: 'var(--ide-border)',
                      color: 'var(--ide-text)',
                    }}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium flex items-center gap-1 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Send Request</span>
                  </button>
                </form>

                {partnerMessage && (
                  <p className={`text-[11px] mt-2 ${partnerMessage.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {partnerMessage.text}
                  </p>
                )}
              </div>

              {/* Partners List */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--ide-text-muted)' }}>Your Coding Partners</h4>
                {loadingPartners ? (
                  <div className="py-4 text-center" style={{ color: 'var(--ide-text-muted)' }}>Loading partners...</div>
                ) : partners.length === 0 ? (
                  <div className="py-6 text-center text-xs italic" style={{ color: 'var(--ide-text-muted)' }}>
                    No coding partners yet. Send an invitation above to collaborate!
                  </div>
                ) : (
                  partners.map((p) => {
                    const isIncomingPending = p.status === 'pending' && p.receiver_id === currentUser.id;
                    const isOutgoingPending = p.status === 'pending' && p.requester_id === currentUser.id;

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded border"
                        style={{
                          backgroundColor: 'var(--ide-card-bg)',
                          borderColor: 'var(--ide-border)',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.profile?.avatar_url ? (
                            <img src={p.profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-sky-600 flex items-center justify-center font-bold text-white uppercase">
                              {(p.profile?.full_name || 'U').charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="font-semibold truncate" style={{ color: 'var(--ide-text)' }}>{p.profile?.full_name || 'Partner'}</p>
                            <p className="text-[10px] truncate" style={{ color: 'var(--ide-text-muted)' }}>@{p.profile?.username || p.profile?.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isIncomingPending && (
                            <>
                              <button
                                onClick={() => handleAcceptPartner(p.id)}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclinePartner(p.id)}
                                className="px-2 py-1 border rounded text-[11px]"
                                style={{
                                  backgroundColor: 'var(--ide-input-bg)',
                                  borderColor: 'var(--ide-border)',
                                  color: 'var(--ide-text)',
                                }}
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {isOutgoingPending && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-medium border border-amber-500/20">
                                Pending Request
                              </span>
                              <button
                                onClick={() => handleUnsendPartner(p.id)}
                                className="px-2 py-0.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded text-[10.5px] font-medium transition-colors flex items-center gap-1"
                                title="Unsend friend request"
                              >
                                <X className="w-3 h-3" />
                                <span>Unsend</span>
                              </button>
                            </div>
                          )}

                          {p.status === 'accepted' && (
                            <>
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" /> Partner
                              </span>
                              <button
                                onClick={() => handleRemovePartner(p.id)}
                                className="p-1 hover:text-red-400 transition-colors"
                                style={{ color: 'var(--ide-text-muted)' }}
                                title="Remove partner"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div 
                className="p-3 rounded border space-y-2"
                style={{
                  backgroundColor: 'var(--ide-dock-header)',
                  borderColor: 'var(--ide-border)',
                }}
              >
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Registered Email</span>
                  <span className="font-mono" style={{ color: 'var(--ide-text)' }}>{currentUser.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Account ID</span>
                  <span className="font-mono text-[10px]" style={{ color: 'var(--ide-text-muted)' }}>{currentUser.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b" style={{ borderColor: 'var(--ide-border)' }}>
                  <span style={{ color: 'var(--ide-text-muted)' }}>Authentication Mode</span>
                  <span className="text-emerald-400 font-semibold">Supabase Cloud Auth</span>
                </div>
                <div className="flex justify-between py-1">
                  <span style={{ color: 'var(--ide-text-muted)' }}>Real-Time Collaboration</span>
                  <span className="text-sky-400 font-semibold">Yjs CRDT + WebSocket</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
