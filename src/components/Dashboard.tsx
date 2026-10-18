import React, { useState, useEffect } from 'react';
import {
  Home,
  ShoppingBag,
  Footprints,
  Users,
  User as UserIcon,
  Wallet,
  Banknote,
  Headphones,
  Smartphone,
  ShieldCheck,
  Activity,
  X,
  Loader2,
  CheckCircle2,
  Briefcase,
  HelpCircle,
  Send,
  ChevronRight,
  TrendingUp,
  Zap,
  Play,
  Bell,
} from 'lucide-react';
import { User } from '../types/auth';
import { BrandLogo } from './BrandLogo';
import { api, DepositBankCode, DepositOrder, WithdrawalRecord } from '../services/api';

// Separated Tab Components
import { MarketTab } from './market';
import { TrackTab } from './track';
import { TeamTab } from './team';
import { MeTab } from './me';
import { MyRunnerTab } from './myrunner';
import { MyRecordTab } from './myrecord';
import { AppModal } from './app';
import { MarathonTab } from './marathon';
import { WithdrawTab } from './withdraw';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
}

type NavTab = 'home' | 'market' | 'track' | 'team' | 'marathon' | 'me' | 'myrunners' | 'myrecord';

interface WithdrawalStatusNotification {
  orderId: string;
  status: 'accepted' | 'failed';
}

function getTabFromUrl(): NavTab {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (path.startsWith('/me') || hash.includes('/me') || hash === '#me') return 'me';
  if (path.startsWith('/myrunners') || hash.includes('/myrunners') || hash === '#myrunners') return 'myrunners';
  if (path.startsWith('/myrecord') || hash.includes('/myrecord') || hash === '#myrecord') return 'myrecord';
  if (path.startsWith('/market') || hash.includes('/market') || hash === '#market' || path.startsWith('/graph') || hash.includes('/graph')) return 'market';
  if (path.startsWith('/track') || hash.includes('/track') || hash === '#track' || path.startsWith('/trades') || hash.includes('/trades')) return 'track';
  if (path.startsWith('/team') || hash.includes('/team') || hash === '#team') return 'team';
  if (path.startsWith('/marathon') || hash.includes('/marathon') || hash === '#marathon') return 'marathon';
  return 'home';
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<NavTab>(() => getTabFromUrl());
  const [equippedSneaker, setEquippedSneaker] = useState<string>('Cyber Aero Walker');
  const [withdrawalNotifications, setWithdrawalNotifications] = useState<WithdrawalStatusNotification[]>([]);

  const handleTabSelect = (tab: NavTab) => {
    setActiveTab(tab);
    const targetPath = tab === 'home' ? '/' : `/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modal States
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [openPayoutAccountsSignal, setOpenPayoutAccountsSignal] = useState(0);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);

  // Deposit inputs
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [depositMethod, setDepositMethod] = useState<DepositBankCode>('gcash');
  const [isProcessingDeposit, setIsProcessingDeposit] = useState(false);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);
  const [depositOrder, setDepositOrder] = useState<DepositOrder | null>(null);

  const currentBalance = user.balance ?? 0;
  const currentTotalDeposit = user.totalDeposit ?? 0;
  const handleOpenPayoutAccounts = () => {
    setShowWithdrawModal(false);
    handleTabSelect('me');
    setOpenPayoutAccountsSignal((signal) => signal + 1);
  };
  const getDepositMethodLabel = (method: DepositBankCode) => {
    switch (method) {
      case 'gcash': return 'GCash';
      case 'PMP': return 'Maya';
      case 'GOT': return 'GoTyme';
      case 'qrph': return 'QRPh';
      case 'usdt-trc20': return 'USDT (TRC20)';
    }
  };

  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0 || Math.abs(amt * 100 - Math.round(amt * 100)) > 0.000001) {
      setDepositErrorMsg('Enter a valid amount with no more than two decimal places.');
      return;
    }
    if (amt < 100) {
      setDepositErrorMsg('The minimum deposit is ₱100.');
      return;
    }
    if (depositMethod === 'usdt-trc20' && amt < 800) {
      setDepositErrorMsg('USDT-TRC20 deposits must be at least ₱800.');
      return;
    }

    setDepositErrorMsg(null);
    setDepositOrder(null);
    setIsProcessingDeposit(true);
    try {
      const order = await api.createDeposit(amt, depositMethod);
      setDepositOrder(order);
    } catch (error) {
      setDepositErrorMsg(error instanceof Error ? error.message : 'Could not start the deposit.');
    } finally {
      setIsProcessingDeposit(false);
    }
  };

  useEffect(() => {
    if (!depositOrder || depositOrder.status !== 'pending') return;

    let isActive = true;
    let isChecking = false;
    const checkDepositStatus = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        const status = await api.getDepositStatus(depositOrder.orderId);
        if (!isActive) return;
        setDepositOrder((current) => current?.orderId === status.orderId ? { ...current, ...status } : current);
        if (status.status === 'paid' && status.user) {
          onUpdateUser?.({ ...user, ...status.user });
        }
      } catch (error) {
        console.warn('[Deposit Status Check]', error);
      } finally {
        isChecking = false;
      }
    };

    const intervalId = window.setInterval(() => void checkDepositStatus(), 5000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [depositOrder?.orderId, depositOrder?.status, onUpdateUser, user]);

  useEffect(() => {
    let isActive = true;
    let isChecking = false;
    let hasBaseline = false;
    const previousStatuses = new Map<string, WithdrawalRecord['status']>();

    const checkWithdrawalStatuses = async () => {
      if (!isActive || isChecking || document.visibilityState === 'hidden') return;
      isChecking = true;
      try {
        const withdrawals = await api.getWithdrawalHistory();
        if (!isActive) return;

        const changedWithdrawals: WithdrawalStatusNotification[] = [];
        for (const withdrawal of withdrawals) {
          const previousStatus = previousStatuses.get(withdrawal.orderId);
          if (
            hasBaseline &&
            previousStatus === 'pending' &&
            (withdrawal.status === 'accepted' || withdrawal.status === 'failed')
          ) {
            changedWithdrawals.push({ orderId: withdrawal.orderId, status: withdrawal.status });
          }
          previousStatuses.set(withdrawal.orderId, withdrawal.status);
        }
        hasBaseline = true;

        if (changedWithdrawals.length > 0) {
          setWithdrawalNotifications((current) => {
            const knownOrderIds = new Set(current.map(({ orderId }) => orderId));
            return [
              ...current,
              ...changedWithdrawals.filter(({ orderId }) => !knownOrderIds.has(orderId)),
            ];
          });
          const notificationSound = new Audio('/notif.mp3');
          void notificationSound.play().catch((error: unknown) => {
            console.warn('[Withdrawal Notification Sound]', error);
          });
        }
      } catch (error) {
        console.warn('[Withdrawal Status Check]', error);
      } finally {
        isChecking = false;
      }
    };

    void checkWithdrawalStatuses();
    const intervalId = window.setInterval(() => void checkWithdrawalStatuses(), 10000);
    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [user.id]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#08132B] text-white font-sans select-none">
      
      {/* Scrollable Content Container */}
      <div className="dashboard-scroll w-full flex-1 overflow-y-auto min-h-0 pb-4">

        {/* ---------------------------------------------------- */}
        {/* TOP HERO BRAND BANNER (Stepora Movement Header) */}
        {/* ---------------------------------------------------- */}
        <div className="relative w-full bg-gradient-to-b from-[#091738] via-[#0E2352] to-[#08132B] pt-6 pb-6 px-4 border-b border-[#1E3A78]/50 overflow-hidden">
          {/* Subtle Glow Background Shapes */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute inset-0 bg-tech-grid opacity-15 pointer-events-none" />

          {/* Banner Branding Content */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <BrandLogo size="sm" className="mb-2.5" />
            
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-['Plus_Jakarta_Sans',sans-serif]">
              Stepora Movement
            </h1>
            <p className="text-[10px] sm:text-[11px] text-cyan-300 font-extrabold tracking-wider uppercase mt-0.5">
              MOVE WITH PURPOSE. EARN WITH EVERY STEP.
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

          {/* TAB 1: HOME */}
          {activeTab === 'home' && (
            <div className="space-y-5 animate-fade-in">

              {/* 1. TOTAL DEPOSIT & AVAILABLE BALANCE HEADER CARD */}
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
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Deposit</span>
                  </button>

                  {/* Action 2: Withdraw */}
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Banknote className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Withdraw</span>
                  </button>

                  {/* Action 3: Support */}
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Headphones className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Support</span>
                  </button>

                  {/* Action 4: APP */}
                  <button
                    onClick={() => setShowAppModal(true)}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">APP</span>
                  </button>

                  {/* Action 5: Market */}
                  <button
                    onClick={() => handleTabSelect('market')}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Market</span>
                  </button>

                  {/* Action 6: Track */}
                  <button
                    onClick={() => handleTabSelect('track')}
                    className="bg-white hover:bg-slate-50 text-[#0B1A3D] rounded-2xl p-3.5 flex flex-col items-center justify-center text-center shadow-lg transition-all active:scale-95 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#2459C4] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                      <Footprints className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-[#0B1A3D]">Track</span>
                  </button>
                </div>
              </div>

              {/* 3. FEATURED MOVE-TO-EARN GEAR & WORKOUT SHORTCUT */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block" />
                    <h3 className="text-sm font-extrabold text-white tracking-tight">
                      Equipped Move Gear
                    </h3>
                  </div>
                  <button
                    onClick={() => handleTabSelect('market')}
                    className="text-[10px] font-bold tracking-wider uppercase text-cyan-300 hover:text-white flex items-center gap-1"
                  >
                    <span>VIEW MARKET</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="bg-[#0C1F4A]/80 border border-[#1E3E80]/60 rounded-2xl p-4 shadow-lg relative overflow-hidden flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white p-1.5 flex items-center justify-center flex-shrink-0 shadow-md">
                    <img
                      src="/images/sneaker_cyan.jpg"
                      alt="Cyber Aero Walker"
                      className="w-full h-full object-contain drop-shadow"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-cyan-400/20 text-cyan-300 text-[9px] font-black uppercase">
                        SLOW • LV.1
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                        <Zap className="w-3 h-3" />
                        +₱8.40/km
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white truncate">
                      {equippedSneaker}
                    </h4>
                    <p className="text-[11px] text-blue-200/60 line-clamp-1 mb-2">
                      Optimal pace: 1 - 6 km/h (Walking & Jogging)
                    </p>
                    <button
                      onClick={() => handleTabSelect('track')}
                      className="w-full py-2 bg-[#D8FD2F] hover:bg-[#cbf128] text-black font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-black" />
                      <span>START WORKOUT NOW</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: MARKET (from market.tsx) */}
          {activeTab === 'market' && (
            <MarketTab
              user={user}
              currentBalance={currentBalance}
              onEquipSneaker={(snk) => setEquippedSneaker(snk.name)}
              onUpdateUser={onUpdateUser}
              onNavigateTab={handleTabSelect}
              equippedSneakerId={user.equippedRunnerId}
            />
          )}

          {/* TAB 3: TRACK (from track.tsx) */}
          <div className={activeTab === 'track' ? 'block' : 'hidden'}>
            <TrackTab
              user={user}
              isActiveTab={activeTab === 'track'}
              onNavigateTab={handleTabSelect}
              equippedSneakerName={equippedSneaker}
              onWorkoutFinish={(_earned, runnerIds, settledBalance) => {
                const cooldownUntil = Date.now() + 12 * 60 * 60 * 1000;
                const updatedCooldowns = {
                  ...(user.runnerCooldowns || {}),
                  ...Object.fromEntries(runnerIds.map((runnerId) => [runnerId, cooldownUntil])),
                };
                const updatedUser = { ...user, balance: settledBalance, runnerCooldowns: updatedCooldowns };
                onUpdateUser?.(updatedUser);
                api.updateRunners({ runnerCooldowns: updatedCooldowns })
                  .then((result) => {
                    if (result.user) onUpdateUser?.({ ...updatedUser, ...result.user });
                  })
                  .catch((err) => console.warn('[Workout Cooldown Sync]', err));
              }}
            />
          </div>

          {/* TAB 4: TEAM (from team.tsx) */}
          {activeTab === 'team' && (
            <TeamTab user={user} onNavigateMarathon={() => handleTabSelect('marathon')} />
          )}
          {activeTab === 'marathon' && <MarathonTab user={user} />}

          {activeTab === 'myrunners' && (
            <MyRunnerTab
              user={user}
              onUpdateUser={onUpdateUser}
              onNavigateTab={handleTabSelect}
            />
          )}

          {/* TAB 5: ME (from me.tsx) */}
          {activeTab === 'me' && (
            <MeTab
              user={user}
              onLogout={onLogout}
              onUpdateUser={onUpdateUser}
              onNavigateTab={handleTabSelect}
              openPayoutAccountsSignal={openPayoutAccountsSignal}
              onOpenCustomerService={() => setShowSupportModal(true)}
              onOpenAppModal={() => setShowAppModal(true)}
            />
          )}

          {activeTab === 'myrecord' && (
            <MyRecordTab onBack={() => handleTabSelect('me')} />
          )}

        </div>
      </div>

      {withdrawalNotifications.length > 0 && (
        <div className="fixed left-1/2 top-4 z-[80] w-[min(92vw,420px)] -translate-x-1/2 space-y-3">
          {withdrawalNotifications.map((notification) => (
            <div
              key={notification.orderId}
              role="alert"
              className="rounded-2xl border border-cyan-300/30 bg-[#0b1e43] p-4 shadow-2xl shadow-black/50"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-200">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">
                    Withdrawal {notification.status === 'accepted' ? 'successful' : 'failed'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-blue-100/75">
                    {notification.status === 'accepted'
                      ? 'Your withdrawal has been processed.'
                      : 'Your withdrawal was rejected and the balance has been refunded.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawalNotifications((current) =>
                        current.filter(({ orderId }) => orderId !== notification.orderId),
                      );
                      handleTabSelect('myrecord');
                    }}
                    className="mt-3 rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold text-[#08132B] hover:bg-cyan-200"
                  >
                    View in My Record
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss withdrawal notification"
                  onClick={() => setWithdrawalNotifications((current) =>
                    current.filter(({ orderId }) => orderId !== notification.orderId),
                  )}
                  className="rounded-md p-1 text-blue-100/60 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================================================== */}
      {/* BOTTOM NAVIGATION BAR (HOME MARKET TRACK TEAM ME)        */}
      {/* ======================================================== */}
      <nav
        aria-label="Bottom Navigation"
        className="flex-shrink-0 w-full h-16 bg-[#091738]/95 backdrop-blur-md border-t border-[#1E3A78] flex items-center justify-around z-30 px-1 select-none shadow-2xl"
      >
        {[
          { id: 'home', label: 'HOME', icon: Home },
          { id: 'market', label: 'MARKET', icon: ShoppingBag },
          { id: 'track', label: 'TRACK', icon: Footprints },
          { id: 'team', label: 'TEAM', icon: Users },
          { id: 'me', label: 'ME', icon: UserIcon },
        ].map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id || (id === 'me' && activeTab === 'myrecord');
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleTabSelect(id as NavTab)}
              className={`flex-1 h-full flex flex-col items-center justify-center transition-colors select-none relative ${
                isActive ? 'text-cyan-400' : 'text-blue-200/60 hover:text-blue-100'
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[10px] font-bold tracking-wider mt-1 leading-none uppercase">
                {label}
              </span>
              <span
                className={`w-6 h-0.5 rounded-full mt-1.5 transition-all flex-shrink-0 ${
                  isActive ? 'bg-cyan-400 opacity-100' : 'bg-transparent opacity-0'
                }`}
              />
            </button>
          );
        })}
      </nav>

      {/* MODAL 1: DEPOSIT MODAL */}
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
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-cyan-400 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-white">Deposit Funds</h3>
            </div>

            {depositOrder ? (
              <div className="space-y-3">
                <div className={`p-4 rounded-2xl border text-xs font-bold text-center ${
                  depositOrder.status === 'paid'
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : depositOrder.status === 'failed'
                      ? 'bg-red-500/20 border-red-400/40 text-red-200'
                      : depositOrder.status === 'expired'
                        ? 'bg-slate-500/20 border-slate-400/40 text-slate-200'
                      : 'bg-cyan-500/15 border-cyan-400/30 text-cyan-100'
                }`}>
                  {depositOrder.status === 'paid' ? (
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  ) : (
                    <Wallet className="w-7 h-7 mx-auto mb-2" />
                  )}
                  <div>
                    {depositOrder.status === 'paid'
                      ? 'Payment confirmed. Your account balance has been updated.'
                      : depositOrder.status === 'failed'
                        ? 'This payment was not completed.'
                        : depositOrder.status === 'expired'
                          ? 'This payment link has expired. Start a new deposit to get a fresh payment link.'
                        : depositOrder.message || 'Payment request created. Your balance will update after payment is confirmed.'}
                  </div>
                </div>
                <p className="text-[10px] text-blue-200/70 text-center break-all">
                  Order: {depositOrder.orderId}
                </p>
                {depositOrder.status !== 'expired' && (depositOrder.qrcodeUrl || depositOrder.gcashQrUrl) && (
                  <img
                    src={depositOrder.qrcodeUrl || depositOrder.gcashQrUrl}
                    alt={`${getDepositMethodLabel(depositOrder.bankCode)} deposit QR code`}
                    className="mx-auto max-h-52 max-w-full rounded-xl bg-white p-2"
                  />
                )}
                {depositOrder.status !== 'expired' && (depositOrder.redirectUrl || depositOrder.qrcodeUrl || depositOrder.gcashQrUrl) && (
                  <a
                    href={depositOrder.redirectUrl || depositOrder.qrcodeUrl || depositOrder.gcashQrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 rounded-xl bg-cyan-400 text-center text-[#08132B] font-extrabold text-xs uppercase tracking-wider"
                  >
                    Open {getDepositMethodLabel(depositOrder.bankCode)} payment
                  </a>
                )}
                <p className="text-[10px] leading-4 text-blue-100/70 text-center">
                  This screen checks for confirmation automatically. Do not send a second payment for the same order.
                </p>
                {depositOrder.status !== 'pending' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDepositOrder(null);
                      setDepositErrorMsg(null);
                    }}
                    className="w-full py-2 rounded-xl bg-[#142B5B] text-white font-bold text-xs"
                  >
                    Start another deposit
                  </button>
                )}
              </div>
            ) : (
              <>
              {depositErrorMsg && (
                <div role="alert" className="mb-3 rounded-xl border border-red-400/40 bg-red-500/15 p-3 text-xs font-semibold text-red-200">
                  {depositErrorMsg}
                </div>
              )}
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
                    min={depositMethod === 'usdt-trc20' ? '800' : '100'}
                    step="0.01"
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
                    onChange={(e) => {
                      const method = e.target.value as DepositBankCode;
                      setDepositMethod(method);
                      if (method === 'usdt-trc20' && Number(depositAmount) < 800) setDepositAmount('800');
                    }}
                    className="w-full px-3.5 py-2.5 bg-[#08132B] border border-[#1E3A78] rounded-xl text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="gcash">GCash</option>
                    <option value="PMP">Maya</option>
                    <option value="GOT">GoTyme</option>
                    <option value="qrph">QRPh</option>
                    <option value="usdt-trc20">USDT (TRC20)</option>
                  </select>
                </div>

                {depositMethod === 'usdt-trc20' && (
                  <p className="text-[10px] leading-4 text-amber-200">
                    Minimum deposit is ₱800. Send the exact USDT amount shown on the payment screen in one transfer; wallet fees must not reduce the amount received.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isProcessingDeposit}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-white text-[#08132B] font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                >
                  {isProcessingDeposit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  <span>{isProcessingDeposit ? 'Processing...' : 'Confirm Deposit'}</span>
                </button>
              </form>
              </>
            )}
          </div>
        </div>
      )}

      {showWithdrawModal && (
        <WithdrawTab
          balance={currentBalance}
          onClose={() => setShowWithdrawModal(false)}
          onUpdateBalance={(balance) => onUpdateUser?.({ ...user, balance })}
          onGoToPayoutAccounts={handleOpenPayoutAccounts}
        />
      )}

      {/* MODAL 3: SUPPORT MODAL */}
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
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-cyan-400 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
              <h3 className="text-base font-extrabold text-white">24/7 Member Support</h3>
            </div>

            <p className="text-xs text-blue-200/80 mb-4 leading-relaxed">
              Need assistance with your account, deposits, or trading? Connect directly with our official Stepora customer service representatives.
            </p>

            <div className="space-y-2.5">
              <a
                href="https://t.me/stepm_fun"
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
                href="https://www.facebook.com/steporamovement"
                target="_blank"
                rel="noreferrer"
                className="w-full p-3 rounded-xl bg-[#142B5B] hover:bg-[#1E3A78] border border-[#2459C4]/40 flex items-center justify-between text-xs font-bold text-cyan-300 no-underline transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                  <span>Official Facebook Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: APP DOWNLOAD STORE MODAL (from app.tsx) */}
      <AppModal isOpen={showAppModal} onClose={() => setShowAppModal(false)} />

    </div>
  );
};

export default Dashboard;
