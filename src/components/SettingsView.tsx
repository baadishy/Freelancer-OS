/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Send, 
  Bot, 
  BellRing, 
  Cpu, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  RefreshCw,
  LogOut,
  Sliders,
  Sparkles,
  Trash2,
  Bug,
  Play,
  Check,
  XCircle,
  Globe,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { TelegramSettings, AutomationSettings, SystemLog } from '../types.js';

interface SettingsViewProps {
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  onLogout: () => void;
}

export default function SettingsView({ onShowToast, onLogout }: SettingsViewProps) {
  const [tgSettings, setTgSettings] = useState<TelegramSettings | null>(null);
  const [autoSettings, setAutoSettings] = useState<AutomationSettings | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [testingTg, setTestingTg] = useState(false);
  const [dispatchingBriefing, setDispatchingBriefing] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  // URL link debugging states
  const [debugUrl, setDebugUrl] = useState('');
  const [debugging, setDebugging] = useState(false);
  const [debugSteps, setDebugSteps] = useState<{ name: string; status: 'success' | 'failed' | 'running' | 'pending'; message: string; data?: any }[]>([]);
  const [debugResult, setDebugResult] = useState<any>(null);
  
  const fetchSettingsAndLogs = async () => {
    try {
      const [tgRes, autoRes, logsRes] = await Promise.all([
        fetch('/api/telegram/settings'),
        fetch('/api/automation/settings'),
        fetch('/api/logs')
      ]);

      if (tgRes.ok && autoRes.ok && logsRes.ok) {
        setTgSettings(await tgRes.json());
        setAutoSettings(await autoRes.json());
        setLogs(await logsRes.json());
      }
    } catch (e) {
      onShowToast('Could not load configuration profiles.', 'error');
    }
  };

  useEffect(() => {
    fetchSettingsAndLogs();
    const interval = setInterval(fetchSettingsAndLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveTelegram = async (updates: Partial<TelegramSettings>) => {
    if (!tgSettings) return;
    const fresh = { ...tgSettings, ...updates };
    setTgSettings(fresh);
    try {
      const response = await fetch('/api/telegram/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fresh)
      });
      if (response.ok) {
        onShowToast('Telegram bot preferences saved.', 'success');
      }
    } catch (e) {
      onShowToast('Failed to save Telegram config.', 'error');
    }
  };

  const handleSaveAutomation = async (updates: Partial<AutomationSettings>) => {
    if (!autoSettings) return;
    const fresh = { ...autoSettings, ...updates };
    setAutoSettings(fresh);
    try {
      const response = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fresh)
      });
      if (response.ok) {
        onShowToast(`Automation parameters mutated: ${updates.mode || 'value'}`, 'success');
      }
    } catch (e) {
      onShowToast('Failed to save automation parameters.', 'error');
    }
  };

  const handleTestTelegram = async () => {
    if (!tgSettings?.botToken || !tgSettings?.chatId) {
      onShowToast('Please provide Bot Token and Chat ID to run a test.', 'error');
      return;
    }
    setTestingTg(true);
    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: tgSettings.botToken,
          chatId: tgSettings.chatId
        })
      });
      const data = await response.json();
      if (response.ok) {
        onShowToast('Verification message successfully dispatched to Telegram Chat!', 'success');
      } else {
        onShowToast(data.error || 'Telegram rejected connection.', 'error');
      }
    } catch (e) {
      onShowToast('Failed to contact verification server.', 'error');
    } finally {
      setTestingTg(false);
    }
  };

  const handleSendManualBriefing = async () => {
    setDispatchingBriefing(true);
    onShowToast('Compiling metrics and deploying Daily AI Briefing report...', 'info');
    try {
      const response = await fetch('/api/telegram/send-briefing', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        onShowToast('AI Briefing successfully published via Telegram!', 'success');
        fetchSettingsAndLogs();
      } else {
        onShowToast(data.error || 'Failed to dispatch report.', 'error');
      }
    } catch (e) {
      onShowToast('Briefing publication failed.', 'error');
    } finally {
      setDispatchingBriefing(false);
    }
  };

  const handleClearLogs = async () => {
    setClearingLogs(true);
    try {
      const response = await fetch('/api/logs/clear', { method: 'POST' });
      if (response.ok) {
        onShowToast('Console log buffer flushed.', 'success');
        setLogs([]);
      }
    } catch (e) {
      onShowToast('Reset logs call failed.', 'error');
    } finally {
      setClearingLogs(false);
    }
  };

  const handleDebugUrl = async () => {
    if (!debugUrl) {
      onShowToast('Please provide a freelance project URL to perform diagnostic steps.', 'error');
      return;
    }
    setDebugging(true);
    setDebugResult(null);
    setDebugSteps([
      { name: 'Detect Platform Domain', status: 'running', message: 'Analyzing domain structure...' },
      { name: 'URL Routing Pattern Check', status: 'pending', message: 'Awaiting platform resolution...' },
      { name: 'Active Browsing Session Check (Playwright)', status: 'pending', message: 'Awaiting routing verification...' },
      { name: 'Metadata & Text Content Extraction Check', status: 'pending', message: 'Awaiting accessibility report...' },
      { name: 'Telegram Safe-Format Formatting Check', status: 'pending', message: 'Awaiting metadata capture...' }
    ]);

    try {
      const res = await fetch('/api/opportunities/debug-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: debugUrl })
      });

      const body = await res.json();
      if (body.steps) {
        // Overlay completed steps from server
        const updatedSteps = body.steps.map((srvStep: any) => ({
          name: srvStep.name,
          status: srvStep.status as 'success' | 'failed' | 'running' | 'pending',
          message: srvStep.message,
          data: srvStep.data
        }));

        // Pad any omitted steps as failed/pending
        const stepNames = [
          'Detect Platform Domain',
          'URL Routing Pattern Check',
          'Active Browsing Session Check (Playwright)',
          'Metadata & Text Content Extraction Check',
          'Telegram Safe-Format Formatting Check'
        ];

        const paddedSteps = [...updatedSteps];
        for (const name of stepNames) {
          if (!paddedSteps.some(s => s.name === name)) {
            paddedSteps.push({
              name,
              status: 'pending',
              message: 'Skipped due to upstream failure.'
            });
          }
        }

        setDebugSteps(paddedSteps);

        if (body.success) {
          setDebugResult(body.opportunity);
          onShowToast('URL diagnostics completed successfully. View metrics below.', 'success');
        } else {
          onShowToast('URL Diagnostics identified a validation block.', 'error');
        }
      } else {
        onShowToast(body.error || 'Server returned empty diagnostic step list.', 'error');
        setDebugSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', message: body.error || 'Unspecified response' } : s));
      }
    } catch (e: any) {
      onShowToast(`Failed to establish session validation socket: ${e.message}`, 'error');
      setDebugSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', message: e.message } : s));
    } finally {
      setDebugging(false);
    }
  };

  if (!tgSettings || !autoSettings) {
    return (
      <div className="py-24 text-center pb-48">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
        <p className="mt-3 text-slate-400 text-xs font-mono uppercase tracking-wider">Decoding settings profiles...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-[#1e2235] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <Settings size={22} className="text-blue-400" />
            Platform Orchestration Settings
          </h1>
          <p className="text-xs text-slate-405 font-mono uppercase tracking-wide mt-1">
            Configure scraping schedules, Telegram connectors, automation profiles, and review log buffers.
          </p>
        </div>
        <button
          id="settings-logout-btn"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#0b0d16] hover:bg-rose-950/20 text-rose-400 hover:text-rose-300 border border-[#1e2235] hover:border-rose-900/30 rounded font-bold uppercase tracking-widest text-[10px] cursor-pointer transition shrink-0"
        >
          <LogOut size={13} />
          Flush Session LogOut
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Column 1: Bot Variable Configurations & Channels */}
        <div className="space-y-6">
          
          {/* Telegram Credentials configuration */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 space-y-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 border-b border-[#1e2235]/45 pb-3 font-mono">
              <Bot size={16} className="text-blue-400" />
              Telegram Bot Integration API
            </h3>

            <div className="flex items-center justify-between font-mono">
              <span className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">
                Enable Telegram Bot Alerts
              </span>
              <button
                id="settings-tg-toggle-btn"
                onClick={() => handleSaveTelegram({ enabled: !tgSettings.enabled })}
                className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  tgSettings.enabled ? 'bg-blue-600' : 'bg-[#07080d] border border-[#1e2235]'
                }`}
              >
                <div className={`bg-slate-105 w-4.5 h-4.5 rounded-full shadow-md transform duration-200 ${
                  tgSettings.enabled ? 'translate-x-[22px]' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="space-y-4 pt-1 font-mono">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider" htmlFor="settings-tg-token">
                  HTTP Bot Token API Credentials
                </label>
                <input
                  id="settings-tg-token"
                  type="password"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-200 rounded p-2.5 text-xs placeholder-slate-550 outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 123456:ABC-DEF1234ghIkl-zyx..."
                  value={tgSettings.botToken}
                  onChange={(e) => handleSaveTelegram({ botToken: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider" htmlFor="settings-tg-chat">
                  Telegram Chat ID Target
                </label>
                <input
                  id="settings-tg-chat"
                  type="text"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-200 rounded p-2.5 text-xs placeholder-slate-550 outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 9876543210"
                  value={tgSettings.chatId}
                  onChange={(e) => handleSaveTelegram({ chatId: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider" htmlFor="settings-tg-time">
                  Daily Briefing Publication Time (UTC)
                </label>
                <input
                  id="settings-tg-time"
                  type="time"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-250 rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                  value={tgSettings.reportTime}
                  onChange={(e) => handleSaveTelegram({ reportTime: e.target.value })}
                />
              </div>
            </div>

            {/* Notification Rules */}
            <div className="space-y-2 border-t border-[#1e2235]/45 pt-4 font-mono">
              <span className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-2">Notification Alert Rules</span>
              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-300 uppercase tracking-wider">
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    id="settings-alert-newmatch"
                    type="checkbox"
                    className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded-sm text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    checked={tgSettings.notifyOnNewMatch}
                    onChange={(e) => handleSaveTelegram({ notifyOnNewMatch: e.target.checked })}
                  />
                  Matches Suitability
                </label>
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    id="settings-alert-comments"
                    type="checkbox"
                    className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded-sm text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    checked={tgSettings.notifyOnClientReply}
                    onChange={(e) => handleSaveTelegram({ notifyOnClientReply: e.target.checked })}
                  />
                  Client Replies
                </label>
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    id="settings-alert-submissions"
                    type="checkbox"
                    className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded-sm text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    checked={tgSettings.notifyOnSubmission}
                    onChange={(e) => handleSaveTelegram({ notifyOnSubmission: e.target.checked })}
                  />
                  Proposal dispatches
                </label>
                <label className="flex items-center gap-2 select-none cursor-pointer">
                  <input
                    id="settings-alert-errors"
                    type="checkbox"
                    className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded-sm text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                    checked={tgSettings.notifyOnError}
                    onChange={(e) => handleSaveTelegram({ notifyOnError: e.target.checked })}
                  />
                  System Failures
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4 border-t border-[#1e2235]/45 font-mono">
              <button
                id="settings-tg-test-btn"
                onClick={handleTestTelegram}
                disabled={testingTg}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#07080d] hover:bg-[#121522] border border-[#1e2235] text-slate-300 hover:text-slate-100 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer disabled:opacity-50"
              >
                <Send size={11} />
                {testingTg ? 'Testing Bot...' : 'Dispatch Test Alert'}
              </button>
              <button
                id="settings-tg-briefing-btn"
                onClick={handleSendManualBriefing}
                disabled={dispatchingBriefing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600/10 hover:bg-blue-600 hover:text-white text-blue-300 text-[10px] font-bold uppercase tracking-wider rounded border border-blue-500/20 transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={11} />
                {dispatchingBriefing ? 'Deploying...' : 'Send Manual Briefing'}
              </button>
            </div>
          </div>

        </div>

        {/* Column 2: Automation profiles & System Logs stream */}
        <div className="space-y-6">
          
          {/* Automation profiles settings */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 space-y-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 border-b border-[#1e2235]/45 pb-3 font-mono">
              <Cpu size={16} className="text-blue-400" />
              General Automation Control Terminal
            </h3>

            <div className="space-y-2 font-mono">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Automation Profile Mode</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['manual', 'assisted', 'auto'] as const).map((mode) => (
                  <button
                    id={`settings-mode-${mode}-btn`}
                    key={mode}
                    onClick={() => handleSaveAutomation({ mode })}
                    className={`p-3 rounded border text-left transition cursor-pointer ${
                      autoSettings.mode === mode 
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-[#07080d] border-[#1e2235] text-slate-400 hover:text-slate-350'
                    }`}
                  >
                    <span className="block font-extrabold uppercase tracking-widest text-[10px] mb-1">{mode} Mode</span>
                    <span className="block text-[9px] opacity-75 leading-normal">
                      {mode === 'manual' ? 'Manual review of matches & proposal copy/submit operations.' :
                       mode === 'assisted' ? 'Scraper alerts you on match. Custom Gemini pitches cued as drafts.' :
                       'Scraping, AI vetting, and submission queuing automated under matching thresholds.'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#1e2235]/45 pt-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-slate-450" htmlFor="settings-auto-minscore">Auto-approve Min Score</label>
                <input
                  id="settings-auto-minscore"
                  type="number"
                  min="50"
                  max="100"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none"
                  value={autoSettings.autoApproveMinScore}
                  onChange={(e) => handleSaveAutomation({ autoApproveMinScore: parseInt(e.target.value) || 70 })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-slate-450" htmlFor="settings-auto-interval">Scraping Interval (Min)</label>
                <input
                  id="settings-auto-interval"
                  type="number"
                  min="5"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none"
                  value={autoSettings.scrapeIntervalMinutes}
                  onChange={(e) => handleSaveAutomation({ scrapeIntervalMinutes: parseInt(e.target.value) || 30 })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-slate-450" htmlFor="settings-auto-model">Target Gemini Model</label>
                <select
                  id="settings-auto-model"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-[#b8c2ec] rounded p-[7px] text-xs outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  value={autoSettings.geminiModel || 'gemini-2.5-flash'}
                  onChange={(e) => handleSaveAutomation({ geminiModel: e.target.value })}
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Default - Cost Saving)</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Standard - Faster)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview - Higher Cost)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Master logs module */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 space-y-4 flex flex-col h-[340px] backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-[#1e2235]/45 pb-3 shrink-0 font-mono">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-blue-400" />
                Master Microservice Logs
              </h3>
              <button
                id="settings-logs-clear-btn"
                onClick={handleClearLogs}
                disabled={clearingLogs || logs.length === 0}
                className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-400 font-extrabold hover:text-rose-350 transition cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={13} />
                Flush buffer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 font-mono text-[10px]">
              {logs.length === 0 ? (
                <div className="text-center py-16 text-slate-500 uppercase tracking-wider text-[10px]">
                  Buffer is currently flat with no system actions printed.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="border-b border-[#1e2235]/20 pb-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-wider">
                      <span className={`font-bold px-1.5 py-0.5 rounded-sm ${
                        log.type === 'error' ? 'bg-rose-500/10 text-rose-401 border border-rose-500/15' :
                        log.type === 'warning' ? 'bg-amber-500/10 text-amber-401 border border-amber-500/15' :
                        log.type === 'success' ? 'bg-emerald-500/10 text-emerald-401 border border-emerald-500/15' :
                        'bg-slate-900 text-slate-401 border border-slate-800'
                      }`}>
                        {log.source}:{log.type}
                      </span>
                      <span className="text-slate-500 font-semibold">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[10px]">{log.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 5. LIVE URL VALIDATION DIAGNOSTIC TERMINAL */}
      <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 space-y-6 backdrop-blur-sm">
        <div className="border-b border-[#1e2235]/45 pb-3">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
            <Bug size={16} className="text-amber-400" />
            Active Opportunity Link Debugger & Tracer
          </h3>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide mt-1">
            Is a specific Khamsat or Mostaql link failing to scraper/alert correctly? Paste it below to run step-by-step connection, session-wall, DOM extraction, and formatting diagnostic tests.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 font-mono">
          <input
            id="debug-url-input"
            type="text"
            className="flex-1 bg-[#07080d] border border-[#1e2235] text-slate-200 rounded p-3 text-xs placeholder-slate-550 min-w-0 outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Paste raw target platform URL (e.g. https://mostaql.com/project/1234567-build-saas)..."
            value={debugUrl}
            onChange={(e) => setDebugUrl(e.target.value)}
          />
          <button
            id="debug-url-btn"
            onClick={handleDebugUrl}
            disabled={debugging}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-300 font-bold uppercase tracking-widest text-[10px] border border-amber-500/25 rounded cursor-pointer transition disabled:opacity-50 shrink-0"
          >
            {debugging ? (
              <>
                <RefreshCw size={12} className="animate-spin" />
                Validating Link...
              </>
            ) : (
              <>
                <Play size={12} />
                Examine Link
              </>
            )}
          </button>
        </div>

        {/* Steps stepper and indicators */}
        {debugSteps.length > 0 && (
          <div className="space-y-4 border-t border-[#1e2235]/45 pt-5 font-mono">
            <h4 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">Diagnostic Step traces:</h4>
            <div className="space-y-3">
              {debugSteps.map((step, idx) => {
                let statusColor = 'text-slate-500 border-[#1e2235]';
                let Icon = () => <div className="h-2 w-2 rounded-full bg-slate-600 mt-1" />;

                if (step.status === 'running') {
                  statusColor = 'text-blue-400 border-blue-500 bg-blue-500/5 font-bold';
                  Icon = () => <RefreshCw size={12} className="animate-spin text-blue-400" />;
                } else if (step.status === 'success') {
                  statusColor = 'text-emerald-400 border-emerald-950/40 bg-emerald-950/5';
                  Icon = () => <CheckCircle size={14} className="text-emerald-400 shrink-0" />;
                } else if (step.status === 'failed') {
                  statusColor = 'text-rose-400 border-rose-955/20 bg-rose-955/5 font-bold';
                  Icon = () => <XCircle size={14} className="text-rose-400 shrink-0" />;
                }

                return (
                  <div key={idx} className={`p-3 border rounded-md flex items-start gap-3 transition ${statusColor}`}>
                    <div className="shrink-0 mt-0.5">
                      <Icon />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wide">
                          Step {idx + 1}: {step.name}
                        </span>
                        <span className="text-[9px] uppercase font-semibold opacity-75">
                          ({step.status})
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed font-sans">{step.message}</p>
                      
                      {/* Step inner data output logic */}
                      {step.data && (
                        <div className="mt-2 p-2 bg-slate-950/50 border border-[#1e2235]/65 rounded text-[9px] text-slate-450 overflow-x-auto space-y-1 select-text">
                          <span className="font-extrabold text-[#7e8db4] uppercase block tracking-wider">Payload diagnostic trace:</span>
                          <pre className="mt-1 leading-normal font-mono">{JSON.stringify(step.data, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Extracted Opportunity Details Block */}
        {debugResult && (
          <div className="bg-[#0a0c14] border border-[#1e2235] rounded-lg p-5 font-mono space-y-4 animate-fade-in">
            <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 pb-2.5 border-b border-[#1e2235]/45">
              <CheckCircle size={14} className="text-emerald-400" />
              Extracted Opportunity Schemas (Valid and Parsing)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Target Title</span>
                <span className="text-slate-200 lg:text-xs font-bold block">{debugResult.title}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Freelancer Platform</span>
                <span className="text-blue-400 font-extrabold block uppercase tracking-widest">{debugResult.platform}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Extracted Job Budget / Estimate</span>
                <span className="text-emerald-400 font-bold block">{debugResult.budget || 'Unspecified'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Client Brand Name</span>
                <span className="text-amber-400 font-bold block">{debugResult.clientName || 'Anonymous Client'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Target Category</span>
                <span className="text-slate-300 block">{debugResult.category || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 uppercase tracking-wider block">Detected Source Language</span>
                <span className="text-indigo-400 block uppercase tracking-widest">{debugResult.language || 'Arabic (ar)'}</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-3 border-t border-[#1e2235]/25 text-[10px]">
              <span className="text-slate-500 uppercase tracking-wider block">Job Post Description Snippet</span>
              <p className="text-slate-300 font-sans leading-relaxed p-3 bg-black/45 border border-[#1e2235]/45 rounded text-xs select-text overflow-y-auto max-h-[140px]">
                {debugResult.description}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-[#1e2235]/25 bg-[#07080c]/50 p-3 rounded-md">
              <span className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate max-w-full">
                <Globe size={12} className="text-slate-500 shrink-0" />
                Ref URL: {debugResult.link}
              </span>
              <a
                href={debugResult.link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0"
              >
                Launch Link Externally
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
