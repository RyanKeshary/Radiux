'use client';

import React, { useState, useEffect } from 'react';
import { ExtensionInstance, ExtensionPermission, ExtensionManifest } from '@/lib/extensions/types';
import { ExtensionRegistry } from '@/lib/extensions/registry';
import { 
  Search, 
  Settings, 
  Check, 
  ChevronDown, 
  ChevronRight, 
  X, 
  ExternalLink,
  Code2,
  Palette,
  Terminal,
  Layers,
  Sparkles,
  ShieldCheck,
  Star,
  Download,
  Filter,
  FileCode,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface ExtensionsPanelProps {
  onOpenSettings?: () => void;
  isCompact?: boolean;
}

// Additional marketplace recommendations to match VS Code experience
const RECOMMENDED_MARKETPLACE_EXTENSIONS: ExtensionManifest[] = [
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier - Code Formatter',
    version: '10.1.0',
    author: 'Prettier',
    description: 'Code formatter using prettier for JavaScript, TypeScript, HTML, CSS, JSON, and Markdown.',
    category: 'Productivity',
    permissions: ['commands', 'shortcuts'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'prettier.formatDocument', title: 'Format Document', category: 'Prettier' },
      ],
    },
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'ESLint & Code Linter',
    version: '2.4.2',
    author: 'Microsoft',
    description: 'Integrates ESLint into Radiux to statically analyze code and rapidly find problems.',
    category: 'Editor',
    permissions: ['editor.decorations', 'commands'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'eslint.fixAllProblems', title: 'Fix all auto-fixable Problems', category: 'ESLint' },
      ],
    },
  },
  {
    id: 'ms-python.python',
    name: 'Python IntelliSense & LSP',
    version: '2024.4.1',
    author: 'Microsoft',
    description: 'Rich support for the Python language including IntelliSense, linting, debugging, and code navigation.',
    category: 'Languages',
    permissions: ['commands', 'ui.panel'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'python.runFile', title: 'Run Python File in Terminal', category: 'Python' },
      ],
    },
  },
  {
    id: 'bradlc.vscode-tailwindcss',
    name: 'Tailwind CSS IntelliSense',
    version: '0.9.11',
    author: 'Tailwind Labs',
    description: 'Intelligent Tailwind CSS tooling for Radiux including autocomplete, syntax highlighting, and linting.',
    category: 'Editor',
    permissions: ['editor.decorations'],
    activationEvents: ['onStartup'],
    contributions: {
      commands: [
        { id: 'tailwind.showConfig', title: 'Inspect Tailwind Config', category: 'Tailwind' },
      ],
    },
  },
];

export function ExtensionsPanel({ onOpenSettings, isCompact = false }: ExtensionsPanelProps) {
  const [extensions, setExtensions] = useState<ExtensionInstance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedOpen, setInstalledOpen] = useState(true);
  const [recommendedOpen, setRecommendedOpen] = useState(true);
  const [selectedExt, setSelectedExt] = useState<ExtensionManifest | null>(null);
  const [detailsTab, setDetailsTab] = useState<'details' | 'contributions' | 'permissions'>('details');
  const [openMenuExtId, setOpenMenuExtId] = useState<string | null>(null);

  const refreshList = () => {
    const list = ExtensionRegistry.getExtensions();
    setExtensions(list);
  };

  useEffect(() => {
    refreshList();
    const handleUpdate = () => refreshList();
    window.addEventListener('radiux:extensions-updated', handleUpdate);
    return () => window.removeEventListener('radiux:extensions-updated', handleUpdate);
  }, []);

  const handleToggle = (id: string, currentState: boolean) => {
    ExtensionRegistry.toggleExtension(id, !currentState);
    refreshList();
  };

  const handleInstallRecommended = (manifest: ExtensionManifest) => {
    // Add to installed extensions
    const current = ExtensionRegistry.getExtensions();
    if (!current.some((e) => e.manifest.id === manifest.id)) {
      const newInst: ExtensionInstance = {
        manifest,
        enabled: true,
        active: true,
        installedAt: new Date().toISOString(),
      };
      const updated = [...current, newInst];
      if (typeof window !== 'undefined') {
        localStorage.setItem('radiux_installed_extensions', JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('radiux:extensions-updated'));
      }
      refreshList();
    }
  };

  const handleUninstall = (id: string) => {
    const current = ExtensionRegistry.getExtensions();
    const updated = current.filter((e) => e.manifest.id !== id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('radiux_installed_extensions', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('radiux:extensions-updated'));
    }
    refreshList();
    if (selectedExt?.id === id) {
      setSelectedExt(null);
    }
  };

  // Filter installed
  const installedFiltered = extensions.filter((ext) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      ext.manifest.name.toLowerCase().includes(q) ||
      ext.manifest.description.toLowerCase().includes(q) ||
      ext.manifest.author.toLowerCase().includes(q)
    );
  });

  // Filter recommended
  const installedIds = new Set(extensions.map((e) => e.manifest.id));
  const recommendedFiltered = RECOMMENDED_MARKETPLACE_EXTENSIONS.filter((rec) => {
    if (installedIds.has(rec.id)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      rec.name.toLowerCase().includes(q) ||
      rec.description.toLowerCase().includes(q) ||
      rec.author.toLowerCase().includes(q)
    );
  });

  // Pick an icon representation for extension
  const getExtensionIcon = (id: string, category: string) => {
    if (id.includes('markdown')) {
      return (
        <div className="w-9 h-9 rounded bg-[#007acc]/20 border border-[#007acc]/30 flex items-center justify-center text-[#38bdf8] flex-shrink-0 font-bold text-xs">
          M↓
        </div>
      );
    }
    if (id.includes('bracket')) {
      return (
        <div className="w-9 h-9 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 font-mono text-sm font-bold">
          {`{ }`}
        </div>
      );
    }
    if (id.includes('git')) {
      return (
        <div className="w-9 h-9 rounded bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
          <Code2 className="w-5 h-5" />
        </div>
      );
    }
    if (id.includes('nord') || category === 'Themes') {
      return (
        <div className="w-9 h-9 rounded bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
          <Palette className="w-5 h-5" />
        </div>
      );
    }
    if (id.includes('prettier')) {
      return (
        <div className="w-9 h-9 rounded bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400 flex-shrink-0 font-mono font-bold text-xs">
          P
        </div>
      );
    }
    if (id.includes('python')) {
      return (
        <div className="w-9 h-9 rounded bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center text-yellow-400 flex-shrink-0 font-mono font-bold text-xs">
          Py
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded bg-white/10 border border-white/10 flex items-center justify-center text-neutral-300 flex-shrink-0">
        <Sparkles className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col h-full text-xs select-none relative"
      style={{
        backgroundColor: 'var(--ide-bg)',
        color: 'var(--ide-text)',
      }}
    >
      {/* VS Code Style Header */}
      <div 
        className="p-2 border-b space-y-2 flex-shrink-0"
        style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-sidebar)' }}
      >
        <div className="flex items-center justify-between px-1">
          <span className="font-semibold text-[11px] tracking-wider uppercase opacity-75">
            EXTENSIONS
          </span>
          <span className="text-[10px] text-neutral-400 font-mono">
            {installedFiltered.length} installed
          </span>
        </div>

        {/* Search Input matching VS Code */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Extensions in Marketplace"
            className="w-full pl-8 pr-7 py-1 rounded bg-[#1e1e1e] border border-white/10 text-neutral-200 placeholder-neutral-500 focus:border-[#007acc] outline-none text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* VS Code Vertical Extensions List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {/* Section 1: Installed */}
        <div>
          <div 
            onClick={() => setInstalledOpen(!installedOpen)}
            className="px-2 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer bg-black/20"
          >
            <div className="flex items-center gap-1">
              {installedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Installed</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-neutral-300">
              {installedFiltered.length}
            </span>
          </div>

          {installedOpen && (
            <div className="divide-y divide-white/[0.04]">
              {installedFiltered.length === 0 ? (
                <div className="p-4 text-center text-neutral-500 text-[11px]">
                  No installed extensions found.
                </div>
              ) : (
                installedFiltered.map((ext) => {
                  const isMenuOpen = openMenuExtId === ext.manifest.id;
                  return (
                    <div
                      key={ext.manifest.id}
                      onClick={() => setSelectedExt(ext.manifest)}
                      className="p-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer flex items-start gap-2.5 group relative"
                    >
                      {/* Icon */}
                      {getExtensionIcon(ext.manifest.id, ext.manifest.category)}

                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-neutral-200 text-xs truncate group-hover:text-sky-400 transition-colors">
                            {ext.manifest.name}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-400 line-clamp-1 leading-tight">
                          {ext.manifest.description}
                        </p>

                        <div className="flex items-center gap-2 text-[10.5px] text-neutral-500 pt-0.5">
                          <span className="truncate max-w-[90px]">{ext.manifest.author}</span>
                          <span>•</span>
                          <span className="text-amber-400/80 font-mono">★ 5.0</span>
                          <span>•</span>
                          <span className="font-mono">v{ext.manifest.version}</span>
                        </div>
                      </div>

                      {/* Right Action: Gear / Disable */}
                      <div className="flex items-center gap-1 self-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggle(ext.manifest.id, ext.enabled)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            ext.enabled
                              ? 'bg-white/10 hover:bg-white/20 text-neutral-300'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                          title={ext.enabled ? 'Click to disable' : 'Click to enable'}
                        >
                          {ext.enabled ? 'Disable' : 'Enable'}
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuExtId(isMenuOpen ? null : ext.manifest.id)}
                            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                            title="Manage Extension"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>

                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 w-32 bg-[#252526] border border-white/10 rounded-lg shadow-xl py-1 z-30 text-xs">
                              <button
                                onClick={() => {
                                  handleToggle(ext.manifest.id, ext.enabled);
                                  setOpenMenuExtId(null);
                                }}
                                className="w-full text-left px-3 py-1 hover:bg-white/10 text-neutral-200"
                              >
                                {ext.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => {
                                  handleUninstall(ext.manifest.id);
                                  setOpenMenuExtId(null);
                                }}
                                className="w-full text-left px-3 py-1 hover:bg-rose-500/20 text-rose-300"
                              >
                                Uninstall
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 2: Recommended */}
        {recommendedFiltered.length > 0 && (
          <div>
            <div 
              onClick={() => setRecommendedOpen(!recommendedOpen)}
              className="px-2 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400 hover:text-white cursor-pointer bg-black/20"
            >
              <div className="flex items-center gap-1">
                {recommendedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Recommended</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-neutral-300">
                {recommendedFiltered.length}
              </span>
            </div>

            {recommendedOpen && (
              <div className="divide-y divide-white/[0.04]">
                {recommendedFiltered.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => setSelectedExt(rec)}
                    className="p-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer flex items-start gap-2.5 group"
                  >
                    {/* Icon */}
                    {getExtensionIcon(rec.id, rec.category)}

                    {/* Info */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="font-semibold text-neutral-200 text-xs truncate group-hover:text-sky-400 transition-colors block">
                        {rec.name}
                      </span>
                      <p className="text-[11px] text-neutral-400 line-clamp-1 leading-tight">
                        {rec.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10.5px] text-neutral-500 pt-0.5">
                        <span className="truncate max-w-[80px]">{rec.author}</span>
                        <span>•</span>
                        <span className="text-amber-400/80 font-mono">★ 4.9</span>
                      </div>
                    </div>

                    {/* Install Button (VS Code Blue) */}
                    <div className="self-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleInstallRecommended(rec)}
                        className="px-2.5 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-[11px] font-semibold transition-colors shadow-sm"
                      >
                        Install
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* VS Code Extension Details Modal / Drawer View */}
      {selectedExt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setSelectedExt(null)}
        >
          <div 
            className="w-full max-w-2xl max-h-[85vh] bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden text-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* VS Code Extension Details Header */}
            <div className="p-6 border-b border-white/10 bg-[#252526] flex items-start gap-5">
              {getExtensionIcon(selectedExt.id, selectedExt.category)}

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{selectedExt.name}</span>
                      <span className="text-xs text-neutral-500 font-mono">v{selectedExt.version}</span>
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                      <span className="text-sky-400 font-medium">{selectedExt.author}</span>
                      <span>•</span>
                      <span className="px-2 py-0.2 rounded bg-white/10 text-neutral-300 text-[10.5px]">
                        {selectedExt.category}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedExt(null)}
                    className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed">
                  {selectedExt.description}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  {installedIds.has(selectedExt.id) ? (
                    <>
                      <button
                        onClick={() => {
                          const inst = extensions.find((e) => e.manifest.id === selectedExt.id);
                          if (inst) handleToggle(inst.manifest.id, inst.enabled);
                        }}
                        className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                      >
                        {extensions.find((e) => e.manifest.id === selectedExt.id)?.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleUninstall(selectedExt.id)}
                        className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium transition-colors border border-rose-500/30"
                      >
                        Uninstall
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstallRecommended(selectedExt)}
                      className="px-4 py-1 rounded bg-[#007acc] hover:bg-[#0062a3] text-white text-xs font-semibold transition-colors"
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subnav Tabs */}
            <div className="flex items-center gap-6 px-6 border-b border-white/10 bg-[#1e1e1e] text-xs">
              <button
                onClick={() => setDetailsTab('details')}
                className={`py-2.5 font-medium border-b-2 transition-colors ${
                  detailsTab === 'details' ? 'border-[#007acc] text-white' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setDetailsTab('contributions')}
                className={`py-2.5 font-medium border-b-2 transition-colors ${
                  detailsTab === 'contributions' ? 'border-[#007acc] text-white' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Feature Contributions
              </button>
              <button
                onClick={() => setDetailsTab('permissions')}
                className={`py-2.5 font-medium border-b-2 transition-colors ${
                  detailsTab === 'permissions' ? 'border-[#007acc] text-white' : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                Permissions
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-6 text-xs space-y-4">
              {detailsTab === 'details' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2">
                    <h3 className="font-semibold text-sm text-white">Overview</h3>
                    <p className="text-neutral-300 leading-relaxed text-xs">
                      {selectedExt.description}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold text-neutral-200">Extension Capabilities</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                      <div className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Sandboxed Web Runtime</span>
                      </div>
                      <div className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Zero Telemetry / Private</span>
                      </div>
                      <div className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Monaco Editor Integration</span>
                      </div>
                      <div className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Instant Activation</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'contributions' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-neutral-200 mb-2">Contributed Commands</h4>
                    {selectedExt.contributions.commands && selectedExt.contributions.commands.length > 0 ? (
                      <div className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden bg-black/20">
                        {selectedExt.contributions.commands.map((cmd) => (
                          <div key={cmd.id} className="p-2.5 flex items-center justify-between text-xs">
                            <span className="font-medium text-white">{cmd.title}</span>
                            <span className="font-mono text-[10.5px] text-neutral-400">{cmd.id}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-neutral-500">No commands contributed.</p>
                    )}
                  </div>
                </div>
              )}

              {detailsTab === 'permissions' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Sandboxed Capabilities</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedExt.permissions.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    This extension runs strictly within the client sandbox. It has zero arbitrary system shell access.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
