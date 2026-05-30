/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  User, 
  Code, 
  FolderGit, 
  HelpCircle, 
  Globe, 
  DollarSign, 
  Ban, 
  Calendar, 
  Save, 
  Sparkles, 
  Plus, 
  X,
  RefreshCw,
  Key,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { FreelancerProfile } from '../types.js';

interface ProfileViewProps {
  onShowToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

export default function ProfileView({ onShowToast }: ProfileViewProps) {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'skills' | 'targets' | 'tone' | 'credentials'>('basics');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Buffer fields for tags
  const [skillsBuffer, setSkillsBuffer] = useState('');
  const [techsBuffer, setTechsBuffer] = useState('');
  const [exclBuffer, setExclBuffer] = useState('');
  const [linkBuffer, setLinkBuffer] = useState('');

  // Project Portfolio inputs
  const [newProjTitle, setNewProjTitle] = useState('');
  const [newProjLink, setNewProjLink] = useState('');
  const [newProjDesc, setNewProjDesc] = useState('');

  const handleAddProject = () => {
    if (!profile) return;
    if (!newProjTitle.trim()) {
      onShowToast('Portfolio projects need a clear title.', 'error');
      return;
    }
    if (!newProjDesc.trim()) {
      onShowToast('Please provide a short description so the AI can reference actual achievements in proposals!', 'error');
      return;
    }

    const projects = profile.portfolioProjects || [];
    const newProj = {
      id: `port-${Date.now()}`,
      title: newProjTitle.trim(),
      link: newProjLink.trim() || '#',
      description: newProjDesc.trim()
    };

    handleUpdateProfileField('portfolioProjects', [...projects, newProj]);
    setNewProjTitle('');
    setNewProjLink('');
    setNewProjDesc('');
    onShowToast('Project added to portfolio. Save profile changes to keep updates!', 'success');
  };

  const handleRemoveProject = (id: string) => {
    if (!profile) return;
    const projects = profile.portfolioProjects || [];
    handleUpdateProfileField('portfolioProjects', projects.filter(p => p.id !== id));
    onShowToast('Project removed. Save profile changes to commit.', 'info');
  };

  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ [platform: string]: { success: boolean; message: string; username?: string } }>({});
  const [optimizingPlatform, setOptimizingPlatform] = useState<string | null>(null);
  const [cookieExplanations, setCookieExplanations] = useState<{ [platform: string]: string }>({});

  const handleOptimizeCookieWithAI = async (platform: 'Khamsat' | 'Mostaql' | 'Fiverr', value: string) => {
    if (!value) {
      onShowToast(`Please input some cookie contents for ${platform} first.`, 'error');
      return;
    }
    setOptimizingPlatform(platform);
    onShowToast(`AI is analyzing and selecting optimal cookies for ${platform}...`, 'info');
    try {
      const res = await fetch('/api/profile/optimize-cookie-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, cookieValue: value })
      });
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }
      const data = await res.json();
      if (data.optimizedCookie && profile) {
        const cookies = profile.platformCookies || {};
        let targetKey: 'khamsat' | 'mostaql' | 'fiverr' = 'khamsat';
        if (platform === 'Mostaql') targetKey = 'mostaql';
        if (platform === 'Fiverr') targetKey = 'fiverr';
        
        setProfile(prev => prev ? {
          ...prev,
          platformCookies: { ...cookies, [targetKey]: data.optimizedCookie }
        } : null);

        setCookieExplanations(prev => ({ ...prev, [platform]: data.explanation }));
        onShowToast(`AI optimized the cookies! Only essential tokens chosen.`, 'success');
      } else {
        onShowToast(`AI could not optimize cookies. Using manual fallback.`, 'info');
      }
    } catch (e: any) {
      onShowToast(`AI Optimization failed: ${e.message}`, 'error');
    } finally {
      setOptimizingPlatform(null);
    }
  };

  const handleTestCookie = async (platform: 'Khamsat' | 'Mostaql' | 'Fiverr', value: string) => {
    if (!value) {
      onShowToast(`Please input some cookie contents for ${platform} first.`, 'error');
      return;
    }
    setTestingPlatform(platform);
    onShowToast(`Testing ${platform} session token validity...`, 'info');
    try {
      const res = await fetch('/api/profile/test-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, cookieValue: value })
      });
      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [platform]: data }));
      if (data.success) {
        onShowToast(`${platform} session is ACTIVE and verified!`, 'success');
        if (data.cookieHeader && profile) {
          const cookies = profile.platformCookies || {};
          let targetKey: 'khamsat' | 'mostaql' | 'fiverr' = 'khamsat';
          if (platform === 'Mostaql') targetKey = 'mostaql';
          if (platform === 'Fiverr') targetKey = 'fiverr';
          setProfile(prev => prev ? { 
            ...prev, 
            platformCookies: { ...cookies, [targetKey]: data.cookieHeader } 
          } : null);
        }
      } else {
        onShowToast(`${platform} cookie has expired, or is unauthenticated.`, 'error');
      }
    } catch (e: any) {
      onShowToast(`Verification request failed: ${e.message}`, 'error');
      setTestResults(prev => ({
        ...prev,
        [platform]: { success: false, message: `Could not connect: ${e.message}` }
      }));
    } finally {
      setTestingPlatform(null);
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/profile');
      if (response.ok) {
        setProfile(await response.json());
      }
    } catch (e) {
      onShowToast('Could not load profile settings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfileField = (field: keyof FreelancerProfile, value: any) => {
    if (!profile) return;
    setProfile(prev => prev ? { ...prev, [field]: value } : null);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (response.ok) {
        onShowToast('Freelancer profile updated successfully. AI is updated.', 'success');
      } else {
        onShowToast('Database profile update was rejected.', 'error');
      }
    } catch (e) {
      onShowToast('Network error saving profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = (field: 'skills' | 'technologies' | 'excludedCategories' | 'portfolioLinks', buffer: string, setBuffer: React.Dispatch<React.SetStateAction<string>>) => {
    if (!profile || !buffer.trim()) return;
    const current = profile[field] as string[];
    if (current.includes(buffer.trim())) {
      setBuffer('');
      return;
    }
    handleUpdateProfileField(field, [...current, buffer.trim()]);
    setBuffer('');
  };

  const handleRemoveTag = (field: 'skills' | 'technologies' | 'excludedCategories' | 'portfolioLinks', value: string) => {
    if (!profile) return;
    const current = profile[field] as string[];
    handleUpdateProfileField(field, current.filter(t => t !== value));
  };

  if (loading || !profile) {
    return (
      <div className="py-24 text-center pb-48">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
        <p className="mt-3 text-slate-400 text-xs font-mono uppercase tracking-wider">Mapping skill indexes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="border-b border-[#1e2235] pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <User size={22} className="text-blue-400" />
            Freelancer Profile System
          </h1>
          <p className="text-xs text-slate-405 font-mono uppercase tracking-wide mt-1">
            Configure your technical keywords, portfolio parameters, and bidding rules for rigorous matching.
          </p>
        </div>
        <button
          id="profile-save-top-btn"
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-wider text-[11px] border border-blue-500/20 rounded shadow cursor-pointer transition disabled:opacity-50 shrink-0"
        >
          <Save size={14} />
          {saving ? 'Syncing...' : 'Save Profile Changes'}
        </button>
      </div>

      {/* Profile Section Tabs */}
      <div className="flex border-b border-[#1e2235]/40 gap-2 overflow-x-auto shrink-0 pb-1 font-mono">
        {(['basics', 'skills', 'targets', 'tone', 'credentials'] as const).map((tab) => (
          <button
            id={`profile-tab-${tab}`}
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === tab 
                ? 'border-blue-500 text-blue-400 bg-[#07080d]/40' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'basics' ? 'Core Identity' : tab === 'skills' ? 'Core Skills & Tags' : tab === 'targets' ? 'Outreach Filters' : tab === 'tone' ? 'Tone Guidelines' : 'Platform Session Sync'}
          </button>
        ))}
      </div>

      {/* Main Tabbed Container card */}
      <div className="bg-[#0b0d16]/75 border border-[#1e2235] rounded-lg p-6 backdrop-blur-sm">
        
        {/* Tab 1: Basics Configuration */}
        {activeTab === 'basics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
                <Globe size={14} className="text-blue-400" />
                Language & Level
              </h3>

              <div className="space-y-1.5 font-mono">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none" htmlFor="profile-exp-select">
                  Experience Level Profile
                </label>
                <select
                  id="profile-exp-select"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2.5 text-xs outline-none"
                  value={profile.experience}
                  onChange={(e) => handleUpdateProfileField('experience', e.target.value)}
                >
                  <option value="junior">Junior (1-2 years)</option>
                  <option value="mid">Mid-level (2-5 years)</option>
                  <option value="senior">Senior (5-8 years)</option>
                  <option value="expert">Expert Agent (8+ years)</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-2 font-mono">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                  Target Proposal Languages
                </label>
                <div className="space-y-2">
                  {['English', 'Arabic'].map((lang) => {
                    const active = profile.languages.includes(lang);
                    return (
                      <label key={lang} className="flex items-center gap-2.5 text-xs text-slate-300 select-none cursor-pointer uppercase tracking-wider">
                        <input
                          id={`profile-lang-checkbox-${lang}`}
                          type="checkbox"
                          className="h-4 w-4 bg-[#07080d] border-[#1e2235] rounded-sm text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                          checked={active}
                          onChange={(e) => {
                            const newLangs = e.target.checked 
                              ? [...profile.languages, lang]
                              : profile.languages.filter(l => l !== lang);
                            handleUpdateProfileField('languages', newLangs);
                          }}
                        />
                        {lang} Pitch Layout
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time constraints */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 mb-2 font-mono">
                <Calendar size={14} className="text-blue-400" />
                Working Hours Constraints
              </h3>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase text-slate-450 font-bold tracking-wider" htmlFor="profile-start-time">Start Time</label>
                  <input
                    id="profile-start-time"
                    type="time"
                    className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none"
                    value={profile.workingHours.start}
                    onChange={(e) => handleUpdateProfileField('workingHours', { ...profile.workingHours, start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] uppercase text-slate-450 font-bold tracking-wider" htmlFor="profile-end-time">End Time</label>
                  <input
                    id="profile-end-time"
                    type="time"
                    className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none"
                    value={profile.workingHours.end}
                    onChange={(e) => handleUpdateProfileField('workingHours', { ...profile.workingHours, end: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5 pt-2 font-mono">
                <label className="block text-[10px] uppercase text-slate-450 font-bold tracking-wider" htmlFor="profile-timezone">Timezone Baseline</label>
                <input
                  id="profile-timezone"
                  type="text"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2.5 text-xs placeholder-slate-500 outline-none"
                  value={profile.workingHours.timezone}
                  onChange={(e) => handleUpdateProfileField('workingHours', { ...profile.workingHours, timezone: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Skills & Tags Config */}
        {activeTab === 'skills' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Core Skills tags list */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                <Code size={14} className="text-blue-400" />
                Matching Core Skills Index
              </h3>
              <p className="text-xs text-slate-405 font-mono uppercase tracking-wide">
                Lister direct client matching terms.
              </p>

              <div className="flex gap-2">
                <input
                  id="profile-skill-input"
                  type="text"
                  className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-3 py-2 text-xs placeholder-slate-550 outline-none flex-1 max-w-md focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Next.js, Stripe integration..."
                  value={skillsBuffer}
                  onChange={(e) => setSkillsBuffer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag('skills', skillsBuffer, setSkillsBuffer)}
                />
                <button
                  id="profile-skill-add-btn"
                  onClick={() => handleAddTag('skills', skillsBuffer, setSkillsBuffer)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-550 border border-blue-500/20 text-white font-bold rounded text-xs cursor-pointer transition select-none flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {profile.skills.map(skill => (
                  <span key={skill} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-[#07080d] border border-[#1e2235] text-slate-300 font-mono font-bold uppercase tracking-wide">
                    {skill}
                    <button
                      id={`profile-remove-skill-${skill}-btn`}
                      onClick={() => handleRemoveTag('skills', skill)}
                      className="text-slate-500 hover:text-rose-455 transition cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Tech Stack tags list */}
            <div className="space-y-3 pt-4 border-t border-[#1e2235]/40">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                <Code size={14} className="text-blue-400" />
                Target Technologies / Libs
              </h3>
              <p className="text-xs text-slate-405 font-mono uppercase tracking-wide">
                Add precise items (Node, PyTorch, React Native) for proposal roadmapping.
              </p>

              <div className="flex gap-2">
                <input
                  id="profile-tech-input"
                  type="text"
                  className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-3 py-2 text-xs placeholder-slate-550 outline-none flex-1 max-w-md focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. FastAPI, Docker, GCP..."
                  value={techsBuffer}
                  onChange={(e) => setTechsBuffer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag('technologies', techsBuffer, setTechsBuffer)}
                />
                <button
                  id="profile-tech-add-btn"
                  onClick={() => handleAddTag('technologies', techsBuffer, setTechsBuffer)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-555 border border-blue-500/20 text-white font-bold rounded text-xs cursor-pointer transition select-none flex items-center justify-center"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {profile.technologies.map(tech => (
                  <span key={tech} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-blue-950/20 border border-blue-500/20 text-blue-300 font-mono font-bold uppercase tracking-wide">
                    {tech}
                    <button
                      id={`profile-remove-tech-${tech}-btn`}
                      onClick={() => handleRemoveTag('technologies', tech)}
                      className="text-blue-400 hover:text-rose-455 transition cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Tab 3: Outreach Filters / Budgets */}
        {activeTab === 'targets' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Hourly rate and budget sliders */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <DollarSign size={14} className="text-blue-400" />
                  Target Budget Ranges
                </h3>

                <div className="space-y-1.5 font-mono">
                  <label className="block text-[10px] uppercase text-slate-450 font-bold" htmlFor="profile-rate-input">Hourly Rate Target ($/hr)</label>
                  <div className="relative max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs font-bold">$</span>
                    <input
                      id="profile-rate-input"
                      type="number"
                      className="w-full bg-[#07080d] border border-[#1e2235] text-slate-200 rounded pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      value={profile.hourlyRate}
                      onChange={(e) => handleUpdateProfileField('hourlyRate', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 font-mono">
                  <label className="block text-[10px] uppercase text-slate-450 font-bold" htmlFor="profile-budget-input">Preferred Minimum Project Budget</label>
                  <div className="relative max-w-xs">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs font-bold">$</span>
                    <input
                      id="profile-budget-input"
                      type="number"
                      className="w-full bg-[#07080d] border border-[#1e2235] text-slate-200 rounded pl-8 pr-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      value={profile.preferredMinBudget}
                      onChange={(e) => handleUpdateProfileField('preferredMinBudget', parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Exclusion lists */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <Ban size={14} className="text-rose-450 animate-pulse" />
                  Excluded Categories / Tags
                </h3>
                <p className="text-xs text-slate-405 font-mono uppercase tracking-wide">
                  Matches in these sectors will be penalized heavily during compatibility score vetting.
                </p>

                <div className="flex gap-2">
                  <input
                    id="profile-exclude-input"
                    type="text"
                    className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-3 py-2 text-xs placeholder-slate-550 outline-none flex-1 focus:ring-1 focus:ring-rose-500"
                    placeholder="e.g. Translation, Data entry..."
                    value={exclBuffer}
                    onChange={(e) => setExclBuffer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag('excludedCategories', exclBuffer, setExclBuffer)}
                  />
                  <button
                    id="profile-exclude-add-btn"
                    onClick={() => handleAddTag('excludedCategories', exclBuffer, setExclBuffer)}
                    className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-900/40 rounded text-xs cursor-pointer flex items-center justify-center transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {profile.excludedCategories.map(ex => (
                    <span key={ex} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded bg-rose-950/20 border border-rose-900/40 text-rose-400 font-mono font-bold uppercase tracking-wide">
                      {ex}
                      <button
                        id={`profile-remove-exclude-${ex}-btn`}
                        onClick={() => handleRemoveTag('excludedCategories', ex)}
                        className="text-rose-500 hover:text-rose-300 transition cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Portfolio Links panel */}
            <div className="space-y-4 pt-6 border-t border-[#1e2235]/40 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <FolderGit size={14} className="text-blue-400" />
                  Social Assets & Handles
                </h3>
                <p className="text-xs text-slate-405 font-mono uppercase tracking-wide leading-relaxed">
                  Provide standard links (such as GitHub, LinkedIn, or personal website domains) for the AI model to include as quick baseline profile citations.
                </p>

                <div className="flex gap-2">
                  <input
                    id="profile-link-input"
                    type="text"
                    className="bg-[#07080d] border border-[#1e2235] text-slate-300 rounded px-3 py-2 text-xs placeholder-slate-550 outline-none flex-1 focus:ring-1 focus:ring-blue-500"
                    placeholder="https://github.com/username..."
                    value={linkBuffer}
                    onChange={(e) => setLinkBuffer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag('portfolioLinks', linkBuffer, setLinkBuffer)}
                  />
                  <button
                    id="profile-link-add-btn"
                    onClick={() => handleAddTag('portfolioLinks', linkBuffer, setLinkBuffer)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-550 border border-blue-500/20 text-white rounded text-xs cursor-pointer flex items-center justify-center transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="space-y-1.5 pt-2 max-h-48 overflow-y-auto">
                  {profile.portfolioLinks.map(link => (
                    <div key={link} className="flex items-center justify-between p-2.5 bg-[#07080d] border border-[#1e2235] rounded text-[11px] text-slate-300 font-mono">
                      <span className="truncate mr-4 text-xs">{link}</span>
                      <button
                        id={`profile-remove-link-${link}-btn`}
                        onClick={() => handleRemoveTag('portfolioLinks', link)}
                        className="text-slate-500 hover:text-rose-400 transition cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advanced Descriptive Projects */}
              <div className="lg:col-span-8 space-y-4 border-l lg:border-l border-[#1e2235]/40 lg:pl-6">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                  AI Portfolio Projects with Descriptions
                </h3>
                <p className="text-xs text-slate-405 font-mono uppercase tracking-wide leading-relaxed pb-2">
                  Describe what each project is, the tech used, and its concrete problem-solving impact. The AI will read these descriptions to write custom, highly targeted, relevant project pitches inside proposals.
                </p>

                {/* List of Descriptive Projects */}
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {(profile.portfolioProjects || []).length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-[#1e2235] rounded-lg bg-[#07080d]/40">
                      <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">No descriptive portfolio items configured yet.</p>
                      <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mt-1">Use the builder form below to register your first deep project!</p>
                    </div>
                  ) : (
                    (profile.portfolioProjects || []).map((project) => (
                      <div key={project.id} className="p-3.5 bg-[#06080d] border border-[#1e2235] rounded-lg relative hover:border-[#252a44] transition">
                        <button
                          id={`profile-remove-project-${project.id}-btn`}
                          onClick={() => handleRemoveProject(project.id)}
                          className="absolute top-3 right-3 text-slate-500 hover:text-rose-400 transition cursor-pointer p-1"
                          title="Remove Project"
                        >
                          <X size={14} />
                        </button>
                        
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2 font-mono tracking-wide">
                            {project.title}
                          </h4>
                          {project.link && project.link !== '#' && (
                            <a href={project.link} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-blue-400 underline hover:text-blue-300">
                              {project.link}
                            </a>
                          )}
                          <p className="text-xs text-slate-400 font-sans leading-relaxed pt-1.5 bg-[#0c0e18]/60 p-2.5 rounded border border-[#141829]/50 whitespace-pre-wrap">
                            {project.description}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Form to Register A New Detailed Portfolio Project */}
                <div className="p-4 bg-[#121522]/35 border border-[#1e2235]/60 rounded-xl space-y-3.5">
                  <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-350 font-mono">
                    Register New AI Portfolio Project
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1 font-mono">
                      <label className="block text-[9px] uppercase font-bold text-slate-450" htmlFor="project-title-input">Project Title / Name *</label>
                      <input
                        id="project-title-input"
                        type="text"
                        className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-600"
                        placeholder="e.g. Riyadh Pharmacy Checkout Portal"
                        value={newProjTitle}
                        onChange={(e) => setNewProjTitle(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-1 font-mono">
                      <label className="block text-[9px] uppercase font-bold text-slate-450" htmlFor="project-link-input">Repository / Live Link</label>
                      <input
                        id="project-link-input"
                        type="text"
                        className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-600"
                        placeholder="https://github.com/... (optional)"
                        value={newProjLink}
                        onChange={(e) => setNewProjLink(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 font-mono">
                    <label className="block text-[9px] uppercase font-bold text-slate-450" htmlFor="project-desc-input">
                      Project Description & Technical Achievements (for the AI) *
                    </label>
                    <textarea
                      id="project-desc-input"
                      rows={3}
                      className="w-full bg-[#07080d] border border-[#1e2235] text-slate-300 rounded p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-600 font-sans leading-relaxed resize-none"
                      placeholder="Describe the main problem this project solved, tech stacks used (Node/React/C# etc), Stripe flows integrated, API payloads mapped, and direct performance metric wins. Keep it details-rich!"
                      value={newProjDesc}
                      onChange={(e) => setNewProjDesc(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      id="profile-project-add-submit-btn"
                      onClick={handleAddProject}
                      type="button"
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded font-bold uppercase tracking-wider text-[10px] font-mono cursor-pointer transition shadow-lg"
                    >
                      <Plus size={12} />
                      Insert Project into Profile
                    </button>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Tone preferences */}
        {activeTab === 'tone' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} className="text-blue-400" />
                Tone Guidelines
              </h3>
              <p className="text-xs text-slate-405 uppercase tracking-wide">
                Assign the baseline model voice for proposal content generation.
              </p>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider" htmlFor="profile-tone-select">Pitch Voice</label>
                <select
                  id="profile-tone-select"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  value={profile.proposalTone}
                  onChange={(e) => handleUpdateProfileField('proposalTone', e.target.value)}
                >
                  <option value="professional">Professional (Executive compliance)</option>
                  <option value="persuasive">Persuasive (Feature / Pain-relief focused)</option>
                  <option value="friendly">Friendly (Collaborative, co-founder energy)</option>
                  <option value="technical">Technical (Software design, system details first)</option>
                  <option value="analytical">Analytical (Problem breakdown, estimation values)</option>
                </select>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider" htmlFor="profile-len-select">Baseline Layout Length</label>
                <select
                  id="profile-len-select"
                  className="w-full bg-[#07080d] border border-[#1e2235] text-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  value={profile.proposalLength}
                  onChange={(e) => handleUpdateProfileField('proposalLength', e.target.value)}
                >
                  <option value="short">Short (Under 100 words, high scan)</option>
                  <option value="medium">Medium (Standard 2-3 paragraph format)</option>
                  <option value="long">Long (Multi-paragraph technical roadmaps)</option>
                </select>
              </div>
            </div>

            {/* Prompt tips */}
            <div className="bg-[#07080d]/85 border border-[#1e2235] p-5 rounded flex flex-col justify-between font-mono">
              <div className="space-y-2 text-xs text-slate-405 leading-relaxed">
                <span className="font-bold text-slate-200 text-xs block uppercase tracking-wider">Vetting Architecture Rules</span>
                <p>
                  These properties are integrated automatically within every Gemini API query. Correctly adjusting tones prevents mechanical robotic outputs, aligning your proposal format directly with target client categories.
                </p>
                <p className="pt-2">
                  Exclusion tags (e.g., SEO writing, translators) protect the system from burning scan tokens on inappropriate categories.
                </p>
              </div>
              <button
                id="profile-save-bottom-secondary-btn"
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-550 text-white text-[11px] font-bold uppercase tracking-widest border border-blue-500/20 rounded shadow cursor-pointer transition disabled:opacity-50 mt-4"
              >
                Save Profile Parameters
              </button>
            </div>

          </div>
        )}

        {/* Tab 5: Session Credentials & Cookies */}
        {activeTab === 'credentials' && (
          <div className="space-y-6 animate-fade-in text-center py-12" id="profile-credentials-tab-panel">
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-450 rounded-full inline-flex">
                <ShieldCheck size={36} className="animate-pulse" />
              </div>
              <h3 className="text-base font-bold text-slate-100 tracking-wide uppercase font-mono">
                Universal Session-Based Authentication Active
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                We have completely removed manual cookie pasting, copying, and extraction. You can now connect, disconnect, and monitor your platform accounts using the universal Playwright session-based automation system.
              </p>
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 text-left leading-relaxed text-xs">
                <span className="block text-[10px] font-mono font-bold uppercase text-blue-300 tracking-wider">Playwright Benefits:</span>
                <ul className="list-disc pl-3.5 space-y-1 text-slate-400 text-[11px] font-sans">
                  <li>No more copying or extracting cookies from DevTools!</li>
                  <li>Go to the <span className="text-slate-200 font-semibold font-mono">"Platform Accounts"</span> workspace menu tab.</li>
                  <li>Click <span className="text-slate-200 font-semibold font-mono">"Connect Account"</span> on any supported portal.</li>
                  <li>Sign in normally in the secure sandboxed Chromium live-casting browser.</li>
                  <li>Click <span className="text-slate-250 font-semibold font-mono">"Save Session & Verify"</span> to serialize your session state.</li>
                </ul>
              </div>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest pt-2">
                Unified Playwright Authenticator Engine v2.0
              </p>
            </div>

            {/* Hidden legacy segment nested perfectly to preserve tag alignment */}
            <div className="hidden" style={{ display: 'none' }}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#a5b4fc] font-mono">
                      Session Cookie Injection Values
                    </span>
                    <span className="text-[9px] text-indigo-400 font-bold bg-[#141829] px-2 py-0.5 rounded border border-indigo-500/10 font-mono">
                      ADAPTIVE PARSER STAGED
                    </span>
                  </div>

                  <div className="space-y-6">
                    {/* Khamsat Sync */}
                  <div className="bg-[#0b0d18] border border-[#1e2235]/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-bold text-slate-200 font-mono" htmlFor="cookie-khamsat-input">Khamsat Token or Cookie Table</label>
                        <span className="text-[10px] text-slate-500 font-sans block">Primary cookie key: <code className="text-amber-400">rack.session</code> or <code className="text-amber-400">PHPSESSID</code></span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase font-mono px-2 py-0.5 bg-[#07080d]/80 rounded border border-slate-800">
                        Khamsat
                      </span>
                    </div>

                    <textarea
                      id="cookie-khamsat-input"
                      rows={3}
                      className="w-full bg-[#040508] border border-[#1e2235] text-slate-300 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-600 placeholder-slate-700 font-mono"
                      placeholder="Paste either raw rack.session value, entire Cookie header string, or copy-paste the whole cookie table directly from DevTools Application tab!"
                      value={profile?.platformCookies?.khamsat || ''}
                      onChange={(e) => {
                        const cookies = profile?.platformCookies || {};
                        handleUpdateProfileField('platformCookies', { ...cookies, khamsat: e.target.value });
                      }}
                    />

                    {cookieExplanations['Khamsat'] && (
                      <div className="p-2 border border-purple-500/10 bg-purple-500/5 rounded-lg text-[10px] text-slate-300 font-sans leading-relaxed flex items-start gap-1.5 animate-gradient-slow" id="khamsat-ai-explanation">
                        <Sparkles size={11} className="text-purple-400 shrink-0 mt-0.5 animate-bounce" />
                        <span><strong>AI Selection Decision:</strong> {cookieExplanations['Khamsat']}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          id="test-khamsat-cookie-btn"
                          type="button"
                          onClick={() => handleTestCookie('Khamsat', profile?.platformCookies?.khamsat || '')}
                          disabled={testingPlatform === 'Khamsat'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141829] hover:bg-slate-800 text-[#a5b4fc] border border-indigo-500/20 hover:border-indigo-400/40 rounded transition cursor-pointer select-none"
                        >
                          {testingPlatform === 'Khamsat' ? (
                            <Activity size={12} className="animate-spin text-indigo-400" />
                          ) : (
                            <ShieldCheck size={12} className="text-emerald-400" />
                          )}
                          {testingPlatform === 'Khamsat' ? 'Validating...' : 'Test Active Cookie'}
                        </button>

                        <button
                          id="optimize-khamsat-cookie-ai-btn"
                          type="button"
                          onClick={() => handleOptimizeCookieWithAI('Khamsat', profile?.platformCookies?.khamsat || '')}
                          disabled={optimizingPlatform === 'Khamsat'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17101f] hover:bg-[#281b37] text-purple-200 border border-purple-500/20 hover:border-purple-400/45 rounded transition cursor-pointer select-none"
                        >
                          {optimizingPlatform === 'Khamsat' ? (
                            <Activity size={12} className="animate-spin text-purple-400" />
                          ) : (
                            <Sparkles size={12} className="text-purple-400 animate-pulse" />
                          )}
                          {optimizingPlatform === 'Khamsat' ? 'Analyzing...' : 'AI Clean & Select'}
                        </button>
                      </div>

                      {/* Status Indicator Badge */}
                      {testResults['Khamsat'] ? (
                        testResults['Khamsat'].success ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE {testResults['Khamsat'].username ? `(@${testResults['Khamsat'].username})` : ''}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            EXPIRED / UNVERIFIED
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 font-bold bg-[#07080d]/60 px-2.5 py-1 rounded-full border border-slate-800 text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          UNTESTED - PARSER STANDBY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mostaql Sync */}
                  <div className="bg-[#0b0d18] border border-[#1e2235]/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-bold text-slate-200 font-mono" htmlFor="cookie-mostaql-input">Mostaql Token or Cookie Table</label>
                        <span className="text-[10px] text-slate-500 font-sans block">Primary cookie key: <code className="text-amber-400">laravel_session</code> or <code className="text-amber-400">PHPSESSID</code></span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase font-mono px-2 py-0.5 bg-[#07080d]/80 rounded border border-slate-800">
                        Mostaql
                      </span>
                    </div>

                    <textarea
                      id="cookie-mostaql-input"
                      rows={3}
                      className="w-full bg-[#040508] border border-[#1e2235] text-slate-300 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-600 placeholder-slate-700 font-mono"
                      placeholder="Paste either raw laravel_session value, entire Cookie header string, or copy-paste the whole cookie table directly from DevTools Application tab!"
                      value={profile?.platformCookies?.mostaql || ''}
                      onChange={(e) => {
                        const cookies = profile?.platformCookies || {};
                        handleUpdateProfileField('platformCookies', { ...cookies, mostaql: e.target.value });
                      }}
                    />

                    {cookieExplanations['Mostaql'] && (
                      <div className="p-2 border border-purple-500/10 bg-purple-500/5 rounded-lg text-[10px] text-slate-300 font-sans leading-relaxed flex items-start gap-1.5 animate-gradient-slow" id="mostaql-ai-explanation">
                        <Sparkles size={11} className="text-purple-400 shrink-0 mt-0.5 animate-bounce" />
                        <span><strong>AI Selection Decision:</strong> {cookieExplanations['Mostaql']}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          id="test-mostaql-cookie-btn"
                          type="button"
                          onClick={() => handleTestCookie('Mostaql', profile?.platformCookies?.mostaql || '')}
                          disabled={testingPlatform === 'Mostaql'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141829] hover:bg-slate-800 text-[#a5b4fc] border border-indigo-500/20 hover:border-indigo-400/40 rounded transition cursor-pointer select-none"
                        >
                          {testingPlatform === 'Mostaql' ? (
                            <Activity size={12} className="animate-spin text-indigo-400" />
                          ) : (
                            <ShieldCheck size={12} className="text-emerald-400" />
                          )}
                          {testingPlatform === 'Mostaql' ? 'Validating...' : 'Test Active Cookie'}
                        </button>

                        <button
                          id="optimize-mostaql-cookie-ai-btn"
                          type="button"
                          onClick={() => handleOptimizeCookieWithAI('Mostaql', profile?.platformCookies?.mostaql || '')}
                          disabled={optimizingPlatform === 'Mostaql'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17101f] hover:bg-[#281b37] text-purple-200 border border-purple-500/20 hover:border-purple-400/45 rounded transition cursor-pointer select-none"
                        >
                          {optimizingPlatform === 'Mostaql' ? (
                            <Activity size={12} className="animate-spin text-purple-400" />
                          ) : (
                            <Sparkles size={12} className="text-purple-400 animate-pulse" />
                          )}
                          {optimizingPlatform === 'Mostaql' ? 'Analyzing...' : 'AI Clean & Select'}
                        </button>
                      </div>

                      {/* Status Indicator Badge */}
                      {testResults['Mostaql'] ? (
                        testResults['Mostaql'].success ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE {testResults['Mostaql'].username ? `(@${testResults['Mostaql'].username})` : ''}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-450 font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            EXPIRED / UNVERIFIED
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-slate-455 font-bold bg-[#07080d]/60 px-2.5 py-1 rounded-full border border-slate-800 text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          UNTESTED - PARSER STANDBY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fiverr Sync */}
                  <div className="bg-[#0b0d18] border border-[#1e2235]/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-bold text-slate-200 font-mono" htmlFor="cookie-fiverr-input">Fiverr Authorization Token or Table</label>
                        <span className="text-[10px] text-slate-500 font-sans block">Primary cookie key: <code className="text-amber-400">_fiverr_session</code> or auth value</span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase font-mono px-2 py-0.5 bg-[#07080d]/80 rounded border border-slate-800">
                        Fiverr
                      </span>
                    </div>

                    <textarea
                      id="cookie-fiverr-input"
                      rows={3}
                      className="w-full bg-[#040508] border border-[#1e2235] text-slate-300 rounded-lg p-2.5 text-xs outline-none focus:ring-1 focus:ring-indigo-600 placeholder-slate-700 font-mono"
                      placeholder="Paste either fiverr_session value, entire raw header, or copy-paste the whole cookie table directly from DevTools Application tab!"
                      value={profile?.platformCookies?.fiverr || ''}
                      onChange={(e) => {
                        const cookies = profile?.platformCookies || {};
                        handleUpdateProfileField('platformCookies', { ...cookies, fiverr: e.target.value });
                      }}
                    />

                    {cookieExplanations['Fiverr'] && (
                      <div className="p-2 border border-purple-500/10 bg-purple-500/5 rounded-lg text-[10px] text-slate-300 font-sans leading-relaxed flex items-start gap-1.5 animate-gradient-slow" id="fiverr-ai-explanation">
                        <Sparkles size={11} className="text-purple-400 shrink-0 mt-0.5 animate-bounce" />
                        <span><strong>AI Selection Decision:</strong> {cookieExplanations['Fiverr']}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          id="test-fiverr-cookie-btn"
                          type="button"
                          onClick={() => handleTestCookie('Fiverr', profile?.platformCookies?.fiverr || '')}
                          disabled={testingPlatform === 'Fiverr'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141829] hover:bg-slate-800 text-[#a5b4fc] border border-indigo-500/20 hover:border-indigo-400/40 rounded transition cursor-pointer select-none"
                        >
                          {testingPlatform === 'Fiverr' ? (
                            <Activity size={12} className="animate-spin text-indigo-400" />
                          ) : (
                            <ShieldCheck size={12} className="text-emerald-400" />
                          )}
                          {testingPlatform === 'Fiverr' ? 'Validating...' : 'Test Active Cookie'}
                        </button>

                        <button
                          id="optimize-fiverr-cookie-ai-btn"
                          type="button"
                          onClick={() => handleOptimizeCookieWithAI('Fiverr', profile?.platformCookies?.fiverr || '')}
                          disabled={optimizingPlatform === 'Fiverr'}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#17101f] hover:bg-[#281b37] text-purple-200 border border-purple-500/20 hover:border-purple-400/45 rounded transition cursor-pointer select-none"
                        >
                          {optimizingPlatform === 'Fiverr' ? (
                            <Activity size={12} className="animate-spin text-purple-400" />
                          ) : (
                            <Sparkles size={12} className="text-purple-400 animate-pulse" />
                          )}
                          {optimizingPlatform === 'Fiverr' ? 'Analyzing...' : 'AI Clean & Select'}
                        </button>
                      </div>

                      {/* Status Indicator Badge */}
                      {testResults['Fiverr'] ? (
                        testResults['Fiverr'].success ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-455 font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/25">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            EXPIRED / UNVERIFIED
                          </span>
                        )
                      ) : (
                        <span className="flex items-center gap-1 text-slate-455 font-bold bg-[#07080d]/60 px-2.5 py-1 rounded-full border border-slate-800 text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                          UNTESTED - PARSER STANDBY
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    id="profile-cookies-save-btn"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-550 text-white font-bold uppercase tracking-wider text-[11px] font-mono rounded-lg cursor-pointer transition select-none shadow-lg w-full sm:w-auto animate-fade-in"
                  >
                    <Save size={14} />
                    {saving ? 'Saving Profile...' : 'Commit Cookies & Save Profile'}
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#07080d]/85 border border-[#1e2235]/60 p-5 rounded-2xl space-y-4 font-mono text-[11px] leading-relaxed">
                <span className="font-extrabold text-[#f59e0b] text-xs block uppercase tracking-wider">
                  How to get your session cookies:
                </span>
                
                <ol className="list-decimal list-inside space-y-3.5 text-slate-400 font-sans leading-relaxed text-xs">
                  <li>
                    Open a new tab and log in to <strong className="text-slate-200">Khamsat</strong>, <strong className="text-slate-200">Mostaql</strong>, or <strong className="text-slate-200">Fiverr</strong> under your own account.
                  </li>
                  <li>
                    Right-click anywhere on page, select <strong className="text-[#a5b4fc]">Inspect</strong>, or press <kbd className="px-1.5 py-0.5 bg-[#121522] border border-[#1e2235] rounded font-mono text-[10px] text-[#a5b4fc]">F12</kbd>.
                  </li>
                  <li>
                    Navigate to <strong className="text-[#a5b4fc]">Application</strong> or <strong className="text-[#a5b4fc]">Storage</strong> tab inside your DevTools panel.
                  </li>
                  <li>
                    Expand <strong className="text-slate-200">Cookies</strong> on the left, and choose the platform's URL.
                  </li>
                  <li>
                    <strong className="text-emerald-400">ALL COOKIES COPY (RECOMMENDED)</strong>: Select any row, press <kbd className="px-1.5 py-0.5 bg-[#121522] border border-[#1e2235] rounded text-[9px] text-[#a5b4fc]">Ctrl+A</kbd> or drag-select all rows, hit <kbd className="px-1.5 py-0.5 bg-[#121522] border border-[#1e2235] text-[9px] text-[#a5b4fc]">Ctrl+C</kbd> (or Cmd+C), and paste them directly in the textboxes here! Our system uses intelligent multi-line extraction to identify relevant tokens.
                  </li>
                </ol>

                <div className="pt-2 border-t border-[#1e2235]/40 text-rose-450 uppercase text-[10px] font-bold font-sans">
                  ⚠️ Security Policy: Session cookies are persisted securely and are used solely to sign and post automated biddings on your behalf.
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

      </div>
    </div>
  );
}
