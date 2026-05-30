/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Search, 
  FileText, 
  User, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  UserCheck
} from 'lucide-react';

// Sub Views
import LoginView from './components/LoginView.tsx';
import DashboardView from './components/DashboardView.tsx';
import OpportunitiesView from './components/OpportunitiesView.tsx';
import ProposalQueueView from './components/ProposalQueueView.tsx';
import ProfileView from './components/ProfileView.tsx';
import SettingsView from './components/SettingsView.tsx';
import AccountsView from './components/AccountsView.tsx';
import ChatbotWidget from './components/ChatbotWidget.tsx';

interface LocalSessionUser {
  name: string;
  email: string;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'info' | 'error';
}

export default function App() {
  const [session, setSession] = useState<{ user: LocalSessionUser; token: string } | null>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const handleNavigate = (view: string, id?: string) => {
    setCurrentView(view);
    if (id) {
      setSelectedOpportunityId(id);
    }
  };

  // Show Toast Toast Notification Trigger helper
  const showToastNotification = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    setToasts(prev => [...prev, { id, text, type }]);
    
    // Auto purge toast after 4s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleFetchMeOnBoot = async () => {
    setLoadingSession(true);
    const token = localStorage.getItem('freelance_os_token');
    const localUserStr = localStorage.getItem('freelance_os_user');

    if (!token) {
      setLoadingSession(false);
      return;
    }

    try {
      let response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSession({ user: data.user, token });
        showToastNotification(`Welcome back to your workspace, ${data.user.name}!`, 'success');
      } else {
        // If me request failed, check if we have offline recovery backup
        if (localUserStr) {
          try {
            const localUser = JSON.parse(localUserStr);
            const localSnapshotStr = localStorage.getItem('freelance_os_db_snapshot');
            const localSnapshot = localSnapshotStr ? JSON.parse(localSnapshotStr) : null;

            showToastNotification('Re-syncing sandbox workspace...', 'info');

            const restoreResponse = await fetch('/api/auth/restore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user: localUser,
                dbState: localSnapshot
              })
            });

            if (restoreResponse.ok) {
              // Retry fetching the authorization
              const retryResponse = await fetch('/api/auth/me', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                setSession({ user: retryData.user, token });
                showToastNotification('Workspace successfully restored from cloud backup!', 'success');
                setLoadingSession(false);
                return;
              }
            }
          } catch (restoreErr) {
            console.error('Session restorer sub-routine failed:', restoreErr);
          }
        }

        // Wipe session tokens if all backup mechanisms fail
        localStorage.removeItem('freelance_os_token');
        setSession(null);
      }
    } catch (err) {
      console.error('Session handshaking error:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    handleFetchMeOnBoot();
  }, []);

  // Periodic database background backing up routine to safeguard user data
  useEffect(() => {
    if (!session) return;

    const performSnapshotBackup = async () => {
      try {
        const response = await fetch('/api/db/snapshot', {
          headers: {
            'Authorization': `Bearer ${session.token}`
          }
        });
        if (response.ok) {
          const snapshot = await response.json();
          // Exclude users list to keep backup footprint small
          if (snapshot.users) {
            delete snapshot.users;
          }
          localStorage.setItem('freelance_os_db_snapshot', JSON.stringify(snapshot));
        }
      } catch (e) {
        console.warn('Periodic snapshot saving failed:', e);
      }
    };

    performSnapshotBackup();
    const interval = setInterval(performSnapshotBackup, 25000);
    return () => clearInterval(interval);
  }, [session]);

  const handleLoginSuccess = (user: LocalSessionUser, token: string) => {
    setSession({ user, token });
    showToastNotification(`Successfully authenticated. Loading system feeds...`, 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem('freelance_os_token');
    localStorage.removeItem('freelance_os_user');
    localStorage.removeItem('freelance_os_db_snapshot');
    setSession(null);
    setCurrentView('dashboard');
    showToastNotification('Console session terminated.', 'info');
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="relative flex justify-center items-center">
            <div className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-indigo-500 opacity-20" />
            <ShieldCheck className="h-10 w-10 text-indigo-400 z-10" />
          </div>
          <p className="text-slate-400 font-semibold tracking-wide text-xs uppercase animate-pulse">Running Session Authentication...</p>
        </div>
      </div>
    );
  }

  // If session is unauthorized, show credentials panel
  if (!session) {
    return (
      <>
        <LoginView onLoginSuccess={handleLoginSuccess} />
        {/* Render Toast messages overlay */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map(t => (
            <div 
              key={t.id} 
              className={`p-4 border rounded-xl shadow-lg text-xs leading-relaxed flex items-center gap-3 backdrop-blur bg-slate-800/90 border-slate-700/60 transition duration-300 animate-slide-up`}
            >
              {t.type === 'success' && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
              {t.type === 'error' && <XCircle size={16} className="text-rose-400 flex-shrink-0" />}
              {t.type === 'info' && <Info size={16} className="text-indigo-400 flex-shrink-0" />}
              <span className="text-slate-200">{t.text}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  const navItems = [
    { view: 'dashboard', label: 'Monitor Terminal', icon: LayoutDashboard },
    { view: 'accounts', label: 'Platform Accounts', icon: UserCheck },
    { view: 'opportunities', label: 'Opportunities Feeds', icon: Search },
    { view: 'proposals', label: 'Proposals Queue', icon: FileText },
    { view: 'profile', label: 'Freelancer Profile', icon: User },
    { view: 'settings', label: 'Orchestration Rules', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex relative overflow-x-hidden font-sans geometric-grid-bg">
      
      {/* 1. DESKTOP SIDEBAR PANEL */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0a0c10]/90 border-r border-[#1d2030] shrink-0 relative z-30 backdrop-blur-md">
        {/* Logo brand */}
        <div className="p-6 border-b border-[#1d2030] flex items-center gap-2.5">
          <div className="p-2 bg-blue-600/15 rounded-lg border border-blue-500/30 text-blue-400">
            <ShieldCheck size={20} />
          </div>
          <span className="text-lg font-bold text-slate-100 tracking-tight">
            Freelance<span className="text-blue-500 font-extrabold text-sm uppercase align-super ml-0.5">OS</span>
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 p-4 space-y-1 pt-6">
          {navItems.map((item) => {
            const ActiveIcon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                id={`sidebar-nav-${item.view}`}
                key={item.view}
                onClick={() => setCurrentView(item.view)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md border border-blue-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#121522]/80 border border-transparent'
                }`}
              >
                <ActiveIcon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Configured freelancer credential tags at footer */}
        <div className="p-4 border-t border-[#1d2030] space-y-3 shrink-0">
          <div className="p-3 bg-[#0c0e16]/65 border border-[#1d2030] rounded-lg">
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Logged Operator:</span>
            <span className="block text-xs font-semibold text-slate-300 truncate">{session.user.name}</span>
            <span className="block text-[10px] text-blue-400 truncate mt-0.5">{session.user.email}</span>
          </div>
          <button
            id="sidebar-logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#1d2030] hover:border-rose-900/30 hover:bg-rose-950/15 text-slate-400 hover:text-rose-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            <LogOut size={13} />
            LogOut OS Session
          </button>
        </div>
      </aside>

      {/* 2. MOBILE HEADER & NAVIGATION DRAWER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a0c10]/95 backdrop-blur-md border-b border-[#1d2030] flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-blue-400" />
          <span className="font-bold text-slate-100 tracking-tight text-sm">
            Freelance<span className="text-blue-400 font-black">OS</span>
          </span>
        </div>
        
        <button
          id="mobile-drawer-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-[#121522] border border-[#1d2030] rounded-lg text-slate-300 hover:text-slate-100 cursor-pointer"
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Drawer element overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="lg:hidden fixed inset-y-0 left-0 w-64 bg-[#0a0c10] border-r border-[#1d2030] p-4 pt-20 z-30 flex flex-col justify-between"
          >
            <nav className="space-y-2">
              {navItems.map((item) => {
                const ActiveIcon = item.icon;
                const isActive = currentView === item.view;
                return (
                  <button
                    id={`mobile-nav-${item.view}`}
                    key={item.view}
                    onClick={() => {
                      setCurrentView(item.view);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition ${
                      isActive 
                        ? 'bg-blue-600 text-white border border-blue-500/30' 
                        : 'text-slate-400 hover:bg-[#121522]/80'
                    }`}
                  >
                    <ActiveIcon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-[#1d2030] space-y-4">
              <div className="p-3 bg-[#0c0e16]/65 border border-[#1d2030] rounded-lg text-xs">
                <span className="block text-[9px] text-slate-500 uppercase">Session Operator</span>
                <span className="font-bold text-slate-300 block truncate">{session.user.name}</span>
              </div>
              <button
                id="mobile-logout-btn"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-950/20 text-rose-300 hover:bg-rose-900/35 border border-rose-500/10 rounded-lg text-xs font-bold cursor-pointer"
              >
                <LogOut size={13} />
                Term credentials
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MAIN WORKSPACE CANVAS */}
      <main className="flex-1 flex flex-col min-w-0 pt-20 lg:pt-6 pb-12 px-4 sm:px-6 lg:px-8 relative z-20">
        
        {/* Render Active View in motion scale block */}
        <div className="max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {currentView === 'dashboard' && (
                <DashboardView onNavigate={handleNavigate} onShowToast={showToastNotification} />
              )}
              {currentView === 'accounts' && (
                <AccountsView onShowToast={showToastNotification} />
              )}
              {currentView === 'opportunities' && (
                <OpportunitiesView 
                  onNavigate={handleNavigate} 
                  initialSelectedId={selectedOpportunityId}
                  onClearSelectedId={() => setSelectedOpportunityId(null)}
                  onShowToast={showToastNotification} 
                />
              )}
              {currentView === 'proposals' && (
                <ProposalQueueView onNavigate={handleNavigate} onShowToast={showToastNotification} />
              )}
              {currentView === 'profile' && (
                <ProfileView onShowToast={showToastNotification} />
              )}
              {currentView === 'settings' && (
                <SettingsView onShowToast={showToastNotification} onLogout={handleLogout} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </main>

      {/* Floating Sparkles indicator on the corner */}
      <div className="fixed bottom-4 left-4 z-40 bg-blue-950/40 border border-blue-500/20 px-3 py-1.5 rounded-lg text-[10px] text-blue-300 font-mono font-bold flex items-center gap-1.5 backdrop-blur-md select-none">
        <Zap size={10} className="text-amber-400 animate-pulse" />
        AI Engine Active: Live Match
      </div>

      {/* 4. TOAST NOTIFICATIONS DRAWER */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`p-4 border rounded-lg shadow-xl text-xs leading-relaxed flex items-center gap-3 backdrop-blur bg-[#0e1017]/95 border-[#1d2030]`}
            >
              {toast.type === 'success' && <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />}
              {toast.type === 'error' && <XCircle size={16} className="text-rose-500 flex-shrink-0" />}
              {toast.type === 'info' && <Info size={16} className="text-blue-400 flex-shrink-0" />}
              <span className="text-slate-200">{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 5. DYNAMIC CHAT CONTEXT CONTROLLER */}
      <ChatbotWidget />

    </div>
  );
}
