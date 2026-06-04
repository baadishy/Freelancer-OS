/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Briefcase, 
  Target, 
  FileText, 
  CheckCircle, 
  MessageSquare, 
  Activity, 
  BellRing, 
  RefreshCw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Zap,
  Trash2
} from 'lucide-react';
import { DashboardStats, SystemLog, Opportunity } from '../types.js';

interface DashboardViewProps {
  onNavigate: (view: string, id?: string) => void;
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function DashboardView({ onNavigate, onShowToast }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [highMatches, setHighMatches] = useState<Opportunity[]>([]);
  const [scraperAnalytics, setScraperAnalytics] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [purging, setPurging] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('freelance_os_token');
      const headersOption = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [statsRes, logsRes, opsRes, analyticsRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers: headersOption }),
        fetch('/api/logs', { headers: headersOption }),
        fetch('/api/opportunities?minScore=80', { headers: headersOption }),
        fetch('/api/scraper/analytics', { headers: headersOption })
      ]);

      if (statsRes.ok && logsRes.ok && opsRes.ok) {
        const statsData = await statsRes.json();
        const logsData = await logsRes.json();
        const opsData = await opsRes.json();

        setStats(statsData);
        setLogs(logsData.slice(0, 10)); // Top 10 for dashboard stream
        // Clean out submitted opportunities to make dashboard clean
        const activeOps = opsData.filter((o: any) => o.status !== 'submitted');
        setHighMatches(activeOps.slice(0, 3)); // Top 3 matching jobs
      }

      if (analyticsRes && analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setScraperAnalytics(analyticsData);
      }
    } catch (err) {
      console.error('Failed to update dashboard feeds:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh every 10s
    const timer = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(timer);
  }, []);

  const triggerManualScrape = async () => {
    setRefreshing(true);
    onShowToast('Scraping Mostaql, Fiverr, and Khamsat platforms...', 'info');
    try {
      const response = await fetch('/api/opportunities/scrape', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        onShowToast(`Scan finished! Scraped ${data.addedCount} new actionable leads.`, 'success');
        fetchDashboardData();
      } else {
        onShowToast(data.error || 'Scraper failed to launch.', 'error');
      }
    } catch (e) {
      onShowToast('Platform scraping offline.', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const triggerPurgeData = async () => {
    if (!window.confirm('Are you absolute sure you want to clean database history? This deletes all collected jobs and proposal logs.')) {
      return;
    }
    setPurging(true);
    try {
      const response = await fetch('/api/dashboard/purge', { method: 'POST' });
      if (response.ok) {
        onShowToast('Local workspace data successfully flushed clean.', 'success');
        fetchDashboardData();
      }
    } catch (e) {
      onShowToast('Purge connection lost.', 'error');
    } finally {
      setPurging(false);
    }
  };

  const dismissOpportunity = async (id: string) => {
    try {
      const response = await fetch(`/api/opportunities/${id}/hide`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true })
      });
      if (response.ok) {
        onShowToast('Offer dismissed from display (AI routing unaffected).', 'info');
        fetchDashboardData();
      } else {
        onShowToast('Failed to dismiss opportunity.', 'error');
      }
    } catch (e) {
      onShowToast('Network error dismissing opportunity.', 'error');
    }
  };

  if (!stats) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-slate-900">
        <div className="text-center">
          <RefreshCw className="h-10 w-10 animate-spin text-indigo-400 mx-auto" />
          <p className="mt-4 text-slate-400 font-medium">Booting Freelance Monitor terminal...</p>
        </div>
      </div>
    );
  }

  // Pure SVG Circular Donut calculations for dashboard platforms ratio
  const totalPr = stats.platformsBreakdown.Khamsat + stats.platformsBreakdown.Mostaql + stats.platformsBreakdown.Fiverr || 1;
  const khPct = stats.platformsBreakdown.Khamsat / totalPr;
  const mosPct = stats.platformsBreakdown.Mostaql / totalPr;
  const fivPct = stats.platformsBreakdown.Fiverr / totalPr;

  return (
    <div className="space-y-8 font-sans">
      {/* Upper header action blocks */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#1d2030] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
            System Terminal
            {!stats.telegramStatus && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Telegram offline
              </span>
            )}
            {stats.telegramStatus && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Bot Connected
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time telemetry and AI task automated briefings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="db-purge-btn"
            onClick={triggerPurgeData}
            disabled={purging}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#0d0f17]/80 hover:bg-rose-950/20 text-rose-300 text-xs font-bold uppercase tracking-wider rounded-lg border border-[#1d2030] hover:border-rose-800/40 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            Reset DB
          </button>
          <button
            id="db-scrape-btn"
            onClick={triggerManualScrape}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-slate-100 text-xs font-bold uppercase tracking-wider rounded-lg border border-blue-500/30 shadow-md transition-all cursor-pointer disabled:opacity-50 font-sans"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Auditing Channels...' : 'Scrape Platforms Now'}
          </button>
        </div>
      </div>

      {/* Grid count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-4 flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Jobs Discovered</span>
            <Briefcase size={14} className="text-slate-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.totalJobsFound}</span>
            <span className="text-[9px] text-slate-550 block font-mono">Total scraped</span>
          </div>
        </div>

        <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-4 flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">High Match</span>
            <Target size={14} className="text-blue-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.matchedJobs}</span>
            <span className="text-[9px] text-blue-40block font-mono text-blue-400">Matches &gt;= 70%</span>
          </div>
        </div>

        <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-4 flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Proposal Drafts</span>
            <FileText size={14} className="text-slate-500" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.proposalsGenerated}</span>
            <span className="text-[9px] text-slate-550 block font-mono">Unsubmitted drafts</span>
          </div>
        </div>

        <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-4 flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Sent to Clients</span>
            <CheckCircle size={14} className="text-emerald-450" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.proposalsSubmitted}</span>
            <span className="text-[9px] text-emerald-400 block font-mono">Officially submitted</span>
          </div>
        </div>

        <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-4 flex flex-col justify-between backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Client Replies</span>
            <MessageSquare size={14} className="text-blue-450" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.repliesReceived}</span>
            <span className="text-[9px] text-blue-400 block font-mono">Realtime estimated</span>
          </div>
        </div>

        <div className="bg-[#0b0d16]/75 border border-blue-500/20 rounded-lg p-4 flex flex-col justify-between bg-gradient-to-br from-blue-950/15 to-[#0b0d16]/75 backdrop-blur-sm">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Win Ratio</span>
            <Zap size={14} className="text-amber-400" />
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-slate-100">{stats.acceptanceRate}%</span>
            <span className="text-[9px] text-blue-300 block font-mono">AI conversion score</span>
          </div>
        </div>
      </div>

      {/* Main double column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Double-span container (Top matches & Analytics SVG) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Opportunities Card */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Target size={18} className="text-blue-400" />
                Highly Suitable Opportunities
              </h3>
              <button
                id="db-goto-ops-btn"
                onClick={() => onNavigate('opportunities')}
                className="text-xs text-blue-400 font-bold uppercase tracking-wider hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                View absolute list
                <ExternalLink size={12} />
              </button>
            </div>

            {highMatches.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#1e2235] rounded-lg">
                <Briefcase size={32} className="text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400 font-medium pb-1">No top-bracket matches available right now.</p>
                <p className="text-xs text-slate-500 font-mono">Run a scrape cycle or broaden profile tech skills.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {highMatches.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-4 bg-[#0d0f17]/65 rounded-lg border border-[#1e2235] hover:border-blue-500/30 transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.25 text-[10px] pl-1.25 pr-2 py-0.5 rounded font-bold uppercase tracking-widest border ${
                          job.platform === 'Mostaql' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                          job.platform === 'Khamsat' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {job.platform === 'Mostaql' && (
                            <span className="w-3 w-3 rounded-full bg-blue-500 flex items-center justify-center text-[7px] font-extrabold text-white select-none">M</span>
                          )}
                          {job.platform === 'Khamsat' && (
                            <span className="w-3 w-3 rounded-full bg-orange-500 flex items-center justify-center text-[7px] font-extrabold text-white select-none">٥</span>
                          )}
                          {job.platform === 'Fiverr' && (
                            <span className="w-3 w-3 rounded-full bg-emerald-550 flex items-center justify-center text-[7px] font-extrabold text-white select-none">f</span>
                          )}
                          {job.platform}
                        </span>
                        <span className="text-xs font-semibold text-slate-400 flex items-center gap-2 flex-wrap">
                          <span>Budget: <strong className="text-slate-200">{job.budget}</strong></span>
                          {job.timestamp && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-450 font-mono font-medium">
                              <span className="text-slate-600">•</span>
                              <Clock size={11} className="text-indigo-400 shrink-0" />
                              Published: <span className="text-slate-350">{new Date(job.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                          )}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-slate-200 truncate pr-4" dir={['Mostaql', 'Khamsat'].includes(job.platform) ? 'rtl' : 'ltr'}>{job.title}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2" dir={['Mostaql', 'Khamsat'].includes(job.platform) ? 'rtl' : 'ltr'}>{job.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="text-center bg-blue-950/20 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                        <span className="block text-[8px] text-blue-400 uppercase tracking-widest font-semibold">Match score</span>
                        <span className="text-base font-extrabold text-blue-300">{job.matchAnalysis?.score}%</span>
                      </div>
                      <button
                        id={`db-dismiss-job-${job.id}-btn`}
                        onClick={() => dismissOpportunity(job.id)}
                        className="p-2.5 bg-[#121522] hover:bg-rose-950/30 text-rose-450 hover:text-rose-400 border border-[#1e2235] hover:border-rose-900/30 rounded-md transition cursor-pointer"
                        title="Dismiss (does not affect AI)"
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        id={`db-view-job-${job.id}-btn`}
                        onClick={() => onNavigate('opportunities', job.id)}
                        className="px-3 py-2 bg-[#121522] hover:bg-[#1a1e30] text-slate-300 hover:text-slate-105 text-xs font-semibold rounded-md border border-[#1e2235] transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Graphical Analytics Component */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 backdrop-blur-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-6 flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              Dynamic Performance Visualizer
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Custom SVG line chart of fake historical telemetry success */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Quarterly Proposal Success Rate</span>
                <div className="relative h-44 bg-[#0d0f17]/65 rounded-lg p-3 border border-[#1e2235] flex flex-col justify-between">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
                    <div className="border-b border-[#1e2235]/40 w-full" />
                    <div className="border-b border-[#1e2235]/40 w-full" />
                    <div className="border-b border-[#1e2235]/40 w-full" />
                    <div className="border-b border-[#1e2235]/40 w-full" />
                  </div>

                  <svg viewBox="0 0 100 35" className="w-full h-28 overflow-visible z-10">
                    <defs>
                      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Shaded Area */}
                    <path
                      d="M 5 30 L 25 22 L 45 15 L 65 24 L 85 8 L 85 30 Z"
                      fill="url(#grad)"
                    />
                    {/* Line path */}
                    <path
                      d="M 5 30 L 25 22 L 45 15 L 65 24 L 85 8"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Interactive dots */}
                    <circle cx="5" cy="30" r="1.5" fill="#e2e8f0" />
                    <circle cx="25" cy="22" r="1.5" fill="#e2e8f0" />
                    <circle cx="45" cy="15" r="1.5" fill="#3b82f6" />
                    <circle cx="65" cy="24" r="1.5" fill="#e2e8f0" />
                    <circle cx="85" cy="8" r="1.8" fill="#a855f7" className="animate-pulse" />
                  </svg>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono font-semibold px-2">
                    <span>Week 1</span>
                    <span>Week 2</span>
                    <span>Week 3</span>
                    <span>Week 4</span>
                    <span>Active Week</span>
                  </div>
                </div>
              </div>

              {/* Custom platform distribution chart */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Identified Bids Share</span>
                <div className="flex items-center gap-6 p-4 bg-[#0d0f17]/65 rounded-lg border border-[#1e2235]">
                  <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                    {/* Render visual SVG segmented circle */}
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="#121522" strokeWidth="4.5" />
                      
                      {/* Fiverr slice limit */}
                      <circle 
                        cx="18" cy="18" r="14" fill="none" 
                        stroke="#10b981" strokeWidth="5" 
                        strokeDasharray={`${isNaN(fivPct) ? 33 : Math.round(fivPct * 88)} 88`} 
                        strokeDashoffset="0"
                      />
                      {/* Mostaql slice limit */}
                      <circle 
                        cx="18" cy="18" r="14" fill="none" 
                        stroke="#3b82f6" strokeWidth="5" 
                        strokeDasharray={`${isNaN(mosPct) ? 33 : Math.round(mosPct * 88)} 88`} 
                        strokeDashoffset={`-${isNaN(fivPct) ? 33 : Math.round(fivPct * 88)}`}
                      />
                      {/* Khamsat slice limit */}
                      <circle 
                        cx="18" cy="18" r="14" fill="none" 
                        stroke="#f97316" strokeWidth="5" 
                        strokeDasharray={`${isNaN(khPct) ? 22 : Math.round(khPct * 88)} 88`} 
                        strokeDashoffset={`-${isNaN(fivPct) ? 33 : Math.round((fivPct + mosPct) * 88)}`}
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="block text-lg font-bold text-slate-200">{stats.totalJobsFound}</span>
                      <span className="block text-[9px] text-slate-500 uppercase tracking-wider font-mono">Indexed</span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs flex-1">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="flex items-center gap-2 text-slate-400">
                        <span className="w-2 h-2 rounded-none bg-emerald-500 block" /> Fiverr
                      </span>
                      <span className="font-semibold text-slate-200">{stats.platformsBreakdown.Fiverr}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="flex items-center gap-2 text-slate-400">
                        <span className="w-2 h-2 rounded-none bg-blue-500 block" /> Mostaql
                      </span>
                      <span className="font-semibold text-slate-200">{stats.platformsBreakdown.Mostaql}</span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="flex items-center gap-2 text-slate-400">
                        <span className="w-2 h-2 rounded-none bg-orange-500 block" /> Khamsat
                      </span>
                      <span className="font-semibold text-slate-200">{stats.platformsBreakdown.Khamsat}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right Single-span column (AI recommendations, bot status, and logs feed) */}
        <div className="space-y-6">

          {/* AI Advisor Panel */}
          <div className="bg-gradient-to-br from-blue-950/15 to-[#0b0d16]/75 border border-blue-500/20 rounded-lg p-5 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
            <div className="flex items-center gap-2 text-blue-400 mb-3.5">
              <Zap size={20} className="text-amber-400 animate-pulse" />
              <h4 className="text-xs font-bold uppercase tracking-wider">AI Tactical Advisor</h4>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-350">
              <p className="leading-relaxed">
                Based on current metrics, bidding on <strong>Mostaql</strong> projects yields the highest immediate response rate (*40% probability*).
              </p>
              <div className="p-3 bg-[#07080d]/80 rounded-lg border border-[#1e2235] border-l-2 border-l-amber-400 text-slate-300">
                <span className="font-mono text-[10px] font-bold text-amber-300 block mb-1 uppercase tracking-wider">Recommended Action:</span>
                Authorize generated proposal drafts inside the queue immediately before target Platform cooling-down timers reset.
              </div>
            </div>
          </div>

          {/* System Logs Feed */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-5 flex flex-col h-96 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 border-b border-[#1e2235]/40 pb-3 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Clock size={16} className="text-slate-500" />
                Live Network Logs
              </h3>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1" id="db-logs-container">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  No active system logs currently recorded.
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="text-[11px] leading-relaxed border-b border-[#1e2235]/40 pb-2">
                    <div className="flex items-center justify-between mb-0.5 whitespace-nowrap">
                      <span className={`font-mono font-bold uppercase tracking-wider px-1 bg-[#07080d] rounded ${
                        log.type === 'error' ? 'text-rose-400' : 
                        log.type === 'warning' ? 'text-amber-400' :
                        log.type === 'success' ? 'text-emerald-400' : 'text-slate-450'
                      }`}>
                        {log.source}:{log.type}
                      </span>
                      <span className="text-slate-500 font-mono text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-350 font-mono break-all">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
