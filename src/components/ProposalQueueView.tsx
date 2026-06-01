/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
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
  Settings
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

  useEffect(() => {
    fetchProposalsAndJobs();
  }, []);

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
    onShowToast('AI Agent is logging into platform page and posting your bid draft...', 'info');
    try {
      const response = await fetch(`/api/proposals/${id}/auto-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.realPosted) {
          onShowToast('SUCCESS! Proposal was posted automatically under your account!', 'success');
        } else {
          onShowToast('Platform Sync Redirect staging completed!', 'success');
        }
        // Open the tracking/submission link in a secondary tab if available
        if (data.submittedPlatformLink && data.submittedPlatformLink !== '#') {
          window.open(data.submittedPlatformLink, '_blank');
        }
        fetchProposalsAndJobs();
      } else {
        onShowToast('Auto-submit action stopped or failed.', 'error');
      }
    } catch (e) {
      onShowToast('Failed to submit proposal via agent service.', 'error');
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

      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
          <p className="mt-3 text-slate-400 text-xs font-mono uppercase tracking-wider">Synchronizing proposal states...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-[#1e2235] rounded-lg bg-[#0b0d16]/30">
          <FileText size={40} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Outbox Queue Empty</h3>
          <p className="text-xs text-slate-500 font-mono mt-2 max-w-md mx-auto">
            Authorize new opportunities in the Job List or click "AI Generate Proposal" on relevant projects to populate your queue.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main proposals queue column */}
          <div className="xl:col-span-2 space-y-6">
            {proposals.map((prop) => {
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
                      <h3 className="text-sm font-bold text-slate-200 truncate max-w-lg">
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
    </div>
  );
}
