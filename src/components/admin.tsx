import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Activity,
  BadgeCheck,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  KeyRound,
  LoaderCircle,
  LogOut,
  Menu,
  Percent,
  RefreshCw,
  Search,
  ShoppingBag,
  Footprints,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { getApiBaseUrl } from '../services/api';
import type { RunnerPrice, RunnerRules } from '../services/api';

type AdminScreen = 'login' | 'setup' | 'verify' | 'dashboard';
type TransactionType = 'deposit' | 'withdrawal';
type DateRange = '24h' | '7d' | '30d' | 'all';
type AdminRole = 'admin' | 'staff';
type AdminView = 'overview' | TransactionType | 'runner-purchases' | 'profile' | 'security' | 'staff-team' | 'runner-pricing' | 'runner';

interface AdminTransaction {
  id: string;
  type: TransactionType;
  status: string;
  amount: number;
  method: string;
  createdAt: string;
  userId: string;
  username: string;
  phoneNumber: string;
  steporaId: string;
  fee?: number;
  payoutAmount?: number;
  totalDeducted?: number;
  accountHolder?: string;
  accountNumber?: string;
  referenceNo?: string;
}

interface AdminTeamMember {
  email: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  createdAt: string;
}

interface AdminRunnerPurchase {
  id: string;
  runnerName: string;
  serial: string;
  createdAt: string;
  amount: number;
  username: string;
  phoneNumber: string;
  steporaId: string;
}

interface AdminUserProfile {
  username: string;
  userId: string;
  steporaId: string;
  status: string;
  ownedRunners: Array<{ id: string; runnerId: string; serial: string; purchasedAt: number }>;
  transactions: Array<{
    id: string;
    type: 'deposit' | 'withdrawal';
    status: string;
    amount: number;
    createdAt: string;
    method: string;
  }>;
  activeWorkout: {
    status: string;
    isTracking: boolean;
    isPaused: boolean;
    pendingFinish: boolean;
    distanceKm: number;
    elapsedSeconds: number;
    tokensEarned: number;
    lastUpdated: number;
  } | null;
  pastTracks: Array<{
    id: string;
    startedAt: string;
    completedAt: string;
    distanceKm: number;
    earned: number;
    claimed: boolean;
  }>;
}

interface AdminActiveWorkout {
  userId: string;
  username: string;
  steporaId: string;
  status: string;
  isTracking: boolean;
  isPaused: boolean;
  pendingFinish: boolean;
  distanceKm: number;
  elapsedSeconds: number;
  tokensEarned: number;
  lastUpdated: number;
}

interface AdminApiResponse {
  success: boolean;
  message?: string;
}

const SESSION_KEY = 'stepora_admin_session';
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const runnerNames: Record<string, string> = {
  'snk-1': 'Cyber Aero Walker',
  'snk-2': 'Bio Surge Trainer',
  'snk-3': 'Cobalt Aero Jogger',
  'snk-4': 'Vortex Blaze Sprint',
};

async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const result = await response.json().catch(() => null) as (AdminApiResponse & T) | null;
  if (!response.ok || !result?.success) {
    throw new Error(result?.message || `Request failed (${response.status}).`);
  }
  return result as T;
}

function isSuccessfulStatus(status: string): boolean {
  return ['paid', 'completed', 'success', 'successful'].includes(status.toLowerCase());
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const style = isSuccessfulStatus(normalized)
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : ['failed', 'rejected', 'cancelled', 'expired'].includes(normalized)
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function TrendChart({ transactions }: { transactions: AdminTransaction[] }) {
  const series = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return { date, deposits: 0, withdrawals: 0 };
    });

    for (const transaction of transactions) {
      const timestamp = Date.parse(transaction.createdAt);
      if (!Number.isFinite(timestamp)) continue;
      const bucket = days.find((day, index) => {
        const nextDay = days[index + 1]?.date.getTime() ?? Date.now() + 86_400_000;
        return timestamp >= day.date.getTime() && timestamp < nextDay;
      });
      if (!bucket) continue;
      if (transaction.type === 'deposit') bucket.deposits += transaction.amount;
      else bucket.withdrawals += transaction.amount;
    }

    const max = Math.max(1, ...days.flatMap((day) => [day.deposits, day.withdrawals]));
    return days.map((day, index) => ({
      ...day,
      x: 40 + index * 100,
      depositY: 166 - (day.deposits / max) * 130,
      withdrawalY: 166 - (day.withdrawals / max) * 130,
    }));
  }, [transactions]);

  const depositPath = series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.depositY}`).join(' ');
  const withdrawalPath = series.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.withdrawalY}`).join(' ');

  return (
    <div className="min-w-0 rounded-xl border border-[#1e3a78] bg-[#081b3d] p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Transaction volume</h3>
          <p className="mt-1 text-[11px] text-[#817c79]">Last 7 days · PHP</p>
        </div>
        <ChartNoAxesCombined className="h-4 w-4 text-[#f15408]" />
      </div>
      <svg className="h-48 w-full overflow-visible" viewBox="0 0 680 210" role="img" aria-label="Deposit and withdrawal volume over the last seven days">
        {[36, 79, 122, 165].map((y) => (
          <line key={y} x1="40" x2="640" y1={y} y2={y} stroke="#352a26" strokeDasharray="4 5" />
        ))}
        <path d={depositPath} fill="none" stroke="#15965b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <path d={withdrawalPath} fill="none" stroke="#ef4b05" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((point) => (
          <text key={point.date.toISOString()} x={point.x} y="195" textAnchor="middle" fill="#817c79" fontSize="10">
            {point.date.toLocaleDateString(undefined, { weekday: 'short' })}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex justify-center gap-5 text-xs">
        <span className="flex items-center gap-2 text-emerald-400"><i className="h-2 w-2 rounded-full bg-emerald-500" />Deposits</span>
        <span className="flex items-center gap-2 text-orange-500"><i className="h-2 w-2 rounded-full bg-orange-500" />Withdrawals</span>
      </div>
    </div>
  );
}

export const Admin: React.FC = () => {
  const [screen, setScreen] = useState<AdminScreen>(() => sessionStorage.getItem(SESSION_KEY) ? 'dashboard' : 'login');
  const [stageToken, setStageToken] = useState('');
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualEntryKey, setManualEntryKey] = useState('');
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [runnerPurchases, setRunnerPurchases] = useState<AdminRunnerPurchase[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<AdminTeamMember[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(false);
  const [teamRefreshKey, setTeamRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [depositUserIdSearch, setDepositUserIdSearch] = useState('');
  const [withdrawalUserIdSearch, setWithdrawalUserIdSearch] = useState('');
  const [runnerPurchaseUserIdSearch, setRunnerPurchaseUserIdSearch] = useState('');
  const [profileSearchInput, setProfileSearchInput] = useState('');
  const [profileLookupId, setProfileLookupId] = useState('');
  const [userProfile, setUserProfile] = useState<AdminUserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [activeWorkouts, setActiveWorkouts] = useState<AdminActiveWorkout[]>([]);
  const [isLoadingActiveWorkouts, setIsLoadingActiveWorkouts] = useState(false);
  const [activeWorkoutsError, setActiveWorkoutsError] = useState('');
  const [profileRefreshKey, setProfileRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordCode, setPasswordCode] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState<AdminRole>('staff');
  const [staffPassword, setStaffPassword] = useState('');
  const [confirmStaffPassword, setConfirmStaffPassword] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [reviewingWithdrawalId, setReviewingWithdrawalId] = useState('');
  const [withdrawalReferenceNumbers, setWithdrawalReferenceNumbers] = useState<Record<string, string>>({});
  const [runnerPrices, setRunnerPrices] = useState<Record<string, RunnerPrice>>({});
  const [selectedPriceRunner, setSelectedPriceRunner] = useState('snk-1');
  const [originalPriceInput, setOriginalPriceInput] = useState('500');
  const [newPriceInput, setNewPriceInput] = useState('500');
  const [discountInput, setDiscountInput] = useState('0');
  const [isLoadingRunnerPrices, setIsLoadingRunnerPrices] = useState(false);
  const [isSavingRunnerPrice, setIsSavingRunnerPrice] = useState(false);
  const [runnerRules, setRunnerRules] = useState<RunnerRules | null>(null);
  const [selectedRuleRunner, setSelectedRuleRunner] = useState('snk-1');
  const [runnerEarningInput, setRunnerEarningInput] = useState('8.4');
  const [runnerKmLimitInput, setRunnerKmLimitInput] = useState('6');
  const [runnerHealthLimitInput, setRunnerHealthLimitInput] = useState('10');
  const [isLoadingRunnerRules, setIsLoadingRunnerRules] = useState(false);
  const [isSavingRunnerRule, setIsSavingRunnerRule] = useState(false);
  const [grantRunnerUserId, setGrantRunnerUserId] = useState('');
  const [grantRunnerType, setGrantRunnerType] = useState('snk-1');
  const [isGrantingRunner, setIsGrantingRunner] = useState(false);

  const loadTransactions = async (token: string) => {
    const result = await adminRequest<{
      transactions: AdminTransaction[];
      runnerPurchases: AdminRunnerPurchase[];
      registeredUsers: number;
      email: string;
      role: AdminRole;
    }>('/api/admin/transactions', { method: 'GET' }, token);
    setTransactions(result.transactions);
    setRunnerPurchases(result.runnerPurchases);
    setRegisteredUsers(result.registeredUsers);
    setEmail(result.email);
    setRole(result.role);
  };

  useEffect(() => {
    if (!sessionToken) return;
    let isCurrent = true;
    setIsLoading(true);
    adminRequest<{
      transactions: AdminTransaction[];
      runnerPurchases: AdminRunnerPurchase[];
      registeredUsers: number;
      email: string;
      role: AdminRole;
    }>('/api/admin/transactions', { method: 'GET' }, sessionToken)
      .then((result) => {
        if (isCurrent) {
          setTransactions(result.transactions);
          setRunnerPurchases(result.runnerPurchases);
          setRegisteredUsers(result.registeredUsers);
          setEmail(result.email);
          setRole(result.role);
        }
      })
      .catch((loadError: unknown) => {
        if (!isCurrent) return;
        sessionStorage.removeItem(SESSION_KEY);
        setSessionToken('');
        setScreen('login');
        setError(loadError instanceof Error ? loadError.message : 'Could not restore administrator session.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || role !== 'admin' || activeView !== 'staff-team') return;
    let isCurrent = true;
    setIsLoadingTeam(true);
    adminRequest<{ accounts: AdminTeamMember[] }>('/api/admin/accounts', { method: 'GET' }, sessionToken)
      .then((result) => {
        if (isCurrent) setTeamMembers(result.accounts);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load the staff team.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingTeam(false);
      });
    return () => { isCurrent = false; };
  }, [activeView, role, sessionToken, teamRefreshKey]);

  useEffect(() => {
    if (!sessionToken || role !== 'admin' || activeView !== 'runner-pricing') return;
    let isCurrent = true;
    setIsLoadingRunnerPrices(true);
    adminRequest<{ prices: Record<string, RunnerPrice> }>('/api/admin/runner-prices', { method: 'GET' }, sessionToken)
      .then((result) => {
        if (isCurrent) {
          setRunnerPrices(result.prices);
          setOriginalPriceInput(String(result.prices[selectedPriceRunner]?.originalPrice ?? 500));
          setNewPriceInput(String(result.prices[selectedPriceRunner]?.newPrice ?? 500));
          setDiscountInput(String(result.prices[selectedPriceRunner]?.discountPercentage ?? 0));
        }
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load runner prices.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingRunnerPrices(false);
      });
    return () => { isCurrent = false; };
  }, [activeView, role, sessionToken]);

  useEffect(() => {
    if (!sessionToken || role !== 'admin' || activeView !== 'runner') return;
    let isCurrent = true;
    setIsLoadingRunnerRules(true);
    adminRequest<{ rules: RunnerRules }>('/api/admin/runner-rules', { method: 'GET' }, sessionToken)
      .then((result) => {
        if (!isCurrent) return;
        setRunnerRules(result.rules);
        setRunnerEarningInput(String(result.rules[selectedRuleRunner as keyof RunnerRules].earningRate));
        setRunnerKmLimitInput(String(result.rules[selectedRuleRunner as keyof RunnerRules].kmLimitPerDay));
        setRunnerHealthLimitInput(String(result.rules[selectedRuleRunner as keyof RunnerRules].healthLimit));
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Could not load Runner settings.');
      })
      .finally(() => {
        if (isCurrent) setIsLoadingRunnerRules(false);
      });
    return () => { isCurrent = false; };
  }, [activeView, role, sessionToken]);

  useEffect(() => {
    if (!sessionToken || activeView !== 'profile' || !profileLookupId) return;
    let isCurrent = true;
    const loadProfile = async (showLoading: boolean) => {
      if (showLoading) setIsLoadingProfile(true);
      try {
        const result = await adminRequest<{ profile: AdminUserProfile }>(
          `/api/admin/users/${encodeURIComponent(profileLookupId)}`,
          { method: 'GET' },
          sessionToken,
        );
        if (isCurrent) {
          setUserProfile(result.profile);
          setProfileError('');
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setProfileError(loadError instanceof Error ? loadError.message : 'Could not load this user profile.');
        }
      } finally {
        if (isCurrent && showLoading) setIsLoadingProfile(false);
      }
    };

    setUserProfile(null);
    setProfileError('');
    void loadProfile(true);
    const intervalId = window.setInterval(() => void loadProfile(false), 5000);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [activeView, profileLookupId, profileRefreshKey, sessionToken]);

  useEffect(() => {
    if (!sessionToken || role !== 'admin' || activeView !== 'profile') return;
    let isCurrent = true;
    const loadActiveWorkouts = async (showLoading: boolean) => {
      if (showLoading) setIsLoadingActiveWorkouts(true);
      try {
        const result = await adminRequest<{ activeWorkouts: AdminActiveWorkout[] }>(
          '/api/admin/active-workouts',
          { method: 'GET' },
          sessionToken,
        );
        if (isCurrent) {
          setActiveWorkouts(result.activeWorkouts);
          setActiveWorkoutsError('');
        }
      } catch (loadError: unknown) {
        if (isCurrent) {
          setActiveWorkoutsError(loadError instanceof Error ? loadError.message : 'Could not load active workouts.');
        }
      } finally {
        if (isCurrent && showLoading) setIsLoadingActiveWorkouts(false);
      }
    };

    void loadActiveWorkouts(true);
    const intervalId = window.setInterval(() => void loadActiveWorkouts(false), 5000);
    return () => {
      isCurrent = false;
      window.clearInterval(intervalId);
    };
  }, [activeView, role, sessionToken]);

  const filteredTransactions = useMemo(() => {
    const now = Date.now();
    const rangeMs: Record<Exclude<DateRange, 'all'>, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return transactions.filter((transaction) => {
      if (activeView !== 'overview' && activeView !== 'security' && activeView !== 'staff-team' && activeView !== 'runner-purchases' && transaction.type !== activeView) return false;
      if (dateRange === 'all') return true;
      const timestamp = Date.parse(transaction.createdAt);
      return Number.isFinite(timestamp) && timestamp >= now - rangeMs[dateRange];
    });
  }, [activeView, dateRange, transactions]);

  const filteredRunnerPurchases = useMemo(() => {
    if (dateRange === 'all') return runnerPurchases;
    const now = Date.now();
    const rangeMs: Record<Exclude<DateRange, 'all'>, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return runnerPurchases.filter((purchase) => {
      const timestamp = Date.parse(purchase.createdAt);
      return Number.isFinite(timestamp) && timestamp >= now - rangeMs[dateRange];
    });
  }, [dateRange, runnerPurchases]);

  const deposits = filteredTransactions.filter((transaction) => transaction.type === 'deposit');
  const withdrawals = filteredTransactions.filter((transaction) => transaction.type === 'withdrawal');
  const visibleDeposits = deposits.filter((transaction) =>
    transaction.steporaId.toLowerCase().includes(depositUserIdSearch.trim().toLowerCase()),
  );
  const visibleWithdrawals = withdrawals.filter((transaction) =>
    transaction.steporaId.toLowerCase().includes(withdrawalUserIdSearch.trim().toLowerCase()),
  );
  const visibleRunnerPurchases = filteredRunnerPurchases.filter((purchase) =>
    purchase.steporaId.toLowerCase().includes(runnerPurchaseUserIdSearch.trim().toLowerCase()),
  );
  const paidDeposits = deposits.filter((transaction) => isSuccessfulStatus(transaction.status));
  const successfulWithdrawals = withdrawals.filter((transaction) => isSuccessfulStatus(transaction.status));
  const depositTotal = paidDeposits.reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawalTotal = successfulWithdrawals.reduce((sum, transaction) => sum + transaction.amount, 0);

  const startLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      const result = await adminRequest<{ stageToken: string; needsSetup: boolean }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setStageToken(result.stageToken);
      setPassword('');
      if (result.needsSetup) {
        const setup = await adminRequest<{ qrCodeDataUrl: string; manualEntryKey: string }>(
          '/api/admin/auth/totp/setup',
          { method: 'POST' },
          result.stageToken,
        );
        setQrCodeDataUrl(setup.qrCodeDataUrl);
        setManualEntryKey(setup.manualEntryKey);
        setScreen('setup');
      } else {
        setScreen('verify');
      }
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Administrator sign-in failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await adminRequest<{ token: string; email: string; role: AdminRole }>('/api/admin/auth/totp/verify', {
        method: 'POST',
        body: JSON.stringify({ code, setup: screen === 'setup' }),
      }, stageToken);
      sessionStorage.setItem(SESSION_KEY, result.token);
      setSessionToken(result.token);
      setEmail(result.email);
      setRole(result.role);
      setCode('');
      setScreen('dashboard');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Authenticator verification failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTransactions = async () => {
    if (!sessionToken) return;
    setError('');
    setIsRefreshing(true);
    try {
      await loadTransactions(sessionToken);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh transactions.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReviewWithdrawal = async (
    orderId: string,
    decision: 'accept' | 'reject',
    referenceNo = '',
  ) => {
    const action = decision === 'accept' ? 'accept' : 'reject and refund';
    if (!sessionToken || !window.confirm(`Are you sure you want to ${action} withdrawal ${orderId}?`)) return;
    setError('');
    setNotice('');
    setReviewingWithdrawalId(orderId);
    try {
      const result = await adminRequest<{ message: string }>(
        `/api/admin/withdrawals/${encodeURIComponent(orderId)}/review`,
        { method: 'PUT', body: JSON.stringify({ decision, referenceNo }) },
        sessionToken,
      );
      setNotice(result.message);
      await loadTransactions(sessionToken);
    } catch (reviewError) {
      const message = reviewError instanceof Error ? reviewError.message : 'Could not review this withdrawal.';
      setError(message);
      try {
        await loadTransactions(sessionToken);
      } catch (refreshError) {
        const refreshMessage = refreshError instanceof Error ? refreshError.message : 'Could not refresh transactions.';
        setError(`${message} ${refreshMessage}`);
      }
    } finally {
      setReviewingWithdrawalId('');
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmNewPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    try {
      await adminRequest<{ message: string }>('/api/admin/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword, code: passwordCode }),
      }, sessionToken);
      sessionStorage.removeItem(SESSION_KEY);
      setSessionToken('');
      setStageToken('');
      setPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordCode('');
      setEmail('');
      setRole(null);
      setScreen('login');
      setActiveView('overview');
      setNotice('Password changed successfully. Sign in again with your new password.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not change the password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const createAccount = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (staffPassword !== confirmStaffPassword) {
      setError('The account passwords do not match.');
      return;
    }
    setIsCreatingAccount(true);
    try {
      const result = await adminRequest<{ message: string }>('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify({
          email: staffEmail,
          password: staffPassword,
          role: staffRole,
          code: staffCode,
        }),
      }, sessionToken);
      setNotice(result.message);
      setStaffEmail('');
      setStaffPassword('');
      setConfirmStaffPassword('');
      setStaffCode('');
      setStaffRole('staff');
    } catch (accountError) {
      setError(accountError instanceof Error ? accountError.message : 'Could not create the account.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const saveRunnerPrice = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const originalPrice = Number(originalPriceInput);
    const newPrice = Number(newPriceInput);
    const discountPercentage = Number(discountInput);
    if (!Number.isFinite(originalPrice) || originalPrice <= 0) {
      setError('Original price must be greater than ₱0.');
      return;
    }
    if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice > originalPrice) {
      setError('New price must be between ₱0 and the original price.');
      return;
    }
    if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
      setError('Discount must be between 0% and 100%.');
      return;
    }
    const expectedDiscount = originalPrice > 0
      ? Math.round((1 - newPrice / originalPrice) * 1_000_000) / 10_000
      : 0;
    setIsSavingRunnerPrice(true);
    try {
      const result = await adminRequest<{ prices?: Record<string, RunnerPrice>; message?: string }>(
        '/api/admin/runner-prices',
        {
          method: 'PUT',
          body: JSON.stringify({
            runnerId: selectedPriceRunner,
            originalPrice,
            newPrice,
            discountPercentage: expectedDiscount,
          }),
        },
        sessionToken,
      );
      const savedPrice = result.prices?.[selectedPriceRunner];
      if (
        !result.prices ||
        !savedPrice ||
        Math.abs(savedPrice.originalPrice - originalPrice) > 0.01 ||
        Math.abs(savedPrice.newPrice - newPrice) > 0.01
      ) {
        throw new Error('The pricing API is outdated and did not save the entered amounts. Restart the local server or deploy the latest backend, then try again.');
      }
      setRunnerPrices(result.prices);
      setOriginalPriceInput(String(savedPrice.originalPrice));
      setNewPriceInput(String(savedPrice.newPrice));
      setDiscountInput(String(savedPrice.discountPercentage));
      setNotice(result.message || 'Runner price updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update this runner price.');
    } finally {
      setIsSavingRunnerPrice(false);
    }
  };

  const saveRunnerRule = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const earningRate = Number(runnerEarningInput);
    const kmLimitPerDay = Number(runnerKmLimitInput);
    const healthLimit = Number(runnerHealthLimitInput);
    if (!Number.isFinite(earningRate) || earningRate < 0 || !Number.isFinite(kmLimitPerDay) || kmLimitPerDay <= 0 ||
      !Number.isInteger(healthLimit) || healthLimit < 1 || healthLimit > 1000) {
      setError('Enter a valid earning rate, positive daily distance limit, and whole-number health limit.');
      return;
    }
    setIsSavingRunnerRule(true);
    try {
      const result = await adminRequest<{ rules: RunnerRules; message?: string }>('/api/admin/runner-rules', {
        method: 'PUT',
        body: JSON.stringify({ runnerId: selectedRuleRunner, earningRate, kmLimitPerDay, healthLimit }),
      }, sessionToken);
      setRunnerRules(result.rules);
      setNotice(result.message || 'Runner settings updated successfully.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update Runner settings.');
    } finally {
      setIsSavingRunnerRule(false);
    }
  };

  const grantRunner = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const userId = grantRunnerUserId.trim();
    if (!userId) {
      setError('Enter the user account ID.');
      return;
    }
    setIsGrantingRunner(true);
    try {
      const result = await adminRequest<{ message: string }>('/api/admin/runners/grant', {
        method: 'POST',
        body: JSON.stringify({ steporaId: userId, runnerId: grantRunnerType }),
      }, sessionToken);
      setNotice(result.message);
      setGrantRunnerUserId('');
    } catch (grantError) {
      setError(grantError instanceof Error ? grantError.message : 'Could not give this Runner to the user.');
    } finally {
      setIsGrantingRunner(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionToken('');
    setStageToken('');
    setTransactions([]);
    setRunnerPurchases([]);
    setRegisteredUsers(null);
    setUserProfile(null);
    setProfileLookupId('');
    setActiveWorkouts([]);
    setEmail('');
    setActiveView('overview');
    setRole(null);
    setScreen('login');
    setError('');
  };

  if (screen !== 'dashboard') {
    const isSetup = screen === 'setup';
    const isVerify = screen === 'verify';
    return (
      <div className="min-h-screen bg-[#010f30] px-4 py-10 text-white sm:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center">
          <div className="mb-7 flex items-center gap-3">
            <img src="/logo.png" alt="Stepora Movement logo" className="h-12 w-12 rounded-xl border border-cyan-300/30 object-cover shadow-lg shadow-blue-950/50" />
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">Stepora Movement</div>
              <h1 className="mt-1 text-xl font-bold text-white">Administrator portal</h1>
            </div>
          </div>

          <section className="rounded-2xl border border-[#1e3a78] bg-[#081b3d] p-6 shadow-2xl shadow-blue-950/40 sm:p-8">
            {isSetup ? (
              <>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6923]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Secure your admin account</h2>
                <p className="mt-2 text-sm leading-6 text-[#aaa3a0]">
                  Scan this one-time QR code with Google Authenticator, then enter the current six-digit code to finish setup.
                </p>
                <div className="mx-auto my-6 w-fit rounded-xl bg-white p-3">
                  {qrCodeDataUrl ? (
                    <img className="h-52 w-52" src={qrCodeDataUrl} alt="Authenticator setup QR code" />
                  ) : (
                    <div className="grid h-52 w-52 place-items-center text-sm text-slate-500">QR code unavailable</div>
                  )}
                </div>
                <details className="mb-5 rounded-lg border border-[#24466f] px-3 py-2 text-xs text-[#c5bcb7]">
                  <summary className="cursor-pointer font-semibold">Can’t scan? Enter the setup key manually</summary>
                  <code className="mt-2 block break-all font-mono text-orange-200">{manualEntryKey}</code>
                </details>
              </>
            ) : isVerify ? (
              <>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6923]">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Two-factor verification</h2>
                <p className="mt-2 text-sm leading-6 text-[#aaa3a0]">
                  Enter the six-digit code currently shown in Google Authenticator.
                </p>
              </>
            ) : (
              <>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 text-[#ff6923]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Sign in securely</h2>
                <p className="mt-2 text-sm leading-6 text-[#aaa3a0]">
                  Admin and staff access requires your email, password, and an authenticator code.
                </p>
              </>
            )}

            {isSetup || isVerify ? (
              <form onSubmit={verifyCode} className="space-y-4">
                <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor="admin-totp-code">Authenticator code</label>
                <input
                  id="admin-totp-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-[#24466f] bg-[#06132e] px-4 py-3 text-center font-mono text-xl tracking-[0.45em] text-white outline-none focus:border-cyan-300"
                />
                {error && <p role="alert" className="text-xs font-medium text-rose-300">{error}</p>}
                <button
                  disabled={isLoading || code.length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e94f08] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ff6418] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {isSetup ? 'Enable two-factor authentication' : 'Verify and continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={startLogin} className="mt-6 space-y-4">
                {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">{notice}</p>}
                <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your admin or staff email"
                  className="w-full rounded-xl border border-[#24466f] bg-[#06132e] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                />
                <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[#24466f] bg-[#06132e] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                />
                {error && <p role="alert" className="text-xs font-medium text-rose-300">{error}</p>}
                <button
                  disabled={isLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#e94f08] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#ff6418] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Continue to secure sign-in
                </button>
              </form>
            )}
            <p className="mt-6 text-center text-[10px] leading-5 text-[#817c79]">
              Protected administrator access · Never share your authenticator code
            </p>
          </section>
        </div>
      </div>
    );
  }

  const rangeLabels: Array<{ id: DateRange; label: string }> = [
    { id: '24h', label: 'Last 24h' },
    { id: '7d', label: 'Last 7d' },
    { id: '30d', label: 'Last 30d' },
    { id: 'all', label: 'All time' },
  ];

  return (
    <div className="flex min-h-screen bg-[#010f30] text-[#f8f6f4]">
      <aside className={`${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-30 flex w-[76px] flex-col items-center border-r border-[#1e3a78] bg-[#071735] py-4 transition-transform md:static md:translate-x-0`}>
        <img src="/logo.png" alt="Stepora Movement logo" className="mb-8 h-10 w-10 rounded-lg border border-cyan-300/30 object-cover" />
        <nav aria-label="Admin navigation" className="flex flex-1 flex-col gap-3">
          {[
            { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
            { id: 'deposit' as const, label: 'Deposits', icon: ArrowDownLeft },
            { id: 'withdrawal' as const, label: 'Withdrawals', icon: ArrowUpRight },
            { id: 'runner-purchases' as const, label: 'Runner purchases', icon: ShoppingBag },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              title={label}
              aria-label={label}
              onClick={() => { setActiveView(id); setMobileNavOpen(false); }}
              className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === id ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
          {role === 'admin' && (
            <>
              <div className="mt-3 h-px w-8 bg-[#24466f]" />
              <button
                title="Runner"
                aria-label="Runner"
                onClick={() => { setActiveView('runner'); setMobileNavOpen(false); }}
                className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === 'runner' ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
              >
                <Footprints className="h-5 w-5" />
              </button>
              <button
                title="Runner prices"
                aria-label="Runner prices"
                onClick={() => { setActiveView('runner-pricing'); setMobileNavOpen(false); }}
                className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === 'runner-pricing' ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
              >
                <Percent className="h-5 w-5" />
              </button>
              <button
                title="User profile"
                aria-label="User profile"
                onClick={() => { setActiveView('profile'); setMobileNavOpen(false); }}
                className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === 'profile' ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
              >
                <UserRound className="h-5 w-5" />
              </button>
              <button
                title="Staff team"
                aria-label="Staff team"
                onClick={() => { setActiveView('staff-team'); setMobileNavOpen(false); }}
                className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === 'staff-team' ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
              >
                <Users className="h-5 w-5" />
              </button>
              <button
                title="Security and accounts"
                aria-label="Security and accounts"
                onClick={() => { setActiveView('security'); setMobileNavOpen(false); }}
                className={`grid h-11 w-11 place-items-center rounded-xl border-l-[3px] transition ${activeView === 'security' ? 'border-cyan-300 bg-[#142b5b] text-cyan-200' : 'border-transparent text-[#c5bfbb] hover:bg-[#10234a]'}`}
              >
                <ShieldCheck className="h-5 w-5" />
              </button>
            </>
          )}
          <div className="mt-3 h-px w-8 bg-[#24466f]" />
        </nav>
        <span className="text-[10px] font-semibold text-[#817c79]">v1.0.0</span>
      </aside>

      {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-20 bg-black/60 md:hidden" />}

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-[62px] items-center justify-between border-b border-[#1e3a78] bg-[#071735]/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-4">
            <button className="rounded-md border border-[#24466f] p-1.5 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm font-semibold">
              {activeView === 'overview' ? <LayoutDashboard className="h-4 w-4 text-[#f15408]" /> : activeView === 'security' ? <ShieldCheck className="h-4 w-4 text-[#f15408]" /> : activeView === 'staff-team' ? <Users className="h-4 w-4 text-cyan-300" /> : activeView === 'runner-purchases' ? <ShoppingBag className="h-4 w-4 text-[#f15408]" /> : activeView === 'runner' ? <Footprints className="h-4 w-4 text-cyan-300" /> : activeView === 'runner-pricing' ? <Percent className="h-4 w-4 text-cyan-300" /> : activeView === 'profile' ? <UserRound className="h-4 w-4 text-[#f15408]" /> : <ArrowLeftRight className="h-4 w-4 text-[#f15408]" />}
              {activeView === 'overview' ? 'Dashboard' : activeView === 'security' ? 'Security & accounts' : activeView === 'staff-team' ? 'Staff team' : activeView === 'deposit' ? 'Deposits' : activeView === 'withdrawal' ? 'Withdrawals' : activeView === 'runner-purchases' ? 'Runner purchases' : activeView === 'runner' ? 'Runner' : activeView === 'runner-pricing' ? 'Runner prices' : 'User profile'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-md border border-[#24466f] px-3 py-2 text-[11px] sm:block">
              <span className="text-[#c5bfbb]">Total deposits: </span>
              <strong className="text-emerald-400">{currency.format(depositTotal)}</strong>
            </div>
            <div className="hidden items-center gap-2 text-xs sm:flex">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[#142b5b] text-cyan-200"><ShieldCheck className="h-4 w-4" /></span>
              <span className="max-w-[150px] truncate">{email}</span>
              {role && <span className="rounded-full bg-[#142b5b] px-2 py-1 text-[9px] font-bold uppercase text-cyan-200">{role}</span>}
              <ChevronDown className="h-3 w-3 text-[#948c87]" />
            </div>
            <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-lg p-2 text-[#c5bfbb] hover:bg-[#10234a] hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-7">
          {error && (
            <div role="alert" className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="Dismiss error" className="ml-4 text-lg leading-none">×</button>
            </div>
          )}

          {notice && (
            <div role="status" className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss notice" className="ml-4 text-lg leading-none">×</button>
            </div>
          )}

          {activeView !== 'security' && activeView !== 'staff-team' && activeView !== 'profile' && activeView !== 'runner-pricing' && activeView !== 'runner' && <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {rangeLabels.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setDateRange(id)}
                  className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${dateRange === id ? 'border-cyan-300 bg-[#142b5b] text-white' : 'border-[#24466f] bg-[#081b3d] text-[#c0b8b3] hover:border-cyan-300'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 text-[11px] text-[#99908b] sm:flex"><CalendarDays className="h-3.5 w-3.5" /> Created time</span>
              <button
                onClick={() => void refreshTransactions()}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-lg border border-[#24466f] bg-[#10234a] px-3 py-2 text-xs font-semibold text-white hover:border-cyan-300 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>}

          {activeView === 'security' && role === 'admin' && (
            <section className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400"><KeyRound className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-base font-bold">Change your password</h2>
                    <p className="mt-1 text-xs text-[#99908b]">Requires your current password and a fresh authenticator code.</p>
                  </div>
                </div>
                <form onSubmit={changePassword} className="space-y-3">
                  <PasswordField id="current-admin-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
                  <PasswordField id="new-admin-password" label="New password (12+ characters)" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={12} />
                  <PasswordField id="confirm-admin-password" label="Confirm new password" value={confirmNewPassword} onChange={setConfirmNewPassword} autoComplete="new-password" minLength={12} />
                  <CodeField id="password-change-code" value={passwordCode} onChange={setPasswordCode} />
                  <p className="text-[10px] leading-4 text-[#8f8985]">Authenticator codes can only be used once. Wait for a new code after signing in before confirming this change.</p>
                  <button disabled={isChangingPassword} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e94f08] px-4 py-3 text-sm font-bold text-white hover:bg-[#ff6418] disabled:opacity-50">
                    {isChangingPassword && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Update password
                  </button>
                </form>
              </div>

              <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400"><UserPlus className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-base font-bold">Create an admin or staff account</h2>
                    <p className="mt-1 text-xs text-[#99908b]">The new account will enroll Google Authenticator at first sign-in.</p>
                  </div>
                </div>
                <form onSubmit={createAccount} className="space-y-3">
                  <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor="new-account-email">Gmail / email</label>
                  <input id="new-account-email" type="email" required maxLength={254} autoComplete="off" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="person@gmail.com" className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" />
                  <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor="new-account-role">Account role</label>
                  <select id="new-account-role" value={staffRole} onChange={(event) => setStaffRole(event.target.value as AdminRole)} className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300">
                    <option value="staff">Staff — view transactions only</option>
                    <option value="admin">Admin — manage accounts and security</option>
                  </select>
                  <PasswordField id="new-account-password" label="Initial password (12+ characters)" value={staffPassword} onChange={setStaffPassword} autoComplete="new-password" minLength={12} />
                  <PasswordField id="confirm-account-password" label="Confirm initial password" value={confirmStaffPassword} onChange={setConfirmStaffPassword} autoComplete="new-password" minLength={12} />
                  <CodeField id="create-account-code" value={staffCode} onChange={setStaffCode} />
                  <p className="text-[10px] leading-4 text-[#8f8985]">Enter a fresh code from your authenticator to confirm account creation. The new account will set up its own authenticator at first sign-in.</p>
                  <button disabled={isCreatingAccount} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#27508d] bg-[#10234a] px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-[#142b5b] disabled:opacity-50">
                    {isCreatingAccount && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Create account
                  </button>
                </form>
              </div>
            </section>
          )}

          {activeView === 'staff-team' && role === 'admin' && (
            <section className="overflow-hidden rounded-xl border border-[#1e3a78] bg-[#081b3d]">
              <div className="flex items-center justify-between gap-3 border-b border-[#1e3a78] px-4 py-4 sm:px-5">
                <div>
                  <h2 className="text-sm font-bold text-white">Staff team</h2>
                  <p className="mt-1 text-[11px] text-[#8f9fba]">Registered administrator and staff accounts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setTeamRefreshKey((key) => key + 1)}
                  disabled={isLoadingTeam}
                  className="flex items-center gap-2 rounded-lg border border-[#24466f] bg-[#10234a] px-3 py-2 text-xs font-semibold text-white hover:border-cyan-300 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTeam ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-[#06132e] text-[10px] uppercase tracking-wider text-[#8f9fba]">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Email</th>
                      <th className="px-5 py-3 font-semibold">Role</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3a78] text-xs">
                    {isLoadingTeam ? (
                      <tr><td colSpan={4} className="px-5 py-12 text-center text-[#8f9fba]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-300" />Loading staff team…</td></tr>
                    ) : teamMembers.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-12 text-center text-[#8f9fba]">No registered admin or staff accounts found.</td></tr>
                    ) : teamMembers.map((member) => (
                      <tr key={member.email} className="hover:bg-[#10234a]">
                        <td className="px-5 py-3.5 font-medium text-white">{member.email}</td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${member.role === 'admin' ? 'bg-[#142b5b] text-cyan-200' : 'bg-slate-700/60 text-slate-200'}`}>{member.role}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${member.status === 'active' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>{member.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-[#aab9d0]">{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'runner' && role === 'admin' && (
            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-base font-bold text-white">Runner settings</h2>
                  <p className="mt-1 text-xs leading-5 text-[#99908b]">Changes to earning, daily distance, and health apply to every Runner of the selected type.</p>
                </div>
                {isLoadingRunnerRules ? (
                  <p className="py-8 text-center text-xs text-[#8f9fba]">
                    <LoaderCircle className="mx-auto mb-2 h-4 w-4 animate-spin text-cyan-300" />
                    Loading Runner settings…
                  </p>
                ) : (
                  <form onSubmit={saveRunnerRule} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-rule-type">Runner type</label>
                      <select
                        id="runner-rule-type"
                        value={selectedRuleRunner}
                        onChange={(event) => {
                          const runnerId = event.target.value;
                          const rule = runnerRules?.[runnerId as keyof RunnerRules];
                          setSelectedRuleRunner(runnerId);
                          setRunnerEarningInput(String(rule?.earningRate ?? 0));
                          setRunnerKmLimitInput(String(rule?.kmLimitPerDay ?? 1));
                          setRunnerHealthLimitInput(String(rule?.healthLimit ?? 10));
                        }}
                        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                      >
                        {Object.entries(runnerNames).map(([runnerId, name]) => <option key={runnerId} value={runnerId}>{name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-earning-rate">Earnings per km (₱)</label>
                      <input
                        id="runner-earning-rate"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={runnerEarningInput}
                        onChange={(event) => setRunnerEarningInput(event.target.value)}
                        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-km-limit">Max km/day</label>
                        <input
                          id="runner-km-limit"
                          type="number"
                          min="0.1"
                          step="0.1"
                          required
                          value={runnerKmLimitInput}
                          onChange={(event) => setRunnerKmLimitInput(event.target.value)}
                          className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-health-limit">Health limit</label>
                        <input
                          id="runner-health-limit"
                          type="number"
                          min="1"
                          max="1000"
                          step="1"
                          required
                          value={runnerHealthLimitInput}
                          onChange={(event) => setRunnerHealthLimitInput(event.target.value)}
                          className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                        />
                      </div>
                    </div>
                    <button
                      disabled={isSavingRunnerRule || !runnerRules}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e94f08] px-4 py-3 text-sm font-bold text-white hover:bg-[#ff6418] disabled:opacity-50"
                    >
                      {isSavingRunnerRule && <LoaderCircle className="h-4 w-4 animate-spin" />}
                      Save Runner settings
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
                <div className="mb-5">
                  <h2 className="text-base font-bold text-white">Give a Runner to a user</h2>
                  <p className="mt-1 text-xs leading-5 text-[#99908b]">Enter the user’s five-digit Stepora ID. The Runner is added to their inventory without a balance charge.</p>
                </div>
                <form onSubmit={grantRunner} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="grant-runner-user-id">Stepora ID</label>
                    <input
                      id="grant-runner-user-id"
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{5}"
                      maxLength={5}
                      value={grantRunnerUserId}
                      onChange={(event) => setGrantRunnerUserId(event.target.value)}
                      placeholder="12345"
                      className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="grant-runner-type">Runner type</label>
                    <select
                      id="grant-runner-type"
                      value={grantRunnerType}
                      onChange={(event) => setGrantRunnerType(event.target.value)}
                      className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {Object.entries(runnerNames).map(([runnerId, name]) => <option key={runnerId} value={runnerId}>{name}</option>)}
                    </select>
                  </div>
                  <button
                    disabled={isGrantingRunner}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#27508d] bg-[#10234a] px-4 py-3 text-sm font-bold text-cyan-100 hover:bg-[#142b5b] disabled:opacity-50"
                  >
                    {isGrantingRunner && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Give Runner
                  </button>
                </form>
              </div>
            </section>
          )}

          {activeView === 'runner-pricing' && role === 'admin' && (
            <section className="max-w-2xl rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-white">Runner market pricing</h2>
                <p className="mt-1 text-xs leading-5 text-[#99908b]">
                  Set a percentage discount. The sale price is calculated from the original price and applies immediately to the market and purchases.
                </p>
              </div>
              {isLoadingRunnerPrices ? (
                <p className="py-8 text-center text-xs text-[#8f9fba]">
                  <LoaderCircle className="mx-auto mb-2 h-4 w-4 animate-spin text-cyan-300" />
                  Loading runner prices…
                </p>
              ) : (
                <form onSubmit={saveRunnerPrice} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="price-runner-type">Runner type</label>
                    <select
                      id="price-runner-type"
                      value={selectedPriceRunner}
                      onChange={(event) => {
                        const runnerId = event.target.value;
                        const price = runnerPrices[runnerId];
                        setSelectedPriceRunner(runnerId);
                        setOriginalPriceInput(String(price?.originalPrice ?? 0));
                        setNewPriceInput(String(price?.newPrice ?? 0));
                        setDiscountInput(String(price?.discountPercentage ?? 0));
                      }}
                      className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                    >
                      {Object.entries(runnerNames).map(([runnerId, name]) => (
                        <option key={runnerId} value={runnerId}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-original-price">Original price</label>
                      <input
                        id="runner-original-price"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={originalPriceInput}
                        onChange={(event) => {
                          const value = event.target.value;
                          setOriginalPriceInput(value);
                          const originalPrice = Number(value);
                          const discountPercentage = Number(discountInput);
                          if (originalPrice > 0 && Number.isFinite(discountPercentage)) {
                            const newPrice = Math.round(originalPrice * (1 - discountPercentage / 100) * 100) / 100;
                            setNewPriceInput(String(newPrice));
                          }
                        }}
                        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-new-price">New price</label>
                      <input
                        id="runner-new-price"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newPriceInput}
                        onChange={(event) => {
                          const value = event.target.value;
                          setNewPriceInput(value);
                          const originalPrice = Number(originalPriceInput);
                          const newPrice = Number(value);
                          if (originalPrice > 0 && Number.isFinite(newPrice)) {
                            const discountPercentage = Math.max(0, Math.min(100, (1 - newPrice / originalPrice) * 100));
                            setDiscountInput(discountPercentage.toFixed(4).replace(/\.?0+$/, ''));
                          }
                        }}
                        className="w-full rounded-lg border border-emerald-500/30 bg-[#06132e] px-3 py-2.5 text-sm font-bold text-emerald-200 outline-none focus:border-emerald-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#d6cfcb]" htmlFor="runner-discount">Discount percentage</label>
                    <div className="relative">
                      <input
                        id="runner-discount"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        value={discountInput}
                        onChange={(event) => {
                          const value = event.target.value;
                          setDiscountInput(value);
                          const discountPercentage = Number(value);
                          const originalPrice = Number(originalPriceInput);
                          if (originalPrice > 0 && Number.isFinite(discountPercentage) && discountPercentage >= 0 && discountPercentage <= 100) {
                            const newPrice = Math.round(originalPrice * (1 - discountPercentage / 100) * 100) / 100;
                            setNewPriceInput(String(newPrice));
                          }
                        }}
                        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 pr-9 text-sm text-white outline-none focus:border-cyan-300"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8f9fba]">%</span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-[#8f9fba]">Enter 0 to remove the discount and hide the sale badge on the market.</p>
                  </div>
                  <button
                    disabled={isSavingRunnerPrice || !runnerPrices[selectedPriceRunner]}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#e94f08] px-4 py-3 text-sm font-bold text-white hover:bg-[#ff6418] disabled:opacity-50"
                  >
                    {isSavingRunnerPrice && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Save runner price
                  </button>
                </form>
              )}
            </section>
          )}

          {activeView === 'overview' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  title="Registered users"
                  value={registeredUsers === null ? '—' : registeredUsers.toLocaleString()}
                  detail="Total accounts registered"
                  icon={Users}
                  accent="emerald"
                />
                <SummaryCard
                  title="Total deposit amount"
                  value={currency.format(depositTotal)}
                  detail={`${paidDeposits.length} successful deposits in selected range`}
                  icon={ArrowDownLeft}
                  accent="emerald"
                />
                <SummaryCard
                  title="Total withdrawal amount"
                  value={currency.format(withdrawalTotal)}
                  detail={withdrawals.length ? `${successfulWithdrawals.length} completed withdrawals` : 'No withdrawal records are currently stored'}
                  icon={ArrowUpRight}
                  accent="orange"
                />
                <SummaryCard
                  title="Fees earned"
                  value="Not tracked"
                  detail="A fee ledger has not been configured"
                  icon={CircleDollarSign}
                  accent="amber"
                />
              </div>

              <section>
                <h2 className="mb-3 text-lg font-semibold">Trend</h2>
                <div className="grid gap-4 xl:grid-cols-2">
                  <TrendChart transactions={transactions} />
                  <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-4">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Transaction success</h3>
                        <p className="mt-1 text-[11px] text-[#817c79]">Successful payments in selected range</p>
                      </div>
                      <BadgeCheck className="h-4 w-4 text-[#f15408]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-emerald-900/60 bg-[#071f2d] p-4">
                        <p className="text-xs text-[#a8a09b]">Deposits</p>
                        <p className="mt-2 text-2xl font-semibold text-emerald-400">{paidDeposits.length}</p>
                      </div>
                      <div className="rounded-lg border border-[#24466f] bg-[#10234a] p-4">
                        <p className="text-xs text-[#a8a09b]">Withdrawals</p>
                        <p className="mt-2 text-2xl font-semibold text-orange-400">{successfulWithdrawals.length}</p>
                      </div>
                      <div className="col-span-2 flex items-start gap-2 rounded-lg border border-[#24466f] bg-[#06132e] p-3 text-xs leading-5 text-[#aaa3a0]">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#f15408]" />
                        Accepted requests stay in processing until TurboPay confirms payment. Rejected requests are automatically refunded.
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <TransactionTable
                transactions={filteredTransactions.slice(0, 8)}
                isLoading={isLoading}
                onShowDeposits={() => setActiveView('deposit')}
                title="Recent transactions"
              />
            </>
          )}

          {activeView === 'deposit' && (
            <TransactionTable
              transactions={visibleDeposits}
              isLoading={isLoading}
              title="Deposits"
              userIdSearch={depositUserIdSearch}
              onUserIdSearchChange={setDepositUserIdSearch}
            />
          )}
          {activeView === 'withdrawal' && (
            <>
              <TransactionTable
                transactions={visibleWithdrawals}
                isLoading={isLoading}
                title="Withdrawals"
                userIdSearch={withdrawalUserIdSearch}
                onUserIdSearchChange={setWithdrawalUserIdSearch}
                onReviewWithdrawal={handleReviewWithdrawal}
                reviewingWithdrawalId={reviewingWithdrawalId}
                withdrawalReferenceNumbers={withdrawalReferenceNumbers}
                onWithdrawalReferenceNoChange={(orderId, value) => {
                  setWithdrawalReferenceNumbers((current) => ({ ...current, [orderId]: value }));
                }}
              />
              {!isLoading && withdrawals.length === 0 && (
                <p className="-mt-3 text-xs text-[#908984]">
                  No withdrawal requests found for this date range.
                </p>
              )}
            </>
          )}
          {activeView === 'runner-purchases' && (
            <RunnerPurchaseTable
              purchases={visibleRunnerPurchases}
              isLoading={isLoading}
              userIdSearch={runnerPurchaseUserIdSearch}
              onUserIdSearchChange={setRunnerPurchaseUserIdSearch}
            />
          )}
          {activeView === 'profile' && (
            <UserProfileSection
              searchInput={profileSearchInput}
              onSearchInputChange={setProfileSearchInput}
              onSearch={(event) => {
                event.preventDefault();
                const searchId = profileSearchInput.trim();
                if (!searchId) {
                  setProfileError('Enter a Stepora ID or full account ID.');
                  setUserProfile(null);
                  return;
                }
                setProfileLookupId(searchId);
              }}
              profile={userProfile}
              isLoading={isLoadingProfile}
              error={profileError}
              activeWorkouts={activeWorkouts}
              isLoadingActiveWorkouts={isLoadingActiveWorkouts}
              activeWorkoutsError={activeWorkoutsError}
              onSelectActiveWorkout={(workout) => {
                setProfileSearchInput(workout.steporaId);
                setProfileLookupId(workout.userId);
                setUserProfile(null);
                setProfileRefreshKey((key) => key + 1);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

function UserProfileSection({
  searchInput,
  onSearchInputChange,
  onSearch,
  profile,
  isLoading,
  error,
  activeWorkouts,
  isLoadingActiveWorkouts,
  activeWorkoutsError,
  onSelectActiveWorkout,
}: {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
  profile: AdminUserProfile | null;
  isLoading: boolean;
  error: string;
  activeWorkouts: AdminActiveWorkout[];
  isLoadingActiveWorkouts: boolean;
  activeWorkoutsError: string;
  onSelectActiveWorkout: (workout: AdminActiveWorkout) => void;
}) {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!profile?.activeWorkout && activeWorkouts.length === 0) return;
    const intervalId = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [activeWorkouts.length, profile?.activeWorkout]);

  const activeWorkout = profile?.activeWorkout;
  const elapsedSeconds = activeWorkout
    ? activeWorkout.elapsedSeconds + (
      activeWorkout.isTracking &&
      !activeWorkout.isPaused &&
      !activeWorkout.pendingFinish &&
      activeWorkout.lastUpdated > 0
        ? Math.floor(Math.max(0, clock - activeWorkout.lastUpdated) / 1000)
        : 0
    )
    : 0;
  const pendingCount = profile?.transactions.filter((transaction) => transaction.status.toLowerCase() === 'pending').length || 0;
  const deposits = profile?.transactions.filter((transaction) => transaction.type === 'deposit') || [];
  const withdrawals = profile?.transactions.filter((transaction) => transaction.type === 'withdrawal') || [];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Find a user</h2>
          <p className="mt-1 text-[11px] text-[#8f9fba]">Search by Stepora ID or full account ID.</p>
        </div>
        <form onSubmit={onSearch} className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 focus-within:border-cyan-300">
            <Search className="h-4 w-4 shrink-0 text-[#8f9fba]" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder="Enter user ID"
              aria-label="Search user by ID"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#64748b]"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#e94f08] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#ff6418] disabled:opacity-60"
          >
            {isLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Search
          </button>
        </form>
        {error && <p role="alert" className="mt-3 text-xs text-rose-300">{error}</p>}

        <section className="mt-5 border-t border-[#1e3a78] pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Activity className="h-4 w-4 text-cyan-300" />
                Users with active workouts
              </h3>
              <p className="mt-1 text-[10px] text-[#8f9fba]">Updates automatically every 5 seconds.</p>
            </div>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-200">
              {activeWorkouts.length} active
            </span>
          </div>
          {activeWorkoutsError && <p role="alert" className="mb-3 text-xs text-rose-300">{activeWorkoutsError}</p>}
          {isLoadingActiveWorkouts ? (
            <p className="py-5 text-center text-xs text-[#8f9fba]"><LoaderCircle className="mx-auto mb-2 h-4 w-4 animate-spin text-cyan-300" />Loading active workouts…</p>
          ) : activeWorkouts.length === 0 ? (
            <p className="rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-5 text-center text-xs text-[#8f9fba]">No users are currently tracking a workout.</p>
          ) : (
            <ul className="grid gap-2 lg:grid-cols-2">
              {activeWorkouts.map((workout) => {
                const liveElapsed = workout.elapsedSeconds + (
                  workout.isTracking &&
                  !workout.isPaused &&
                  !workout.pendingFinish &&
                  workout.lastUpdated > 0
                    ? Math.floor(Math.max(0, clock - workout.lastUpdated) / 1000)
                    : 0
                );
                return (
                  <li key={workout.userId}>
                    <button
                      type="button"
                      onClick={() => onSelectActiveWorkout(workout)}
                      className="w-full rounded-lg border border-[#24466f] bg-[#06132e] p-3 text-left transition hover:border-cyan-300 hover:bg-[#10234a] focus:outline-none focus:ring-2 focus:ring-cyan-300"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span>
                          <span className="block text-xs font-semibold text-white">{workout.username}</span>
                          <span className="mt-1 block font-mono text-[10px] text-cyan-200">ID {workout.steporaId}</span>
                        </span>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-bold uppercase text-cyan-200">{workout.status}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                        <span className="text-[#8f9fba]">KM <strong className="block mt-1 text-xs text-white">{workout.distanceKm.toFixed(2)}</strong></span>
                        <span className="text-[#8f9fba]">Time <strong className="block mt-1 text-xs text-white">{formatWorkoutDuration(liveElapsed)}</strong></span>
                        <span className="text-[#8f9fba]">Earned <strong className="block mt-1 text-xs text-white">{currency.format(workout.tokensEarned)}</strong></span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>

      {isLoading && !profile && (
        <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] px-4 py-12 text-center text-sm text-[#8f9fba]">
          <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-cyan-300" />
          Loading user profile…
        </div>
      )}

      {profile && (
        <>
          <section className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#142b5b] text-cyan-200"><UserRound className="h-6 w-6" /></span>
                <div>
                  <h2 className="text-lg font-bold text-white">{profile.username}</h2>
                  <p className="mt-1 font-mono text-xs text-cyan-200">ID {profile.steporaId}</p>
                  <p className="mt-1 text-[10px] text-[#8f9fba]">Account ID: {profile.userId}</p>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase ${profile.status.toLowerCase() === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
                {profile.status}
              </span>
            </div>
          </section>

          <section className="rounded-xl border border-[#1e3a78] bg-[#081b3d]">
            <div className="border-b border-[#1e3a78] px-4 py-4 sm:px-5">
              <h2 className="text-sm font-semibold text-white">Runner Inventory</h2>
              <p className="mt-1 text-[11px] text-[#817c79]">{profile.ownedRunners.length} runners owned</p>
            </div>
            {profile.ownedRunners.length === 0 ? (
              <p className="px-5 py-6 text-xs text-[#8f9fba]">No runners in this user’s inventory.</p>
            ) : (
              <ul className="divide-y divide-[#1e3a78]">
                {profile.ownedRunners.map((runner) => (
                  <li key={runner.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                    <span className="text-xs font-semibold text-white">{runnerNames[runner.runnerId] || `Runner (${runner.runnerId})`}</span>
                    <span className="font-mono text-[10px] text-[#8f9fba]">
                      {runner.serial ? `Serial #${runner.serial}` : 'Serial unavailable'}
                      {runner.purchasedAt > 0 ? ` · Purchased ${new Date(runner.purchasedAt).toLocaleDateString()}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Transactions</h2>
              <p className="mt-1 text-[11px] text-[#8f9fba]">Deposits, withdrawals, and pending requests</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <ProfileCountCard title="Deposits" count={deposits.length} accent="emerald" />
              <ProfileCountCard title="Withdrawals" count={withdrawals.length} accent="orange" />
              <ProfileCountCard title="Pending" count={pendingCount} accent="amber" />
            </div>
            <div className="overflow-hidden rounded-xl border border-[#1e3a78] bg-[#081b3d]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-[#06132e] text-[10px] uppercase tracking-wider text-[#8f9fba]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Type / ID</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 font-semibold">Time / Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3a78] text-xs">
                    {profile.transactions.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8f9fba]">No deposit or withdrawal records found.</td></tr>
                    ) : profile.transactions.map((transaction) => (
                      <tr key={`${transaction.type}:${transaction.id}`} className="hover:bg-[#10234a]">
                        <td className="px-4 py-3">
                          <span className="font-semibold capitalize text-white">{transaction.type}</span>
                          <span className="mt-1 block font-mono text-[10px] text-[#8f9fba]">{transaction.id}</span>
                        </td>
                        <td className="px-4 py-3"><StatusPill status={transaction.status} /></td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{currency.format(transaction.amount)}</td>
                        <td className="px-4 py-3 text-[#a39b96]">{transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Track Status</h2>
              <p className="mt-1 text-[11px] text-[#8f9fba]">Ongoing workout progress and past claimed tracks</p>
            </div>
            {activeWorkout ? (
              <div className="rounded-xl border border-cyan-500/30 bg-[#081b3d] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-300" />
                    <h3 className="text-sm font-bold text-white">Ongoing workout</h3>
                  </div>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase text-cyan-200">{activeWorkout.status}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ProfileMetric label="KM" value={`${activeWorkout.distanceKm.toFixed(2)} km`} />
                  <ProfileMetric label="Time" value={formatWorkoutDuration(elapsedSeconds)} />
                  <ProfileMetric label="Earned" value={currency.format(activeWorkout.tokensEarned)} />
                </div>
                <p className="mt-3 text-[10px] text-[#8f9fba]">Live updates every 5 seconds.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] px-4 py-5 text-xs text-[#8f9fba]">No active workout.</div>
            )}

            <div className="overflow-hidden rounded-xl border border-[#1e3a78] bg-[#081b3d]">
              <div className="border-b border-[#1e3a78] px-4 py-4 sm:px-5">
                <h3 className="text-sm font-semibold text-white">Past Track</h3>
                <p className="mt-1 text-[11px] text-[#817c79]">{profile.pastTracks.length} completed tracks</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left">
                  <thead className="bg-[#06132e] text-[10px] uppercase tracking-wider text-[#8f9fba]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Time / Date</th>
                      <th className="px-4 py-3 text-right font-semibold">KM</th>
                      <th className="px-4 py-3 text-right font-semibold">Earned</th>
                      <th className="px-4 py-3 font-semibold">Claimed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e3a78] text-xs">
                    {profile.pastTracks.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8f9fba]">No past tracks found.</td></tr>
                    ) : profile.pastTracks.map((track) => (
                      <tr key={track.id} className="hover:bg-[#10234a]">
                        <td className="px-4 py-3 text-[#a39b96]">{track.completedAt ? new Date(track.completedAt).toLocaleString() : track.startedAt ? new Date(track.startedAt).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono text-white">{track.distanceKm.toFixed(2)} km</td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{currency.format(track.earned)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${track.claimed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/60 text-slate-300'}`}>
                            {track.claimed ? 'Claimed' : 'Not claimed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ProfileCountCard({ title, count, accent }: { title: string; count: number; accent: 'emerald' | 'orange' | 'amber' }) {
  const color = accent === 'emerald' ? 'text-emerald-300' : accent === 'orange' ? 'text-orange-300' : 'text-amber-200';
  return (
    <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-4">
      <p className="text-xs text-[#8f9fba]">{title}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{count}</p>
    </div>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#24466f] bg-[#06132e] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#8f9fba]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function formatWorkoutDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function RunnerPurchaseTable({
  purchases,
  isLoading,
  userIdSearch,
  onUserIdSearchChange,
}: {
  purchases: AdminRunnerPurchase[];
  isLoading: boolean;
  userIdSearch: string;
  onUserIdSearchChange: (value: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#1e3a78] bg-[#081b3d]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e3a78] px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-white">Runner purchases</h2>
        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto">
          <p className="text-[11px] text-[#817c79]">{purchases.length} records</p>
          <UserIdSearch value={userIdSearch} onChange={onUserIdSearchChange} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead className="bg-[#06132e] text-[10px] uppercase tracking-wider text-[#8f9fba]">
            <tr>
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">What Runner buy</th>
              <th className="px-5 py-3 font-semibold">Time / Date</th>
              <th className="px-5 py-3 text-right font-semibold">How much</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a78] text-xs">
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-[#948c87]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-[#f15408]" />Loading runner purchases…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-12 text-center text-[#948c87]">No runner purchases found for this date range.</td></tr>
            ) : purchases.map((purchase) => (
              <tr key={purchase.id} className="hover:bg-[#10234a]">
                <td className="px-5 py-3.5">
                  <div className="font-mono text-[11px] text-cyan-200">{purchase.steporaId}</div>
                  <div className="mt-1 font-semibold text-[#e3dedb]">{purchase.username}</div>
                  {purchase.phoneNumber && <div className="mt-1 text-[10px] text-[#817c79]">{purchase.phoneNumber}</div>}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-white">{purchase.runnerName}</div>
                  {purchase.serial && <div className="mt-1 font-mono text-[10px] text-[#8f9fba]">Serial #{purchase.serial}</div>}
                </td>
                <td className="px-5 py-3.5 text-[#a39b96]">
                  {purchase.createdAt ? new Date(purchase.createdAt).toLocaleString() : '—'}
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-white">{currency.format(purchase.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: 'emerald' | 'orange' | 'amber';
}) {
  const iconColor = accent === 'emerald' ? 'text-emerald-400 bg-emerald-500/10' : accent === 'orange' ? 'text-orange-400 bg-orange-500/10' : 'text-amber-300 bg-amber-400/10';
  return (
    <div className="rounded-xl border border-[#1e3a78] bg-[#081b3d] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#f1eeec]">{title}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${iconColor}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      <p className="mt-2 text-[10px] text-[#8f8985]">{detail}</p>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  return (
    <>
      <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor={id}>{label}</label>
      <input
        id={id}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={minLength}
        maxLength={128}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300"
      />
    </>
  );
}

function CodeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="block text-xs font-semibold text-[#d6cfcb]" htmlFor={id}>Fresh authenticator code</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        className="w-full rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2.5 text-center font-mono text-base tracking-[0.4em] text-white outline-none focus:border-cyan-300"
      />
    </>
  );
}

function TransactionTable({
  transactions,
  isLoading,
  title,
  onShowDeposits,
  onReviewWithdrawal,
  reviewingWithdrawalId,
  withdrawalReferenceNumbers,
  onWithdrawalReferenceNoChange,
  userIdSearch,
  onUserIdSearchChange,
}: {
  transactions: AdminTransaction[];
  isLoading: boolean;
  title: string;
  onShowDeposits?: () => void;
  onReviewWithdrawal?: (orderId: string, decision: 'accept' | 'reject', referenceNo?: string) => void;
  reviewingWithdrawalId?: string;
  withdrawalReferenceNumbers?: Record<string, string>;
  onWithdrawalReferenceNoChange?: (orderId: string, value: string) => void;
  userIdSearch?: string;
  onUserIdSearchChange?: (value: string) => void;
}) {
  const withdrawalTable = Boolean(onReviewWithdrawal);
  const columnCount = withdrawalTable ? 9 : 7;
  return (
    <section className="overflow-hidden rounded-xl border border-[#1e3a78] bg-[#081b3d]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e3a78] px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-1 text-[11px] text-[#817c79]">{transactions.length} records</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onShowDeposits && (
            <button onClick={onShowDeposits} className="text-xs font-semibold text-orange-400 hover:text-orange-300">View deposits</button>
          )}
          {userIdSearch !== undefined && onUserIdSearchChange && (
            <UserIdSearch value={userIdSearch} onChange={onUserIdSearchChange} />
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left">
          <thead className="bg-[#06132e] text-[10px] uppercase tracking-wider text-[#8f9fba]">
            <tr>
              <th className="px-5 py-3 font-semibold">Transaction</th>
              <th className="px-5 py-3 font-semibold">ID</th>
              <th className="px-5 py-3 font-semibold">User</th>
              <th className="px-5 py-3 font-semibold">Method</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 text-right font-semibold">{onReviewWithdrawal ? 'Payout' : 'Amount'}</th>
              <th className="px-5 py-3 font-semibold">Created</th>
              {onReviewWithdrawal && <th className="px-5 py-3 font-semibold">Ref. No</th>}
              {onReviewWithdrawal && <th className="px-5 py-3 font-semibold">Review</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e3a78] text-xs">
            {isLoading ? (
              <tr><td colSpan={columnCount} className="px-5 py-12 text-center text-[#948c87]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-[#f15408]" />Loading transaction records…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={columnCount} className="px-5 py-12 text-center text-[#948c87]">No transactions found for this date range.</td></tr>
            ) : transactions.map((transaction) => (
              <tr key={`${transaction.type}:${transaction.id}`} className="hover:bg-[#10234a]">
                <td className="px-5 py-3.5">
                  <div className="font-mono text-[11px] text-white">{transaction.id}</div>
                  <div className="mt-1 text-[10px] capitalize text-[#817c79]">{transaction.type}</div>
                </td>
                <td className="px-5 py-3.5 font-mono text-[11px] text-cyan-200">{transaction.steporaId}</td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-[#e3dedb]">{transaction.username}</div>
                  <div className="mt-1 text-[10px] text-[#817c79]">{transaction.phoneNumber || '—'}</div>
                </td>
                <td className="px-5 py-3.5 text-[#c0b8b3]">
                  <div className="capitalize">{transaction.method}</div>
                  {transaction.type === 'withdrawal' && transaction.accountHolder && (
                    <div className="mt-1 text-[10px] leading-4 text-[#8f9fba]">
                      {transaction.accountHolder}<br />{transaction.accountNumber}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5"><StatusPill status={transaction.status} /></td>
                <td className="px-5 py-3.5 text-right font-semibold text-white">
                  {currency.format(transaction.amount)}
                  {transaction.type === 'withdrawal' && (
                    <div className="mt-1 text-[10px] font-normal leading-4 text-[#8f9fba]">
                      Payout · Fee {currency.format(transaction.fee || 0)}<br />
                      Balance debit {currency.format(transaction.totalDeducted ?? transaction.amount + (transaction.fee || 0))}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[#a39b96]">
                  {transaction.createdAt ? new Date(transaction.createdAt).toLocaleString() : '—'}
                </td>
                {onReviewWithdrawal && (
                  <td className="px-5 py-3.5">
                    {transaction.type === 'withdrawal' && transaction.status === 'pending' ? (
                      <input
                        type="text"
                        maxLength={100}
                        value={withdrawalReferenceNumbers?.[transaction.id] ?? ''}
                        onChange={(event) => onWithdrawalReferenceNoChange?.(transaction.id, event.target.value)}
                        placeholder="Optional"
                        aria-label={`Reference number for ${transaction.id}`}
                        disabled={reviewingWithdrawalId === transaction.id}
                        className="w-32 rounded-lg border border-[#24466f] bg-[#06132e] px-2 py-2 text-[10px] text-white outline-none placeholder:text-[#64748b] focus:border-cyan-300 disabled:opacity-50"
                      />
                    ) : transaction.type === 'withdrawal' && transaction.referenceNo ? (
                      <span className="break-all font-mono text-[10px] text-[#c0b8b3]">{transaction.referenceNo}</span>
                    ) : transaction.type === 'withdrawal' ? (
                      <span className="text-[10px] text-[#64748b]">—</span>
                    ) : null}
                  </td>
                )}
                {onReviewWithdrawal && (
                  <td className="px-5 py-3.5">
                    {transaction.type === 'withdrawal' && transaction.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={reviewingWithdrawalId === transaction.id}
                          onClick={() => onReviewWithdrawal(
                            transaction.id,
                            'accept',
                            withdrawalReferenceNumbers?.[transaction.id] ?? '',
                          )}
                          className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          {reviewingWithdrawalId === transaction.id ? 'Working…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          disabled={reviewingWithdrawalId === transaction.id}
                          onClick={() => onReviewWithdrawal(transaction.id, 'reject')}
                          className="rounded-lg bg-rose-500/15 px-3 py-2 text-[10px] font-bold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : transaction.type === 'withdrawal' ? (
                      <span className="text-[10px] text-[#8f9fba]">Reviewed</span>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserIdSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-[#24466f] bg-[#06132e] px-3 py-2 focus-within:border-cyan-300">
      <Search className="h-3.5 w-3.5 shrink-0 text-[#8f9fba]" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search user ID"
        aria-label="Search table by user ID"
        className="w-40 bg-transparent text-xs text-white outline-none placeholder:text-[#64748b]"
      />
    </label>
  );
}

export default Admin;
