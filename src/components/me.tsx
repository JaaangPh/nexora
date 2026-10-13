import React, { useState } from 'react';
import {
  User as UserIcon,
  Edit2,
  Save,
  X,
  Loader2,
  Check,
  Copy,
  LogOut,
  Users,
  Footprints,
  CreditCard,
  Headphones,
  ClipboardList,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import { User } from '../types/auth';
import { api } from '../services/api';

interface MeTabProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
  onNavigateTab: (tab: 'market' | 'track' | 'team' | 'myrunners' | 'myrecord') => void;
  onOpenBankAccount: () => void;
  onOpenCustomerService: () => void;
  onOpenAppModal: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  user,
  onLogout,
  onUpdateUser,
  onNavigateTab,
  onOpenBankAccount,
  onOpenCustomerService,
  onOpenAppModal,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  const nexoraId = (user.referralCode || user.id)
    .replace(/\D/g, '')
    .slice(-5)
    .padStart(5, '0');
  const menuItems = [
    { label: 'TEAM MARATHON', icon: Users, onClick: () => onNavigateTab('team') },
    { label: 'MY RUNNERS', icon: Footprints, onClick: () => onNavigateTab('myrunners') },
    { label: 'BANK ACCOUNT', icon: CreditCard, onClick: onOpenBankAccount },
    { label: 'CUSTOMER SERVICE', icon: Headphones, onClick: onOpenCustomerService },
    { label: 'MY RECORDS', icon: ClipboardList, onClick: () => onNavigateTab('myrecord') },
    { label: 'DOWNLOAD APP', icon: Smartphone, onClick: onOpenAppModal },
  ];

  const handleCopyId = () => {
    navigator.clipboard.writeText(nexoraId);
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
      <section className="relative overflow-hidden rounded-2xl border border-[#232731] bg-[#171A21] p-4 shadow-xl">
        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#D8FD2F] text-[#08132B]">
            <UserIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-white">{user.phoneNumber}</p>
            <p className="text-xs font-medium text-slate-300">Welcome back, {user.username || 'Member'}</p>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 divide-x divide-[#232731] rounded-xl border border-[#232731] bg-[#10141D] px-3 py-2.5">
          <div className="pr-3">
            <p className="text-[11px] font-semibold text-slate-400">Main Balance</p>
            <p className="text-lg font-black text-white">
              ₱{(user.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-semibold text-slate-400">Total Deposit</p>
            <p className="text-lg font-black text-[#D8FD2F]">
              ₱{(user.totalDeposit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </section>

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

      <section className="overflow-hidden rounded-2xl border border-[#1E3E80] bg-[#0D204A] px-3">
        {menuItems.map(({ label, icon: Icon, onClick }, index) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`flex min-h-[58px] w-full items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/10 ${
              index < menuItems.length - 1 ? 'border-b border-[#1E3A78]' : ''
            }`}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#D8FD2F] text-[#0B1A3D]">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1 text-xs font-semibold tracking-wide text-white">{label}</span>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-200/60" />
          </button>
        ))}
      </section>

      {/* User Details Box */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3 text-xs">
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
            <span className="font-mono text-[11px] text-cyan-200 truncate pr-2">{nexoraId}</span>
            <button onClick={handleCopyId} className="text-cyan-400 hover:text-white font-bold flex items-center gap-1 flex-shrink-0">
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
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
