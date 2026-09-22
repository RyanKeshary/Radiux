'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Moon, 
  Sun, 
  Type, 
  Sliders, 
  Check, 
  User, 
  Users, 
  Shield, 
  Bell, 
  Keyboard, 
  Palette, 
  Lock, 
  Github, 
  Cpu, 
  ExternalLink,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FolderGit2,
  Blocks,
  Share2
} from 'lucide-react';
import { ThemeId, THEMES, applyThemeVariables } from '@/lib/themes';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { UserProfile, CodingPartner } from '@/lib/types';
import { soundManager } from '@/lib/sound';
import { CommandRegistry, CommandItem } from '@/lib/commands';
import { ExtensionsPanel } from './ExtensionsPanel';
import { IntegrationManager } from '@/lib/integrations/integration-manager';

export interface EditorSettings {
  theme: ThemeId | 'vs-dark' | 'vs' | 'hc-black';
  fontSize: number;
  fontFamily?: string;
  tabSize: number;
  wordWrap: 'on' | 'off';
  minimap: boolean;
  cursorBlinking?: 'smooth' | 'blink' | 'solid';
  lineNumbers?: 'on' | 'off';
  autoSaveDelay?: number;
  soundEnabled?: boolean;
  showCollaboratorCursors?: boolean;
}

export type SettingsSection = 
  | 'ide'
  | 'profile'
  | 'collaborators'
  | 'account'
  | 'shortcuts'
  | 'appearance'
  | 'privacy'
  | 'github'
  | 'extensions'
  | 'integrations'
  | 'advanced';

interface EditorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EditorSettings;
  onUpdateSettings: (newSettings: Partial<EditorSettings>) => void;
  initialSection?: SettingsSection;
  projectId?: string;
}

export function EditorSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  initialSection = 'ide',
  projectId,
}: EditorSettingsModalProps) {
  const { user, signOut, updateCurrentUserProfile } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partners, setPartners] = useState<CodingPartner[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Form states for Profile
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    username: '',
    bio: '',
    role: '',
    location: '',
    website: '',
    github_username: '',
    skills: [] as string[],
    languages: [] as string[],
  });
  const [privacyForm, setPrivacyForm] = useState({
    show_location: true,
    show_education: true,
    show_links: true,
    show_skills: true,
    show_activity: true,
    show_readme: true,
    show_partners: true,
    show_email: false,
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLang, setNewLang] = useState('');

  // Form state for Partner invitation
  const [partnerTarget, setPartnerTarget] = useState('');
  const [partnerMsg, setPartnerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // GitHub state
  const [gitHubRepoUrl, setGitHubRepoUrl] = useState('');
  const [gitHubStatus, setGitHubStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      if (user) {
        setLoadingProfile(true);
        Promise.all([
          DataService.getProfile(user.id),
          DataService.getCodingPartners(user.id),
        ]).then(([prof, parts]) => {
          if (prof) {
            setProfile(prof);
            setProfileForm({
              full_name: prof.full_name || '',
              username: prof.username || '',
              bio: prof.bio || '',
              role: prof.role || '',
              location: prof.location || '',
              website: prof.website || '',
              github_username: prof.github_username || '',
              skills: prof.skills || [],
              languages: prof.languages || [],
            });
            if (prof.privacy) {
              setPrivacyForm((prev) => ({ ...prev, ...prof.privacy }));
            }
          }
          setPartners(parts);
          setLoadingProfile(false);
        });
      }
      if (projectId) {
        DataService.getGitHubRemotes(projectId).then(remotes => {
          const origin = remotes.find(r => r.name === 'origin');
          if (origin) setGitHubRepoUrl(origin.url);
        }).catch(() => {});
      }
    }
  }, [isOpen, initialSection, user, projectId]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await DataService.updateProfile(user.id, profileForm);
      setProfileSaved(true);
      soundManager.playSuccess();
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const handleSendPartnerRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !partnerTarget.trim() || !profile) return;
    setPartnerMsg(null);
    const res = await DataService.sendPartnerRequest(profile, partnerTarget.trim());
    if (res.success) {
      setPartnerMsg({ type: 'success', text: res.message });
      setPartnerTarget('');
      const parts = await DataService.getCodingPartners(user.id);
      setPartners(parts);
      soundManager.playSuccess();
    } else {
      setPartnerMsg({ type: 'error', text: res.message });
    }
  };

  const handlePartnerAction = async (requestId: string, action: 'accept' | 'ignore' | 'reject') => {
    await DataService.respondToPartnerRequest(requestId, action);
    if (user) {
      const parts = await DataService.getCodingPartners(user.id);
      setPartners(parts);
      soundManager.playSuccess();
    }
  };

  const handleUnsendPartner = async (requestId: string) => {
    await DataService.unsendPartnerRequest(requestId);
    if (user) {
      const parts = await DataService.getCodingPartners(user.id);
      setPartners(parts);
      soundManager.playSuccess();
    }
  };

  const handleTogglePrivacy = async (key: string, value: boolean) => {
    const updatedPrivacy = { ...privacyForm, [key]: value };
    setPrivacyForm(updatedPrivacy);
    if (user) {
      try {
        await DataService.updateProfile(user.id, { privacy: updatedPrivacy });
        if (updateCurrentUserProfile) {
          await updateCurrentUserProfile({ privacy: updatedPrivacy });
        }
        soundManager.playSuccess();
      } catch (err) {
        console.error('Failed to update privacy:', err);
      }
    }
  };

  const SECTIONS: { id: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { id: 'ide', label: '1. IDE & Editor', icon: <Sliders className="w-4 h-4 text-sky-400" /> },
    { id: 'profile', label: '2. Profile', icon: <User className="w-4 h-4 text-indigo-400" /> },
    { id: 'collaborators', label: '3. Collaborators', icon: <Users className="w-4 h-4 text-emerald-400" /> },
    { id: 'account', label: '4. Account', icon: <Shield className="w-4 h-4 text-amber-400" /> },
    { id: 'shortcuts', label: '5. Keyboard Shortcuts', icon: <Keyboard className="w-4 h-4 text-purple-400" /> },
    { id: 'appearance', label: '6. Appearance', icon: <Palette className="w-4 h-4 text-pink-400" /> },
    { id: 'privacy', label: '7. Privacy', icon: <Lock className="w-4 h-4 text-teal-400" /> },
    { id: 'github', label: '8. GitHub / Source Control', icon: <Github className="w-4 h-4 text-white" /> },
    { id: 'extensions', label: '9. Extensions', icon: <Blocks className="w-4 h-4 text-emerald-400" /> },
    { id: 'integrations', label: '10. Integrations', icon: <Share2 className="w-4 h-4 text-violet-400" /> },
    { id: 'advanced', label: '11. Advanced', icon: <Cpu className="w-4 h-4 text-rose-400" /> },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'var(--ide-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        className="w-full max-w-4xl h-[85vh] border rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div 
          className="h-12 px-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2.5 font-semibold text-sm">
            <img src="/logo.png" alt="Radiux" className="w-5 h-5 rounded object-contain" />
            <span>Radiux Settings</span>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--ide-text-muted)' }}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Close Settings (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Body: Left Section Nav + Right Content Area */}
        <div className="flex-1 flex min-h-0">
          {/* Left Section Sidebar */}
          <div 
            className="w-56 border-r flex flex-col p-2 space-y-0.5 overflow-y-auto flex-shrink-0"
            style={{ 
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-sidebar)'
            }}
          >
            {SECTIONS.map((sec) => {
              const isSelected = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full px-3 py-2 rounded-lg text-left font-medium flex items-center gap-2.5 transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {sec.icon}
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content View */}
          <div 
            className="flex-1 overflow-y-auto p-6"
            style={{ backgroundColor: 'var(--ide-bg)' }}
          >
            {/* 1. IDE & Editor */}
            {activeSection === 'ide' && (
              <div className="space-y-6 max-w-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ide-text)' }}>
                      Development Environment & Editor
                    </h3>
                    <p className="text-[11px] opacity-70">
                      Fine-tune code editor parameters, typography, layout, and feedback.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10.5px] font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Auto-applied in real-time</span>
                  </div>
                </div>

                {/* Theme Selector */}
                <div>
                  <label className="block font-medium mb-2">Editor Theme</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.keys(THEMES) as ThemeId[]).map((tId) => {
                      const t = THEMES[tId];
                      const isSel = settings.theme === tId || (tId === 'dark' && settings.theme === 'vs-dark');
                      return (
                        <button
                          key={tId}
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ theme: tId });
                            applyThemeVariables(tId);
                          }}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            isSel ? 'border-sky-400 bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/50' : 'border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="font-semibold text-[11px] truncate mb-1">{t.name}</div>
                          <div className="flex gap-0.5 h-1.5 rounded overflow-hidden">
                            <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.bg }} />
                            <span className="w-1/2 h-full" style={{ backgroundColor: t.colors.accent }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Font Size & Font Family */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium mb-1.5">
                      Font Size: <span className="text-sky-400 font-mono font-bold">{settings.fontSize}px</span>
                    </label>
                    <input
                      type="range"
                      min="11"
                      max="24"
                      value={settings.fontSize}
                      onChange={(e) => onUpdateSettings({ fontSize: parseInt(e.target.value) })}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1.5">Font Family</label>
                    <select
                      value={settings.fontFamily || "'Fira Code', Consolas, monospace"}
                      onChange={(e) => onUpdateSettings({ fontFamily: e.target.value })}
                      className="w-full p-1.5 rounded border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <option value="'Fira Code', 'Cascadia Code', Consolas, monospace">Fira Code</option>
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                      <option value="'Cascadia Code', monospace">Cascadia Code</option>
                      <option value="Consolas, 'Courier New', monospace">Consolas</option>
                      <option value="monospace">Standard Monospace</option>
                    </select>
                  </div>
                </div>

                {/* Tab Size, Word Wrap, Minimap */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium mb-1.5">Tab Size</label>
                    <select
                      value={settings.tabSize}
                      onChange={(e) => onUpdateSettings({ tabSize: parseInt(e.target.value) })}
                      className="w-full p-1.5 rounded border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <option value={2}>2 spaces</option>
                      <option value={4}>4 spaces</option>
                      <option value={8}>8 spaces</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium mb-1.5">Word Wrap</label>
                    <select
                      value={settings.wordWrap}
                      onChange={(e) => onUpdateSettings({ wordWrap: e.target.value as 'on' | 'off' })}
                      className="w-full p-1.5 rounded border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <option value="on">On (Wrapped)</option>
                      <option value="off">Off</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium mb-1.5">Minimap</label>
                    <select
                      value={settings.minimap ? 'true' : 'false'}
                      onChange={(e) => onUpdateSettings({ minimap: e.target.value === 'true' })}
                      className="w-full p-1.5 rounded border focus:outline-none"
                      style={{
                        backgroundColor: 'var(--ide-input-bg)',
                        borderColor: 'var(--ide-border)',
                        color: 'var(--ide-text)',
                      }}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>

                {/* Notification Sounds Toggle */}
                <div className="p-3.5 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--ide-border)' }}>
                  <div>
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Notification Sounds & Audio Feedback</span>
                    </div>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      Play a gentle synthesized chime when important partner requests or notices arrive.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={soundManager.isEnabled()}
                    onChange={(e) => {
                      soundManager.setEnabled(e.target.checked);
                      onUpdateSettings({ soundEnabled: e.target.checked });
                    }}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Show Collaborator Cursors Toggle */}
                <div className="p-3.5 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--ide-border)' }}>
                  <div>
                    <div className="font-semibold text-xs flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      <span>Show Collaborator Cursors</span>
                    </div>
                    <div className="text-[11px] opacity-70 mt-0.5">
                      Display live shared cursors, name tags, and selection highlights of peers in the editor.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showCollaboratorCursors !== false}
                    onChange={(e) => onUpdateSettings({ showCollaboratorCursors: e.target.checked })}
                    className="w-4 h-4 accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Live Code Preview Card */}
                <div 
                  className="rounded-xl border overflow-hidden transition-all shadow-md"
                  style={{ 
                    borderColor: 'var(--ide-border)',
                    backgroundColor: 'var(--ide-card-bg)',
                  }}
                >
                  <div 
                    className="px-3 py-2 border-b flex items-center justify-between text-[11px]"
                    style={{ 
                      backgroundColor: 'var(--ide-dock-header)',
                      borderColor: 'var(--ide-border)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                      <span className="font-mono font-medium ml-1">Live Editor Preview</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] opacity-70 font-mono">
                      <span>{settings.fontSize}px</span>
                      <span>•</span>
                      <span>{settings.wordWrap === 'on' ? 'Wrap' : 'No-wrap'}</span>
                      <span>•</span>
                      <span>{settings.minimap ? 'Minimap ON' : 'Minimap OFF'}</span>
                    </div>
                  </div>

                  <div 
                    className="p-3.5 relative overflow-hidden flex"
                    style={{
                      fontFamily: settings.fontFamily || "'Fira Code', Consolas, monospace",
                      fontSize: `${settings.fontSize}px`,
                      lineHeight: 1.5,
                      backgroundColor: 'var(--ide-editor-bg)',
                      color: 'var(--ide-text)',
                    }}
                  >
                    {/* Line numbers */}
                    <div 
                      className="pr-3 text-right select-none opacity-40 font-mono border-r mr-3"
                      style={{ borderColor: 'var(--ide-border)' }}
                    >
                      <div>1</div>
                      <div>2</div>
                      <div>3</div>
                      <div>4</div>
                      <div>5</div>
                    </div>

                    {/* Code lines */}
                    <div className={`flex-1 ${settings.wordWrap === 'on' ? 'break-words' : 'overflow-x-auto whitespace-pre'}`}>
                      <div><span className="text-sky-400 font-semibold">import</span> &#123; createClient &#125; <span className="text-sky-400 font-semibold">from</span> <span className="text-emerald-400">&apos;@radiux/client&apos;</span>;</div>
                      <div className="mt-0.5"><span className="text-sky-400 font-semibold">export function</span> <span className="text-amber-300 font-semibold">useRadiuxIDE</span>() &#123;</div>
                      <div className="pl-4 mt-0.5"><span className="text-sky-400 font-semibold">const</span> ide = createClient(&#123; theme: <span className="text-emerald-400">&apos;{settings.theme}&apos;</span> &#125;);</div>
                      <div className="pl-4 mt-0.5"><span className="text-sky-400 font-semibold">return</span> ide.init();</div>
                      <div className="mt-0.5">&#125;</div>
                    </div>

                    {/* Simulated Minimap */}
                    {settings.minimap && (
                      <div 
                        className="w-12 ml-2 border-l pl-1 select-none opacity-30 flex flex-col gap-1 py-1"
                        style={{ borderColor: 'var(--ide-border)' }}
                      >
                        <div className="h-1 bg-sky-400/80 rounded w-full" />
                        <div className="h-1 bg-emerald-400/80 rounded w-4/5" />
                        <div className="h-1 bg-amber-400/80 rounded w-3/4" />
                        <div className="h-1 bg-sky-400/60 rounded w-1/2" />
                        <div className="h-1 bg-neutral-400/50 rounded w-2/3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Profile */}
            {activeSection === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Developer Identity & Profile</h3>
                  <p className="text-[11px] opacity-70">
                    Update your public developer persona, bio, skills, and coding interests.
                  </p>
                </div>

                {profileSaved && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Profile changes saved successfully!</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      className="w-full p-2 rounded border focus:outline-none"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Username / Handle</label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      className="w-full p-2 rounded border focus:outline-none font-mono"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1">Bio</label>
                  <textarea
                    rows={2}
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Short developer bio..."
                    className="w-full p-2 rounded border focus:outline-none resize-none"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium mb-1">Role / Headline</label>
                    <input
                      type="text"
                      value={profileForm.role}
                      placeholder="e.g. Full-Stack Engineer"
                      onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                      className="w-full p-2 rounded border focus:outline-none"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">GitHub Username</label>
                    <input
                      type="text"
                      value={profileForm.github_username}
                      placeholder="octocat"
                      onChange={(e) => setProfileForm({ ...profileForm, github_username: e.target.value })}
                      className="w-full p-2 rounded border focus:outline-none font-mono"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                  </div>
                </div>

                {/* Skills tags */}
                <div>
                  <label className="block font-medium mb-1">Skills & Frameworks</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {profileForm.skills.map((s, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                        <span>{s}</span>
                        <button
                          type="button"
                          onClick={() => setProfileForm({ ...profileForm, skills: profileForm.skills.filter((_, i) => i !== idx) })}
                        >
                          <X className="w-3 h-3 hover:text-white" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add a skill (e.g. React, Next.js, Docker)..."
                      className="flex-1 p-1.5 rounded border focus:outline-none"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newSkill.trim() && !profileForm.skills.includes(newSkill.trim())) {
                          setProfileForm({ ...profileForm, skills: [...profileForm.skills, newSkill.trim()] });
                          setNewSkill('');
                        }
                      }}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded border border-white/20 font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded font-semibold transition-colors shadow-sm"
                  >
                    Save Profile
                  </button>
                </div>
              </form>
            )}

            {/* 3. Collaborators */}
            {activeSection === 'collaborators' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Coding Partners & Collaborators</h3>
                  <p className="text-[11px] opacity-70">
                    Manage your active relationships, friend requests, and peer invites.
                  </p>
                </div>

                {/* Add Partner Form */}
                <form onSubmit={handleSendPartnerRequest} className="p-3.5 rounded-lg border space-y-3" style={{ borderColor: 'var(--ide-border)' }}>
                  <label className="block font-medium">Add a Coding Partner</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter partner email or username..."
                      value={partnerTarget}
                      onChange={(e) => setPartnerTarget(e.target.value)}
                      className="flex-1 p-2 rounded border focus:outline-none"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                    <button
                      type="submit"
                      disabled={!partnerTarget.trim()}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50 transition-colors"
                    >
                      Send Request
                    </button>
                  </div>
                  {partnerMsg && (
                    <div className={`p-2 rounded text-xs flex items-center gap-1.5 ${
                      partnerMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {partnerMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{partnerMsg.text}</span>
                    </div>
                  )}
                </form>

                {/* Active Partners List */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-xs opacity-70 uppercase tracking-wider">
                    Your Partners ({partners.length})
                  </h4>
                  {partners.length === 0 ? (
                    <p className="text-neutral-500 italic">No partners added yet.</p>
                  ) : (
                    partners.map((p) => {
                      const peer = p.profile;
                      return (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-lg border flex items-center justify-between"
                          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-card-bg)' }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-sky-600/20 text-sky-400 flex items-center justify-center font-bold">
                              {(peer?.full_name || 'D')[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[11.5px] truncate">{peer?.full_name || 'Developer'}</p>
                              <p className="text-[10px] opacity-60 truncate">@{peer?.username || 'peer'}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                              p.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}>
                              {p.status}
                            </span>
                            {p.status === 'pending' && p.receiver_id === user?.id && (
                              <button
                                onClick={() => handlePartnerAction(p.id, 'accept')}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px]"
                              >
                                Accept
                              </button>
                            )}
                            {p.status === 'pending' && p.requester_id === user?.id && (
                              <button
                                onClick={() => handleUnsendPartner(p.id)}
                                className="px-2 py-0.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 rounded text-[10.5px] font-medium transition-colors flex items-center gap-1"
                                title="Unsend friend request"
                              >
                                <X className="w-3 h-3" />
                                <span>Unsend</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* 4. Account */}
            {activeSection === 'account' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Account & Authentication</h3>
                  <p className="text-[11px] opacity-70">
                    Manage your credentials, active session, and cloud account links.
                  </p>
                </div>

                <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--ide-border)' }}>
                  <div>
                    <label className="block text-[11px] opacity-60">Primary Email</label>
                    <p className="font-semibold text-xs mt-0.5">{user?.email || 'guest@radiux.dev'}</p>
                  </div>
                  <div>
                    <label className="block text-[11px] opacity-60">User ID</label>
                    <p className="font-mono text-[10.5px] opacity-80 mt-0.5 break-all">{user?.id || 'guest-session'}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => signOut()}
                    className="px-4 py-2 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded font-semibold transition-all"
                  >
                    Sign Out of Radiux
                  </button>
                </div>
              </div>
            )}

            {/* 5. Keyboard Shortcuts */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-4 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Keyboard Shortcuts Registry</h3>
                  <p className="text-[11px] opacity-70">
                    All core IDE commands are scoped to avoid hijacking browser native shortcuts.
                  </p>
                </div>

                <div className="border rounded-lg overflow-hidden divide-y divide-white/5">
                  {CommandRegistry.getAllCommands().slice(0, 8).map(({ item, shortcut }) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs">{item.title}</div>
                        <div className="text-[10.5px] opacity-60">{item.description}</div>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-[9px] px-1 py-0.5 rounded uppercase font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                          {item.scope}
                        </span>
                        <kbd className="px-2 py-0.5 rounded border text-xs shadow-sm" style={{ borderColor: 'var(--ide-border)' }}>
                          {shortcut || 'unassigned'}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Appearance */}
            {activeSection === 'appearance' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Appearance & Design Aesthetics</h3>
                  <p className="text-[11px] opacity-70">
                    Select tailored dark, light, or OLED contrast themes for the full IDE chrome.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onUpdateSettings({ theme: t.id });
                        applyThemeVariables(t.id);
                      }}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                        settings.theme === t.id ? 'border-sky-400 bg-sky-500/15' : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{t.description}</p>
                      </div>
                      <div className="w-5 h-5 rounded-full border flex items-center justify-center" style={{ backgroundColor: t.colors.accent }}>
                        {settings.theme === t.id && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 8. Privacy */}
            {activeSection === 'privacy' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Privacy & Profile Visibility</h3>
                  <p className="text-[11px] opacity-70">Control which details other developers can inspect on your public developer profile.</p>
                </div>
                <div className="space-y-2 p-3.5 rounded-lg border" style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-card-bg)' }}>
                  {[
                    { key: 'show_location', label: 'Show Location on Public Profile' },
                    { key: 'show_education', label: 'Show Education on Public Profile' },
                    { key: 'show_links', label: 'Show External Links (Website, GitHub, LinkedIn)' },
                    { key: 'show_skills', label: 'Show Skills & Technologies' },
                    { key: 'show_activity', label: 'Show Developer Contribution Graph' },
                    { key: 'show_readme', label: 'Show Personal Profile README' },
                    { key: 'show_partners', label: 'Show Mutual Coding Partners' },
                    { key: 'show_email', label: 'Show Email Address (Publicly Visible)' },
                  ].map(({ key, label }) => {
                    const checked = (privacyForm as any)[key] ?? false;
                    return (
                      <label 
                        key={key} 
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors border border-white/5"
                      >
                        <span className="text-xs font-medium">{label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => handleTogglePrivacy(key, e.target.checked)}
                          className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 9. GitHub Integration */}
            {activeSection === 'github' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">GitHub Remote & Synchronization</h3>
                  <p className="text-[11px] opacity-70">
                    Connect your workspace directly to GitHub repositories for automatic version control.
                  </p>
                </div>

                <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--ide-border)' }}>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Repository Origin URL</label>
                    <input
                      type="text"
                      placeholder="https://github.com/RyanKeshary/Radiux.git"
                      value={gitHubRepoUrl}
                      onChange={(e) => setGitHubRepoUrl(e.target.value)}
                      className="w-full p-2 rounded border focus:outline-none font-mono"
                      style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (projectId && gitHubRepoUrl.trim()) {
                        await DataService.setGitHubRemote(projectId, gitHubRepoUrl.trim());
                        setGitHubStatus('Linked successfully');
                        soundManager.playSuccess();
                        setTimeout(() => setGitHubStatus(null), 3000);
                      }
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium"
                  >
                    Save Remote URL
                  </button>
                  {gitHubStatus && <p className="text-xs text-emerald-400">{gitHubStatus}</p>}
                </div>
              </div>
            )}

            {/* 10. Extensions */}
            {activeSection === 'extensions' && (
              <div className="space-y-4 max-w-xl h-full flex flex-col">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Installed Extensions & Plugins</h3>
                  <p className="text-[11px] opacity-70">
                    Manage sandboxed extensions, capabilities, and keybindings.
                  </p>
                </div>
                <div className="h-[400px] border rounded-lg overflow-hidden" style={{ borderColor: 'var(--ide-border)' }}>
                  <ExtensionsPanel isCompact />
                </div>
              </div>
            )}

            {/* 11. Integrations */}
            {activeSection === 'integrations' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Platform Integrations</h3>
                  <p className="text-[11px] opacity-70">
                    Connect external source control, communication, and project management tools.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {IntegrationManager.getIntegrations().slice(0, 6).map((item) => (
                    <div 
                      key={item.provider}
                      className="p-3.5 rounded-lg border space-y-1.5"
                      style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-card-bg)' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-neutral-200">{item.name}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.status === 'connected' 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-neutral-400 border border-white/10'
                        }`}>
                          {item.status === 'connected' ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-70 line-clamp-2">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 11. Advanced */}
            {activeSection === 'advanced' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Advanced Settings & Diagnostics</h3>
                  <p className="text-[11px] opacity-70">
                    Troubleshoot local caches, export system diagnostics, and reset custom keybinds.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--ide-border)' }}>
                    <div>
                      <p className="font-semibold">Reset Keyboard Shortcuts</p>
                      <p className="text-[10.5px] opacity-60">Revert all user-customized shortcuts back to default bindings.</p>
                    </div>
                    <button
                      onClick={() => {
                        CommandRegistry.resetAllShortcuts();
                        soundManager.playSuccess();
                        alert('All keybindings reset to defaults.');
                      }}
                      className="px-3 py-1 rounded border border-white/20 hover:bg-white/10"
                    >
                      Reset All
                    </button>
                  </div>

                  <div className="p-3 rounded-lg border flex items-center justify-between" style={{ borderColor: 'var(--ide-border)' }}>
                    <div>
                      <p className="font-semibold">Clear Local Cache</p>
                      <p className="text-[10.5px] opacity-60">Purge local workspace state and editor storage.</p>
                    </div>
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('codecollab_editor_settings');
                          alert('Local settings cache cleared.');
                        }
                      }}
                      className="px-3 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                    >
                      Clear Cache
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Modal Footer: Live feedback, Reset and Apply & Close Button */}
        <div 
          className="h-14 px-6 border-t flex items-center justify-between flex-shrink-0"
          style={{ 
            borderColor: 'var(--ide-border)', 
            backgroundColor: 'var(--ide-dock-header)' 
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <span className="text-[11px] font-medium" style={{ color: 'var(--ide-text-muted)' }}>
              Settings are auto-saved to your profile and active across all workspace tabs
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const defaultSettings: EditorSettings = {
                  theme: 'dark',
                  fontSize: 14,
                  tabSize: 2,
                  wordWrap: 'off',
                  minimap: true,
                  soundEnabled: true,
                };
                onUpdateSettings(defaultSettings);
                applyThemeVariables('dark');
                soundManager.playSuccess();
              }}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-white/5 transition-colors"
              style={{
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text-muted)',
              }}
            >
              Reset to Defaults
            </button>

            <button
              type="button"
              onClick={() => {
                soundManager.playSuccess();
                onClose();
              }}
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Check className="w-4 h-4" />
              <span>Apply & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
