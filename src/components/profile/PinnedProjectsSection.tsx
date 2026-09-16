'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Project } from '@/lib/types';
import { 
  Pin, 
  Plus, 
  ExternalLink, 
  Lock, 
  Globe, 
  Users, 
  Github, 
  FolderGit2, 
  MoveUp, 
  MoveDown, 
  X, 
  Check, 
  AlertCircle 
} from 'lucide-react';

interface PinnedProjectsSectionProps {
  pinnedProjects: Project[];
  allProjects?: Project[];
  isOwner: boolean;
  onUpdatePinned?: (projectIds: string[]) => Promise<void>;
}

export function PinnedProjectsSection({
  pinnedProjects,
  allProjects = [],
  isOwner,
  onUpdatePinned,
}: PinnedProjectsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    pinnedProjects.map((p) => p.id).slice(0, 4)
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenModal = () => {
    setSelectedIds(pinnedProjects.map((p) => p.id).slice(0, 4));
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleTogglePin = (projectId: string) => {
    setErrorMsg(null);
    if (selectedIds.includes(projectId)) {
      setSelectedIds(selectedIds.filter((id) => id !== projectId));
    } else {
      if (selectedIds.length >= 4) {
        setErrorMsg('Maximum of 4 projects can be pinned to your profile. Please unpin a project first.');
        return;
      }
      setSelectedIds([...selectedIds, projectId]);
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedIds.length) return;
    const reordered = [...selectedIds];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;
    setSelectedIds(reordered);
  };

  const handleSave = async () => {
    if (!onUpdatePinned) return;
    setIsSaving(true);
    try {
      await onUpdatePinned(selectedIds.slice(0, 4));
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-sky-400 rotate-45" />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ide-text)' }}>
            Pinned Projects
          </h3>
          <span 
            className="text-[11px] px-1.5 py-0.5 rounded font-mono"
            style={{
              backgroundColor: 'var(--ide-dock-header)',
              color: 'var(--ide-text-muted)',
            }}
          >
            {pinnedProjects.length}/4
          </span>
        </div>

        {isOwner && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded border hover:opacity-90 transition-opacity"
            style={{
              borderColor: 'var(--ide-border)',
              backgroundColor: 'var(--ide-card-bg)',
              color: 'var(--ide-text)',
            }}
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Customize Pinned</span>
          </button>
        )}
      </div>

      {/* Grid: Up to 4 cards (2x2 on desktop) */}
      {pinnedProjects.length === 0 ? (
        <div 
          className="p-8 rounded-xl border text-center space-y-2"
          style={{
            backgroundColor: 'var(--ide-card-bg)',
            borderColor: 'var(--ide-border)',
          }}
        >
          <FolderGit2 className="w-8 h-8 text-neutral-500 mx-auto opacity-50" />
          <p className="text-xs font-medium" style={{ color: 'var(--ide-text-muted)' }}>
            No pinned projects to display.
          </p>
          {isOwner && (
            <button
              onClick={handleOpenModal}
              className="text-xs text-sky-400 font-medium hover:underline inline-block mt-1"
            >
              Pin up to 4 showcase workspaces →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pinnedProjects.map((project) => (
            <div
              key={project.id}
              className="group p-4 rounded-xl border shadow-sm flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden"
              style={{
                backgroundColor: 'var(--ide-card-bg)',
                borderColor: 'var(--ide-border)',
                color: 'var(--ide-text)',
              }}
            >
              <div>
                {/* Project Title & Privacy Badge */}
                <div className="flex items-start justify-between gap-2">
                  <Link 
                    href={`/project/${project.id}`}
                    className="font-semibold text-xs text-sky-400 hover:underline flex items-center gap-1.5 truncate"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{project.name}</span>
                  </Link>

                  <span 
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border flex-shrink-0"
                    style={{
                      borderColor: 'var(--ide-border)',
                      backgroundColor: 'var(--ide-dock-header)',
                      color: 'var(--ide-text-muted)',
                    }}
                  >
                    <Globe className="w-2.5 h-2.5" />
                    Public
                  </span>
                </div>

                {/* Description */}
                <p 
                  className="text-[11.5px] mt-2 line-clamp-2 leading-relaxed"
                  style={{ color: 'var(--ide-text-muted)' }}
                >
                  {project.description || 'Modern collaborative cloud workspace built with Radiux.'}
                </p>
              </div>

              {/* Card Footer: Metadata & Quick Links */}
              <div className="pt-4 mt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: 'var(--ide-border)', color: 'var(--ide-text-muted)' }}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
                    TypeScript
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/project/${project.id}`}
                    className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:underline"
                  >
                    <span>Launch</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customize Pinned Projects Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in select-none"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            style={{
              backgroundColor: 'var(--ide-card-bg)',
              borderColor: 'var(--ide-border)',
              color: 'var(--ide-text)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="px-5 py-3 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
            >
              <div className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-sky-400 rotate-45" />
                <span className="font-semibold text-xs">Customize Pinned Projects ({selectedIds.length}/4)</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-white/10"
                style={{ color: 'var(--ide-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Content: Selected List + Available Projects */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ide-text-muted)' }}>
                  Selected Order (Max 4)
                </h4>
                {selectedIds.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic">No projects selected yet. Check projects below to pin.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedIds.map((id, index) => {
                      const proj = allProjects.find((p) => p.id === id);
                      return (
                        <div 
                          key={id}
                          className="flex items-center justify-between p-2 rounded-lg border text-xs"
                          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[10px] text-sky-400 font-bold">{index + 1}.</span>
                            <span className="font-medium truncate">{proj?.name || id}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              disabled={index === 0}
                              onClick={() => handleMove(index, 'up')}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                              title="Move Up"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={index === selectedIds.length - 1}
                              onClick={() => handleMove(index, 'down')}
                              className="p-1 rounded hover:bg-white/10 disabled:opacity-30"
                              title="Move Down"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleTogglePin(id)}
                              className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                              title="Unpin"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ide-text-muted)' }}>
                  All Workspaces
                </h4>
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {allProjects.map((p) => {
                    const isPinned = selectedIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleTogglePin(p.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-lg border text-xs text-left transition-colors ${
                          isPinned ? 'border-sky-500/50 bg-sky-500/10' : 'hover:bg-white/5'
                        }`}
                        style={{ borderColor: isPinned ? undefined : 'var(--ide-border)' }}
                      >
                        <div className="truncate pr-2">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-[10.5px] truncate" style={{ color: 'var(--ide-text-muted)' }}>
                            {p.description || 'No description'}
                          </div>
                        </div>
                        <div 
                          className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 ${
                            isPinned ? 'bg-sky-500 border-sky-400 text-white' : 'border-neutral-600'
                          }`}
                        >
                          {isPinned && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div 
              className="px-5 py-3 border-t flex items-center justify-end gap-2"
              style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded border hover:bg-white/5 transition-colors"
                style={{ borderColor: 'var(--ide-border)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 text-xs font-medium text-white rounded transition-colors shadow-sm"
                style={{ backgroundColor: 'var(--ide-accent)' }}
              >
                {isSaving ? 'Saving...' : 'Save Pinned Projects'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
