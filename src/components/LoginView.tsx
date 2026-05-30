/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, User, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { name: string; email: string }, token: string) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const body = isSignup ? { email, name, password } : { email, password };

    try {
      let response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      let data = await response.json();

      if (!response.ok) {
        // If login failed because the container scaled down or restarted, we attempt account-restoration using local backup data
        if (!isSignup && (data.error === 'Invalid email address or credentials.' || data.error === 'Incorrect email or password.')) {
          const localUserStr = localStorage.getItem('freelance_os_user');
          if (localUserStr) {
            const localUser = JSON.parse(localUserStr);
            if (localUser.email.toLowerCase().trim() === email.toLowerCase().trim()) {
              const localSnapshotStr = localStorage.getItem('freelance_os_db_snapshot');
              const localSnapshot = localSnapshotStr ? JSON.parse(localSnapshotStr) : null;

              // Generate passwordHash from the typed password if it's missing in local storage metadata (back-compat)
              const userPasswordHash = localUser.passwordHash || `sim_hash_${btoa(unescape(encodeURIComponent(password)))}`;

              const restoreResponse = await fetch('/api/auth/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user: {
                    ...localUser,
                    passwordHash: userPasswordHash
                  },
                  dbState: localSnapshot
                })
              });

              if (restoreResponse.ok) {
                // Retry login
                response = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(body)
                });
                data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error || 'Login retry failed.');
                }
              } else {
                throw new Error(data.error || 'Server session restoration failed.');
              }
            } else {
              throw new Error(data.error || 'Invalid email address or credentials.');
            }
          } else {
            throw new Error(data.error || 'Invalid email address or credentials.');
          }
        } else {
          throw new Error(data.error || 'Request evaluation failed.');
        }
      }

      if (isSignup) {
        setSuccess('Account created successfully! Switching to login...');
        if (data.user) {
          localStorage.setItem('freelance_os_user', JSON.stringify(data.user));
        }
        setIsSignup(false);
        setPassword('');
      } else {
        // Logged in
        if (data.user) {
          localStorage.setItem('freelance_os_user', JSON.stringify(data.user));
        }
        if (rememberMe) {
          localStorage.setItem('freelance_os_token', data.token);
        }
        onLoginSuccess(data.user, data.token);
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans geometric-grid-bg">
      {/* Visual background accents - geometric balanced lines */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center items-center gap-3">
          <div className="p-3 bg-blue-600/15 rounded-lg border border-blue-500/30 text-blue-400">
            <ShieldCheck size={32} />
          </div>
          <span className="text-3xl font-bold text-slate-100 tracking-tight">
            Freelance<span className="text-blue-500">OS</span>
          </span>
        </div>
        <p className="mt-2 text-center text-sm text-slate-400 max-w font-mono uppercase tracking-wider text-[11px]">
          The personal AI-powered freelance command system.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        <div className="bg-[#0b0d16]/85 backdrop-blur-md py-8 px-6 sm:px-10 border border-[#1e2235] rounded-lg shadow-2xl">
          <h2 className="text-lg font-bold uppercase tracking-wider text-slate-200 mb-6 text-center flex items-center justify-center gap-2">
            <Sparkles size={18} className="text-blue-400 animate-pulse" />
            {isSignup ? 'Create Local Account' : 'Access Your Console'}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono rounded" id="auth-error-banner">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono rounded" id="auth-success-banner">
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isSignup && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="auth-name-input">
                  Your Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User size={16} />
                  </div>
                  <input
                    id="auth-name-input"
                    type="text"
                    required
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#07080d] border border-[#1e2235] rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-550 focus:border-blue-500 text-sm font-sans"
                    placeholder="e.g. Ahmad Al-Ansari"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="auth-email-input">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#07080d] border border-[#1e2235] rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-550 focus:border-blue-500 text-sm font-sans"
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1" htmlFor="auth-pwd-input">
                Credentials Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  id="auth-pwd-input"
                  type="password"
                  required
                  className="block w-full pl-10 pr-3 py-2.5 bg-[#07080d] border border-[#1e2235] rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-550 focus:border-blue-500 text-sm font-sans"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {!isSignup && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="auth-remember-checkbox"
                    type="checkbox"
                    className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="auth-remember-checkbox" className="ml-2 block text-xs text-slate-400 select-none cursor-pointer">
                    Remember me locally
                  </label>
                </div>
                <div className="text-xs">
                  <span className="text-blue-400/80 hover:text-blue-400 cursor-not-allowed select-none">
                    Offline recovery
                  </span>
                </div>
              </div>
            )}

            <div>
              <button
                id="auth-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 bg-blue-600 hover:bg-blue-500 border border-blue-500/30 text-white font-bold uppercase tracking-wider text-xs rounded shadow-md focus:outline-none disabled:opacity-50 transition duration-150 ease-in-out cursor-pointer"
              >
                {loading ? 'Processing Workspace...' : isSignup ? 'Configure Database App' : 'Access System Terminal'}
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-col items-center">
            <span className="text-slate-600 text-[10px] font-mono uppercase tracking-wider mb-2">or manage account environment</span>
            <button
              id="auth-toggle-btn"
              onClick={() => setIsSignup(!isSignup)}
              className="text-xs uppercase tracking-wider font-bold text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              {isSignup ? "Already configured? Sign in instead" : "New deployment? Create accounts database"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
