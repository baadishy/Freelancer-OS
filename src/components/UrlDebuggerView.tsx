/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bug, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ExternalLink, 
  Globe, 
  Clock, 
  Compass, 
  Activity, 
  ShieldAlert, 
  Info, 
  ChevronRight, 
  ArrowRight,
  Database,
  Terminal,
  HelpCircle,
  Copy,
  Trash2
} from 'lucide-react';

interface UrlDebuggerViewProps {
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
  prefillUrl?: string;
  onClearPrefill?: () => void;
  onNavigate?: (view: string, id?: string) => void;
}

interface DiagnosticStep {
  name: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  message: string;
  data?: any;
}

export default function UrlDebuggerView({ 
  onShowToast, 
  prefillUrl = '', 
  onClearPrefill,
  onNavigate
}: UrlDebuggerViewProps) {
  const [debugUrl, setDebugUrl] = useState('');
  const [debugging, setDebugging] = useState(false);
  const [debugSteps, setDebugSteps] = useState<DiagnosticStep[]>([]);
  const [debugResult, setDebugResult] = useState<any | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Load recently traced links from local storage
  useEffect(() => {
    const saved = localStorage.getItem('freelance_os_debug_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (_) {}
    }
  }, []);

  // Sync prefillUrl on mount or whenever it shifts
  useEffect(() => {
    if (prefillUrl) {
      setDebugUrl(prefillUrl);
      onShowToast(`Loaded target link from Opportunities feed. Ready to examine!`, 'info');
      // Auto trigger debug if we have a prefilled URL
      triggerDiagnostics(prefillUrl);
      if (onClearPrefill) {
        onClearPrefill();
      }
    }
  }, [prefillUrl]);

  const saveToHistory = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const filtered = prev.filter(u => u !== trimmed);
      const nextHistory = [trimmed, ...filtered].slice(0, 10);
      localStorage.setItem('freelance_os_debug_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const clearHistory = () => {
    localStorage.removeItem('freelance_os_debug_history');
    setHistory([]);
    onShowToast('Diagnostics link history successfully cleared.', 'info');
  };

  const triggerDiagnostics = async (urlToTest: string) => {
    const targetUrl = urlToTest.trim();
    if (!targetUrl) {
      onShowToast('Please provide a valid freelance project link to initiate analysis.', 'error');
      return;
    }

    setDebugging(true);
    setDebugResult(null);
    setDebugSteps([
      { name: 'Detect Platform Domain', status: 'running', message: 'Analyzing domain hierarchy...' },
      { name: 'URL Routing Pattern Check', status: 'pending', message: 'Awaiting platform resolution...' },
      { name: 'Active Browsing Session Check (Playwright)', status: 'pending', message: 'Awaiting pattern matches...' },
      { name: 'Metadata & Text Content Extraction Check', status: 'pending', message: 'Awaiting interactive session...' },
      { name: 'Telegram Safe-Format Formatting Check', status: 'pending', message: 'Awaiting DOM extracts...' }
    ]);

    saveToHistory(targetUrl);

    try {
      const res = await fetch('/api/opportunities/debug-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: targetUrl })
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP bad response state: ${res.status}`);
      }

      const body = await res.json();
      if (body.steps) {
        const updatedSteps = body.steps.map((srvStep: any) => ({
          name: srvStep.name,
          status: srvStep.status as 'success' | 'failed' | 'running' | 'pending',
          message: srvStep.message,
          data: srvStep.data
        }));

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
              message: 'Skipped due to upstream step failure.'
            });
          }
        }

        setDebugSteps(paddedSteps);

        if (body.success) {
          setDebugResult(body.opportunity);
          onShowToast('Link diagnostic steps passed successfully!', 'success');
        } else {
          onShowToast('URL Diagnostics identified a validation block.', 'error');
        }
      } else {
        onShowToast(body.error || 'Server diagnostics completed with an empty result.', 'error');
        setDebugSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', message: body.error || 'Connection error' } : s));
      }
    } catch (e: any) {
      onShowToast(`Server diagnostic exception triggered: ${e.message}`, 'error');
      setDebugSteps(prev => prev.map(s => s.status === 'running' ? { ...s, status: 'failed', message: e.message } : s));
    } finally {
      setDebugging(false);
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    onShowToast('Copied payload schema to clipboard.', 'success');
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  // Helper to diagnose specific failure reasons and provide helpful operator tips
  const getTroubleshootingAdvice = (failedStep: DiagnosticStep): string => {
    if (failedStep.name.includes('Detect Platform')) {
      return "The URL provided does not match our supported scrapers. Make sure the domain contains 'mostaql.com', 'khamsat.com', or 'fiverr.com'. Shared links must target supported freelance channels, not external blogs or project templates.";
    }
    if (failedStep.name.includes('Routing Pattern Check')) {
      return "Mostaql project pages require specific structures: e.g. 'https://mostaql.com/project/12345-title'. Khamsat requires service pages ('/service/123') or request pages ('/community/requests/123'). Fiverr blocks inbox threads or meta-search routes. Double check the URL structure.";
    }
    if (failedStep.name.includes('Browsing Session')) {
      return "Playwright got redirected to a login wall or homepage, or returned 404. Go to 'Platform Accounts' of your system dashboard, ensure you have input correct, unexpired login credentials, and test logging into the target account. If the platform has strong bot-protection (Cloudflare), we recommend re-saving settings to reset the browser cache.";
    }
    if (failedStep.name.includes('Metadata & Text Content')) {
      return "The page is loaded but no description, budget selectors, or text metrics could be extracted. The project might have been marked as PRIVATE, strictly restricted by the creator, archived, or deleted by the administrator. Check the project link on a browser yourself to verify.";
    }
    return "Check if there are strange formatting issues (e.g. carriage returns or unicode symbols) in the project title or description which cause the Telegram bot formatting engine to error out on the payload transmission.";
  };

  const failedStep = debugSteps.find(s => s.status === 'failed');

  return (
    <div className="space-y-6 font-sans">
      
      {/* 1. Header block */}
      <div className="border-b border-[#1e2235] pb-5">
        <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Bug size={22} className="text-amber-400" />
          Active URL Tracer & Debugger
        </h1>
        <p className="text-xs text-slate-400 font-mono uppercase tracking-wide mt-1">
          Resolve routing redirects, investigate login walls, evaluate element selectors parsing, and debug escaping.
        </p>
      </div>

      {/* Bento grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Input and Traced steps (8 columns out of 12) */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 space-y-6 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-widest flex items-center gap-2 font-mono border-b border-[#1e2235]/45 pb-2">
              <Terminal size={14} className="text-blue-400" />
              Diagnostics Console Input
            </h3>

            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Are some scraped links showing <span className="text-rose-400 font-mono font-bold">invalid</span> health states, or are you unable to scrape custom project briefs? Paste any platform URL here to run step-by-step interactive testing.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    id="debugger-url-input-field"
                    type="text"
                    className="block w-full pl-3 pr-4 py-3 bg-[#07080d] border border-[#1e2235] rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                    placeholder="https://mostaql.com/project/1542153-develop-mobile-app..."
                    value={debugUrl}
                    onChange={(e) => setDebugUrl(e.target.value)}
                  />
                </div>
                <button
                  id="debugger-run-diagnostics-btn"
                  onClick={() => triggerDiagnostics(debugUrl)}
                  disabled={debugging}
                  className="px-6 py-3 bg-amber-500/10 hover:bg-amber-500 hover:text-black hover:border-amber-550 text-amber-300 font-bold uppercase tracking-widest text-[10px] border border-amber-500/20 rounded cursor-pointer transition disabled:opacity-50 shrink-0 font-mono flex items-center justify-center gap-2"
                >
                  {debugging ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Tracing Link...
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      Examine Link
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Stepper display */}
            {debugSteps.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-[#1e2235]/40 font-mono">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Execution Trace Logs:</h4>
                
                <div className="space-y-3">
                  {debugSteps.map((step, idx) => {
                    let stepBg = 'border-[#1e2235] text-slate-550 bg-transparent';
                    let StepIcon = () => <div className="h-2 w-2 rounded-full bg-slate-700 mt-2.5 ml-1 mr-1" />;

                    if (step.status === 'running') {
                      stepBg = 'border-blue-500 text-blue-400 bg-blue-950/5';
                      StepIcon = () => <RefreshCw size={13} className="animate-spin text-blue-400 shrink-0 mt-2" />;
                    } else if (step.status === 'success') {
                      stepBg = 'border-emerald-555/15 text-emerald-400 bg-emerald-955/5';
                      StepIcon = () => <CheckCircle size={14} className="text-emerald-450 shrink-0 mt-2" />;
                    } else if (step.status === 'failed') {
                      stepBg = 'border-rose-955/15 text-rose-400 bg-rose-955/5';
                      StepIcon = () => <XCircle size={14} className="text-rose-450 shrink-0 mt-2" />;
                    }

                    return (
                      <div key={idx} className={`p-4 border rounded relative overflow-hidden transition-all duration-300 ${stepBg}`}>
                        {step.status === 'running' && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 overflow-hidden">
                            <div className="h-full bg-blue-300 animate-slide-right w-1/3" />
                          </div>
                        )}

                        <div className="flex gap-3 items-start">
                          <StepIcon />
                          <div className="flex-1 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-bold uppercase tracking-wider">
                                STAGE {idx + 1}: {step.name}
                              </span>
                              <span className="text-[9px] uppercase font-bold opacity-75">
                                [{step.status}]
                              </span>
                            </div>
                            
                            <p className="text-[10px] font-sans text-slate-300 leading-relaxed font-normal">{step.message}</p>
                            
                            {/* Inner step metadata payloads */}
                            {step.data && (
                              <div className="mt-3 p-3 bg-black/45 border border-[#1e2235]/65 rounded text-[10px] text-slate-400 overflow-x-auto select-all">
                                <span className="font-bold text-[#778bc5] text-[9.5px] uppercase block tracking-wider mb-1">Response metadata sub-elements:</span>
                                <pre className="font-mono leading-relaxed max-h-[160px] overflow-y-auto">{JSON.stringify(step.data, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SENDER DIAGNOSTIC ANALYSIS INSIGHT CARD */}
          {failedStep && (
            <div className="p-5 bg-rose-950/10 border border-rose-900/30 rounded-lg flex gap-4 animate-fade-in">
              <ShieldAlert className="text-rose-450 mt-0.5 shrink-0" size={20} />
              <div className="space-y-2">
                <span className="block text-xs font-extrabold uppercase text-rose-400 tracking-wider font-mono">
                  Diagnostics Auto-Insights: Troubleshoot Tip
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The diagnostics engine failed at stage <strong className="text-rose-300">"{failedStep.name}"</strong>.
                </p>
                <div className="bg-[#07080d]/65 border border-rose-900/15 p-3 rounded text-[11px] text-slate-350 leading-relaxed italic font-mono max-w-full">
                  {getTroubleshootingAdvice(failedStep)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Resolve these criteria natively by checking cookies, user logins status, and verifying links access boundaries.
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Result parsed Output */}
          {debugResult && (
            <div className="bg-[#0b0d16]/75 border border-emerald-500/20 rounded-lg p-6 space-y-5 backdrop-blur-sm animate-fade-in">
              <div className="border-b border-[#1e2235]/45 pb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <CheckCircle size={15} className="text-emerald-400" />
                  Successfully Normalized Schema Payload
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded uppercase tracking-wider">
                    VALID STATUS
                  </span>
                </div>
              </div>

              {/* Parsed key value grids */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Target Title</span>
                  <span className="text-slate-200 font-bold block leading-snug">{debugResult.title}</span>
                </div>
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Freelance Platform</span>
                  <span className="text-blue-400 font-black block uppercase tracking-widest text-[11px]">{debugResult.platform}</span>
                </div>
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Extracted Job Budget</span>
                  <span className="text-emerald-400 font-extrabold block text-xs">{debugResult.budget || 'Unspecified'}</span>
                </div>
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Client Creator name</span>
                  <span className="text-amber-400 font-bold block">{debugResult.clientName || 'Anonymous Operator'}</span>
                </div>
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Source Category</span>
                  <span className="text-slate-350 block capitalize">{debugResult.category || 'Standard Brief'}</span>
                </div>
                <div className="bg-[#07080d]/60 p-3 border border-[#1e2235]/45 rounded space-y-1">
                  <span className="text-[9px] text-slate-550 uppercase tracking-wider block">Inferred Language</span>
                  <span className="text-indigo-400 block font-bold uppercase tracking-wider">{debugResult.language === 'ar' ? 'Arabic (ar)' : 'English (en)'}</span>
                </div>
              </div>

              {/* Large Description block */}
              <div className="space-y-1.5 font-mono">
                <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Extracted Job Description Text Snippet:</span>
                <p className="text-slate-300 font-sans leading-relaxed text-xs p-4 bg-black/45 border border-[#1e2235]/45 rounded select-text select-all overflow-y-auto max-h-[220px] whitespace-pre-wrap">
                  {debugResult.description}
                </p>
              </div>

              {/* Copy schema payload button */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#07080c]/50 p-4 border border-[#1e2235]/45 rounded">
                <span className="text-[10px] text-slate-450 flex items-center gap-1.5 truncate max-w-full font-mono">
                  <Globe size={12} className="text-slate-500 shrink-0" />
                  URL Ref: {debugResult.link}
                </span>
                <div className="flex items-center gap-3 font-mono">
                  <button
                    onClick={() => handleCopyText(JSON.stringify(debugResult, null, 2), 999)}
                    className="text-[9px] font-bold text-slate-405 hover:text-slate-200 border border-[#1e2235] px-2.5 py-1 bg-[#10121d] rounded flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Copy size={11} />
                    {copiedIndex === 999 ? 'Copied' : 'Copy Payload'}
                  </button>
                  <a
                    href={debugResult.link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-wider font-extrabold transition cursor-pointer shrink-0"
                  >
                    Launch Site Link
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: Recents and guidelines (4 columns out of 12) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Active links test list */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-5 space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-[#1e2235]/45 pb-2">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Clock size={13} className="text-yellow-500" />
                Rescan Recent links
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-[9px] font-mono text-rose-450 hover:text-rose-400 flex items-center gap-0.5"
                  title="Wipe diagnostics history logs"
                >
                  <Trash2 size={10} />
                  wipe
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 text-[11px] text-slate-500 font-mono italic">
                No recent diagnostic link traces recorded.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono">
                {history.map((url, i) => {
                  let platformLabel = 'Fiverr';
                  let platColor = 'text-emerald-400 border-emerald-950/45';
                  if (url.includes('khamsat.com')) {
                    platformLabel = 'Khamsat';
                    platColor = 'text-orange-400 border-orange-950/45';
                  } else if (url.includes('mostaql.com')) {
                    platformLabel = 'Mostaql';
                    platColor = 'text-blue-400 border-blue-950/45';
                  }

                  return (
                    <div 
                      key={i} 
                      className="group p-2.5 bg-[#07080d]/60 border border-[#1e2235]/45 hover:border-amber-500/25 rounded flex items-center justify-between gap-2.5 transition text-[10px]"
                    >
                      <div className="min-w-0 flex-1 flex flex-col">
                        <span className={`text-[8px] font-extrabold uppercase ${platColor} tracking-wider`}>
                          {platformLabel}
                        </span>
                        <span className="text-slate-350 truncate block mt-0.5" title={url}>
                          {url}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setDebugUrl(url);
                          triggerDiagnostics(url);
                        }}
                        disabled={debugging}
                        className="opacity-0 group-hover:opacity-100 p-1 px-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded text-[8px] font-bold uppercase transition cursor-pointer"
                      >
                        diagnose
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diagnostic specifications rules card */}
          <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-5 space-y-4 backdrop-blur-sm">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 font-mono border-b border-[#1e2235]/45 pb-2">
              <Info size={13} className="text-indigo-400" />
              Checking Guidelines
            </h3>

            <div className="space-y-3.5 text-slate-400 text-xs leading-relaxed">
              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase tracking-wider text-[10px] font-mono">1. Detect Platform Domain</span>
                <p className="text-[11px]">Evaluates domain authority tags to verify whether the parser has custom selector rules loaded for the target platform.</p>
              </div>

              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase tracking-wider text-[10px] font-mono">2. Routing Pattern Check</span>
                <p className="text-[11px]">Ensures the project ID structure and slug match the expected path of active public freelance requests.</p>
              </div>

              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase tracking-wider text-[10px] font-mono">3. Active Session Check</span>
                <p className="text-[11px]">Launches headless browser state with persistent mock session metadata to confirm bypass of landing forms.</p>
              </div>

              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase tracking-wider text-[10px] font-mono">4. Text Content Extraction</span>
                <p className="text-[11px]">Executes selector evaluation to read page title, body, costs, budget bounds, and flags deleted posts.</p>
              </div>

              <div className="space-y-1">
                <span className="block font-bold text-slate-300 uppercase tracking-wider text-[10px] font-mono">5. Telegram Formatting Check</span>
                <p className="text-[11px]">Validates payload parameters escaping (HTML/Markdown V1 blocks) to confirm safe messaging transmission.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
