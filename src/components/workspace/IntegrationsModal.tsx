'use client';

import React, { useState, useEffect } from 'react';
import { IntegrationConfig, IntegrationProvider, IntegrationCategory } from '@/lib/integrations/types';
import { IntegrationManager } from '@/lib/integrations/integration-manager';
import { 
  Share2, 
  Github, 
  Gitlab, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  X, 
  ExternalLink, 
  Key, 
  Link2, 
  Send, 
  RefreshCw,
  Clock,
  Layers,
  Check,
  AlertCircle
} from 'lucide-react';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationsModal({ isOpen, onClose }: IntegrationsModalProps) {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [configuringProvider, setConfiguringProvider] = useState<IntegrationConfig | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [webhookInput, setWebhookInput] = useState('');
  const [accountInput, setAccountInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const refreshList = () => {
    setIntegrations(IntegrationManager.getIntegrations());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenConfig = (item: IntegrationConfig) => {
    setConfiguringProvider(item);
    setTokenInput('');
    setWebhookInput(item.webhookUrl || '');
    setAccountInput(item.connectedAccount || '');
    setTestResult(null);
  };

  const handleSaveConnection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configuringProvider) return;

    IntegrationManager.connect(configuringProvider.provider, {
      token: tokenInput || undefined,
      webhookUrl: webhookInput || undefined,
      account: accountInput || undefined,
    });

    setConfiguringProvider(null);
    refreshList();
  };

  const handleDisconnect = (provider: IntegrationProvider) => {
    IntegrationManager.disconnect(provider);
    refreshList();
  };

  const handleTest = async (provider: IntegrationProvider) => {
    setTesting(true);
    setTestResult(null);
    const res = await IntegrationManager.testWebhook(provider);
    setTesting(false);
    setTestResult(res);
  };

  const categories: ('All' | IntegrationCategory)[] = ['All', 'Source Control', 'Communication', 'Project Management'];

  const filtered = integrations.filter(
    (item) => selectedCategory === 'All' || item.category === selectedCategory
  );

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
        className="w-full max-w-3xl max-h-[85vh] border rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="h-12 px-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)', backgroundColor: 'var(--ide-dock-header)' }}
        >
          <div className="flex items-center gap-2.5 font-semibold text-sm">
            <Share2 className="w-5 h-5 text-violet-400" />
            <span>Platform Integrations</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10.5px] font-mono text-neutral-300">
              {integrations.filter((i) => i.status === 'connected').length} connected
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div 
          className="px-5 py-2.5 border-b flex items-center gap-2 bg-black/20 flex-shrink-0"
          style={{ borderColor: 'var(--ide-border)' }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Body View */}
        <div className="flex-1 overflow-y-auto p-5">
          {configuringProvider ? (
            <form onSubmit={handleSaveConnection} className="max-w-md mx-auto space-y-4 py-2">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="font-semibold text-sm text-violet-300 flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span>Configure {configuringProvider.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setConfiguringProvider(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-neutral-400 text-xs leading-relaxed">
                {configuringProvider.description}
              </p>

              <div>
                <label className="block font-medium mb-1 text-neutral-300">Account / Workspace Name</label>
                <input
                  type="text"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                  placeholder="e.g. acme-corp"
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-violet-500 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium mb-1 text-neutral-300">API Key / Access Token</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter token (stored locally & encrypted in transit)..."
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-violet-500 outline-none font-mono"
                />
              </div>

              {(configuringProvider.provider === 'slack' || configuringProvider.provider === 'discord') && (
                <div>
                  <label className="block font-medium mb-1 text-neutral-300">Webhook URL</label>
                  <input
                    type="url"
                    value={webhookInput}
                    onChange={(e) => setWebhookInput(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white focus:border-violet-500 outline-none font-mono text-[11px]"
                  />
                </div>
              )}

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/15 border-red-500/30 text-red-300'
                  }`}
                >
                  {testResult.success ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleTest(configuringProvider.provider)}
                  disabled={testing}
                  className="px-3 py-1.5 rounded border border-white/10 hover:bg-white/10 text-neutral-300 text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfiguringProvider(null)}
                    className="px-3 py-1.5 rounded hover:bg-white/10 text-neutral-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Connect</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((item) => {
                const isConnected = item.status === 'connected';

                return (
                  <div
                    key={item.provider}
                    className={`p-4 rounded-xl border transition-all space-y-3 flex flex-col justify-between ${
                      isConnected
                        ? 'border-violet-500/30 bg-violet-500/5'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="font-semibold text-sm text-neutral-100 flex items-center gap-2">
                          <span>{item.name}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/5 text-neutral-400 font-normal">
                            {item.category}
                          </span>
                        </div>

                        {isConnected ? (
                          <span className="flex items-center gap-1 text-[10.5px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10.5px] text-neutral-400 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                            Disconnected
                          </span>
                        )}
                      </div>

                      <p className="text-[11.5px] text-neutral-400 leading-relaxed">
                        {item.description}
                      </p>

                      {isConnected && item.connectedAccount && (
                        <div className="mt-2 text-[10.5px] text-neutral-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Linked as: <strong className="text-neutral-200">{item.connectedAccount}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      {isConnected ? (
                        <>
                          <button
                            onClick={() => handleTest(item.provider)}
                            className="text-[11px] text-violet-300 hover:underline flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Test Sync
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenConfig(item)}
                              className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-neutral-200 text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDisconnect(item.provider)}
                              className="px-2 py-1 rounded text-red-400 hover:bg-red-500/10 text-[11px]"
                            >
                              Disconnect
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenConfig(item)}
                          className="w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Key className="w-3 h-3 text-violet-400" />
                          <span>Connect {item.name}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
