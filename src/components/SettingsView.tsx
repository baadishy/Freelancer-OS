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
  Trash2
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
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
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
    </div>
  );
}
