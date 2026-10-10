import React, { useState } from 'react';
import {
  User as UserIcon,
  Edit2,
  Save,
  X,
  Loader2,
  Check,
  Copy,
  Smartphone,
  Download,
  LogOut,
} from 'lucide-react';
import { User } from '../types/auth';
import { api } from '../services/api';

interface MeTabProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
  onOpenAppModal?: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  user,
  onLogout,
  onUpdateUser,
  onOpenAppModal,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) return;

    setIsSavingUsername(true);
    setUsernameError(null);

    try {
      const res = await api.updateUsername(clean);
      if (res.user && onUpdateUser) {
        onUpdateUser(res.user);
      }
      setUsernameSuccess(true);
      setIsEditingUsername(false);
      setTimeout(() => setUsernameSuccess(false), 2500);
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 border-b border-[#1E3A78] pb-3">
        <UserIcon className="w-5 h-5 text-cyan-400" />
        <h3 className="text-base font-extrabold text-white">My Account Profile</h3>
      </div>

      {/* Editable Username Card */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Account Username</span>
          {!isEditingUsername && (
            <button
              onClick={() => {
                setUsernameInput(user.username || '');
                setIsEditingUsername(true);
              }}
              className="text-xs text-cyan-400 hover:text-white font-bold flex items-center gap-1 active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
        </div>

        {isEditingUsername ? (
          <form onSubmit={handleSaveUsername} className="flex items-center gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter new username"
              className="flex-1 px-3 py-2 text-xs font-bold text-white bg-[#08132B] border border-[#2459C4] rounded-xl focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSavingUsername || !usernameInput.trim()}
              className="px-3 py-2 bg-cyan-400 text-[#08132B] text-xs font-bold rounded-xl flex items-center gap-1 disabled:opacity-50"
            >
              {isSavingUsername ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingUsername(false)}
              className="p-2 text-blue-200 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-base font-black font-mono text-white">
              {user.username || 'NexoraMember_723906'}
            </p>
            {usernameSuccess && (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>
        )}
        {usernameError && <p className="text-[11px] text-red-400 font-semibold">{usernameError}</p>}
      </div>

      {/* User Details Box */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3 text-xs">
        <div className="flex justify-between items-center border-b border-[#1E3A78] pb-2">
          <span className="text-blue-200/70 font-semibold">Phone Number</span>
          <span className="font-bold text-white font-mono">{user.phoneNumber}</span>
        </div>
        <div className="flex justify-between items-center border-b border-[#1E3A78] pb-2">
          <span className="text-blue-200/70 font-semibold">Role</span>
          <span className="font-bold text-cyan-300 capitalize">{user.role}</span>
        </div>
        <div className="flex justify-between items-center border-b border-[#1E3A78] pb-2">
          <span className="text-blue-200/70 font-semibold">Invite Key</span>
          <span className="font-bold text-white font-mono">{user.inviteCodeUsed || 'NEXORA-2025'}</span>
        </div>
        <div>
          <span className="text-blue-200/70 font-semibold block mb-1">Nexora ID</span>
          <div className="flex items-center justify-between bg-[#08132B] p-2 rounded-xl border border-[#1E3A78]">
            <span className="font-mono text-[11px] text-cyan-200 truncate pr-2">{user.id}</span>
            <button onClick={handleCopyId} className="text-cyan-400 hover:text-white font-bold flex items-center gap-1 flex-shrink-0">
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* APK Download Banner */}
      <div className="bg-gradient-to-r from-[#102554] to-[#163470] border border-[#2459C4]/40 rounded-2xl p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-400 text-[#08132B] flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Nexora Mobile App</h4>
            <p className="text-[10px] text-blue-200/70">Android v1.0 APK</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (onOpenAppModal) onOpenAppModal();
            else window.open('/downloads/nexora-technologies.apk');
          }}
          className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#08132B] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>APK</span>
        </button>
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>
    </div>
  );
};

export default MeTab;
