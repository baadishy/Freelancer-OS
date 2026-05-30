/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Coins, 
  Activity, 
  CheckCircle, 
  FilePlus, 
  ChevronRight, 
  RefreshCw,
  Clock,
  ThumbsUp,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Opportunity } from '../types.js';

interface OpportunitiesViewProps {
  onNavigate: (view: string, id?: string) => void;
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  initialSelectedId?: string | null;
  onClearSelectedId?: () => void;
}

export default function OpportunitiesView({ 
  onNavigate, 
  onShowToast,
  initialSelectedId,
  onClearSelectedId
}: OpportunitiesViewProps) {
  const [jobs, setJobs] = useState<Opportunity[]>([]);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState('all');
  const [minScore, setMinScore] = useState('0');
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [writingId, setWritingId] = useState<string | null>(null);

  const getCleanJobLink = (job: any) => {
    if (!job.link) return '#';
    if (job.platform === 'Khamsat') {
      return 'https://khamsat.com/community/requests';
    } else if (job.platform === 'Mostaql') {
      return `https://mostaql.com/projects?keyword=${encodeURIComponent(job.title.split(' ').slice(0, 2).join(' '))}`;
    } else if (job.platform === 'Fiverr') {
      return `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(job.title.split(' ').slice(0, 3).join(' '))}`;
    }
    return job.link;
  };

  // Suggested Natural Language queries for user clicks
  const nlpSuggestions = [
    'Find React projects with low complexity',
    'Find Web Development over $300',
    'Khamsat projects with low competition'
  ];

  const fetchOpportunities = async (isSearchTrigger: boolean = false) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        platform,
        minScore,
        search
      });
      const response = await fetch(`/api/opportunities?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        // Remove submitted offers from the list
        const activeJobs = data.filter((o: any) => o.status !== 'submitted');
        setJobs(activeJobs);
        if (isSearchTrigger) {
          onShowToast(`Smart query found ${activeJobs.length} matching entries.`, 'success');
        }
      } else {
        onShowToast('Database search rejected.', 'error');
      }
    } catch (e) {
      onShowToast('Offline link to jobs database.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialSelectedId) {
      setPlatform('all');
      setMinScore('0');
      setSearch('');
    }
  }, [initialSelectedId]);

  useEffect(() => {
    if (initialSelectedId && jobs.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`op-card-${initialSelectedId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500');
          }, 3000);
        }
        if (onClearSelectedId) {
          onClearSelectedId();
        }
      }, 300);
    }
  }, [jobs, initialSelectedId]);

  useEffect(() => {
    fetchOpportunities();
  }, [platform, minScore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpportunities(true);
  };

  const handleNlpClick = (nlpText: string) => {
    setSearch(nlpText);
    setTimeout(() => {
      const queryParams = new URLSearchParams({
        platform,
        minScore,
        search: nlpText
      });
      setLoading(true);
      fetch(`/api/opportunities?${queryParams}`)
        .then(res => res.json())
        .then(data => {
          const activeJobs = data.filter((o: any) => o.status !== 'submitted');
          setJobs(activeJobs);
          onShowToast(`Parsed language criteria: "${nlpText}"`, 'success');
        })
        .finally(() => setLoading(false));
    }, 100);
  };

  const handleTriggerAnalysis = async (id: string) => {
    setAnalyzingId(id);
    onShowToast('Running deep Gemini comparative scoring...', 'info');
    try {
      const response = await fetch(`/api/opportunities/${id}/analyze`, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        onShowToast('AI Match Score recalculated successfully!', 'success');
        setJobs(prev => prev.map(j => j.id === id ? data : j));
      } else {
        onShowToast(data.error || 'Gemini analysis failed.', 'error');
      }
    } catch (e) {
      onShowToast('Network error triggering Gemini matching.', 'error');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'ignored' | 'approved') => {
    try {
      const response = await fetch(`/api/opportunities/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await response.json();
      if (response.ok) {
        onShowToast(`Project status registered: ${status}`, 'success');
        setJobs(prev => prev.map(j => j.id === id ? data : j));
      }
    } catch (e) {
      onShowToast('Could not save project status.', 'error');
    }
  };

  const handleCompileProposal = async (job: Opportunity) => {
    setWritingId(job.id);
    onShowToast(`Calling Gemini to draft customized proposal for "${job.title}"...`, 'info');
    try {
      const response = await fetch('/api/proposals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: job.id })
      });
      const data = await response.json();
      if (response.ok) {
        onShowToast('AI Proposal draft successfully generated!', 'success');
        // Route directly to proposal queue
        onNavigate('proposals');
      } else {
        onShowToast(data.error || 'Proposal writer halted.', 'error');
      }
    } catch (e) {
      onShowToast('Network error during draft writing.', 'error');
    } finally {
      setWritingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header and natural search bar */}
      <div className="border-b border-[#1e2235] pb-5">
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Search size={22} className="text-blue-400" />
          Platform Opportunities
        </h1>
        <p className="text-xs text-slate-405 font-mono uppercase tracking-wide mt-1">
          Perform standard queries or search dynamically with natural language parsing.
        </p>

        {/* NLP suggestion chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 font-mono">
            <Sparkles size={12} className="text-amber-400" /> Smart criteria:
          </span>
          {nlpSuggestions.map((suggestion, i) => (
            <button
              id={`nlp-suggest-${i}-btn`}
              key={i}
              onClick={() => handleNlpClick(suggestion)}
              className="text-[11px] font-mono px-3 py-1 bg-[#0b0d16]/75 hover:bg-[#121522] border border-[#1e2235] hover:border-blue-500/30 rounded text-blue-300 hover:text-blue-200 transition cursor-pointer"
            >
              "{suggestion}"
            </button>
          ))}
        </div>
      </div>

      {/* Query panel and filter grid */}
      <div className="bg-[#0b0d16]/75 border border-[#1e2235] p-5 rounded-lg space-y-4 backdrop-blur-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search size={18} />
            </span>
            <input
              id="op-search-input"
              type="text"
              className="block w-full pl-10 pr-4 py-2.5 bg-[#07080d] border border-[#1e2235] rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-550 focus:border-blue-500 text-sm"
              placeholder="Query projects natively, e.g. React projects over $300..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            id="op-submit-search-btn"
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white text-xs font-bold uppercase tracking-wider rounded cursor-pointer transition"
          >
            Apply Query
          </button>
        </form>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-[#1e2235]/40 text-xs text-slate-400">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Platform dropdown selector */}
            <div className="flex items-center gap-2 font-mono">
              <Filter size={14} className="text-slate-500" />
              <span>Platform:</span>
              <select
                id="op-platform-filter"
                className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="all">Fiverr + Mostaql + Khamsat</option>
                <option value="Fiverr">Fiverr Only</option>
                <option value="Mostaql">Mostaql Only</option>
                <option value="Khamsat">Khamsat Only</option>
              </select>
            </div>

            {/* Match threshold dropdown */}
            <div className="flex items-center gap-2 font-mono">
              <Sparkles size={14} className="text-slate-500" />
              <span>Suitability:</span>
              <select
                id="op-score-filter"
                className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none text-xs"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
              >
                <option value="0">All Scores Available</option>
                <option value="50">Medium Compatibility (50%+)</option>
                <option value="75">High Suitability (75%+)</option>
                <option value="90">Elite Matches Only (90%+)</option>
              </select>
            </div>
          </div>

          <span className="font-mono text-[11px] text-slate-400 uppercase tracking-wider">
            Filtered count: <strong className="text-slate-200">{jobs.length}</strong> opportunities
          </span>
        </div>
      </div>

      {/* Main opportunities layout index */}
      {loading ? (
        <div className="py-24 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-400 mx-auto" />
          <p className="mt-3 text-slate-400 text-sm">Organizing matched freelancers feeds...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-slate-700 rounded-2xl bg-slate-800/10">
          <AlertCircle size={40} className="text-slate-600 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-slate-300">No Match Opportunities Matched</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
            Try resetting your filters, emptying search parameters, or forcing a manual platform scraper refresh inside the home dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {jobs.map((job) => {
            const match = job.matchAnalysis;

            return (
              <div 
                key={job.id}
                id={`op-card-${job.id}`}
                className={`bg-[#0b0d16]/75 border rounded-lg p-6 transition duration-250 flex flex-col lg:flex-row gap-6 backdrop-blur-sm ${
                  job.status === 'ignored' ? 'opacity-35 border-[#1e2235]' :
                  job.status === 'approved' ? 'border-emerald-500/35 bg-emerald-950/5' :
                  job.status === 'submitted' ? 'border-blue-500/35 bg-blue-950/5' :
                  'border-[#1e2235]'
                }`}
              >
                {/* Left body - job description, client */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] pl-1.5 pr-2.5 py-0.5 rounded font-extrabold uppercase tracking-wider border ${
                      job.platform === 'Mostaql' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      job.platform === 'Khamsat' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {job.platform === 'Mostaql' && (
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-extrabold text-white select-none">M</span>
                      )}
                      {job.platform === 'Khamsat' && (
                        <span className="w-3.5 h-3.5 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-extrabold text-white select-none">٥</span>
                      )}
                      {job.platform === 'Fiverr' && (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-550 flex items-center justify-center text-[8px] font-extrabold text-white select-none">f</span>
                      )}
                      {job.platform}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#07080d] border border-[#1e2235] text-slate-400 uppercase tracking-widest font-semibold font-mono">
                      Category: {job.category}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-[#07080d] border border-[#1e2235] text-slate-400 font-mono font-bold">
                      {job.language === 'ar' ? 'العربية' : 'English'}
                    </span>
                    {job.budget && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono font-bold">
                        <Coins size={12} className="text-emerald-400" />
                        Price: {job.budget}
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-450 ml-auto flex items-center gap-1.5 font-semibold uppercase tracking-wider bg-[#07080d] px-2 py-0.5 rounded border border-[#1e2235]">
                      <Clock size={12} className="text-indigo-400" />
                      Published: {new Date(job.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-100 group flex items-center gap-2">
                      {job.title}
                      <a href={getCleanJobLink(job)} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-blue-400 transition" id={`op-link-${job.id}`}>
                        <ExternalLink size={14} />
                      </a>
                    </h3>
                    <p className="text-xs text-slate-500 block font-mono uppercase tracking-wider">
                      Client: <span className="text-slate-300 font-bold">{job.clientName || 'Anonymous Request'}</span>
                    </p>
                  </div>

                  <p className="text-sm text-slate-350 leading-relaxed whitespace-pre-wrap">{job.description}</p>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap gap-2.5 pt-4 border-t border-[#1e2235]/40">
                    {job.status === 'new' && (
                      <>
                        <button
                          id={`op-${job.id}-approve-btn`}
                          onClick={() => handleUpdateStatus(job.id, 'approved')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-355 hover:text-slate-100 text-[11px] font-bold uppercase tracking-wider rounded border border-emerald-500/20 transition cursor-pointer"
                        >
                          <CheckCircle size={14} />
                          Approve Project
                        </button>
                        <button
                          id={`op-${job.id}-ignore-btn`}
                          onClick={() => handleUpdateStatus(job.id, 'ignored')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-[#121522] text-slate-400 hover:text-slate-100 text-[11px] font-bold uppercase tracking-wider rounded border border-[#1e2235] transition cursor-pointer"
                        >
                          <XCircle size={14} />
                          Ignore
                        </button>
                      </>
                    )}

                    {job.status === 'ignored' && (
                      <button
                        id={`op-${job.id}-restore-btn`}
                        onClick={() => handleUpdateStatus(job.id, 'approved')}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-[#121522] text-slate-300 text-[11px] font-bold uppercase tracking-wider rounded border border-[#1e2235] transition cursor-pointer"
                      >
                        Restore Opportunity
                      </button>
                    )}

                    {job.status === 'approved' && !job.proposalId && (
                      <button
                        id={`op-${job.id}-proposal-btn`}
                        onClick={() => handleCompileProposal(job)}
                        disabled={writingId === job.id}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white text-[11px] font-bold uppercase tracking-wider rounded shadow-md transition cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles size={14} className={writingId === job.id ? 'animate-pulse' : ''} />
                        {writingId === job.id ? 'Structuring Pitch...' : 'AI Generate Proposal'}
                      </button>
                    )}

                    {job.proposalId && (
                      <button
                        id={`op-${job.id}-goto-prop-btn`}
                        onClick={() => onNavigate('proposals')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-[#121522] text-blue-400 hover:text-blue-300 text-[11px] font-bold uppercase tracking-wider rounded border border-[#1e2235] transition cursor-pointer"
                      >
                        <FilePlus size={14} />
                        View Proposal Draft
                      </button>
                    )}
                  </div>
                </div>

                {/* Right col - Gemini interactive metrics */}
                <div className="w-full lg:w-72 shrink-0 bg-[#0d0f17]/70 rounded-lg p-5 border border-[#1e2235] flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#1e2235]/40 pb-2 mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 font-mono">
                        <Sparkles size={14} className="text-blue-400" />
                        AI Analysis
                      </span>
                      {!match && (
                        <button
                          id={`op-${job.id}-analyze-btn`}
                          onClick={() => handleTriggerAnalysis(job.id)}
                          disabled={analyzingId === job.id}
                          className="p-1 text-xs text-blue-400 hover:text-blue-300 transition"
                        >
                          <RefreshCw size={14} className={analyzingId === job.id ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>

                    {match ? (
                      <div className="space-y-3">
                        {/* Overall score indicator rings */}
                        <div className="flex items-center gap-4 bg-[#07080d]/60 p-3 rounded border border-[#1e2235]/60">
                          <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="16" fill="none" stroke="#121522" strokeWidth="4" />
                              <circle 
                                cx="18" cy="18" r="16" fill="none" 
                                stroke={match.score >= 80 ? '#10b981' : match.score >= 60 ? '#3b82f6' : '#f97316'} 
                                strokeWidth="4" 
                                strokeDasharray={`${match.score} 100`} 
                              />
                            </svg>
                            <span className="absolute text-sm font-extrabold text-slate-200">{match.score}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold">Match score</span>
                            <span className="text-xs font-bold text-slate-200">
                              {match.score >= 80 ? 'Perfect Alignment' : match.score >= 60 ? 'Strong Potential' : 'Risky Selection'}
                            </span>
                          </div>
                        </div>

                        {/* Double bar indicators */}
                        <div className="space-y-2 text-xs font-mono">
                          <div>
                            <div className="flex justify-between text-slate-400 mb-0.5">
                              <span>Win Probability</span>
                              <span className="font-bold text-slate-200">{match.winProbability}%</span>
                            </div>
                            <div className="h-1 bg-[#121522] rounded-none overflow-hidden">
                              <div className="h-full bg-emerald-500 animate-slide-right" style={{ width: `${match.winProbability}%` }} />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-slate-400 mb-0.5">
                              <span>Job Profitability</span>
                              <span className="font-bold text-slate-200">{match.profitabilityScore}%</span>
                            </div>
                            <div className="h-1 bg-[#121522] rounded-none overflow-hidden">
                              <div className="h-full bg-blue-500 animate-slide-right" style={{ width: `${match.profitabilityScore}%` }} />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1e2235]/40 text-slate-400">
                            <span>Complexity:</span>
                            <span className={`font-bold capitalize ${
                              match.complexity === 'low' ? 'text-emerald-400' :
                              match.complexity === 'medium' ? 'text-blue-400' : 'text-rose-400'
                            }`}>{match.complexity}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-400 italic bg-[#07080d] p-2.5 rounded border border-[#1e2235] leading-relaxed font-mono">
                          "{match.reasoning}"
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <HelpCircle size={28} className="text-slate-650 mx-auto mb-2" />
                        <button
                          id={`op-${job.id}-analyze-trigger-btn`}
                          onClick={() => handleTriggerAnalysis(job.id)}
                          disabled={analyzingId === job.id}
                          className="text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 text-white rounded font-sans cursor-pointer disabled:opacity-50"
                        >
                          {analyzingId === job.id ? 'Running Analysis...' : 'Evaluate Match Score'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Client Analysis Block */}
                  {match?.clientAnalysis && (
                    <div className="pt-2 border-t border-[#1e2235]/40 space-y-2 text-[11px] text-slate-405">
                      <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1 font-mono">AI Client Profiler</span>
                      <div className="grid grid-cols-2 gap-2 bg-[#07080d] p-2 rounded border border-[#1e2235]/40 font-mono text-[10px]">
                        <div>
                          <span className="block text-[8px] text-slate-505 uppercase tracking-wide">Reply prob</span>
                          <span className="font-bold text-blue-305">{match.clientAnalysis.replyProbability}%</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-505 uppercase tracking-wide">Negotiator</span>
                          <span className="font-bold text-slate-300 capitalize">{match.clientAnalysis.negotiationTendency}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-505 uppercase tracking-wide">Seriousness</span>
                          <span className="font-bold text-slate-350">{match.clientAnalysis.seriousnessScore}%</span>
                        </div>
                        <div>
                          <span className="block text-[8px] text-slate-505 uppercase tracking-wide">Payment safety</span>
                          <span className={`font-bold capitalize ${
                            match.clientAnalysis.paymentReliability === 'high' ? 'text-emerald-450' : 
                            match.clientAnalysis.paymentReliability === 'medium' ? 'text-blue-300' : 'text-rose-350'
                          }`}>{match.clientAnalysis.paymentReliability}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">"{match.clientAnalysis.communicationQuality}"</p>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
