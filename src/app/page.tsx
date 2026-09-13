'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { Project } from '@/lib/types';
import { UserSwitcher } from '@/components/auth/UserSwitcher';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { 
  Code2, 
  FolderGit2, 
  Plus, 
  Users, 
  Clock, 
  Shield, 
  ArrowRight,
  Database,
  Radio,
  FileCode
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading, isSupabase } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await DataService.getProjects(user.id);
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-[#181818] text-[#cccccc] flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-[#2d2d2d] bg-[#1e1e1e] px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              CodeCollab
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Level 1 Collaborative IDE
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mr-2">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Sync Engine: Yjs + WebSocket
            </span>
            <span className="text-neutral-600">|</span>
            <span className="inline-flex items-center gap-1 text-sky-400">
              <Database className="w-3.5 h-3.5" />
              {isSupabase ? 'Supabase Postgres' : 'Local Persistence'}
            </span>
          </div>

          <UserSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#252526] via-[#202228] to-[#1c2230] border border-[#333742] shadow-xl mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">
              Welcome back, {user?.full_name || 'Developer'}!
            </h2>
            <p className="text-xs text-neutral-400 max-w-xl">
              Open an existing project or spin up a new collaborative workspace. Share project links with peers to edit files simultaneously with live cursors and zero conflict.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg shadow-sky-600/25 hover:shadow-sky-500/40"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Projects Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-sky-400" />
              <span>Your Collaborative Workspaces ({projects.length})</span>
            </h3>
          </div>

          {loading || authLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-xl bg-[#252526] animate-pulse border border-[#333333]" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#222222] border border-[#2e2e2e]">
              <FileCode className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
              <h4 className="text-base font-medium text-white mb-1">No Projects Found</h4>
              <p className="text-xs text-neutral-400 mb-4">
                Get started by creating your first collaborative workspace.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Create Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const isOwner = project.owner_id === user?.id;
                return (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="group flex flex-col justify-between p-5 rounded-xl bg-[#252526] hover:bg-[#2a2a2b] border border-[#333333] hover:border-sky-500/50 transition-all shadow-md hover:shadow-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                          {project.name}
                        </h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isOwner 
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {isOwner ? 'Owner' : 'Member'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-2 mb-4">
                        {project.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#333333] flex items-center justify-between text-[11px] text-neutral-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sky-400 group-hover:translate-x-0.5 transition-transform font-medium">
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newP) => {
          setProjects([newP, ...projects]);
        }}
      />
    </div>
  );
}
