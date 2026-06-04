/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileText, 
  Sparkles, 
  Copy, 
  Send, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  XCircle,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { Proposal, Opportunity } from '../types.js';

interface ProposalQueueViewProps {
  onNavigate: (view: string) => void;
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function ProposalQueueView({ onNavigate, onShowToast }: ProposalQueueViewProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [jobs, setJobs] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Custom tone override state
  const [selectedTone, setSelectedTone] = useState('');
  const [selectedLength, setSelectedLength] = useState<'short' | 'medium' | 'long'>('medium');

  // Interactive Live Browser Debug HUD hook points
  const [debugProposalId, setDebugProposalId] = useState<string | null>(null);
  const [activeScreenshotFilename, setActiveScreenshotFilename] = useState<string | null>(null);
  const [isSubmittingMap, setIsSubmittingMap] = useState<Record<string, boolean>>({});
  const [archiveTab, setArchiveTab] = useState<'active' | 'archived'>('active');

  const fetchProposalsAndJobs = async () => {
    setLoading(true);
    try {
      const [pRes, jRes] = await Promise.all([
        fetch('/api/proposals'),
        fetch('/api/opportunities')
      ]);
      if (pRes.ok && jRes.ok) {
        const payload = await pRes.json();
        const sorted = payload.sort((a: any, b: any) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        setProposals(sorted);
        setJobs(await jRes.json());
      }
    } catch (e) {
      onShowToast('Could not fetch proposals queue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchProposalsAndJobsSilent = async () => {
    try {
      const [pRes, jRes] = await Promise.all([
        fetch('/api/proposals'),
        fetch('/api/opportunities')
      ]);
      if (pRes.ok && jRes.ok) {
        const payload = await pRes.json();
        const sorted = payload.sort((a: any, b: any) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        setProposals(sorted);
        setJobs(await jRes.json());
      }
    } catch (e) {
      console.error('Silent refresh failed:', e);
    }
  };

  useEffect(() => {
    fetchProposalsAndJobs();
  }, []);

  // Poll for screenshot updates and submission updates if checking execution in live terminal
  useEffect(() => {
    let intervalId: any;
    const isAnySubmitting = Object.values(isSubmittingMap).some(Boolean);
    if (debugProposalId || isAnySubmitting) {
      intervalId = setInterval(() => {
        fetchProposalsAndJobsSilent();
      }, 1500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [debugProposalId, isSubmittingMap]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Proposal copied safely to clipboard!', 'success');
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      if (response.ok) {
        onShowToast('Proposal draft saved.', 'success');
        setProposals(prev => prev.map(p => p.id === id ? { ...p, content: editContent } : p));
        setEditingId(null);
      }
    } catch (e) {
      onShowToast('Edit sync failed.', 'error');
    }
  };

  const handleUpdateProposalAttributes = async (id: string, attributes: { cost?: number; period?: number }) => {
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attributes)
      });
      if (response.ok) {
        setProposals(prev => prev.map(p => p.id === id ? { ...p, ...attributes } : p));
        onShowToast('Bid attributes updated!', 'success');
      }
    } catch (e) {
      onShowToast('Attributes sync failed.', 'error');
    }
  };

  const handleTriggerRegenerate = async (id: string, opId: string) => {
    setRegeneratingId(id);
    onShowToast('Recalling writing parameters and building new proposal...', 'info');
    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opId,
          tone: selectedTone || undefined,
          length: selectedLength
        })
      });
      if (response.ok) {
        onShowToast('Bespoke proposal regenerated successfully!', 'success');
        fetchProposalsAndJobs();
      } else {
        onShowToast('Could not regenerate proposal text.', 'error');
      }
    } catch (e) {
      onShowToast('Failed to contact Gemini API.', 'error');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSubmitProposal = async (id: string, extLink?: string) => {
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'submitted' })
      });
      if (response.ok) {
        onShowToast('Proposal status recorded as Submitted!', 'success');
        fetchProposalsAndJobs();
        if (extLink && extLink !== '#') {
          window.open(extLink, '_blank');
        }
      }
    } catch (e) {
      onShowToast('Failed to record submission.', 'error');
    }
  };

  const handleAutoSubmitProposal = async (id: string) => {
    setDebugProposalId(id);
    setActiveScreenshotFilename(null);
    setIsSubmittingMap(prev => ({ ...prev, [id]: true }));
    onShowToast('AI Agent is booting headless sandbox and navigating to target project...', 'info');
    try {
      const response = await fetch(`/api/proposals/${id}/auto-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.realPosted) {
          onShowToast('SUCCESS! Proposal was posted automatically on the freelance platform!', 'success');
        } else {
          onShowToast('Platform connection verified & redirected successfully!', 'success');
        }
        // Open the tracking/submission link in a secondary tab if available
        if (data.submittedPlatformLink && data.submittedPlatformLink !== '#') {
          window.open(data.submittedPlatformLink, '_blank');
        }
        fetchProposalsAndJobsSilent();
      } else {
        onShowToast('Auto-submit action stopped or failed.', 'error');
      }
    } catch (e) {
      onShowToast('Failed to submit proposal via agent service.', 'error');
    } finally {
      setIsSubmittingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleRejectProposal = async (id: string) => {
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (response.ok) {
        onShowToast('Proposal marked as rejected.', 'info');
        fetchProposalsAndJobs();
      }
    } catch (e) {
      onShowToast('Failed to modify proposal status.', 'error');
    }
  };

  const handleToggleArchive = async (id: string, currentlyArchived: boolean) => {
    try {
      const response = await fetch(`/api/proposals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !currentlyArchived })
      });
      if (response.ok) {
        onShowToast(
          currentlyArchived ? 'Proposal restored to active queue.' : 'Proposal archived and filtered from active view.',
          'success'
        );
        fetchProposalsAndJobsSilent();
      } else {
        onShowToast('Failed to update proposal archive state.', 'error');
      }
    } catch (e) {
      onShowToast('Failed to modify proposal archive state.', 'error');
    }
  };

  const debugProposal = proposals.find(p => p.id === debugProposalId);

  const activeCount = proposals.filter(p => !p.archived).length;
  const archivedCount = proposals.filter(p => p.archived).length;

  const filteredProposals = proposals.filter(prop => {
    if (archiveTab === 'active') {
      return !prop.archived;
    } else {
      return !!prop.archived;
    }
  });

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-[#1e2235] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileText size={22} className="text-blue-400" />
            Proposal Approval Queue
          </h1>
          <p className="text-xs text-slate-405 font-mono uppercase tracking-wide mt-1">
            Edit, regenerate, copy or submit matched freelancer bids directly.
          </p>
        </div>
        <button
          id="pq-find-jobs-btn"
          onClick={() => onNavigate('opportunities')}
          className="px-4 py-2 bg-[#0b0d16] hover:bg-[#121522] border border-[#1e2235] text-slate-300 text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition shrink-0"
        >
          Check Job Feeds
        </button>
      </div>

      {/* Tab Navigation for Active vs Archived Proposals */}
      <div className="flex border-b border-[#1e2235]/60 gap-1">
        <button
          onClick={() => setArchiveTab('active')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
            archiveTab === 'active'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Active Queue</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            archiveTab === 'active' ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-500/20' : 'bg-slate-900 text-slate-500'
          }`}>
            {activeCount}
          </span>
        </button>
        <button
          onClick={() => setArchiveTab('archived')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-2 cursor-pointer ${
            archiveTab === 'archived'
              ? 'border-indigo-500 text-indigo-400 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Archived / Hidden</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
            archiveTab === 'archived' ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-500/20' : 'bg-slate-900 text-slate-500'
          }`}>
            {archivedCount}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
          <p className="mt-3 text-slate-400 text-xs font-mono uppercase tracking-wider">Synchronizing proposal states...</p>
        </div>
      ) : filteredProposals.length === 0 ? (
        archiveTab === 'active' ? (
          <div className="text-center py-24 border border-dashed border-[#1e2235] rounded-lg bg-[#0b0d16]/30">
            <FileText size={40} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Outbox Queue Empty</h3>
            <p className="text-xs text-slate-500 font-mono mt-2 max-w-md mx-auto">
              Authorize new opportunities in the Job List or click "AI Generate Proposal" on relevant projects to populate your queue.
            </p>
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-[#1e2235] rounded-lg bg-[#0b0d16]/30">
            <EyeOff size={40} className="text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">No Dismissed Proposals</h3>
            <p className="text-xs text-slate-500 font-mono mt-2 max-w-md mx-auto">
              You can dismiss proposals from your main queue to keep it clean by clicking "Dismiss" on any active draft.
            </p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main proposals queue column */}
          <div className="xl:col-span-2 space-y-6">
            {filteredProposals.map((prop) => {
              const matchedJob = jobs.find(j => j.id === prop.opportunityId);
              const isEditing = editingId === prop.id;
              const isArabic = matchedJob?.language === 'ar' || /[\u0600-\u06FF]/.test(prop.content || '');

              return (
                <div 
                  key={prop.id}
                  className={`bg-[#0b0d16]/75 border rounded-lg p-5 space-y-4 transition backdrop-blur-sm ${
                    prop.status === 'submitted' ? 'border-emerald-500/25 bg-emerald-950/5' :
                    prop.status === 'rejected' ? 'border-rose-950/20 opacity-55' :
                    'border-[#1e2235]'
                  }`}
                >
                  {/* Job context header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2235]/40 pb-3">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-bold text-blue-400 tracking-widest font-mono block">
                        Target Opportunity Context:
                      </span>
                      <h3 className="text-sm font-bold text-slate-200 truncate max-w-lg" dir={matchedJob && ['Mostaql', 'Khamsat'].includes(matchedJob.platform) ? 'rtl' : 'ltr'}>
                        {matchedJob ? matchedJob.title : 'External platform project'}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        {matchedJob?.platform && (
                          <span className={`inline-flex items-center gap-1 text-[10px] pl-1 pr-2 py-0.5 rounded font-bold uppercase tracking-widest border ${
                            matchedJob.platform === 'Mostaql' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            matchedJob.platform === 'Khamsat' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                            'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {matchedJob.platform === 'Mostaql' && (
                              <span className="w-3 w-3 rounded-full bg-blue-500 flex items-center justify-center text-[7px] font-extrabold text-white select-none">M</span>
                            )}
                            {matchedJob.platform === 'Khamsat' && (
                              <span className="w-3 w-3 rounded-full bg-orange-500 flex items-center justify-center text-[7px] font-extrabold text-white select-none">٥</span>
                            )}
                            {matchedJob.platform === 'Fiverr' && (
                              <span className="w-3 w-3 rounded-full bg-emerald-550 flex items-center justify-center text-[7px] font-extrabold text-white select-none">f</span>
                            )}
                            {matchedJob.platform}
                          </span>
                        )}
                        <span>•</span>
                        <span>Budget: {matchedJob?.budget}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold uppercase tracking-widest ${
                        prop.status === 'submitted' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        prop.status === 'rejected' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                      }`}>
                        {prop.status}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-semibold uppercase tracking-wider">
                        {new Date(prop.timestamp).toLocaleDateString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Devalidated Opportunity Warning */}
                  {matchedJob && matchedJob.validationStatus === 'INVALID' && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded text-rose-450 text-xs font-mono flex items-start gap-2">
                      <span className="text-rose-400 mt-0.5 shrink-0">⚠️</span>
                      <div className="space-y-1">
                        <strong className="text-rose-300">Opportunity Devalidated</strong>
                        <p className="text-[11px] leading-relaxed text-rose-400/90">
                          This job has been flagged as {matchedJob.validationReason || 'inactive/deleted'} during verification. Auto-posting is locked. Bidding on closed target channels is highly discouraged.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mostaql Custom Attribute Editors */}
                  {matchedJob?.platform === 'Mostaql' && (
                    <div className="bg-[#121522]/60 border border-[#1e2235]/60 rounded-md p-3.5 space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest font-mono">
                          Bid Submission Fields (Mostaql)
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Used during automated Chrome posting
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 font-mono">
                            THE PRICE I WANT (USD) *
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 font-mono text-xs font-semibold select-none">
                              $
                            </span>
                            <input
                              id={`pq-cost-${prop.id}`}
                              type="number"
                              min="25"
                              className="w-full bg-[#07080d] border border-[#1e2235] rounded pl-7 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                              placeholder="e.g. 150"
                              value={prop.cost !== undefined ? prop.cost : ''}
                              onChange={(e) => handleUpdateProposalAttributes(prop.id, { cost: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            />
                          </div>
                          <p className="text-[9px] text-slate-505 leading-relaxed font-mono">
                            Mostaql minimum valid bid starts at $25.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-400 font-mono">
                            HOW MANY DAYS *
                          </label>
                          <div className="relative">
                            <input
                              id={`pq-period-${prop.id}`}
                              type="number"
                              min="1"
                              className="w-full bg-[#07080d] border border-[#1e2235] rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                              placeholder="e.g. 5"
                              value={prop.period !== undefined ? prop.period : ''}
                              onChange={(e) => handleUpdateProposalAttributes(prop.id, { period: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            />
                          </div>
                          <p className="text-[9px] text-slate-505 leading-relaxed font-mono">
                            The implementation period constraint.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Proposal Text box / Editor */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        id={`pq-editor-${prop.id}`}
                        rows={11}
                        dir={isArabic ? 'rtl' : 'ltr'}
                        className={`w-full bg-[#07080d] border border-[#1e2235] rounded p-3 text-sm text-slate-200 leading-relaxed focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                          isArabic ? 'text-right font-sans text-[15px] font-medium' : 'text-left font-mono text-xs'
                        }`}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          id={`pq-save-${prop.id}-btn`}
                          onClick={() => handleSaveEdit(prop.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs font-semibold rounded-md border border-emerald-700 cursor-pointer transition"
                        >
                          Save Changes
                        </button>
                        <button
                          id={`pq-cancel-${prop.id}-btn`}
                          onClick={() => setEditingId(null)}
                          className="px-3.5 py-1.5 bg-[#121522] hover:bg-slate-900 text-slate-400 text-xs font-semibold rounded border border-[#1e2235] cursor-pointer transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      dir={isArabic ? 'rtl' : 'ltr'}
                      className={`bg-[#07080d]/85 p-4 border border-[#1e2235] rounded-md leading-relaxed text-slate-300 whitespace-pre-line relative group ${
                        isArabic ? 'text-right font-sans text-[14px] font-medium tracking-wide' : 'text-left font-mono text-xs'
                      }`}
                    >
                      {prop.content}
                      <button
                        id={`pq-edit-trigger-${prop.id}-btn`}
                        onClick={() => {
                          setEditingId(prop.id);
                          setEditContent(prop.content);
                        }}
                        className="absolute right-3 top-3 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded transition duration-100 pointer-events-auto opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Edit inline"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                  )}

                  {/* Submission HUD diagnostics summary inside card */}
                  {(isSubmittingMap[prop.id] || (prop.submissionDebugScreenshots && prop.submissionDebugScreenshots.length > 0) || prop.submissionError) && (
                    <div className="p-3 bg-[#0c0e18] border border-[#1e2235] rounded font-mono text-[11px] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isSubmittingMap[prop.id] ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                            <span className="text-indigo-400 font-extrabold uppercase animate-pulse">Auto-posting in progress...</span>
                          </>
                        ) : prop.submissionError ? (
                          <>
                            <span className="text-rose-400 font-extrabold">⚠️ Submission Exception Staged</span>
                          </>
                        ) : (
                          <>
                            <span className="text-emerald-400 font-bold">✨ HUD Session Captured</span>
                          </>
                        )}
                        {prop.submissionDebugScreenshots && prop.submissionDebugScreenshots.length > 0 && (
                          <span className="text-slate-500">({prop.submissionDebugScreenshots.length} HUD Snaps)</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setDebugProposalId(prop.id);
                          setActiveScreenshotFilename(null);
                        }}
                        className="px-2.5 py-1 bg-indigo-950/40 text-indigo-300 hover:text-indigo-200 border border-indigo-500/20 rounded font-bold uppercase text-[10px] transition cursor-pointer"
                      >
                        🔮 View HUD HUD Snaps ({prop.submissionDebugScreenshots?.length || 0})
                      </button>
                    </div>
                  )}

                  {/* Action Commands Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        id={`pq-copy-${prop.id}-btn`}
                        onClick={() => handleCopyToClipboard(prop.content)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#07080d] hover:bg-[#121522] border border-[#1e2235] text-slate-350 text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        <Copy size={13} />
                        Copy text
                      </button>

                      {prop.status === 'draft' && (
                        <button
                          id={`pq-reject-${prop.id}-btn`}
                          onClick={() => handleRejectProposal(prop.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-rose-950/20 text-rose-450 hover:text-rose-300 text-[11px] font-bold uppercase tracking-wider rounded border border-[#1e2235] transition cursor-pointer"
                        >
                          <XCircle size={13} />
                          Reject pitch
                        </button>
                      )}

                      <button
                        id={`pq-archive-${prop.id}-btn`}
                        onClick={() => handleToggleArchive(prop.id, !!prop.archived)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-[#121522] border border-[#1e2235] text-slate-450 hover:text-slate-200 text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer"
                        title={prop.archived ? "Restore back to active queue" : "Hide/archive from active queue"}
                      >
                        {prop.archived ? (
                          <>
                            <Eye size={13} className="text-emerald-400" />
                            Restore
                          </>
                        ) : (
                          <>
                            <EyeOff size={13} className="text-indigo-400" />
                            Dismiss
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {prop.status === 'draft' && (
                        <>
                          <button
                            id={`pq-autosubmit-${prop.id}-btn`}
                            onClick={() => {
                              if (matchedJob && matchedJob.validationStatus === 'INVALID') {
                                onShowToast('Submission locked: The underlying opportunity is devalidated.', 'error');
                                return;
                              }
                              handleAutoSubmitProposal(prop.id);
                            }}
                            disabled={matchedJob?.validationStatus === 'INVALID'}
                            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest rounded shadow-md border transition cursor-pointer ${
                              matchedJob?.validationStatus === 'INVALID'
                                ? 'bg-[#07080d] border-[#1e2235] text-slate-500 opacity-40 cursor-not-allowed'
                                : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border-indigo-500/30'
                            }`}
                          >
                            <Sparkles size={13} className={matchedJob?.validationStatus === 'INVALID' ? "text-slate-500" : "text-yellow-300 animate-pulse"} />
                            Auto-Post (AI Agent)
                          </button>
                          
                          <button
                            id={`pq-submit-${prop.id}-btn`}
                            onClick={() => handleSubmitProposal(prop.id, matchedJob?.link)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#0d0f19] hover:bg-[#141829] border border-[#1e2235] text-slate-400 text-[11px] font-bold uppercase tracking-wider rounded transition cursor-pointer"
                          >
                            <Send size={13} />
                            Mark manual
                          </button>
                        </>
                      )}
                      
                      {prop.status === 'submitted' && (
                        <div className="flex flex-col items-end gap-1 font-mono">
                          <span className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase text-emerald-400 font-bold px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded">
                            <CheckCircle size={14} />
                            Dispatched safely
                          </span>
                          {prop.submittedPlatformLink && (
                            <a
                              href={prop.submittedPlatformLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-blue-400 underline hover:text-blue-350 flex items-center gap-1"
                            >
                              Open submitted post ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Right column: Tone guidelines, regenerate workspace controls */}
          <div className="space-y-6">
            
            <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-5 space-y-4 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                <Sparkles size={16} className="text-blue-400 animate-pulse" />
                Refinement Blueprint
              </h3>
              <p className="text-xs text-slate-405 leading-relaxed font-mono uppercase tracking-wide">
                Alter the targeted style, length parameters, or tonal guidelines, then trigger regeneration on draft.
              </p>

              {/* Tonal Picker selector */}
              <div className="space-y-2 text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-slate-500 block">Draft Tone:</span>
                <select
                  id="pq-tone-refusal"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-350 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                >
                  <option value="">Maintain Profile Baseline</option>
                  <option value="professional">Professional / Executive</option>
                  <option value="persuasive">Persuasive / Pitch-forward</option>
                  <option value="friendly">Friendly / Co-founder</option>
                  <option value="technical">Technical / Architect</option>
                  <option value="analytical">Analytical / Problem Solver</option>
                </select>
              </div>

              {/* Length selection indicator */}
              <div className="space-y-2 text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-slate-500 block">Length Cap:</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['short', 'medium', 'long'] as const).map((l) => (
                    <button
                      id={`pq-len-btn-${l}`}
                      key={l}
                      onClick={() => setSelectedLength(l)}
                      className={`py-1.5 rounded border text-center uppercase tracking-wider text-[9px] font-bold cursor-pointer transition ${
                        selectedLength === l 
                          ? 'bg-blue-600 border-blue-500 text-white shadow'
                          : 'bg-[#07080d] border-[#1e2235] text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt hints block */}
              <div className="p-3 bg-[#07080d] rounded border border-[#1e2235] text-[11px] text-slate-400 leading-relaxed font-mono">
                <span className="font-bold uppercase tracking-wide text-slate-300 block mb-1">Writer Guidelines:</span>
                "Short" restricts Gemini replies to exactly 1 concise paragraph (usually under 100 words), maximizing rapid mobile viewing response ratios. "Long" outputs a numbered technical roadmap.
              </div>
            </div>

            {/* Quick stats on the queue */}
            <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-5 text-xs text-slate-404 space-y-3 font-mono">
              <h4 className="font-bold uppercase tracking-widest text-slate-200">Outbox Telemetry</h4>
              <div className="flex justify-between border-b border-[#1e2235]/40 pb-2">
                <span>Total Drafts Pool</span>
                <span className="font-bold text-slate-250">{proposals.filter(p => p.status === 'draft').length}</span>
              </div>
              <div className="flex justify-between border-b border-[#1e2235]/40 pb-2">
                <span>Total Submitted</span>
                <span className="font-bold text-emerald-400">{proposals.filter(p => p.status === 'submitted').length}</span>
              </div>
              <div className="flex justify-between">
                <span>Auto-purge outbox timer</span>
                <span className="text-slate-500">4 Hours Cooldown</span>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Interactive HUD Live Browser Sandbox Debugger Panel */}
      {debugProposal && createPortal(
        (() => {
          const debugJob = jobs.find(j => j.id === debugProposal?.opportunityId);
          const screenshotsList = debugProposal?.submissionDebugScreenshots || [];
          const currentFilename = activeScreenshotFilename || (screenshotsList.length > 0 ? screenshotsList[screenshotsList.length - 1].filename : null);
          const currentScreenshotStep = screenshotsList.find(s => s.filename === currentFilename);
          const isActiveSubmitting = isSubmittingMap[debugProposal.id];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-[#0b0d16] border border-[#1e2235] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-[#1e2235] flex items-center justify-between bg-[#07080d]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${isActiveSubmitting ? 'bg-indigo-500 animate-ping' : debugProposal.submissionError ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <h2 className="text-sm font-bold text-slate-100 uppercase tracking-widest font-mono">
                      {isActiveSubmitting ? 'Live Sandbox Browser HUD Active' : 'Execution Debug HUD Session'}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setDebugProposalId(null);
                      setActiveScreenshotFilename(null);
                    }}
                    className="text-slate-400 hover:text-slate-200 transition cursor-pointer text-xs uppercase font-mono font-bold"
                  >
                    [ Esc / Close ]
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Info Header */}
                  <div className="bg-[#07080d] border border-[#1e2235] rounded-lg p-4 font-mono text-xs text-slate-400 space-y-2">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>Platform Target: <strong className="text-white">{debugJob?.platform || 'Unknown'}</strong></span>
                      <span>Target URI: <a href={debugJob?.link} target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-350">{debugJob?.link}</a></span>
                    </div>
                    <p className="text-[11px] text-slate-500 uppercase tracking-wide leading-relaxed mt-1">
                      Our automated bidding agent runs on virtual containers in secure cloud servers. Physical Chrome windows cannot be rendered to your display directly. This active HUD viewer displays sequential live screenshots captured during the agent's form-fill macros.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {/* Visual Capture Display (Left) */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                        Visual Capture Viewer
                      </h3>

                      {currentFilename ? (
                        <div className="relative border border-[#1e2235] bg-[#020204]/80 rounded-lg p-2 overflow-hidden flex flex-col justify-center items-center min-h-[220px] sm:min-h-[350px]">
                          <div className="absolute top-4 left-4 bg-indigo-600/90 text-white font-mono text-[9px] uppercase font-extrabold tracking-widest px-2.5 py-1 rounded shadow z-10">
                            {currentScreenshotStep?.title || 'Execution Stage'}
                          </div>
                          
                          <img
                            src={`/api/screenshots/${currentFilename}`}
                            alt="Execution step screen click"
                            referrerPolicy="no-referrer"
                            className="max-h-[260px] sm:max-h-[380px] w-auto max-w-full object-contain rounded border border-slate-900 shadow"
                          />
                          
                          <div className="mt-2 text-[10px] text-slate-500 font-mono text-center">
                            Captured Stage: {currentScreenshotStep?.title} • {new Date(currentScreenshotStep?.timestamp || '').toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        /* Loading Term context */
                        <div className="border border-[#1e2235] bg-[#05060b] text-indigo-400 font-mono text-xs rounded-lg p-6 flex flex-col justify-center items-center min-h-[220px] sm:min-h-[350px] space-y-4">
                          <RefreshCw size={36} className="text-indigo-400 animate-spin" />
                          <span className="text-slate-350 tracking-widest font-extrabold uppercase text-[10px]">
                            Booting Headless Chromium Sandbox...
                          </span>
                          <div className="text-left max-w-md w-full bg-[#020204]/90 p-4 rounded border border-indigo-950/40 text-[10px] text-indigo-300/80 space-y-2">
                            <div>[system] allocating sandbox resources... done.</div>
                            <div>[playwright] launching user-data channel for {debugJob?.platform}...</div>
                            <div>[chrome] bypassing strict client viewport settings...</div>
                            <div>[network] navigating to project details...</div>
                            <div className="animate-pulse">[system] awaiting first document visual snap...</div>
                          </div>
                        </div>
                      )}

                      {/* Timeline thumb indicators */}
                      {screenshotsList.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                            Snapshot Navigation Timeline ({screenshotsList.length} total)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {screenshotsList.map((snap, idx) => (
                              <button
                                key={snap.filename}
                                onClick={() => setActiveScreenshotFilename(snap.filename)}
                                className={`p-1 border rounded flex flex-col items-center gap-1 transition cursor-pointer ${
                                  currentFilename === snap.filename
                                    ? 'border-indigo-500 bg-indigo-950/20'
                                    : 'border-[#1e2235] bg-[#07080d] hover:bg-[#121522]'
                                }`}
                              >
                                <div className="w-16 h-10 bg-slate-900 rounded overflow-hidden flex items-center justify-center relative border border-slate-950">
                                  <img
                                    src={`/api/screenshots/${snap.filename}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <span className="text-[9px] font-mono text-slate-400 w-16 truncate text-center">
                                  Step {idx + 1}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stage Timeline Logs (Right) */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
                        Macro Progression Hud Tracker
                      </h3>

                      {/* Interactive Step-by-Step Bullet Points */}
                      <div className="bg-[#07080d] border border-[#1e2235] rounded-lg p-5 font-mono text-xs space-y-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${screenshotsList.length >= 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                            ✓
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200">1. Navigating & Loading Project</span>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Launches authenticated browser environment and navigates to target link to fetch document nodes.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${screenshotsList.length >= 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                            ✓
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200">2. Mapping Fields & Value Injection</span>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Inputs tailored proposal text inline. Fills out system budget criteria and execution timeframe metrics.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${screenshotsList.length >= 3 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                            ✓
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-200">3. Button Trigger & Post-Verify Check</span>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                              Simulates human clicks on submit fields. Verifies whether any error messages occur or page redirects.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Debug Exception summary */}
                      {debugProposal.submissionError && (
                        <div className="border border-rose-500/25 bg-rose-950/15 rounded-lg p-5 space-y-3 font-mono text-xs">
                          <h4 className="font-extrabold text-rose-400 uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                            <span>⚠️</span> Automation Process Exception Encountered
                          </h4>
                          <div className="bg-black/40 border border-rose-950/50 p-3 rounded text-[11px] text-rose-350 whitespace-pre-wrap font-mono leading-relaxed">
                            {debugProposal.submissionError}
                          </div>
                          <div className="space-y-2 text-[11px] text-slate-400 leading-relaxed">
                            <p>
                              <strong>Reason of Interruption:</strong> This platform incorporates security measures (such as Cloudflare JS integrity filters or Google CAPTCHAs) during form validation, or your account session has timed out.
                            </p>
                            <p className="font-sans font-semibold text-slate-300">
                              Please review the captured snapshots above to identify the issue on the page. If a CAPTCHA or Login screen is visible:
                            </p>
                            <ul className="list-disc pl-4 space-y-1 font-sans text-slate-400">
                              <li>Verify your status on the <strong>Accounts</strong> tab (a session reset or quick re-login may be needed).</li>
                              <li>You can copy the proposal content using the "Copy text" helper inside the Queue page and submit it manually via your standard browser if required.</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {!debugProposal.submissionError && debugProposal.status === 'submitted' && (
                        <div className="border border-emerald-500/25 bg-emerald-950/10 rounded-lg p-5 space-y-2 font-mono text-xs">
                          <h4 className="font-bold text-emerald-400 uppercase tracking-widest text-[10px] flex items-center gap-1">
                            <span>✓</span> Successful Bid Confirmation Recorded
                          </h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Submit click was emitted successfully inside our container and confirmed via Playwright verification bounds. The details were written under your user identity.
                          </p>
                          {debugProposal.submittedPlatformLink && (
                            <a
                              href={debugProposal.submittedPlatformLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/20 rounded font-semibold text-emerald-400 hover:text-white transition mt-2 text-[10px]"
                            >
                              Open submitted page on {debugJob?.platform} ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer Controls */}
                <div className="px-5 py-4 border-t border-[#1e2235] bg-[#07080d] flex flex-wrap items-center justify-between gap-3 font-mono">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase">
                    {isActiveSubmitting ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span>Active Sandbox Sync Polling (1.5s Interval)</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        <span>Static Session Snap View</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setDebugProposalId(null);
                      setActiveScreenshotFilename(null);
                    }}
                    className="px-4 py-2 bg-slate-900 border border-[#1e2235] text-slate-100 hover:text-white text-xs font-bold uppercase rounded cursor-pointer transition"
                  >
                    Close Debugger
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}
    </div>
  );
}
