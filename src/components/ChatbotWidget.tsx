/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  TrendingUp,
  Award,
  Zap
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I am your AI Freelance Copilot. I have real-time access to your current Freelance OS dashboard configurations, matching prospects, active Telegram credentials, and console logs.\n\nAsk me anything! For example:\n- *'How matchable is my current profile skills list?'*\n- *'What are my highest matching jobs right now?'*\n- *'Why are my Telegram alerts not coming through?'*\n- *'How do I configure automatic proposals?'*",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    setErrorStatus(null);
    const userMsgId = `user-${Date.now()}`;
    const newMsg: Message = {
      id: userMsgId,
      role: 'user',
      text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Map history to server schema
      const history = messages.map(m => ({
        role: m.role,
        text: m.text
      }));

      const res = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history })
      });

      if (!res.ok) {
        throw new Error('Chatbot connection interrupted.');
      }

      const data = await res.json();
      const botMsgId = `bot-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: data.reply || "I've processed your coordinate parameters, but was unable to assemble a valid reply text.",
        timestamp: new Date().toISOString()
      }]);
    } catch (err: any) {
      setErrorStatus(err.message || 'Server connection issue.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestClick = (suggestionText: string) => {
    handleSendMessage(suggestionText);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" id="chatbot-container">
      {/* Floating Toggle Bubble */}
      <button
        id="chatbot-bubble-toggle"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer relative ${
          isOpen 
            ? 'bg-rose-600 hover:bg-rose-500 text-white p-3.5 rotate-90' 
            : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white p-4'
        }`}
        title="Open AI Freelance Assistant"
      >
        {isOpen ? <X size={20} /> : <MessageSquare size={22} />}
        
        {/* Pulsing notify dot when closed */}
        {!isOpen && (
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
          </span>
        )}
      </button>

      {/* Chat Windows Slide-Out Container */}
      {isOpen && (
        <div 
          id="chatbot-window-panel"
          className="fixed bottom-22 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[410px] h-[500px] max-h-[calc(100vh-120px)] bg-[#0c0e18]/95 border border-[#1e2235] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden backdrop-blur-md animate-fade-in transition-all duration-300"
        >
          {/* Header Panel */}
          <div className="bg-[#121522] border-b border-[#1e2235] p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg">
                <Bot size={16} className="text-white animate-pulse" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-100 uppercase tracking-widest flex items-center gap-1">
                  Assistant Core AI
                  <Sparkles size={11} className="text-blue-400 animate-pulse" />
                </span>
                <span className="block text-[9px] font-mono text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                  Active Console Context
                </span>
              </div>
            </div>
            <button
              id="chatbot-close-panel-btn"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 transition p-1 hover:bg-[#1e2235]/40 rounded cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Log Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 max-w-[85%] ${
                  msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start'
                }`}
              >
                <div
                  className={`text-xs leading-relaxed p-3.5 rounded-lg whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600/15 border border-blue-500/30 text-slate-100 rounded-tr-none'
                      : 'bg-[#06080e]/90 border border-[#1d2134]/70 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Format simple bolding markdown explicitly */}
                  {msg.text.split('\n').map((para, i) => {
                    // Check for list items or simple bullet markup
                    let renderedText = para;
                    return (
                      <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                        {renderedText.split('**').map((chunk, index) => {
                          if (index % 2 === 1) {
                            return <strong key={index} className="text-blue-300 font-extrabold">{chunk}</strong>;
                          }
                          // Also check for italic single asterisk matching
                          return chunk.split('*').map((subchunk, subidx) => {
                            if (subidx % 2 === 1) {
                              return <span key={subidx} className="text-slate-350 italic font-medium">{subchunk}</span>;
                            }
                            return subchunk;
                          });
                        })}
                      </p>
                    );
                  })}
                </div>
                <span className="text-[8px] font-mono text-slate-500 opacity-80 uppercase tracking-widest pl-1 pr-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {/* AI Loading indicator */}
            {isLoading && (
              <div className="self-start flex items-center gap-1.5 bg-[#06080e] border border-[#1d2134] p-3 rounded-lg rounded-tl-none max-w-[50%]">
                <RefreshCw size={11} className="animate-spin text-blue-400" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest animate-pulse">Consulting AI...</span>
              </div>
            )}

            {/* Error alerts */}
            {errorStatus && (
              <div className="flex items-center gap-2 p-3 bg-rose-950/15 border border-rose-900/30 rounded-lg text-rose-450 text-[10px] uppercase font-mono tracking-wider">
                <AlertCircle size={14} className="shrink-0 text-rose-400" />
                <span>{errorStatus}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick recommendations Suggestions Bar */}
          <div className="px-3 py-2 bg-[#06070a]/90 border-t border-[#1e2235]/65 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5 shrink-0">
            <button
              onClick={() => handleSuggestClick("What are my highest matching jobs right now?")}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#121522] hover:bg-[#1b2034] border border-[#1e2235] text-slate-300 hover:text-slate-105 rounded-full text-[9px] font-mono uppercase tracking-wider transition cursor-pointer"
            >
              <Zap size={10} className="text-amber-400 shrink-0" />
              Analyze Best Leads
            </button>
            <button
              onClick={() => handleSuggestClick("How matchable is my current profile skills list?")}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#121522] hover:bg-[#1b2034] border border-[#1e2235] text-slate-300 hover:text-slate-105 rounded-full text-[9px] font-mono uppercase tracking-wider transition cursor-pointer"
            >
              <Award size={10} className="text-blue-400 shrink-0" />
              Audit Skills Profile
            </button>
            <button
              onClick={() => handleSuggestClick("How do I configure automatic proposals?")}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#121522] hover:bg-[#1b2034] border border-[#1e2235] text-slate-300 hover:text-slate-105 rounded-full text-[9px] font-mono uppercase tracking-wider transition cursor-pointer"
            >
              <TrendingUp size={10} className="text-emerald-400 shrink-0" />
              Auto Bidding
            </button>
          </div>

          {/* Form Message input field box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputValue);
            }}
            className="p-3 bg-[#121522] border-t border-[#1e2235] flex gap-2 shrink-0 items-center"
          >
            <input
              type="text"
              className="flex-1 bg-[#07080d] border border-[#1e2235] text-slate-200 rounded p-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-550 min-w-0"
              placeholder="Query console AI operator..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded transition cursor-pointer shrink-0 disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
