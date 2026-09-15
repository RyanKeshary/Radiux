'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/lib/data-service';
import { Project } from '@/lib/types';
import { UserMenu } from '@/components/auth/UserMenu';
import { AuthModal } from '@/components/auth/AuthModal';
import { CreateProjectModal } from '@/components/dashboard/CreateProjectModal';
import { ImportProjectModal } from '@/components/dashboard/ImportProjectModal';
import { ImportWorkspaceModal } from '@/components/dashboard/ImportWorkspaceModal';
import { 
  Code2, 
  FolderGit2, 
  Plus, 
  Clock, 
  ArrowRight,
  FileCode, 
  LogIn, 
  Upload, 
  FolderArchive, 
  Download,
  Search,
  LayoutGrid,
  List,
  Trash2,
  Users,
  Terminal,
  GitBranch,
  Sparkles,
  Zap,
  Server,
  Globe
} from 'lucide-react';

interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
  icon: any;
  color: string;
  starterFile: { name: string; content: string; language: string };
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'react-spa',
    name: 'React + TypeScript SPA',
    description: 'Modern client-side Single Page App with components & state',
    badge: 'Frontend',
    icon: Zap,
    color: 'from-sky-500/20 to-blue-600/20 border-sky-500/30 text-sky-400',
    starterFile: {
      name: 'App.tsx',
      language: 'typescript',
      content: `// CodeCollab React Starter\nimport React, { useState } from 'react';\n\nexport function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>\n      <h1>Welcome to CodeCollab</h1>\n      <p>Collaborative React Workspace</p>\n      <button onClick={() => setCount(c => c + 1)} style={{ padding: '8px 16px', borderRadius: '6px' }}>\n        Count: {count}\n      </button>\n    </div>\n  );\n}\n`,
    }
  },
  {
    id: 'nodejs-express',
    name: 'Node.js Express API',
    description: 'RESTful backend service with routing and middleware',
    badge: 'Backend',
    icon: Server,
    color: 'from-emerald-500/20 to-teal-600/20 border-emerald-500/30 text-emerald-400',
    starterFile: {
      name: 'server.js',
      language: 'javascript',
      content: `// CodeCollab Node.js Express Starter\nconst express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(express.json());\n\napp.get('/', (req, res) => {\n  res.json({ message: 'CodeCollab API is live!', timestamp: new Date().toISOString() });\n});\n\napp.listen(PORT, () => {\n  console.log(\`Server running on http://localhost:\${PORT}\`);\n});\n`,
    }
  },
  {
    id: 'python-service',
    name: 'Python FastAPI / Flask',
    description: 'Lightweight high-performance Python microservice',
    badge: 'Python',
    icon: Terminal,
    color: 'from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-400',
    starterFile: {
      name: 'main.py',
      language: 'python',
      content: `# CodeCollab Python Starter\nimport json\nfrom datetime import datetime\n\ndef handler():\n    print("CodeCollab Python 3.11 Runtime Initialized")\n    data = {\n        "status": "operational",\n        "timestamp": datetime.utcnow().isoformat(),\n        "collaborators": 1\n    }\n    print(json.dumps(data, indent=2))\n\nif __name__ == "__main__":\n    handler()\n`,
    }
  },
  {
    id: 'modern-web',
    name: 'Modern Web HTML/CSS/JS',
    description: 'Zero-config responsive site with interactive DOM and live preview',
    badge: 'Web',
    icon: Globe,
    color: 'from-purple-500/20 to-pink-600/20 border-purple-500/30 text-purple-400',
    starterFile: {
      name: 'index.html',
      language: 'html',
      content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>CodeCollab Web App</title>\n  <style>\n    body { font-family: system-ui, sans-serif; background: #0f172a; color: white; display: grid; place-content: center; height: 100vh; margin: 0; }\n    .card { background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); text-align: center; }\n  </style>\n</head>\n<body>\n  <div class="card">\n    <h1>CodeCollab Modern Web</h1>\n    <p>Live collaborative preview ready.</p>\n  </div>\n</body>\n</html>\n`,
    }
  }
];

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportProjectOpen, setIsImportProjectOpen] = useState(false);
  const [isImportWorkspaceOpen, setIsImportWorkspaceOpen] = useState(false);
  const [exportingWorkspace, setExportingWorkspace] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'owned' | 'shared'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'alphabetical'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null);

  // Project Deletion State
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
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
    fetchProjects();
  }, [user]);

  const handleExportAllWorkspaces = async () => {
    if (!user) return;
    setExportingWorkspace(true);
    try {
      await DataService.exportCompleteWorkspace(user.id);
    } catch (e) {
      console.error('Export all failed:', e);
      alert('Failed to export workspace');
    } finally {
      setExportingWorkspace(false);
    }
  };

  const handleCreateFromTemplate = async (template: StarterTemplate) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    setCreatingTemplateId(template.id);
    try {
      const newProj = await DataService.createProject(
        `${template.name} Project`,
        template.description,
        user
      );
      // Add the specific starter file
      await DataService.createFile(
        newProj.id,
        null,
        template.starterFile.name,
        false,
        template.starterFile.content
      );
      setProjects([newProj, ...projects]);
      window.location.href = `/project/${newProj.id}`;
    } catch (e: any) {
      console.error('Failed to instantiate template:', e);
      alert('Could not instantiate template: ' + (e.message || 'Unknown error'));
    } finally {
      setCreatingTemplateId(null);
    }
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteProject(projectToDelete.id);
      setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err: any) {
      alert('Failed to delete workspace: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered & Sorted Projects
  const processedProjects = useMemo(() => {
    let list = [...projects];

    // Filter by ownership
    if (filterType === 'owned') {
      list = list.filter(p => p.owner_id === user?.id);
    } else if (filterType === 'shared') {
      list = list.filter(p => p.owner_id !== user?.id);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sortBy === 'updated') {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === 'created') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [projects, filterType, searchQuery, sortBy, user?.id]);

  return (
    <div className="min-h-screen bg-[#141414] text-[#cccccc] flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 border-b border-[#2d2d2d] bg-[#1a1a1a] px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">
              CodeCollab
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {!user && !authLoading ? (
          <div className="p-12 text-center rounded-2xl bg-[#1e1e1e] border border-[#2d2d2d] shadow-2xl my-12">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mx-auto mb-4">
              <Code2 className="w-7 h-7" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Welcome to CodeCollab</h2>
            <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6">
              A professional browser-based collaborative IDE with Git version control, GitHub synchronization, and workspace import/export.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-600/30"
              >
                <LogIn className="w-4 h-4" />
                <span>Get Started / Sign In</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-[#1e2025] via-[#1c1f28] to-[#181d24] border border-[#2e3340] shadow-xl mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Welcome back, {user?.full_name || 'Developer'}!</span>
                </h2>
                <p className="text-xs text-neutral-400 max-w-xl">
                  Create, import or restore workspaces. Work collaboratively with Git version control, push/pull with GitHub, and export your projects whenever needed.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsImportProjectOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252526] hover:bg-[#2d2d2d] text-white border border-[#3c3c3c] font-medium text-xs transition-all"
                  title="Import project from ZIP, Folder, or GitHub"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  <span>Import Project</span>
                </button>

                <button
                  onClick={() => setIsImportWorkspaceOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252526] hover:bg-[#2d2d2d] text-white border border-[#3c3c3c] font-medium text-xs transition-all"
                  title="Restore complete workspace archive"
                >
                  <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                  <span>Restore Workspace</span>
                </button>

                <button
                  onClick={handleExportAllWorkspaces}
                  disabled={exportingWorkspace || projects.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252526] hover:bg-[#2d2d2d] text-white border border-[#3c3c3c] font-medium text-xs transition-all disabled:opacity-50"
                  title="Export all workspaces into codecollab-workspace.zip"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{exportingWorkspace ? 'Exporting...' : 'Export All'}</span>
                </button>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-md shadow-sky-600/25"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Project</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <FolderGit2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">{projects.length}</div>
                  <div className="text-[11px] text-neutral-400">Workspaces</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Multi-User</div>
                  <div className="text-[11px] text-neutral-400">Real-Time Sync</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Cloud Runtime</div>
                  <div className="text-[11px] text-neutral-400">Node.js & Python</div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e1e1e] border border-[#2e2e2e] flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-bold text-white">Git / GitHub</div>
                  <div className="text-[11px] text-neutral-400">Version Control</div>
                </div>
              </div>
            </div>

            {/* Quick Starter Templates Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>Quick Starter Templates</span>
                </h3>
                <span className="text-[11px] text-neutral-500">1-click create</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {STARTER_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isCreatingThis = creatingTemplateId === tmpl.id;
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => !isCreatingThis && handleCreateFromTemplate(tmpl)}
                      className="group p-4 rounded-xl bg-[#1e1e1e] hover:bg-[#252526] border border-[#2e2e2e] hover:border-sky-500/40 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-2 rounded-lg bg-gradient-to-br border ${tmpl.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 text-neutral-400">
                            {tmpl.badge}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-white group-hover:text-sky-300 transition-colors mb-1">
                          {tmpl.name}
                        </h4>
                        <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                          {tmpl.description}
                        </p>
                      </div>

                      <div className="pt-3 mt-2 border-t border-[#2e2e2e] flex items-center justify-between text-[11px] text-sky-400 font-medium">
                        <span>{isCreatingThis ? 'Creating...' : 'Use Template'}</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Workspaces Section Header & Filters */}
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[#2e2e2e]">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Your Collaborative Workspaces ({processedProjects.length})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search workspaces..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#333333] text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 w-44 md:w-56 transition-all"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center bg-[#1e1e1e] p-0.5 rounded-lg border border-[#333333] text-xs">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        filterType === 'all' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('owned')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        filterType === 'owned' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Owned
                    </button>
                    <button
                      onClick={() => setFilterType('shared')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${
                        filterType === 'shared' ? 'bg-sky-600 text-white font-medium' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Shared
                    </button>
                  </div>

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#333333] text-xs text-neutral-300 focus:outline-none focus:border-sky-500"
                  >
                    <option value="updated">Recently Updated</option>
                    <option value="created">Recently Created</option>
                    <option value="alphabetical">Alphabetical (A-Z)</option>
                  </select>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#1e1e1e] p-0.5 rounded-lg border border-[#333333]">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                      }`}
                      title="Grid view"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-md transition-colors ${
                        viewMode === 'list' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                      }`}
                      title="List view"
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {loading || authLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 rounded-xl bg-[#1e1e1e] animate-pulse border border-[#2e2e2e]" />
                  ))}
                </div>
              ) : processedProjects.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e]">
                  <FileCode className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
                  <h4 className="text-base font-medium text-white mb-1">
                    {searchQuery ? 'No matching workspaces' : 'No workspaces found'}
                  </h4>
                  <p className="text-xs text-neutral-400 mb-4">
                    {searchQuery 
                      ? `No workspaces match "${searchQuery}". Clear your search or create a new workspace.` 
                      : 'Get started by creating your first collaborative workspace or using a starter template.'}
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-medium inline-flex items-center gap-1.5 shadow-md shadow-sky-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Project</span>
                  </button>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {processedProjects.map((project) => {
                    const isOwner = project.owner_id === user?.id;
                    return (
                      <div
                        key={project.id}
                        className="group flex flex-col justify-between p-5 rounded-xl bg-[#1e1e1e] hover:bg-[#242426] border border-[#2e2e2e] hover:border-sky-500/40 transition-all shadow-md hover:shadow-xl relative"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <Link href={`/project/${project.id}`} className="min-w-0 flex-1">
                              <h4 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors line-clamp-1">
                                {project.name}
                              </h4>
                            </Link>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                isOwner 
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {isOwner ? 'Owner' : 'Member'}
                              </span>

                              {isOwner && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setProjectToDelete(project);
                                  }}
                                  className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete workspace"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          <Link href={`/project/${project.id}`}>
                            <p className="text-xs text-neutral-400 line-clamp-2 mb-4">
                              {project.description || 'No description provided.'}
                            </p>
                          </Link>
                        </div>

                        <Link
                          href={`/project/${project.id}`}
                          className="pt-3 border-t border-[#2e2e2e] flex items-center justify-between text-[11px] text-neutral-400"
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sky-400 group-hover:translate-x-0.5 transition-transform font-medium">
                            <span>Open Workspace</span>
                            <ArrowRight className="w-3 h-3" />
                          </div>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* List View */
                <div className="rounded-xl border border-[#2e2e2e] overflow-hidden bg-[#1e1e1e] divide-y divide-[#2e2e2e]">
                  {processedProjects.map((project) => {
                    const isOwner = project.owner_id === user?.id;
                    return (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-4 hover:bg-[#252526] transition-colors group"
                      >
                        <Link href={`/project/${project.id}`} className="min-w-0 flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                              {project.name}
                            </span>
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-medium ${
                              isOwner 
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {isOwner ? 'Owner' : 'Member'}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 truncate">
                            {project.description || 'No description provided.'}
                          </p>
                        </Link>

                        <div className="flex items-center gap-4 text-xs text-neutral-400 flex-shrink-0">
                          <div className="hidden sm:flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                          </div>

                          {isOwner && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setProjectToDelete(project);
                              }}
                              className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete workspace"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}

                          <Link
                            href={`/project/${project.id}`}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600/10 text-sky-400 border border-sky-500/20 hover:bg-sky-600 hover:text-white transition-all font-medium text-xs"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-xl bg-[#222222] border border-[#3c3c3c] p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-white">Delete Workspace?</h4>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-white">{projectToDelete.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg bg-[#333333] hover:bg-[#3e3e3e] text-xs text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProjectConfirm}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Workspace'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newP) => {
          setProjects([newP, ...projects]);
        }}
      />

      {user && (
        <>
          <ImportProjectModal
            isOpen={isImportProjectOpen}
            onClose={() => setIsImportProjectOpen(false)}
            user={user}
            onProjectImported={(newP) => {
              setProjects([newP, ...projects]);
            }}
          />

          <ImportWorkspaceModal
            isOpen={isImportWorkspaceOpen}
            onClose={() => setIsImportWorkspaceOpen(false)}
            user={user}
            onSuccess={fetchProjects}
          />
        </>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode="signin"
      />
    </div>
  );
}
