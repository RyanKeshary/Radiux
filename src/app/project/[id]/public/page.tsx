'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Code2, 
  Users, 
  GitBranch, 
  ExternalLink, 
  Star, 
  Eye, 
  FolderGit2, 
  ArrowLeft, 
  FileText, 
  Sparkles, 
  ShieldCheck,
  Globe,
  Share2
} from 'lucide-react';
import { DataService } from '@/lib/data-service';
import { FileItem, ProjectMember } from '@/lib/types';

interface PublicProjectPageProps {
  params: {
    id: string;
  };
}

export default function PublicProjectPage({ params }: PublicProjectPageProps) {
  const { id } = params;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [p, members, files] = await Promise.all([
          DataService.getProject(id),
          DataService.getMembers(id).catch(() => [] as ProjectMember[]),
          DataService.getFiles(id).catch(() => [] as FileItem[]),
        ]);

        if (p) {
          // Calculate real metrics from actual project files
          const textFiles = (files as FileItem[]).filter((f: FileItem) => !f.is_folder);
          let totalLines = 0;
          const techSet = new Set<string>();

          textFiles.forEach((f: FileItem) => {
            if (f.content) {
              totalLines += f.content.split('\n').length;
            }
            const ext = f.name.split('.').pop()?.toLowerCase();
            if (ext === 'ts' || ext === 'tsx') techSet.add('TypeScript');
            else if (ext === 'js' || ext === 'jsx') techSet.add('JavaScript');
            else if (ext === 'py') techSet.add('Python');
            else if (ext === 'html') techSet.add('HTML');
            else if (ext === 'css') techSet.add('CSS');
            else if (ext === 'json') techSet.add('JSON');
            else if (ext === 'md') techSet.add('Markdown');
            else if (ext === 'go') techSet.add('Go');
            else if (ext === 'rs') techSet.add('Rust');
          });

          // Find real README file if present
          const readmeFile = textFiles.find((f: FileItem) => f.name.toLowerCase() === 'readme.md');
          const realReadme = readmeFile?.content || null;

          // Resolve owner
          const ownerMember = (members as ProjectMember[]).find((m: ProjectMember) => m.role === 'owner') || members[0];
          const ownerProfile = (ownerMember as any)?.profile || {
            name: 'Workspace Owner',
            avatar: '',
          };

          const contributors = (members as ProjectMember[]).map((m: any) => ({
            name: m.profile?.full_name || m.profile?.username || 'Collaborator',
            avatar: m.profile?.avatar_url || '',
          }));

          setProject({
            id: p.id,
            name: p.name,
            description: p.description,
            visibility: 'public',
            fileCount: textFiles.length,
            linesOfCode: totalLines,
            technologies: Array.from(techSet),
            owner: {
              name: ownerProfile.full_name || ownerProfile.username || 'Workspace Owner',
              avatar: ownerProfile.avatar_url || '',
            },
            contributors: contributors.length > 0 ? contributors : [{
              name: ownerProfile.full_name || 'Owner',
              avatar: ownerProfile.avatar_url || '',
            }],
            readme: realReadme,
          });
        } else {
          setProject(null);
        }
      } catch (err) {
        console.error('Failed to load public project:', err);
        setProject(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Workspace Not Found</h2>
        <p className="text-sm text-neutral-400 max-w-sm">
          This project could not be located or has not been made publicly accessible.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-neutral-200 selection:bg-sky-500/30 font-sans">
      {/* Top Navbar */}
      <header className="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Radiux" className="w-6 h-6 object-contain rounded" />
            <span className="font-bold text-white tracking-wide">RADIUX</span>
          </Link>
          <span className="text-neutral-500 text-xs">/</span>
          <span className="text-xs font-mono text-neutral-400">Public Showcase</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-neutral-300 flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <Link
            href={`/project/${project.id}`}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-600/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Radiux IDE</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Project Hero Card */}
        <div className="p-8 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent space-y-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">
                  {project.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Public
                </span>
              </div>
              <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed">
                {project.description || 'No description provided.'}
              </p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/5 text-center">
                <div className="text-lg font-bold text-white">{project.fileCount || 0}</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Files</div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/5 text-center">
                <div className="text-lg font-bold text-white">{project.linesOfCode || 0}</div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Lines</div>
              </div>
            </div>
          </div>

          {/* Tech Stack Pills */}
          {project.technologies && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {project.technologies.map((tech: string) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-neutral-300"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Contributors & Owner */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span>Maintained by:</span>
              <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                {project.owner?.avatar && (
                  <img src={project.owner.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                )}
                <span>{project.owner?.name || 'Developer'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span>Contributors:</span>
              <div className="flex items-center -space-x-1.5">
                {(project.contributors || []).map((c: any, i: number) => (
                  <img
                    key={i}
                    src={c.avatar}
                    alt={c.name}
                    title={c.name}
                    className="w-6 h-6 rounded-full border border-black object-cover"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* README & Project Documentation */}
        <div className="p-8 rounded-2xl border border-white/10 bg-black/40 space-y-4">
          <div className="flex items-center gap-2 font-semibold text-sm text-neutral-200 pb-3 border-b border-white/5">
            <FileText className="w-4 h-4 text-sky-400" />
            <span>README.md</span>
          </div>

          <div className="prose prose-invert max-w-none text-xs leading-relaxed text-neutral-300 whitespace-pre-wrap font-mono bg-black/30 p-4 rounded-xl border border-white/5">
            {project.readme || '# ' + project.name + '\n\nPublic project workspace.'}
          </div>
        </div>
      </main>
    </div>
  );
}
