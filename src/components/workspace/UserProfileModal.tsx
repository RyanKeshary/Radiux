'use client';

import React, { useState, useEffect } from 'react';
import { UserProfile, CodingPartner } from '@/lib/types';
import { THEMES, ThemeId } from '@/lib/themes';
import { EditorSettings } from './EditorSettingsModal';
import { DataService } from '@/lib/data-service';
import { useAuth } from '@/context/AuthContext';
import { Sound } from '@/lib/audio';
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
  Globe,
  Sliders,
  Type,
  Code2,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Key,
  LogOut,
  Layers,
  CheckCircle2,
  Clock,
  Mail
} from 'lucide-react';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  onProfileUpdated?: (updated: UserProfile) => void;
  initialTab?: 'ide' | 'profile' | 'collaborators' | 'account';
}

const BANNER_PRESETS = [
  { id: 'nebula', name: 'Nebula', value: 'linear-gradient(135deg, #0ea5e9, #6366f1, #a855f7)' },
  { id: 'sunset', name: 'Sunset Glow', value: 'linear-gradient(135deg, #f43f5e, #fb923c, #facc15)' },
  { id: 'emerald', name: 'Cyber Mint', value: 'linear-gradient(135deg, #10b981, #06b6d4, #3b82f6)' },
  { id: 'violet', name: 'Midnight Violet', value: 'linear-gradient(135deg, #4f46e5, #7c3aed, #ec4899)' },
  { id: 'carbon', name: 'Dark Carbon', value: 'linear-gradient(135deg, #1e293b, #0f172a, #020617)' },
];

export function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onProfileUpdated,
  initialTab = 'ide',
}: UserProfileModalProps) {
  const { updateCurrentUserProfile, signOut } = useAuth();
  
  // Reordered tabs: IDE first, then Profile, then Collaborators, then Account
  const [activeTab, setActiveTab] = useState<'ide' | 'profile' | 'collaborators' | 'account'>('ide');

  // Profile fields
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [username, setUsername] = useState(currentUser.username || currentUser.email.split('@')[0]);
  const [headline, setHeadline] = useState(currentUser.headline || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(
    currentUser.banner_url || 
    (typeof window !== 'undefined' ? localStorage.getItem(`codecollab_user_banner_${currentUser.id}`) || BANNER_PRESETS[0].value : BANNER_PRESETS[0].value)
  );
  const [githubUser, setGithubUser] = useState(currentUser.github_username || '');
  const [websiteUrl, setWebsiteUrl] = useState(currentUser.website_url || '');
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
      setActiveTab(initialTab);
      setFullName(currentUser.full_name || '');
      setUsername(currentUser.username || currentUser.email.split('@')[0]);
      setHeadline(currentUser.headline || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatar_url || '');
      setGithubUser(currentUser.github_username || '');
      setWebsiteUrl(currentUser.website_url || '');
      setSkills(currentUser.skills || ['TypeScript', 'React', 'Node.js']);
      setLanguages(currentUser.languages || ['JavaScript', 'TypeScript', 'Python']);

      const savedBanner = localStorage.getItem(`codecollab_user_banner_${currentUser.id}`);
      setBannerUrl(currentUser.banner_url || savedBanner || BANNER_PRESETS[0].value);

      // Load coding partners
      setLoadingPartners(true);
      DataService.getCodingPartners(currentUser.id).then((list) => {
        setPartners(list);
        setLoadingPartners(false);
      });
    }
  }, [isOpen, currentUser, initialTab]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    Sound.playHapticPop();
    try {
      const updates = {
        full_name: fullName,
        username,
        headline,
        bio,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
        github_username: githubUser,
        website_url: websiteUrl,
        skills,
        languages,
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(`codecollab_user_banner_${currentUser.id}`, bannerUrl);
      }

      const updated = await DataService.updateProfile(currentUser.id, updates);
      try { await updateCurrentUserProfile(updates); } catch (e) {}
      if (onProfileUpdated) onProfileUpdated(updated);
      setSavedSuccess(true);
      Sound.playNotificationChime();
      setTimeout(() => setSavedSuccess(false), 2500);
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
      Sound.playHapticPop();
    }
  };

  const handleAddLang = () => {
    if (langInput.trim() && !languages.includes(langInput.trim())) {
      setLanguages([...languages, langInput.trim()]);
      setLangInput('');
      Sound.playHapticPop();
    }
  };

  const handleSendPartnerRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerInput.trim()) return;
    Sound.playHapticPop();
    const res = await DataService.sendPartnerRequest(currentUser, newPartnerInput.trim());
    setPartnerMessage({ text: res.message, success: res.success });
    if (res.success && res.partner) {
      setPartners(prev => [res.partner!, ...prev]);
      setNewPartnerInput('');
      Sound.playNotificationChime();
    }
    setTimeout(() => setPartnerMessage(null), 3500);
  };

  const handleAcceptPartner = async (partnerId: string) => {
    Sound.playHapticPop();
    await DataService.respondToPartnerRequest(partnerId, true);
    setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, status: 'accepted' } : p));
  };

  const handleDeclinePartner = async (partnerId: string) => {
    Sound.playHapticPop();
    await DataService.respondToPartnerRequest(partnerId, false);
    setPartners(prev => prev.filter(p => p.id !== partnerId));
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl h-[620px] rounded-2xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div 
          className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: 'var(--ide-text)' }}>
                Settings & Preferences
              </h2>
              <p className="text-[11px] opacity-65" style={{ color: 'var(--ide-text-muted)' }}>
                Workspace configuration, profile identity and collaboration
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              Sound.playHapticPop();
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--ide-text-muted)' }}
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Exact order requested: IDE -> Profile -> Collaborators -> Account) */}
        <div 
          className="px-5 border-b flex items-center gap-2 overflow-x-auto flex-shrink-0 text-xs font-semibold"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          {/* Tab 1: IDE Settings */}
          <button
            onClick={() => {
              setActiveTab('ide');
              Sound.playHapticPop();
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'ide'
                ? 'border-sky-500 text-sky-400 font-bold'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>IDE & Editor</span>
          </button>

          {/* Tab 2: Profile */}
          <button
            onClick={() => {
              setActiveTab('profile');
              Sound.playHapticPop();
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'profile'
                ? 'border-sky-500 text-sky-400 font-bold'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Banner</span>
          </button>

          {/* Tab 3: Collaborators */}
          <button
            onClick={() => {
              setActiveTab('collaborators');
              Sound.playHapticPop();
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'collaborators'
                ? 'border-sky-500 text-sky-400 font-bold'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Collaborators & Friends</span>
            {partners.filter(p => p.status === 'pending' && p.receiver_id === currentUser.id).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            )}
          </button>

          {/* Tab 4: Account */}
          <button
            onClick={() => {
              setActiveTab('account');
              Sound.playHapticPop();
            }}
            className={`py-2.5 px-3 border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'account'
                ? 'border-sky-500 text-sky-400 font-bold'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: IDE & EDITOR SETTINGS */}
          {activeTab === 'ide' && (
            <div className="space-y-6 max-w-xl">
              {/* Color Themes */}
              <div>
                <label className="block font-semibold mb-2 text-xs" style={{ color: 'var(--ide-text)' }}>
                  Color Theme
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
                    const t = THEMES[tId];
                    const isSelected = settings.theme === tId || (tId === 'dark' && settings.theme === 'vs-dark');
                    return (
                      <button
                        key={tId}
                        type="button"
                        onClick={() => {
                          onUpdateSettings({ theme: tId });
                          Sound.playHapticPop();
                        }}
                        className={`p-2.5 rounded-xl border text-left font-medium transition-all ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-500 text-sky-300 ring-1 ring-sky-500/50'
                            : 'border-white/10 hover:bg-white/5 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <div className="truncate font-bold text-[11px] mb-1.5">{t.name}</div>
                        <div className="flex items-center gap-1 h-2.5 rounded overflow-hidden">
                          <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.bg }} />
                          <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.accent }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size */}
              <div>
                <div className="flex items-center justify-between font-semibold mb-1.5" style={{ color: 'var(--ide-text)' }}>
                  <span>Font Size</span>
                  <span className="text-sky-400 font-mono font-bold">{settings.fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={11}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {/* Tab Size */}
              <div>
                <label className="block font-semibold mb-2" style={{ color: 'var(--ide-text)' }}>
                  Indentation & Tab Size
                </label>
                <div className="flex gap-2">
                  {[2, 4].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ tabSize: size });
                        Sound.playHapticPop();
                      }}
                      className={`px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        settings.tabSize === size
                          ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                          : 'border-white/10 hover:bg-white/5 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {size} Spaces
                    </button>
                  ))}
                </div>
              </div>

              {/* Word Wrap & Minimap */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t" style={{ borderColor: 'var(--ide-border)' }}>
                <div>
                  <label className="block font-semibold mb-1.5">Word Wrap</label>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ wordWrap: settings.wordWrap === 'on' ? 'off' : 'on' });
                      Sound.playHapticPop();
                    }}
                    className={`px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      settings.wordWrap === 'on'
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'border-white/10 hover:bg-white/5 opacity-70'
                    }`}
                  >
                    {settings.wordWrap === 'on' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                <div>
                  <label className="block font-semibold mb-1.5">Code Minimap</label>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ minimap: !settings.minimap });
                      Sound.playHapticPop();
                    }}
                    className={`px-4 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                      settings.minimap
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'border-white/10 hover:bg-white/5 opacity-70'
                    }`}
                  >
                    {settings.minimap ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEVELOPER PROFILE & BANNER */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
              {/* Banner Customization */}
              <div>
                <label className="block font-semibold mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                    Profile Banner
                  </span>
                  <span className="text-[10px] opacity-60">Presets or image URL</span>
                </label>

                {/* Banner Live Preview */}
                <div 
                  className="w-full h-24 rounded-xl border shadow-inner relative overflow-hidden flex items-end p-3 transition-all"
                  style={{
                    background: bannerUrl.startsWith('http') ? `url("${bannerUrl}") center/cover no-repeat` : bannerUrl,
                    borderColor: 'var(--ide-border)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                  <div className="relative z-10 text-[11px] font-bold text-white drop-shadow">
                    Banner Preview
                  </div>
                </div>

                {/* Presets Chips */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {BANNER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setBannerUrl(preset.value);
                        Sound.playHapticPop();
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10.5px] font-medium border transition-all ${
                        bannerUrl === preset.value
                          ? 'border-sky-400 text-sky-300 font-bold bg-sky-500/10'
                          : 'border-white/10 hover:bg-white/5 opacity-75'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>

                {/* Custom Banner Image URL */}
                <input
                  type="text"
                  value={bannerUrl.startsWith('http') ? bannerUrl : ''}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="Or paste custom image URL (https://...)"
                  className="w-full mt-2 p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                />
              </div>

              {/* Avatar & Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Username / Handle</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 opacity-50 font-mono">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-7 p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Status / Headline */}
              <div>
                <label className="block font-semibold mb-1">Status Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. 🚀 Building collaborative fullstack apps"
                  className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                />
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block font-semibold mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or avatar URL"
                  className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block font-semibold mb-1">Developer Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Share a short bio about what you love building..."
                  className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 resize-none"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                />
              </div>

              {/* Languages Chips */}
              <div>
                <label className="block font-semibold mb-1">Programming Languages</label>
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    value={langInput}
                    onChange={(e) => setLangInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLang(); } }}
                    placeholder="Add language (e.g. Rust, Go, Python)..."
                    className="flex-1 p-1.5 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddLang}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {languages.map((l) => (
                    <span key={l} className="px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono text-[11px] flex items-center gap-1">
                      {l}
                      <button type="button" onClick={() => setLanguages(languages.filter(x => x !== l))} className="hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Skills Chips */}
              <div>
                <label className="block font-semibold mb-1">Skills & Frameworks</label>
                <div className="flex items-center gap-1.5 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                    placeholder="Add skill (e.g. Next.js, Docker, WebSockets)..."
                    className="flex-1 p-1.5 text-xs border rounded-lg focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSkill}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                      {s}
                      <button type="button" onClick={() => setSkills(skills.filter(x => x !== s))} className="hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Socials */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">GitHub Username</label>
                  <input
                    type="text"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="github-handle"
                    className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Website / Portfolio</label>
                  <input
                    type="text"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://yoursite.dev"
                    className="w-full p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500 font-mono"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 flex items-center gap-3 border-t" style={{ borderColor: 'var(--ide-border)' }}>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Profile</span>
                </button>

                {savedSuccess && (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                    <CheckCircle2 className="w-4 h-4" /> Profile saved successfully!
                  </span>
                )}
              </div>
            </form>
          )}

          {/* TAB 3: COLLABORATORS & FRIENDS */}
          {activeTab === 'collaborators' && (
            <div className="space-y-6 max-w-xl">
              {/* Add Partner Form */}
              <form onSubmit={handleSendPartnerRequest} className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--ide-dock-header)', borderColor: 'var(--ide-border)' }}>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-400" />
                  <h4 className="font-bold text-xs">Invite Friend or Coding Partner</h4>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newPartnerInput}
                    onChange={(e) => setNewPartnerInput(e.target.value)}
                    placeholder="Enter friend's email address..."
                    className="flex-1 p-2 text-xs border rounded-lg focus:outline-none focus:border-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)', color: 'var(--ide-text)' }}
                  />
                  <button
                    type="submit"
                    className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs"
                  >
                    Send Request
                  </button>
                </div>

                {partnerMessage && (
                  <p className={`text-xs ${partnerMessage.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {partnerMessage.text}
                  </p>
                )}
              </form>

              {/* Partners List */}
              <div className="space-y-2">
                <h4 className="font-semibold text-xs opacity-75 uppercase tracking-wider">
                  Your Coding Partners ({partners.length})
                </h4>

                {loadingPartners ? (
                  <div className="py-8 text-center opacity-50">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                    Loading partners...
                  </div>
                ) : partners.length === 0 ? (
                  <div className="py-8 text-center opacity-40 italic">
                    No coding partners added yet. Invite peers using their email above!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {partners.map((p) => {
                      const isPendingIncoming = p.status === 'pending' && p.receiver_id === currentUser.id;
                      return (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl border flex items-center justify-between gap-2"
                          style={{ backgroundColor: 'var(--ide-card-bg)', borderColor: 'var(--ide-border)' }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white flex-shrink-0">
                              {p.partner_name?.charAt(0) || <User className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs truncate" style={{ color: 'var(--ide-text)' }}>
                                {p.partner_name || p.partner_email}
                              </p>
                              <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-full ${
                                p.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                              }`}>
                                {p.status === 'accepted' ? 'Partner' : 'Pending Request'}
                              </span>
                            </div>
                          </div>

                          {isPendingIncoming ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleAcceptPartner(p.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-semibold"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclinePartner(p.id)}
                                className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-md text-[11px]"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeclinePartner(p.id)}
                              className="p-1.5 rounded text-slate-400 hover:text-rose-400"
                              title="Remove Partner"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACCOUNT & SECURITY */}
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-xl">
              <div className="p-4 rounded-xl border space-y-3" style={{ backgroundColor: 'var(--ide-dock-header)', borderColor: 'var(--ide-border)' }}>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <h4 className="font-bold text-xs">Account Credentials</h4>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-60">Email Address</span>
                    <span className="font-mono font-medium">{currentUser.email}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="opacity-60">User ID</span>
                    <span className="font-mono text-[10px] opacity-75">{currentUser.id}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="opacity-60">Authentication</span>
                    <span className="text-emerald-400 font-semibold">Supabase Auth Verified</span>
                  </div>
                </div>
              </div>

              {/* Danger Zone / Sign Out */}
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-3">
                <h4 className="font-bold text-xs text-rose-400">Session Controls</h4>
                <p className="text-[11px] opacity-70">
                  Sign out of your active session on this device. Your workspaces and cloud sync remain saved.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    onClose();
                  }}
                  className="py-1.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
