import React, { useState } from 'react';
import {
  ShieldCheck,
  User as UserIcon,
  Phone,
  KeyRound,
  LogOut,
  Lock,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Link,
  Users,
  Smartphone,
  Download,
} from 'lucide-react';
import { User } from '../types/auth';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralCode = user.referralCode || 'NT723906';
  const inviteLink = `${window.location.origin}/register/${referralCode}`;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="w-full animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>AUTHENTICATED MEMBER SESSION</span>
        </div>
        <h2 className="text-2xl sm:text-[28px] font-black text-[#17233B] tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
          Welcome, Member
        </h2>
        <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-medium">
          You are securely signed in to the Nexora Technologies Portal.
        </p>
      </div>

      {/* Member Details Card */}
      <div className="bg-[#F8FAFC] border border-[#DCE4EF] rounded-2xl p-5 mb-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#142B5B] to-[#2459C4] flex items-center justify-center text-white">
              <UserIcon className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                Account Status
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-[#17233B] capitalize">
                  {user.role} (Verified)
                </span>
              </div>
            </div>
          </div>

          <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#142B5B]/10 text-[#142B5B] font-bold uppercase tracking-wider">
            {user.role}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-[#2459C4] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Phone Number</p>
              <p className="text-xs font-bold text-[#17233B] truncate">{user.phoneNumber}</p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Used Invite Key</p>
              <p className="text-xs font-bold text-[#17233B] truncate">
                {user.inviteCodeUsed || 'NEXORA-2025'}
              </p>
            </div>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E2E8F0] flex items-center gap-2.5 sm:col-span-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase font-bold text-[#64748B]">Nexora Member ID</p>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono font-bold text-[#17233B] truncate">{user.id}</p>
                <button
                  onClick={handleCopyId}
                  className="text-xs text-[#2459C4] hover:text-[#142B5B] flex items-center gap-1 font-semibold pl-2"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Member Referral & Invitation Link Card */}
      <div className="bg-gradient-to-br from-[#0F224A] via-[#142B5B] to-[#1E4BA8] rounded-2xl p-4 sm:p-5 mb-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-cyan-400/10 blur-xl pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-white/10 text-cyan-300">
            <Users className="w-4 h-4" />
          </div>
          <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
            Your Personal Referral Pass
          </h4>
        </div>
        <p className="text-[11px] text-blue-100/80 mb-3.5 leading-relaxed">
          Share your unique 6-digit referral code or invite link. Every newly created account gains access through your link.
        </p>

        {/* Referral Code Box */}
        <div className="bg-white/10 border border-white/20 rounded-xl p-3 flex items-center justify-between mb-2.5">
          <div>
            <span className="text-[10px] uppercase font-bold text-cyan-300 block">Referral Code</span>
            <span className="text-base sm:text-lg font-mono font-black tracking-widest text-white">
              {referralCode}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#142B5B] text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Invitation URL Box */}
        <div className="bg-black/25 border border-white/15 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-xs font-mono text-blue-100 truncate">
              {inviteLink}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#091530] text-xs font-black flex items-center gap-1 transition-all active:scale-95 flex-shrink-0"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </div>
      </div>

      {/* Nexora Mobile App (APK) Download Section */}
      <div className="bg-gradient-to-r from-[#0B1E48] to-[#142B5B] border border-[#2459C4]/40 rounded-2xl p-4 sm:p-5 mb-5 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center text-[#08132B] shadow-md shadow-cyan-500/20 flex-shrink-0">
              <Smartphone className="w-6 h-6 text-[#08132B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold text-white tracking-tight">
                  Nexora Mobile App
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold">
                  v1.0 APK
                </span>
              </div>
              <p className="text-xs text-blue-100/75 mt-0.5 leading-snug">
                Install our official Android app for instant access anywhere without opening a browser.
              </p>
            </div>
          </div>

          <a
            href="/downloads/nexora-technologies.apk"
            download="NexoraTechnologies.apk"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-white text-[#0A1938] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all duration-200 active:scale-95 flex-shrink-0 no-underline cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#0A1938]" />
            <span>Download APK App</span>
          </a>
        </div>
      </div>

      {/* Security Protocol Badges */}
      <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4 mb-6">
        <h4 className="text-xs font-bold text-[#1E40AF] uppercase tracking-wider flex items-center gap-1.5 mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Active Security Features</span>
        </h4>
        <ul className="text-[11px] text-[#1E3A8A] space-y-1.5 font-medium">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Google Cloud Firestore data synchronization</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Cryptographic JWT session token issued</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Rate-limited brute-force barrier active</span>
          </li>
        </ul>
      </div>

      {/* Logout Action Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 px-6 rounded-2xl bg-[#DC3545] hover:bg-[#C82333] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-red-900/10 flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Secure Sign Out</span>
      </button>

      <footer className="mt-6 text-center">
        <p className="text-[11px] text-[#94A3B8] font-medium tracking-tight">
          Nexora Technologies • Secure Member Portal
        </p>
      </footer>
    </div>
  );
};
