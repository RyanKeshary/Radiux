'use client';

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  ShieldAlert, 
  Send, 
  CheckCircle2, 
  Loader2, 
  Bug, 
  Sparkles, 
  UserX, 
  Lock, 
  MessageSquareWarning,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  projectName?: string | null;
  defaultCategory?: string;
  defaultTitle?: string;
}

export function ReportIssueModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  defaultCategory = 'bug',
  defaultTitle = '',
}: ReportIssueModalProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<string>(defaultCategory);
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Please provide both a title and description of the issue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: user?.id || null,
          reporterEmail: user?.email || 'anonymous-user@radiux.dev',
          category,
          severity: category === 'security_concern' ? 'CRITICAL' : severity,
          title: title.trim(),
          description: description.trim(),
          projectId: projectId || null,
          priority: category === 'security_concern' ? 'CRITICAL' : severity,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmittedReportId(data.report?.id || 'rep-submitted');
    } catch (err: any) {
      setError(err.message || 'Network error occurred while submitting report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedReportId(null);
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: '#18181b',
          borderColor: '#27272a',
          color: '#f4f4f5',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Report Issue or Complaint</h3>
              <p className="text-[11px] text-zinc-400">Directly routed to the Radiux Administration and Moderation team.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 text-xs space-y-4">
          {submittedReportId ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-base text-white">Report Submitted Successfully</h4>
              <p className="text-zinc-400 text-xs max-w-sm mx-auto leading-relaxed">
                Thank you for your report. The administrative control center has received it in real time and will take appropriate action.
              </p>
              <div className="font-mono text-[11px] px-3 py-1.5 bg-zinc-900 rounded border border-zinc-800 text-zinc-300 inline-block">
                Reference ID: <span className="text-sky-400 font-bold">{submittedReportId}</span>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Category Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                  Category <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'bug', label: 'Bug / Failure', icon: Bug },
                    { id: 'security_concern', label: 'Security Issue', icon: Lock },
                    { id: 'abuse', label: 'User Abuse', icon: UserX },
                    { id: 'ai_issue', label: 'Zodiac AI Issue', icon: Sparkles },
                    { id: 'collaboration_issue', label: 'Collaboration', icon: MessageSquareWarning },
                    { id: 'other', label: 'Other Issue', icon: HelpCircle },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-sky-500/15 border-sky-500 text-white font-medium shadow-sm'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-400' : 'text-zinc-500'}`} />
                        <span className="text-[11px]">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Security Warning Banner */}
              {category === 'security_concern' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11.5px] leading-relaxed">
                  <strong>⚠️ Critical Security Notice:</strong> Security concerns are automatically marked as <strong>CRITICAL</strong> priority and dispatched to Lead Admin channels.
                </div>
              )}

              {/* Severity Selector (if not security) */}
              {category !== 'security_concern' && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                    Impact Severity
                  </label>
                  <div className="flex items-center gap-2">
                    {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSeverity(sev)}
                        className={`flex-1 py-1.5 rounded-lg border text-center font-mono text-[10px] font-bold uppercase transition-all ${
                          severity === sev
                            ? sev === 'CRITICAL'
                              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                              : sev === 'HIGH'
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-sky-500/20 border-sky-500 text-sky-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                  Subject / Summary <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Memory leak during terminal execution or inappropriate chat message"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 text-xs"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">
                  Detailed Description <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Please describe what happened, steps to reproduce, or any context that will help admins investigate..."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500 text-xs resize-none"
                  required
                />
              </div>

              {/* Project ID tag if in workspace */}
              {projectId && (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                  <span>Workspace Context Attached:</span>
                  <span className="text-zinc-400 font-semibold">{projectId}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
