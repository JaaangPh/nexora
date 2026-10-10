import React, { useState, useEffect } from 'react';
import { KeyRound, Sparkles, Settings, ExternalLink, Check, Server, Shield } from 'lucide-react';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api';
import { InviteCodeItem } from '../types/auth';

interface InviteCodeHelperProps {
  onSelectCode: (code: string) => void;
  onFillAdminLogin: () => void;
}

export const InviteCodeHelper: React.FC<InviteCodeHelperProps> = ({
  onSelectCode,
  onFillAdminLogin,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [codes, setCodes] = useState<InviteCodeItem[]>([]);
  const [customApiUrl, setCustomApiUrl] = useState(getApiBaseUrl());
  const [saveFeedback, setSaveFeedback] = useState(false);

  useEffect(() => {
    api
      .getInvites()
      .then((res) => {
        if (res.inviteCodes) setCodes(res.inviteCodes);
      })
      .catch(() => {
        // Fallback default seed codes
        setCodes([
          {
            code: 'NT723906',
            description: 'Nexora Official Founder Referral Pass (Unlimited)',
            max_uses: -1,
            times_used: 0,
            is_active: 1,
          },
          {
            code: 'NEXORA-2025',
            description: 'General Member Onboarding Pass (Unlimited)',
            max_uses: -1,
            times_used: 0,
            is_active: 1,
          },
          {
            code: 'VIP-ACCESS',
            description: 'Executive VIP Access Pass',
            max_uses: 25,
            times_used: 0,
            is_active: 1,
          },
          {
            code: 'ALPHA-TESTER',
            description: 'Mobile QA Verification Pass',
            max_uses: 10,
            times_used: 0,
            is_active: 1,
          },
        ]);
      });
  }, []);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('Pinging server...');
    try {
      setApiBaseUrl(customApiUrl);
      const res = await api.checkHealth();
      setTestStatus('success');
      setTestMessage(`Connected! Server is online with ${res.database || 'Firebase'}.`);
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Connection failed. Verify server is running on port 5000.');
    }
  };

  const handleSaveApiUrl = () => {
    setApiBaseUrl(customApiUrl);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  return (
    <>
      {/* Floating Action Controls for Testing and Android Configuration */}
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2">
        {/* API Settings Button for Mobile / Dev */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-full bg-white text-[#142B5B] shadow-lg border border-[#DCE4EF] hover:bg-slate-50 transition-transform active:scale-95"
          title="Server / APK API Configuration"
          aria-label="Server Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Demo Keys Quick Access Pill */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-3.5 py-2 rounded-full bg-[#142B5B] hover:bg-[#2459C4] text-white shadow-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-cyan-400/30"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <span>Demo Keys & Logins</span>
        </button>
      </div>

      {/* Demo Keys Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#2459C4]" />
                <h3 className="text-sm font-bold text-[#17233B]">Testing Invite Codes</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-3">
              Click any code to autofill the registration form:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {codes.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onSelectCode(item.code);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 transition-all flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-black text-[#142B5B] font-mono group-hover:text-[#2459C4]">
                      {item.code}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
                      {item.description}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#2459C4] bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                    Apply
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-slate-700 mb-2">Pre-seeded Admin Account:</p>
              <button
                type="button"
                onClick={() => {
                  onFillAdminLogin();
                  setIsOpen(false);
                }}
                className="w-full p-2.5 rounded-xl bg-gradient-to-r from-blue-900 to-indigo-900 text-white text-xs font-bold flex items-center justify-between"
              >
                <span>Autofill Admin Login</span>
                <span className="text-[10px] text-cyan-300 font-mono">+18005550199</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APK / Server Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[#2459C4]" />
                <h3 className="text-sm font-bold text-[#17233B]">Mobile API Host Settings</h3>
              </div>
              <button
                onClick={() => {
                  setIsSettingsOpen(false);
                  setTestStatus('idle');
                  setTestMessage('');
                }}
                className="text-xs text-slate-400 hover:text-slate-700 font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mt-2 mb-3 leading-relaxed">
              For Android emulators, use <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">http://10.0.2.2:5000</code> or <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">http://localhost:5000</code>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={customApiUrl}
                  onChange={(e) => {
                    setCustomApiUrl(e.target.value);
                    setTestStatus('idle');
                  }}
                  placeholder="e.g. http://10.0.2.2:5000"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCustomApiUrl('http://10.0.2.2:5000')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2459C4]"
                >
                  Emulator 10.0.2.2:5000
                </button>
                <button
                  type="button"
                  onClick={() => setCustomApiUrl('http://localhost:5000')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2459C4]"
                >
                  ADB Reverse localhost:5000
                </button>
                <button
                  type="button"
                  onClick={() => setCustomApiUrl('')}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Web (/api)
                </button>
              </div>

              {/* Test Connection Button */}
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="w-full py-2 rounded-xl border border-[#2459C4] text-[#2459C4] hover:bg-blue-50/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <span>{testStatus === 'testing' ? 'Testing Connection...' : '⚡ Test Server Connection'}</span>
              </button>

              {testStatus !== 'idle' && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-medium ${
                    testStatus === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : testStatus === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}
                >
                  {testMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveApiUrl}
                className="w-full py-2.5 rounded-xl bg-[#142B5B] hover:bg-[#2459C4] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                {saveFeedback ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save API Configuration</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
