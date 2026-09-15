'use client';

import React, { useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import { DataService } from '@/lib/data-service';
import { useRouter } from 'next/navigation';
import { 
  FolderGit2, 
  Search, 
  X, 
  Plus, 
  Shield, 
  Clock, 
  Check,
  FolderOpen
} from 'lucide-react';

interface ProjectSwitcherModalProps {
  currentProjectId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreateNewProject?: () => void;
}

export function ProjectSwitcherModal({
  currentProjectId,
  userId,
  isOpen,
  onClose,
  onCreateNewProject,
}: ProjectSwitcherModalProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      DataService.getProjects(userId).then((list) => {
        setProjects(list);
        setLoading(false);
      });
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (projectId: string) => {
    if (projectId === currentProjectId) {
      onClose();
      return;
    }
    router.push(`/project/${projectId}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        className="w-full max-w-lg rounded-xl shadow-2xl border flex flex-col overflow-hidden text-xs"
        style={{
          backgroundColor: 'var(--ide-card-bg)',
          borderColor: 'var(--ide-border)',
          color: 'var(--ide-text)',
        }}
      >
        {/* Search Header */}
        <div 
          className="p-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <Search className="w-4 h-4 text-neutral-500 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Switch workspace / project (search name)..."
            autoFocus
            className="flex-1 bg-transparent text-white placeholder-neutral-500 text-xs focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Project List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-white/5 p-1">
          {loading ? (
            <div className="py-8 text-center text-neutral-500">Loading workspaces...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">No workspaces match &quot;{search}&quot;.</div>
          ) : (
            filtered.map((proj) => {
              const isCurrent = proj.id === currentProjectId;
              return (
                <div
                  key={proj.id}
                  onClick={() => handleSelect(proj.id)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-sky-500/15 text-white font-medium border border-sky-500/30'
                      : 'hover:bg-white/5 text-neutral-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isCurrent ? 'text-sky-400' : 'text-neutral-500'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white truncate text-[12px]">{proj.name}</span>
                        {proj.role === 'owner' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 uppercase">
                            Owner
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 uppercase">
                            Member
                          </span>
                        )}
                      </div>
                      {proj.description && (
                        <p className="text-[11px] text-neutral-500 truncate mt-0.5">{proj.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCurrent ? (
                      <span className="flex items-center gap-1 text-[10px] text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Current
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-500">Open</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-3 py-2 border-t flex items-center justify-between text-[11px] text-neutral-400 bg-black/20"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          <span>Use ↑ ↓ to navigate, Enter to select</span>
          {onCreateNewProject && (
            <button
              onClick={() => {
                onClose();
                onCreateNewProject();
              }}
              className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
