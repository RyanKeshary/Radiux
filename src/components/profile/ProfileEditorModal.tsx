'use client';

import React, { useState } from 'react';
import { UserProfile, CustomDeveloperLink } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { 
  X, 
  User, 
  Shield, 
  Check, 
  Loader2, 
  Plus, 
  Trash2, 
  Link as LinkIcon, 
  Github, 
  Linkedin, 
  Globe, 
  MapPin, 
  GraduationCap, 
  Briefcase 
} from 'lucide-react';

interface ProfileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export function ProfileEditorModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
}: ProfileEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'links' | 'privacy'>('profile');

  // Fields
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [username, setUsername] = useState(currentUser.username || currentUser.email.split('@')[0]);
  const [role, setRole] = useState(currentUser.role || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [education, setEducation] = useState(currentUser.education || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar_url || '');
  const [website, setWebsite] = useState(currentUser.website || '');
  const [githubUser, setGithubUser] = useState(currentUser.github_username || '');
  const [linkedinUrl, setLinkedinUrl] = useState(currentUser.linkedin_url || '');
  const [skills, setSkills] = useState<string[]>(currentUser.skills || ['TypeScript', 'React', 'Node.js']);
  const [skillInput, setSkillInput] = useState('');

  // Privacy
  const [privacy, setPrivacy] = useState(currentUser.privacy || {
    show_location: true,
    show_education: true,
    show_links: true,
    show_skills: true,
    show_activity: true,
    show_readme: true,
    show_partners: true,
    show_email: false,
  });

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  const handleAddSkill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!skillInput.trim()) return;
    if (!skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const sanitizedUsername = username.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().trim();
      const updates: Partial<UserProfile> = {
        full_name: fullName.trim(),
        username: sanitizedUsername,
        role: role.trim(),
        location: location.trim(),
        education: education.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim(),
        website: website.trim(),
        github_username: githubUser.trim(),
        linkedin_url: linkedinUrl.trim(),
        skills,
        privacy,
      };

      const updated = await DataService.updateProfile(currentUser.id, updates);
      if (onProfileUpdated) onProfileUpdated(updated);
      setStatusMsg({ text: 'Profile updated successfully!', type: 'success' });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to update profile.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-xs">Edit Developer Profile</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            style={{ color: 'var(--ide-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b text-xs px-5 pt-2" style={{ borderColor: 'var(--ide-border)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>General Info</span>
          </button>
          <button
            onClick={() => setActiveTab('links')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'links'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Links & Handles</span>
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 px-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent opacity-70 hover:opacity-100'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy Controls</span>
          </button>
        </div>

        {/* Status Alert */}
        {statusMsg && (
          <div 
            className={`mx-5 mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
              statusMsg.type === 'success' 
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1 opacity-80">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1 opacity-80">Username (@handle)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">Title / Headline</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Full Stack Developer · Systems Engineering"
                  className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium mb-1 opacity-80">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mumbai, India"
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1 opacity-80">Education</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. B.Tech Computer Engineering"
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell other developers about yourself..."
                  className="w-full p-2 text-xs rounded-lg border outline-none resize-none focus:ring-1 focus:ring-sky-500"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                  style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                />
              </div>

              {/* Skills Tags */}
              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">Skills & Technologies</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSkill(e)}
                    placeholder="Add technology (e.g. Next.js, Python)..."
                    className="flex-1 p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddSkill()}
                    className="px-3 py-2 text-xs font-medium text-white rounded-lg transition-colors"
                    style={{ backgroundColor: 'var(--ide-accent)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border"
                      style={{
                        backgroundColor: 'var(--ide-dock-header)',
                        borderColor: 'var(--ide-border)',
                      }}
                    >
                      {s}
                      <button 
                        type="button" 
                        onClick={() => handleRemoveSkill(s)} 
                        className="hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'links' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">Personal Website</label>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">GitHub Username</label>
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                  <input
                    type="text"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="githubusername"
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 opacity-80">LinkedIn Profile URL</label>
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full p-2 text-xs rounded-lg border outline-none focus:ring-1 focus:ring-sky-500"
                    style={{ backgroundColor: 'var(--ide-input-bg)', borderColor: 'var(--ide-border)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-2.5">
              <p className="text-xs mb-3" style={{ color: 'var(--ide-text-muted)' }}>
                Control which fields are visible to other developers on your public profile.
              </p>

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
                const checked = (privacy as any)[key] ?? false;
                return (
                  <label 
                    key={key} 
                    className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:bg-white/5 transition-colors"
                    style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
                  >
                    <span className="text-xs font-medium">{label}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setPrivacy({ ...privacy, [key]: e.target.checked })}
                      className="w-4 h-4 rounded text-sky-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-5 py-3 border-t flex items-center justify-end gap-2"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border hover:bg-white/5 transition-colors"
            style={{ borderColor: 'var(--ide-border)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white rounded transition-colors shadow-sm"
            style={{ backgroundColor: 'var(--ide-accent)' }}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Save Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
