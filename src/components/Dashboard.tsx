import React, { useState } from 'react';
import {
  Home,
  TrendingUp,
  BarChart2,
  Layers,
  Users,
  User as UserIcon,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Headphones,
  Smartphone,
  Download,
  ShieldCheck,
  Activity,
  Check,
  Copy,
  Share2,
  Link as LinkIcon,
  Edit2,
  Save,
  X,
  Loader2,
  LogOut,
  Lock,
  CheckCircle2,
  Briefcase,
  DollarSign,
  HelpCircle,
  Send,
  ChevronRight,
  Star,
} from 'lucide-react';
import { User } from '../types/auth';
import { api } from '../services/api';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

type NavTab = 'home' | 'graph' | 'trades' | 'team' | 'me';

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Username Editing State
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);

  // Modal States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);

  // Simulated Deposit/Withdraw inputs
  const [depositAmount, setDepositAmount] = useState<string>('500');
  const [depositMethod, setDepositMethod] = useState<string>('GCash');
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<string | null>(null);

  const referralCode = user.referralCode || 'NT723906';
  const inviteLink = `https://nexoratech.live/register/${referralCode}`;

  const currentBalance = user.balance ?? 0;
  const currentTotalDeposit = user.totalDeposit ?? 0;

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

  const handleExecuteDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;

    setIsProcessingDeposit(true);
    setTimeout(() => {
      const updatedUser: User = {
        ...user,
        balance: currentBalance + amt,
        totalDeposit: currentTotalDeposit + amt,
      };
      if (onUpdateUser) onUpdateUser(updatedUser);
      setIsProcessingDeposit(false);
      setDepositSuccessMsg(`Successfully deposited ₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} via ${depositMethod}!`);
      setTimeout(() => {
        setDepositSuccessMsg(null);
        setShowDepositModal(false);
      }, 2000);
    }, 1000);
  };

  const handleExecuteWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      setWithdrawMsg('Please enter a valid amount.');
      return;
    }
    if (amt > currentBalance) {
      setWithdrawMsg('Insufficient available balance.');
      return;
    }

    setIsProcessingWithdraw(true);
    setWithdrawMsg(null);
    setTimeout(() => {
      const updatedUser: User = {
        ...user,
        balance: Math.max(0, currentBalance - amt),
      };
      if (onUpdateUser) onUpdateUser(updatedUser);
      setIsProcessingWithdraw(false);
      setWithdrawMsg(`Withdrawal request of ₱${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })} submitted successfully!`);
      setTimeout(() => {
        setWithdrawMsg(null);
        setShowWithdrawModal(false);
        setWithdrawAmount('');
      }, 2000);
    }, 1000);
  };

  return (
    <div className="w-full bg-[#08132B] text-white min-h-[680px] flex flex-col justify-between font-sans relative overflow-hidden select-none pb-20">
      
      {/* Scrollable Content Container */}
      <div className="w-full flex-1 overflow-y-auto">

        {/* ---------------------------------------------------- */}
        {/* TOP HERO BRAND BANNER (Nexora Technologies Header) */}
        {/* ---------------------------------------------------- */}
        <div className="relative w-full bg-gradient-to-b from-[#091738] via-[#0E2352] to-[#08132B] pt-6 pb-6 px-4 border-b border-[#1E3A78]/50 overflow-hidden">
          {/* Subtle Glow Background Shapes */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-tech-grid opacity-15 pointer-events-none" />

          {/* Banner Branding Content */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#2459C4] to-cyan-400 p-0.5 shadow-lg shadow-cyan-500/20 mb-2.5">
              <div className="w-full h-full bg-[#091738] rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-['Plus_Jakarta_Sans',sans-serif]">
              Nexora Technologies
            </h1>
            <p className="text-[11px] text-cyan-300/90 font-semibold tracking-wider uppercase mt-0.5">
              Automated Trading & Investment Portal
            </p>

            {/* Account Status Pill */}
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-white tracking-wider uppercase">
                {user.username || 'Member'} • {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* MAIN BODY CONTENT BASED ON ACTIVE TAB */}
        <div className="p-4 sm:p-5 space-y-5">

          {/* ==================================================== */}
          {/* TAB 1: HOME                                          */}
          {/* ==================================================== */}
          {activeTab === 'home' && (
            <div className="space-y-5 animate-fade-in">

              {/* 1. TOTAL DEPOSIT & AVAILABLE BALANCE HEADER CARD */}
              {/* Note: Color background remains sleek dark blue as instructed */}
              <div className="bg-gradient-to-r from-[#102554] via-[#163470] to-[#102554] border border-[#264FA6]/60 rounded-2xl p-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/10 rounded-full blur-xl pointer-events-none" />
                
                <div className="grid grid-cols-2 divide-x divide-[#264FA6]/60 text-center relative z-10">
                  {/* Left Column: TOTAL DEPOSIT */}
                  <div className="pr-3 flex flex-col justify-center items-center">
                    <span className="text-[10px] font-bold tracking-widest text-cyan-200 uppercase block mb-1">
                      TOTAL DEPOSIT
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-white tracking-tight">
                      ₱{(currentTotalDeposit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Right Column: AVAILABLE BALANCE */}
                  <div className="pl-3 flex flex-col justify-center items-center">
                    <span className="text-[10px] font-bold tracking-widest text-cyan-200 uppercase block mb-1">
                      AVAILABLE BALANCE
                    </span>
                    <span className="text-lg sm:text-xl font-black font-mono text-cyan-300 tracking-tight">
                      ₱{(currentBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. QUICK ACTIONS SECTION */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block" />
                  <h3 className="text-sm font-extrabold text-white tracking-tight">
                    Quick Actions
                  </h3>
                </div>

                {/* 6 Quick Action Cards Grid */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Action 1: Deposit */}
                  <button
                    onClick={() => setShowDepositModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Deposit</span>
                  </button>

                  {/* Action 2: Withdraw */}
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Withdraw</span>
                  </button>

                  {/* Action 3: Support */}
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Support</span>
                  </button>

                  {/* Action 4: APP */}
                  <button
                    onClick={() => setShowAppModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">APP</span>
                  </button>

                  {/* Action 5: Graph */}
                  <button
                    onClick={() => setActiveTab('graph')}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Graph</span>
                  </button>

                  {/* Action 6: Trader */}
                  <button
                    onClick={() => setActiveTab('trades')}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Trader</span>
                  </button>
                </div>
              </div>

              {/* 3. FEATURED PROJECTS / AVAILABLE TRADER SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block" />
                    <h3 className="text-sm font-extrabold text-white tracking-tight">
                      Featured Projects
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-300/70">
                    AVAILABLE TRADERS
                  </span>
                </div>

                {/* Content: "- for now blank" */}
                <div className="bg-[#0C1F4A]/80 border border-[#1E3E80]/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                  <div className="w-12 h-12 rounded-full bg-[#183674] text-cyan-400 flex items-center justify-center mx-auto mb-3 border border-cyan-500/20">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-white mb-1">
                    No Available Projects Right Now
                  </h4>
                  <p className="text-xs text-blue-200/60 max-w-xs mx-auto leading-relaxed">
                    New algorithmic trading projects and automated trader packages will be featured here soon.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: GRAPH                                         */}
          {/* ==================================================== */}
          {activeTab === 'graph' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-extrabold text-white">Live Market Graph</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                  NEX/USDT • LIVE
                </span>
              </div>

              {/* Market Summary */}
              <div className="bg-[#0D204A] border border-[#1E3E80] rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-blue-200/70 block uppercase">NEX INDEX PRICE</span>
                  <span className="text-xl font-black font-mono text-cyan-300">$1,482.50</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-400 block">+4.82% 24h</span>
                  <span className="text-xs font-mono text-blue-200/80">Vol: $1.42M</span>
                </div>
              </div>

              {/* Simulated Candlestick / Line Chart */}
              <div className="bg-[#0A1738] border border-[#1E3E80] rounded-2xl p-4 shadow-inner">
                <div className="flex items-center justify-between text-xs text-blue-200/70 mb-3">
                  <span className="font-bold">Timeframe:</span>
                  <div className="flex items-center gap-1">
                    {['1M', '5M', '1H', '1D'].map((tf, idx) => (
                      <button
                        key={tf}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                          idx === 2 ? 'bg-cyan-500 text-[#091530]' : 'bg-[#142B5B] text-blue-200 hover:text-white'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SVG Graph Graphic */}
                <div className="w-full h-44 flex items-end justify-between gap-1 pt-4 pb-1 px-1 relative border-b border-[#1E3A78]">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between opacity-15 pointer-events-none">
                    <div className="border-b border-cyan-400 w-full" />
                    <div className="border-b border-cyan-400 w-full" />
                    <div className="border-b border-cyan-400 w-full" />
                  </div>
                  
                  {/* Simulated Candle Bars */}
                  {[40, 55, 35, 60, 75, 50, 65, 80, 70, 85, 95, 90, 110, 105, 125, 120, 140].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        style={{ height: `${h}%` }}
                        className={`w-full rounded-t-sm ${
                          i % 3 === 0 ? 'bg-red-400/80' : 'bg-emerald-400/90 shadow-sm shadow-emerald-500/20'
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] font-mono text-blue-200/50 mt-2">
                  <span>10:00</span>
                  <span>12:00</span>
                  <span>14:00</span>
                  <span>16:00</span>
                  <span>Now</span>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: TRADES                                        */}
          {/* ==================================================== */}
          {activeTab === 'trades' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-extrabold text-white">Automated Trading</h3>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  Bal: ₱{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Quick Trade Order</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#08132B] font-extrabold text-xs rounded-xl transition-all">
                    BUY / LONG
                  </button>
                  <button className="py-2.5 bg-red-500 hover:bg-red-400 text-white font-extrabold text-xs rounded-xl transition-all">
                    SELL / SHORT
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200/80 mb-2">Active Positions</h4>
                <div className="bg-[#0A1738] border border-[#1E3E80] rounded-2xl p-6 text-center">
                  <p className="text-xs text-blue-200/60">No active trading positions open.</p>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: TEAM (Referral Pass & Network)                */}
          {/* ==================================================== */}
          {activeTab === 'team' && (
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
          )}

          {/* ==================================================== */}
          {/* TAB 5: ME (User Profile & Account)                   */}
          {/* ==================================================== */}
          {activeTab === 'me' && (
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
                <a
                  href="/downloads/nexora-technologies.apk"
                  download="NexoraTechnologies.apk"
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#08132B] font-black text-xs uppercase tracking-wider flex items-center gap-1.5 no-underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>APK</span>
                </a>
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
          )}

        </div>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM NAVIGATION BAR (HOME GRAPH TRADES TEAM ME)        */}
      {/* ======================================================== */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed sm:absolute bottom-0 left-0 right-0 w-full max-w-[440px] mx-auto h-16 bg-[#091738]/95 backdrop-blur-md border-t border-[#1E3A78] flex items-center justify-around z-30 px-1 select-none shadow-2xl"
      >
        {[
          { id: 'home', label: 'HOME', icon: Home },
          { id: 'graph', label: 'GRAPH', icon: TrendingUp },
          { id: 'trades', label: 'TRADES', icon: Layers },
          { id: 'team', label: 'TEAM', icon: Users },
          { id: 'me', label: 'ME', icon: UserIcon },
        ].map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id as NavTab)}
              className={`flex-1 h-full flex flex-col items-center justify-center transition-colors select-none relative ${
                isActive ? 'text-cyan-400' : 'text-blue-200/60 hover:text-blue-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[10px] font-bold tracking-wider mt-1 leading-none uppercase">
                {label}
              </span>
              {/* Static dimension indicator - always present in layout so NOTHING ever shifts or moves */}
              <span
                className={`w-6 h-0.5 rounded-full mt-1.5 transition-all flex-shrink-0 ${
                  isActive ? 'bg-cyan-400 opacity-100' : 'bg-transparent opacity-0'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* ======================================================== */}
      {/* MODAL 1: DEPOSIT MODAL                                   */}
      {/* ======================================================== */}
      {showDepositModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091738] border border-[#2459C4]/60 rounded-3xl p-5 w-full max-w-sm text-white shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowDepositModal(false)}
              className="absolute top-4 right-4 text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-white">Deposit Funds</h3>
            </div>

            {depositSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                {depositSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleExecuteDeposit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-cyan-300 uppercase block mb-1">
                    Select Amount (PHP)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {['100', '500', '1000', '5000'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmount(amt)}
                        className={`py-1.5 rounded-lg text-xs font-bold ${
                          depositAmount === amt ? 'bg-cyan-400 text-[#08132B]' : 'bg-[#142B5B] text-white hover:bg-[#1E3A78]'
                        }`}
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="Custom Deposit Amount"
                    className="w-full px-3.5 py-2.5 bg-[#08132B] border border-[#1E3A78] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-cyan-300 uppercase block mb-1">
                    Payment Channel
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#08132B] border border-[#1E3A78] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="GCash">GCash E-Wallet</option>
                    <option value="PayMaya">PayMaya E-Wallet</option>
                    <option value="USDT (TRC20)">USDT (TRC20 Crypto)</option>
                    <option value="Bank Transfer">Local Bank Transfer</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isProcessingDeposit}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-white text-[#08132B] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  {isProcessingDeposit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  <span>{isProcessingDeposit ? 'Processing...' : 'Confirm Deposit'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: WITHDRAW MODAL                                  */}
      {/* ======================================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091738] border border-[#2459C4]/60 rounded-3xl p-5 w-full max-w-sm text-white shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-4 right-4 text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-white">Withdraw Funds</h3>
            </div>

            <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78] mb-3 flex items-center justify-between text-xs">
              <span className="text-blue-200/70 font-semibold">Available Balance:</span>
              <span className="font-bold font-mono text-cyan-300">
                ₱{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {withdrawMsg ? (
              <div className="p-3.5 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold text-center">
                {withdrawMsg}
              </div>
            ) : (
              <form onSubmit={handleExecuteWithdraw} className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-cyan-300 uppercase block mb-1">
                    Withdrawal Amount (PHP)
                  </label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Enter amount to withdraw"
                    className="w-full px-3.5 py-2.5 bg-[#08132B] border border-[#1E3A78] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-cyan-300 uppercase block mb-1">
                    Account Details (GCash / Bank Account)
                  </label>
                  <input
                    type="text"
                    value={withdrawAccount}
                    onChange={(e) => setWithdrawAccount(e.target.value)}
                    placeholder="e.g. GCash 0917XXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-[#08132B] border border-[#1E3A78] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isProcessingWithdraw}
                  className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  {isProcessingWithdraw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                  <span>{isProcessingWithdraw ? 'Processing...' : 'Submit Withdrawal'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: SUPPORT MODAL                                   */}
      {/* ======================================================== */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#091738] border border-[#2459C4]/60 rounded-3xl p-5 w-full max-w-sm text-white shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowSupportModal(false)}
              className="absolute top-4 right-4 text-blue-200 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-white">24/7 Member Support</h3>
            </div>

            <p className="text-xs text-blue-200/80 mb-4 leading-relaxed">
              Need assistance with your account, deposits, or trading? Connect directly with our official Nexora customer service representatives.
            </p>

            <div className="space-y-2.5">
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="w-full p-3 rounded-xl bg-[#142B5B] hover:bg-[#1E3A78] border border-[#2459C4]/40 flex items-center justify-between text-xs font-bold text-cyan-300 no-underline transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="w-4 h-4 text-cyan-400" />
                  <span>Official Telegram Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </a>

              <a
                href="mailto:support@nexoratech.live"
                className="w-full p-3 rounded-xl bg-[#142B5B] hover:bg-[#1E3A78] border border-[#2459C4]/40 flex items-center justify-between text-xs font-bold text-cyan-300 no-underline transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>Email Support Desk</span>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: APP DOWNLOAD STORE MODAL (Matching User Image)   */}
      {/* ======================================================== */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white text-[#17233B] rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl relative animate-scale-up font-sans">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#2459C4]" />
                <h3 className="text-sm font-extrabold text-[#0B1A3D]">App Details</h3>
              </div>
              <button
                onClick={() => setShowAppModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              
              {/* 1. App Header Info */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#091530] via-[#142B5B] to-[#2459C4] p-0.5 shadow-lg flex-shrink-0">
                  <div className="w-full h-full bg-[#08132B] rounded-[14px] flex items-center justify-center border border-cyan-400/30">
                    <ShieldCheck className="w-9 h-9 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#0B1A3D] leading-tight font-['Plus_Jakarta_Sans',sans-serif]">
                    Nexora Technologies
                  </h2>
                  <p className="text-xs font-bold text-[#DC2626] mt-0.5">
                    Nexora Technologies Team
                  </p>
                </div>
              </div>

              {/* 2. Stats Bar */}
              <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
                <div>
                  <div className="text-sm font-extrabold text-[#0B1A3D] flex items-center justify-center gap-1">
                    <span>4.9</span>
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Rating</span>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-[#0B1A3D]">100K+</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Downloads</span>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-[#0B1A3D]">25 MB</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Size</span>
                </div>
              </div>

              {/* 3. Primary Download APK Button */}
              <a
                href="/downloads/nexora-technologies.apk"
                download="NexoraTechnologies.apk"
                className="w-full py-3.5 px-6 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 transition-all no-underline cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download APK</span>
              </a>

              {/* 4. About this app */}
              <div>
                <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-1.5">About this app</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  Nexora Technologies lets you manage your account, explore new features, and enjoy a fast and secure mobile experience.
                </p>
              </div>

              {/* 5. App information Table */}
              <div>
                <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">App information</h4>
                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Version</span>
                    <span className="font-extrabold text-[#0B1A3D]">1.0.0</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Updated on</span>
                    <span className="font-extrabold text-[#0B1A3D]">October 10, 2026</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Downloads</span>
                    <span className="font-extrabold text-[#0B1A3D]">100,000+</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">APK Size</span>
                    <span className="font-extrabold text-[#0B1A3D]">25 MB</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Requires Android</span>
                    <span className="font-extrabold text-[#0B1A3D]">7.0 and up</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Category</span>
                    <span className="font-extrabold text-[#0B1A3D]">Finance</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white">
                    <span className="text-slate-400 font-medium">Developer</span>
                    <span className="font-extrabold text-[#0B1A3D]">Nexora Technologies</span>
                  </div>
                </div>
              </div>

              {/* 6. What's new */}
              <div>
                <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">What's new</h4>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 text-xs space-y-2">
                  <p className="text-[11px] text-slate-400 font-semibold mb-2">Last updated • October 10, 2026</p>
                  <ul className="space-y-2 font-medium text-slate-700">
                    <li className="flex items-center gap-2">🚀 <span>Improved app performance.</span></li>
                    <li className="flex items-center gap-2">🔒 <span>Enhanced account security.</span></li>
                    <li className="flex items-center gap-2">🐞 <span>Fixed login and registration bugs.</span></li>
                    <li className="flex items-center gap-2">⚡ <span>Faster loading speed.</span></li>
                  </ul>
                </div>
              </div>

              {/* 7. Data safety */}
              <div>
                <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">Data safety</h4>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4 text-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      🔒
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[#0B1A3D]">Data is encrypted in transit</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">Your information is protected while being transferred.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      💔
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[#0B1A3D]">No data shared with third parties</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">Your personal information is not sold or shared.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      🗑️
                    </div>
                    <div>
                      <h5 className="font-extrabold text-[#0B1A3D]">You can request data deletion</h5>
                      <p className="text-slate-500 text-[11px] mt-0.5">Contact support if you want your account removed.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 8. Ratings & reviews */}
              <div>
                <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">Ratings & reviews</h4>
                <div className="border border-slate-100 rounded-2xl p-4 bg-white text-xs">
                  <div className="flex items-center gap-5 mb-1">
                    <div className="text-center flex-shrink-0">
                      <span className="text-4xl font-black text-[#0B1A3D] block">4.9</span>
                      <div className="flex items-center justify-center text-amber-400 gap-0.5 my-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Based on 12,845 reviews</span>
                    </div>

                    {/* Progress Bars */}
                    <div className="flex-1 space-y-1.5 text-[10px] font-bold text-slate-600">
                      {[
                        { star: 5, width: '85%' },
                        { star: 4, width: '10%' },
                        { star: 3, width: '3%' },
                        { star: 2, width: '1%' },
                        { star: 1, width: '1%' },
                      ].map((item) => (
                        <div key={item.star} className="flex items-center gap-2">
                          <span className="w-2">{item.star}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div style={{ width: item.width }} className="h-full bg-[#B91C1C] rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
