import React, { useState } from 'react';
import { Users, Link as LinkIcon, Check, Copy, Share2 } from 'lucide-react';
import { User } from '../types/auth';

interface TeamTabProps {
  user: User;
}

export const TeamTab: React.FC<TeamTabProps> = ({ user }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const referralCode = user.referralCode || 'NT723906';
  const inviteLink = `https://nexoratech.live/register/${referralCode}`;

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
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 border-b border-[#1E3A78] pb-3">
        <Users className="w-5 h-5 text-cyan-400" />
        <h3 className="text-base font-extrabold text-white">Team & Referral Pass</h3>
      </div>

      {/* Your Personal Referral Pass Card */}
      <div className="bg-gradient-to-br from-[#0F224A] via-[#142B5B] to-[#1E4BA8] border border-[#2459C4]/40 rounded-2xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden">
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
            <LinkIcon className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
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

      {/* Team Statistics Grid */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="bg-[#0D204A] border border-[#1E3E80] rounded-xl p-3">
          <span className="text-[10px] font-bold text-blue-200/70 uppercase block">DIRECT TEAM</span>
          <span className="text-base font-black font-mono text-white mt-1 block">0</span>
        </div>
        <div className="bg-[#0D204A] border border-[#1E3E80] rounded-xl p-3">
          <span className="text-[10px] font-bold text-blue-200/70 uppercase block">TEAM VOLUME</span>
          <span className="text-base font-black font-mono text-cyan-300 mt-1 block">₱0.00</span>
        </div>
        <div className="bg-[#0D204A] border border-[#1E3E80] rounded-xl p-3">
          <span className="text-[10px] font-bold text-blue-200/70 uppercase block">COMMISSION</span>
          <span className="text-base font-black font-mono text-emerald-300 mt-1 block">₱0.00</span>
        </div>
      </div>
    </div>
  );
};

export default TeamTab;
