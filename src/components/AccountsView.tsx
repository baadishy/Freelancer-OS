/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  Unlink, 
  CheckCircle2, 
  AlertTriangle, 
  Monitor, 
  Keyboard, 
  MousePointer, 
  ArrowRight, 
  Globe, 
  Lock, 
  Check, 
  X,
  PlusCircle,
  HelpCircle,
  Clock
} from 'lucide-react';
import { ConnectedAccount } from '../types.ts';

interface AccountsViewProps {
  onShowToast: (text: string, type?: 'success' | 'info' | 'error') => void;
}

export default function AccountsView({ onShowToast }: AccountsViewProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Chrome Path variables
  const [showChromeConfig, setShowChromeConfig] = useState(false);
  const [chromeDetect, setChromeDetect] = useState<{ platform: string; detectedPath: string | null; configuredPath: string | null } | null>(null);
  const [customChromePath, setCustomChromePath] = useState('');

  // Virtual Browser active session variables
  const [activePlatform, setActivePlatform] = useState<'Khamsat' | 'Mostaql' | 'LinkedIn' | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [typeValue, setTypeValue] = useState('');
  const [verifyingSession, setVerifyingSession] = useState(false);
  const [authStatusText, setAuthStatusText] = useState<{ authenticated: boolean; username?: string } | null>(null);

  // Interaction enhancement states
  const [clickHoldMode, setClickHoldMode] = useState(false);
  const [holdDuration, setHoldDuration] = useState(6000); // Default to 6 seconds

  // Manual session cookie variables
  const [showCookieImport, setShowCookieImport] = useState(false);
  const [cookiePlatform, setCookiePlatform] = useState<'Khamsat' | 'Mostaql' | 'LinkedIn'>('Khamsat');
  const [cookieJson, setCookieJson] = useState('');
  const [cookieImporting, setCookieImporting] = useState(false);
  const [cookieHelpOpen, setCookieHelpOpen] = useState(false);
  
  const screenshotRef = useRef<HTMLImageElement>(null);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (e: any) {
      console.error('Error fetching connected accounts:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchChromeDetection = async () => {
    try {
      const res = await fetch('/api/chrome/detection');
      if (res.ok) {
        const data = await res.json();
        setChromeDetect(data);
        setCustomChromePath(data.configuredPath || '');
      }
    } catch (e) {
      console.error('Error fetching Chrome path state:', e);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchChromeDetection();
  }, []);

  const handleSaveChromeConfig = async () => {
    try {
      const res = await fetch('/api/automation/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chromePath: customChromePath })
      });
      if (res.ok) {
        onShowToast('Chrome path override successfully updated.', 'success');
        fetchChromeDetection();
      } else {
        onShowToast('Failed to update Chrome path settings.', 'error');
      }
    } catch (e: any) {
      onShowToast(`Config error: ${e.message}`, 'error');
    }
  };

  const handleStartConnection = async (platform: 'Khamsat' | 'Mostaql' | 'LinkedIn') => {
    setBrowserLoading(true);
    setActivePlatform(platform);
    setScreenshot(null);
    setAuthStatusText(null);
    onShowToast(`Launching sandboxed Chromium threat for ${platform}...`, 'info');

    try {
      const response = await fetch('/api/accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });

      if (response.ok) {
        const data = await response.json();
        setScreenshot(data.screenshot);
        onShowToast(`Interactive virtual stream established for ${platform}!`, 'success');
      } else {
        const err = await response.json();
        onShowToast(`Failed to open browser: ${err.error}`, 'error');
        setActivePlatform(null);
      }
    } catch (err: any) {
      onShowToast(`Network failure: ${err.message}`, 'error');
      setActivePlatform(null);
    } finally {
      setBrowserLoading(false);
    }
  };

  const handleInteraction = async (payload: any) => {
    if (browserLoading) return;
    setBrowserLoading(true);

    try {
      const response = await fetch('/api/accounts/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setScreenshot(data.screenshot);
        setAuthStatusText(data.authStatus);
      } else {
        const err = await response.json();
        onShowToast(`Interaction error: ${err.error}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Interaction connection issue: ${err.message}`, 'error');
    } finally {
      setBrowserLoading(false);
    }
  };

  const handleScreenshotClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!screenshotRef.current || browserLoading) return;

    const rect = screenshotRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (clickHoldMode) {
      handleInteraction({ action: 'clickHold', x, y, duration: holdDuration });
    } else {
      handleInteraction({ action: 'click', x, y });
    }
  };

  const handleTypeText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typeValue.trim() || browserLoading) return;

    handleInteraction({ action: 'type', text: typeValue });
    setTypeValue('');
  };

  const handlePressKey = (key: string) => {
    handleInteraction({ action: 'press', key });
  };

  const handleVerifyAndSave = async () => {
    if (verifyingSession) return;
    setVerifyingSession(true);
    onShowToast('Evaluating and finalising active browser session state...', 'info');

    try {
      const response = await fetch('/api/accounts/verify', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          onShowToast(`Successfully connected and validated @${data.account?.username}!`, 'success');
          setActivePlatform(null);
          setScreenshot(null);
          fetchAccounts();
        } else {
          onShowToast('Session not recognized as fully authenticated yet. Check credentials and retry.', 'error');
        }
      } else {
        const err = await response.json();
        onShowToast(`Verification failed: ${err.error}`, 'error');
      }
    } catch (e: any) {
      onShowToast(`Error saving session: ${e.message}`, 'error');
    } finally {
      setVerifyingSession(false);
    }
  };

  const handleAbortSession = async () => {
    try {
      await fetch('/api/accounts/cancel', { method: 'POST' });
    } catch (e) {}
    setActivePlatform(null);
    setScreenshot(null);
    onShowToast('Browser session discarded safely.', 'info');
    fetchAccounts();
  };

  const handleDisconnect = async (platform: 'Khamsat' | 'Mostaql' | 'LinkedIn') => {
    if (!confirm(`Are you sure you want to disconnect your ${platform} account? This will permanently close the session and wipe your stored browser profile directory.`)) return;

    try {
      const response = await fetch('/api/accounts/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });

      if (response.ok) {
        onShowToast(`Disconnected ${platform} successfully and deleted profile foldres.`, 'success');
        fetchAccounts();
      } else {
        const err = await response.json();
        onShowToast(`Failed to disconnect: ${err.error}`, 'error');
      }
    } catch (e: any) {
      onShowToast(`Disconnect failed: ${e.message}`, 'error');
    }
  };

  const handleValidateSession = async (platform: 'Khamsat' | 'Mostaql' | 'LinkedIn') => {
    onShowToast(`Validating live credentials persistent profile for ${platform}...`, 'info');
    try {
      const response = await fetch('/api/accounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'CONNECTED') {
          onShowToast(`Verified: ${platform} session is ACTIVE for operator @${data.username || 'user'}!`, 'success');
        } else {
          onShowToast(`Session expired or unauthenticated for ${platform}. Please reconnect.`, 'error');
        }
        fetchAccounts();
      } else {
        const err = await response.json();
        onShowToast(`Validation error: ${err.error}`, 'error');
      }
    } catch (e: any) {
      onShowToast(`Validation request failed: ${e.message}`, 'error');
    }
  };

  const handleImportCookies = async () => {
    if (!cookieJson.trim()) {
      onShowToast('Please paste valid cookies JSON or key-value pair text first.', 'error');
      return;
    }
    setCookieImporting(true);
    onShowToast(`Importing cookie session to persistent ${cookiePlatform} profile...`, 'info');

    try {
      let payloadCookies = cookieJson.trim();
      // Try to validate or auto-detect array if it looks like JSON
      if (payloadCookies.startsWith('[') && payloadCookies.endsWith(']')) {
        try {
          payloadCookies = JSON.parse(payloadCookies);
        } catch (e: any) {
          onShowToast(`Invalid JSON array layout: ${e.message}`, 'error');
          setCookieImporting(false);
          return;
        }
      }

      const response = await fetch('/api/accounts/import-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: cookiePlatform,
          cookies: payloadCookies
        })
      });

      if (response.ok) {
        const data = await response.json();
        onShowToast(`Manual session imported successfully! Connected as @${data.username || 'imported_user'}!`, 'success');
        setCookieJson('');
        setShowCookieImport(false);
        fetchAccounts();
      } else {
        const err = await response.json();
        onShowToast(`Session Import Failed: ${err.error}`, 'error');
      }
    } catch (e: any) {
      onShowToast(`Import connection error: ${e.message}`, 'error');
    } finally {
      setCookieImporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        );
      case 'EXPIRED':
      case 'LOGIN_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
            Session Expired
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
            Conn Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider">
            Disconnected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SPECS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl gap-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
            <ShieldCheck className="text-blue-400 h-6 w-6" />
            Platform Accounts Manager
          </h1>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Universal persistent Google login and session preservation dashboard. Playwright launches Chrome using dedicated, isolated profile dirs so you login manually once and retain credentials safely over application restarts.
          </p>
        </div>
        <div className="flex items-center justify-center p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl max-w-xs md:max-w-none">
          <Lock className="text-blue-400 mr-2 shrink-0 animate-pulse" size={14} />
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wide">Persistent Profiles Encryption</span>
        </div>
      </div>

      {/* SECURE PLAYWRIGHT CHROME CONFIGURATION */}
      <div className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowChromeConfig(!showChromeConfig)}>
          <div className="flex items-center gap-2.5">
            <Globe className="text-blue-450 h-5 w-5" />
            <div>
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider font-mono">Chrome Executable Location Setup</h3>
              <p className="text-[10px] text-slate-400">Playwright targets your real installed Chrome to bypass Google security checks seamlessly.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 rounded cursor-pointer hover:bg-blue-500/20 transition">
            {showChromeConfig ? "Fewer Settings" : "Configure Paths"}
          </span>
        </div>

        {showChromeConfig && (
          <div className="border-t border-slate-800/80 pt-4 space-y-4 transition-all animate-slide-up text-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 p-3.5 bg-slate-950/45 border border-slate-900 rounded-xl">
                <span className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider">Playwright Environmental Sniffer</span>
                <div className="space-y-1.5 mt-1.5 text-[11px] leading-relaxed font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Detected OS Platform:</span>
                    <span className="font-bold text-slate-100 capitalize">{chromeDetect?.platform || 'Checking...'}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Auto-Detected Path:</span>
                    <span className="font-bold text-slate-300 break-all select-all text-right max-w-[65%] text-[10px]" title={chromeDetect?.detectedPath || ''}>
                      {chromeDetect?.detectedPath || 'No Chrome binary auto-detected'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Configured Custom Path:</span>
                    <span className="font-bold text-blue-400 break-all select-all text-right max-w-[65%] text-[10px]" title={chromeDetect?.configuredPath || ''}>
                      {chromeDetect?.configuredPath || 'None (Using Default fallback)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-3.5 bg-slate-950/45 border border-slate-900 rounded-xl flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-550" htmlFor="chrome-path-override">
                    Configure Custom Chrome Path Override
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                    If auto-detection fails to find Chrome on your system, please locate your chrome.exe file path and paste it below.
                  </p>
                </div>
                <div className="flex gap-2.5">
                  <input
                    id="chrome-path-override"
                    type="text"
                    value={customChromePath}
                    onChange={(e) => setCustomChromePath(e.target.value)}
                    placeholder="e.g. C:\Program Files\Google\Chrome\Application\chrome.exe"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-700 font-mono focus:outline-none focus:border-blue-500/40"
                  />
                  <button
                    onClick={handleSaveChromeConfig}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
                  >
                    Save Path
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MANUAL COOKIE SESSION IMPORT */}
      <div className="p-5 bg-slate-900/40 border border-slate-800/80 rounded-2xl space-y-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowCookieImport(!showCookieImport)}>
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider font-mono">Alternative: Manual Cookie Session Import</h3>
              <p className="text-[10px] text-slate-400">Log in securely on your own local Chrome browser and paste cookies to bypass anti-automation / Google Login blocks completely.</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-500/20 transition">
            {showCookieImport ? "Hide Cookie Importer" : "Paste Session Cookies"}
          </span>
        </div>

        {showCookieImport && (
          <div className="border-t border-slate-800/80 pt-4 space-y-4 transition-all animate-slide-up text-xs font-sans">
            <div className="flex flex-col md:flex-row gap-4">
              
              {/* Left Side: Inputs */}
              <div className="flex-1 space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-1" htmlFor="platform-select">Target Platform</label>
                    <select
                      id="platform-select"
                      value={cookiePlatform}
                      onChange={(e) => setCookiePlatform(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/40"
                    >
                      <option value="Khamsat">Khamsat</option>
                      <option value="Mostaql">Mostaql</option>
                      <option value="LinkedIn">LinkedIn</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setCookieHelpOpen(!cookieHelpOpen)}
                      className="w-full text-center py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-950/25 text-slate-350 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <HelpCircle size={13} />
                      {cookieHelpOpen ? "Hide Instructions" : "Get Console Snippet"}
                    </button>
                  </div>
                </div>

                {cookieHelpOpen && (
                  <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-xl space-y-2.5 text-slate-300 pointer-events-auto select-text">
                    <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-slate-200 flex items-center gap-1 font-mono">
                      <ShieldCheck size={13} className="text-emerald-400" />
                      Two-Step Clipboard Snippet Instructions
                    </h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-350">
                      <li>Log in normally to <a href={cookiePlatform === 'Khamsat' ? 'https://khamsat.com' : cookiePlatform === 'Mostaql' ? 'https://mostaql.com' : 'https://linkedin.com'} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                        {cookiePlatform === 'Khamsat' ? 'Khamsat.com' : cookiePlatform === 'Mostaql' ? 'Mostaql.com' : 'LinkedIn.com'}
                      </a> in your actual Google Chrome browser.</li>
                      <li>Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">F12</kbd> (or right click → <strong>Inspect</strong>) and click the <strong>Console</strong> tab.</li>
                      <li>Copy and Paste the command below and hit Enter (it copies the exact session layout to your clipboard automatically):</li>
                    </ol>
                    <div className="relative font-mono text-[9px] bg-slate-905 p-3.5 rounded-lg border border-slate-800 break-all select-all text-slate-300 bg-black/60">
                      <code>
                        copy(JSON.stringify(document.cookie.split(';').map(c =&gt; &#123; const p = c.trim().split('='); return &#123; name: p[0], value: p.slice(1).join('='), domain: window.location.hostname, path: '/' &#125; &#125;)))
                      </code>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">Alternatively: copy your cookies JSON list using Chrome extensions like EditThisCookie.</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono font-bold uppercase text-slate-500" htmlFor="cookies-json-field">Paste Stored Cookies here</label>
                  <textarea
                    id="cookies-json-field"
                    rows={4}
                    value={cookieJson}
                    onChange={(e) => setCookieJson(e.target.value)}
                    placeholder='Paste string snippet here e.g. [{"name":"ka_session","value":"...","domain":".khamsat.com"}]'
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-700 font-mono focus:outline-none focus:border-emerald-500/40"
                  />
                </div>

                <button
                  type="button"
                  disabled={cookieImporting || !cookieJson.trim()}
                  onClick={handleImportCookies}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer disabled:opacity-45 flex items-center justify-center gap-1.5 hover:shadow text-center"
                >
                  {cookieImporting ? (
                    <RefreshCw className="animate-spin text-slate-100" size={13} />
                  ) : (
                    <Check size={14} />
                  )}
                  Import Cookies & Connect Session
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* RENDER ACTIVE BROWSER IF CONNECTING */}
      {activePlatform && (
        <div className="border border-blue-500/30 bg-[#0c0f1d] rounded-2xl p-6 shadow-2xl relative overflow-hidden transition-all animate-slide-up space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Interactive Remote Session: {activePlatform}</h3>
                <span className="text-[10px] text-slate-400">Headless browser stream renders on interactions list below</span>
              </div>
            </div>
            
            <button 
              onClick={handleAbortSession}
              className="p-1 px-2.5 bg-rose-950/40 border border-rose-500/20 hover:bg-rose-900/60 text-rose-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer"
            >
              Cancel Login
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* SCREENCAL SCREEN SHOT CONTAINER */}
            <div className="lg:col-span-8 space-y-3">
              <div className="relative border border-slate-800 rounded-xl overflow-hidden bg-black/50 aspect-[4/3] flex items-center justify-center shadow-inner group">
                {screenshot ? (
                  <img 
                    ref={screenshotRef}
                    src={`data:image/jpeg;base64,${screenshot}`}
                    alt="Active Virtual Screencast"
                    className="w-full h-auto max-h-full object-contain cursor-crosshair border-0"
                    onClick={handleScreenshotClick}
                  />
                ) : (
                  <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto" />
                    <p className="text-xs text-slate-400 animate-pulse font-medium">Downloading portal frame buffer...</p>
                  </div>
                )}

                {browserLoading && screenshot && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center transition-opacity">
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#0c0f1d] border border-blue-500/20 rounded-xl shadow-lg">
                      <RefreshCw size={14} className="animate-spin text-blue-400" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-300">Synchronizing...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900/40 border border-slate-800/80 rounded-xl text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5"><MousePointer size={12} className="text-blue-400" /> Click on the viewframe above to focus and trigger clicking logs.</span>
                <span className="font-mono text-[9px] bg-slate-800 px-2 py-0.5 rounded text-blue-400">1024x768 Dynamic Frame</span>
              </div>
            </div>

            {/* CONTROLS SPEC SIDE PANEL */}
            <div className="lg:col-span-4 space-y-4">
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-4 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Keyboard size={14} className="text-blue-400" />
                  Remote Interaction Controls
                </h4>

                {/* TEXT INPUT HELPER */}
                <form onSubmit={handleTypeText} className="space-y-2">
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider">Keyboard Typing Helper</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={typeValue}
                      onChange={(e) => setTypeValue(e.target.value)}
                      placeholder="Enter credentials/codes..."
                      disabled={browserLoading || !screenshot}
                      className="flex-1 bg-slate-955/65 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40"
                    />
                    <button
                      type="submit"
                      disabled={browserLoading || !screenshot || !typeValue.trim()}
                      className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      Type
                    </button>
                  </div>
                </form>

                {/* CLICK BEHAVIOR MODE CONTROLS */}
                <div className="space-y-2 pt-3 border-t border-slate-800/80">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Click Behavior Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setClickHoldMode(false)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                        !clickHoldMode 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <MousePointer size={12} />
                      Normal Click
                    </button>
                    <button
                      type="button"
                      onClick={() => setClickHoldMode(true)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition flex items-center justify-center gap-1.5 cursor-pointer border ${
                        clickHoldMode 
                          ? 'bg-amber-600 border-amber-500 text-white animate-pulse' 
                          : 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Clock size={12} />
                      Press & Hold
                    </button>
                  </div>
                  
                  {clickHoldMode && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2 animate-slide-up">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-amber-300 font-bold uppercase tracking-wider">Hold Duration</span>
                        <span className="font-mono text-amber-200 font-bold">{(holdDuration / 1000).toFixed(1)} Seconds</span>
                      </div>
                      <input 
                        type="range"
                        min={2000}
                        max={10000}
                        step={1000}
                        value={holdDuration}
                        onChange={(e) => setHoldDuration(Number(e.target.value))}
                        className="w-full text-amber-500 accent-amber-500 focus:outline-none cursor-pointer"
                      />
                      <p className="text-[9px] text-slate-400 leading-relaxed font-sans">
                        Any click on the screen above will hold the browser mouse down for <strong>{(holdDuration/1000)}s</strong> before releasing. Useful for passing manual security verification loops.
                      </p>
                    </div>
                  )}
                </div>

                {/* COMMON HOTKEYS */}
                <div className="space-y-1.5 pt-2">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Useful Shortcuts</span>
                  <div className="grid grid-cols-3 gap-1">
                    <button 
                      onClick={() => handlePressKey('Tab')}
                      disabled={browserLoading || !screenshot}
                      className="py-1 px-2 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition"
                    >
                      Tab ⇥
                    </button>
                    <button 
                      onClick={() => handlePressKey('Enter')}
                      disabled={browserLoading || !screenshot}
                      className="py-1 px-2 text-[10px] font-mono bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 rounded cursor-pointer transition border border-blue-500/10"
                    >
                      Enter ↵
                    </button>
                    <button 
                      onClick={() => handlePressKey('Backspace')}
                      disabled={browserLoading || !screenshot}
                      className="py-1 px-2 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition"
                    >
                      Del ⌫
                    </button>
                  </div>
                </div>

                {/* LIVE AUTOMATION AUTODETECT STATS */}
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg space-y-1.5">
                  <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Authentication Sniffer</span>
                  {authStatusText?.authenticated ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10">
                      <Check size={14} />
                      Logged-in account verified!
                      {authStatusText.username && <span className="text-[10px] text-slate-300">({authStatusText.username})</span>}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Sniffing browser state... You can use "Continue with Google" or standard email. Once logged in, click verify below to finalize profiles.
                    </p>
                  )}
                </div>
              </div>

              {/* SAVE ACTION PANELS */}
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={verifyingSession || !screenshot}
                  onClick={handleVerifyAndSave}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifyingSession ? (
                    <RefreshCw className="animate-spin" size={14} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Save Session & Verify
                </button>
                <div className="flex items-center gap-1 px-1 text-[10px] text-slate-500 justify-center">
                  <HelpCircle size={10} />
                  <span>Saves persistent cookies and tokens directly to isolated browser workspace contexts.</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* PORTALS CONNECTION STATUS MATRIX */}
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Platform Connection Status Matrix</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {accounts.map((acc) => {
          return (
            <div 
              key={acc.platform}
              className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-700/60 transition shadow-sm space-y-4"
            >
              {/* BRAND HEADER CONTAINER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  {/* Platform Identity */}
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl text-xs font-black tracking-tight shrink-0 border ${
                      acc.platform === 'Khamsat' 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                        : acc.platform === 'Mostaql' 
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                        : acc.platform === 'LinkedIn'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                      {acc.platform.substring(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-100">{acc.platform}</h3>
                      <span className="text-[10px] text-slate-500">Platform Portal</span>
                    </div>
                  </div>
                  
                  {/* Status Indicator Badge */}
                  {getStatusBadge(acc.status)}
                </div>

                {/* USER METADATA METRICS */}
                <div className="p-3.5 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2 text-[11px] leading-relaxed font-mono">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Username:</span>
                    <span className="font-bold text-slate-300 select-all">
                      {acc.status === 'CONNECTED' ? `@${acc.username || 'active_user'}` : 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-450">
                    <span>Last Login:</span>
                    <span className="text-slate-300 font-bold">
                      {acc.lastLogin ? new Date(acc.lastLogin).toLocaleDateString() + ' ' + new Date(acc.lastLogin).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Last Validated:</span>
                    <span className="text-slate-400">
                      {acc.lastValidation ? new Date(acc.lastValidation).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Validation Status:</span>
                    <span>
                      {acc.status === 'CONNECTED' ? (
                        <span className="text-emerald-400 font-bold uppercase text-[9px]">Active Code</span>
                      ) : acc.status === 'EXPIRED' ? (
                        <span className="text-amber-450 font-bold uppercase text-[9px]">Expired Session</span>
                      ) : acc.status === 'LOGIN_REQUIRED' ? (
                        <span className="text-amber-450 font-bold uppercase text-[9px]">Login Required</span>
                      ) : acc.status === 'ERROR' ? (
                        <span className="text-rose-450 font-bold uppercase text-[9px]">Error</span>
                      ) : (
                        <span className="text-slate-600 font-bold uppercase text-[9px]">Disconnected</span>
                      )}
                    </span>
                  </div>
                  {acc.profileLocation && (
                    <div className="pt-2 border-t border-slate-800/60 text-slate-550 text-[10px] leading-normal font-sans">
                      <span className="block font-bold text-slate-400 text-[9px] uppercase tracking-wider font-mono">Profile Path:</span>
                      <code className="text-blue-450 text-[9.5px] block truncate select-all" title={acc.profileLocation}>
                        {acc.profileLocation}
                      </code>
                    </div>
                  )}
                  {acc.errorMessage && (
                    <div className="pt-1.5 border-t border-slate-800/65 flex items-start gap-1 text-rose-400 text-[10px] leading-normal font-sans font-semibold">
                      <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                      <span>{acc.errorMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ACTIONS CONTROLLER CAROUSEL */}
              <div className="flex flex-col gap-2">
                {acc.status === 'CONNECTED' ? (
                  <>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleValidateSession(acc.platform)}
                        className="flex-1 py-2 px-3 border border-slate-850 hover:border-slate-700 bg-slate-900/35 text-slate-300 hover:text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={11} />
                        Verify
                      </button>
                      <button
                        onClick={() => handleStartConnection(acc.platform)}
                        className="flex-1 py-2 px-3 border border-blue-900/40 hover:border-blue-700/60 bg-blue-955/20 text-blue-300 hover:text-blue-100 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw size={11} className="text-blue-400" />
                        Reconnect
                      </button>
                    </div>
                    <button
                      onClick={() => handleDisconnect(acc.platform)}
                      className="w-full py-2 px-3 border border-rose-950/40 hover:border-rose-900/60 bg-rose-955/10 hover:bg-rose-950/35 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Unlink size={11} />
                      Disconnect Account
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleStartConnection(acc.platform)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded-xl text-xs font-bold uppercase tracking-wider transition hover:shadow-md cursor-pointer"
                  >
                    Connect Account
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>

            </div>
          );
        })}

        {/* FUTURE PLATFORM ANCHOR */}
        <div className="border border-slate-800 p-5 rounded-2xl flex flex-col justify-between opacity-55 hover:opacity-85 transition bg-slate-950/25 relative border-dashed overflow-hidden group space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-850 border border-slate-800 rounded-xl text-slate-600 font-bold max-h-min text-xs">
                  +
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-400">Future Platforms</h3>
                  <span className="text-[10px] text-slate-500">Universal Driver</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-600 text-[9px] font-bold uppercase tracking-wider">Extensible</span>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Architecture satisfies multi-portal specifications with abstract Playwright profiles. Adding Upwork, Freelancer, or custom sites is incredibly straightforward.
            </p>
          </div>

          <button
            disabled
            className="w-full border border-slate-900 bg-slate-950/50 text-slate-600 rounded-xl py-2 px-3 text-xs font-bold uppercase tracking-wider cursor-not-allowed text-center"
          >
            Extend Adapter
          </button>
        </div>
      </div>

    </div>
  );
}
