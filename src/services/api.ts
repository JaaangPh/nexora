import { Capacitor } from '@capacitor/core';
import { AuthResponse, InviteValidationResponse, InviteCodeItem, OwnedRunner, User } from '../types/auth';
import { WorkoutSnapshot } from '../types/workout';
import {
  getTurboPayPayoutBank,
  isTurboPayPayoutBankCode,
  TurboPayPayoutBankCode,
} from '../../shared/turbopayBanks';

export type DepositBankCode = 'gcash' | 'PMP' | 'GOT' | 'qrph' | 'usdt-trc20';
export type DepositStatus = 'pending' | 'paid' | 'failed' | 'expired';
export type PayoutProvider = TurboPayPayoutBankCode;

export interface PayoutAccount {
  provider: PayoutProvider;
  bankCode: PayoutProvider;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const legacyPayoutProviderCodes: Record<string, PayoutProvider> = {
  gcash: 'gcash',
  maya: 'PMP',
  gotyme: 'GOT',
};

function normalizePayoutAccounts(value: unknown): PayoutAccount[] {
  if (!Array.isArray(value)) throw new Error('Server returned an invalid payout accounts response.');

  return value.map((item): PayoutAccount => {
    if (!item || typeof item !== 'object') {
      throw new Error('Server returned an invalid payout account.');
    }

    const record = item as Record<string, unknown>;
    const provider = typeof record.provider === 'string' && isTurboPayPayoutBankCode(record.provider)
      ? record.provider
      : typeof record.provider === 'string'
        ? legacyPayoutProviderCodes[record.provider]
        : undefined;
    const bankCode = isTurboPayPayoutBankCode(record.bankCode)
      ? record.bankCode
      : provider;
    if (!bankCode || (provider && provider !== bankCode)) {
      throw new Error('Server returned an unsupported payout account provider.');
    }
    if (typeof record.accountNumber !== 'string' || typeof record.accountHolder !== 'string') {
      throw new Error('Server returned incomplete payout account details.');
    }

    return {
      provider: bankCode,
      bankCode,
      bankName: typeof record.bankName === 'string'
        ? record.bankName
        : getTurboPayPayoutBank(bankCode)?.name || bankCode,
      accountNumber: record.accountNumber,
      accountHolder: record.accountHolder,
    };
  });
}

function legacyPayoutProvider(provider: PayoutProvider): string {
  if (provider === 'PMP') return 'maya';
  if (provider === 'GOT') return 'gotyme';
  return provider;
}

export interface RunnerPrice {
  originalPrice: number;
  discountPercentage: number;
  newPrice: number;
}

export interface RunnerRule {
  earningRate: number;
  kmLimitPerDay: number;
  healthLimit: number;
}

export type RunnerRules = Record<'snk-1' | 'snk-2' | 'snk-3' | 'snk-4', RunnerRule>;

export type WithdrawalStatus = 'pending' | 'processing' | 'accepted' | 'paid' | 'failed';

export interface WithdrawalRecord {
  orderId: string;
  status: WithdrawalStatus;
  /** The amount requested for payout before applying the fee. */
  amount: number;
  fee: number;
  payoutAmount: number;
  /** The full amount removed from the member balance, including the fee. */
  totalDeducted?: number;
  referenceNo?: string;
  bankCode: PayoutProvider;
  bankName?: string;
  accountHolder: string;
  accountNumber: string;
  createdAt: string;
  reviewedAt?: string;
  balance?: number;
}

export interface DepositOrder {
  orderId: string;
  status: DepositStatus;
  amount: number;
  bankCode: DepositBankCode;
  message?: string;
  redirectUrl?: string;
  qrcodeUrl?: string;
  gcashQrUrl?: string;
}

export interface DepositStatusResponse extends DepositOrder {
  user?: Partial<User>;
}

export interface DepositHistoryItem {
  orderId: string;
  status: DepositStatus;
  amount: number;
  bankCode: DepositBankCode;
  createdAt: string;
  redirectUrl?: string;
  qrcodeUrl?: string;
  gcashQrUrl?: string;
}

export interface MarathonProfile {
  id: string;
  nexoraId?: string;
  username: string;
  profileImage: string | null;
  ownsCobalt?: boolean;
  ownsVortex?: boolean;
  eligible?: boolean;
  stillRunning?: boolean;
  status?: string;
  canInvite?: boolean;
  cooldownUntil?: number;
  membershipStatus?: 'active' | 'departed' | 'historical';
  role?: string;
  joinedAt?: number;
  leftAt?: number | null;
  active?: boolean;
  verifiedKm?: number;
}

export interface MarathonTeamView {
  id: string;
  name: string;
  leaderId: string;
  status: 'Lobby' | 'Active' | 'Completed' | 'Failed' | 'Cancelled';
  memberIds: string[];
  memberIdsHistory: string[];
  memberCount: number;
  pendingInvitationCount: number;
  membersStillNeeded: number;
  packageId: '250' | '500' | null;
  targetKm: number;
  bounty: number;
  totalKm: number;
  remainingKm: number;
  progressPercentage: number;
  createdAt: number;
  startedAt?: number;
  deadlineAt?: number;
  endedAt?: number;
  payoutStatus?: string;
  members: MarathonProfile[];
  invitations: Array<{
    id: string;
    inviteeId: string;
    status: string;
    createdAt: number;
    bounty: number;
    invitee: MarathonProfile | null;
  }>;
  payouts?: Record<string, number>;
  payoutTransactionIds?: Array<{ userId: string; transactionId: string }>;
}

export interface MarathonDashboard {
  success: boolean;
  eligibility: { eligible: boolean; ownsCobalt: boolean; ownsVortex: boolean };
  cooldownUntil: number;
  currentTeam: MarathonTeamView | null;
  invitations: Array<{
    id: string;
    teamId: string;
    teamName: string;
    targetMeters: number;
    bounty: number;
    createdAt: number;
    team: MarathonTeamView;
    leader: MarathonProfile | null;
    stillRunning: boolean;
    eligibility: { eligible: boolean; ownsCobalt: boolean; ownsVortex: boolean };
    cooldownUntil: number;
    alreadyInTeam: boolean;
  }>;
  history: MarathonTeamView[];
  notifications: Array<{ id: string; type: string; teamName: string; message: string; createdAt: number }>;
}

// Storage keys
const TOKEN_KEY = 'nexora_token';
const USER_KEY = 'nexora_user';
const API_BASE_KEY = 'nexora_api_base';

// Determine initial API Base URL
// In Capacitor, localhost needs http://10.0.2.2:5000 for Android emulator by default
export function getApiBaseUrl(): string {
  const custom = localStorage.getItem(API_BASE_KEY);
  if (custom) return custom.replace(/\/$/, '');

  const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;
  if (envUrl) return String(envUrl).replace(/\/$/, '');

  // Auto-detect native Capacitor platform (Android emulator default)
  if (Capacitor.isNativePlatform()) {
    return 'http://10.0.2.2:5000';
  }

  // Default web proxy or relative root
  return '';
}

export function setApiBaseUrl(url: string) {
  if (!url) {
    localStorage.removeItem(API_BASE_KEY);
  } else {
    localStorage.setItem(API_BASE_KEY, url.trim().replace(/\/$/, ''));
  }
}

// Token helpers
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as User;
  } catch {
    return null;
  }
}

// Common Fetch Wrapper
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends cookies if on same-origin/supported
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Server returned an invalid non-JSON response.',
  }));

  if (!response.ok) {
    const isAuthenticationEntryPoint = endpoint.includes('/api/auth/login') || endpoint.includes('/api/auth/register');
    if (response.status === 401 && token && !isAuthenticationEntryPoint) {
      clearStoredSession();
      window.dispatchEvent(new Event('nexora:session-expired'));
    }
    const errorMsg = data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  async getRunnerRules(): Promise<RunnerRules> {
    const result = await request<{ success: boolean; rules: RunnerRules }>('/api/auth/runner-rules', {
      method: 'GET',
    });
    return result.rules;
  },

  async getRunnerPrices(): Promise<Record<string, RunnerPrice>> {
    const result = await request<{ success: boolean; prices: Record<string, RunnerPrice> }>('/api/auth/runner-prices', {
      method: 'GET',
    });
    return result.prices;
  },

  async login(phoneNumber: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, password }),
    });
    if (res.token && res.user) {
      setStoredSession(res.token, res.user);
    }
    return res;
  },

  async register(
    phoneNumber: string,
    password: string,
    confirmPassword: string,
    inviteCode: string
  ): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, password, confirmPassword, inviteCode }),
    });
    if (res.token && res.user) {
      setStoredSession(res.token, res.user);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearStoredSession();
    }
  },

  async getMe(): Promise<{ success: boolean; user: User }> {
    return request<{ success: boolean; user: User }>('/api/auth/me', {
      method: 'GET',
    });
  },

  async getReferralStats(): Promise<{
    success: boolean;
    directTeamCount: number;
    referralRewards: number;
  }> {
    return request('/api/auth/referrals', { method: 'GET' });
  },

  async getWorkoutSnapshot(): Promise<{ success: boolean; workoutSnapshot: WorkoutSnapshot | null }> {
    return request<{ success: boolean; workoutSnapshot: WorkoutSnapshot | null }>('/api/auth/workout', {
      method: 'GET',
    });
  },

  async saveWorkoutSnapshot(snapshot: WorkoutSnapshot): Promise<{
    success: boolean;
    workoutSnapshot: WorkoutSnapshot;
    ownedRunners?: (OwnedRunner | string)[];
  }> {
    return request<{ success: boolean; workoutSnapshot: WorkoutSnapshot; ownedRunners?: (OwnedRunner | string)[] }>('/api/auth/workout', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });
  },

  async clearWorkoutSnapshot(workoutStartTime: number): Promise<{
    success: boolean;
    verified: boolean;
    creditedMeters: number;
    creditedReward: number;
    balance: number;
  }> {
    return request<{
      success: boolean;
      verified: boolean;
      creditedMeters: number;
      creditedReward: number;
      balance: number;
    }>('/api/auth/workout', {
      method: 'DELETE',
      body: JSON.stringify({ workoutStartTime }),
    });
  },

  async getMarathonDashboard(): Promise<MarathonDashboard> {
    return request<MarathonDashboard>('/api/marathons', { method: 'GET' });
  },

  async createMarathonTeam(name: string): Promise<{ success: boolean; teamId: string }> {
    return request<{ success: boolean; teamId: string }>('/api/marathons/teams', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  async searchMarathonUser(teamId: string, nexoraId: string): Promise<{ success: boolean; profile: MarathonProfile }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/search?nexoraId=${encodeURIComponent(nexoraId)}`, {
      method: 'GET',
    });
  },

  async inviteMarathonUser(teamId: string, inviteeId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ inviteeId }),
    });
  },

  async respondToMarathonInvitation(invitationId: string, action: 'accept' | 'decline'): Promise<{ success: boolean }> {
    return request(`/api/marathons/invitations/${encodeURIComponent(invitationId)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  async cancelMarathonInvitation(teamId: string, invitationId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE',
    });
  },

  async updateMarathonTeam(
    teamId: string,
    changes: { name?: string; packageId?: '250' | '500' },
  ): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
  },

  async startMarathon(teamId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/start`, { method: 'POST' });
  },

  async removeMarathonMember(teamId: string, memberId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
  },

  async leaveMarathonTeam(teamId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/leave`, { method: 'POST' });
  },

  async cancelMarathonLobby(teamId: string): Promise<{ success: boolean }> {
    return request(`/api/marathons/teams/${encodeURIComponent(teamId)}/cancel`, { method: 'POST' });
  },

  async updateUsername(username: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/username', {
      method: 'PUT',
      body: JSON.stringify({ username }),
    });
    if (res.user) {
      const currentStored = getStoredUser();
      if (currentStored) {
        const updatedUser = { ...currentStored, ...res.user };
        setStoredSession(getStoredToken() || '', updatedUser);
        res.user = updatedUser;
      }
    }
    return res;
  },

  async updateProfileImage(profileImage: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/profile-image', {
      method: 'PUT',
      body: JSON.stringify({ profileImage }),
    });
    if (res.user) {
      const currentStored = getStoredUser();
      if (currentStored) {
        const updatedUser = { ...currentStored, ...res.user };
        setStoredSession(getStoredToken() || '', updatedUser);
        res.user = updatedUser;
      }
    }
    return res;
  },

  async createDeposit(amount: number, bankCode: DepositBankCode): Promise<DepositOrder> {
    const res = await request<{ success: boolean; deposit: DepositOrder }>('/api/payments/turbopay/deposits', {
      method: 'POST',
      body: JSON.stringify({ amount, bankCode }),
    });
    return res.deposit;
  },

  async getDepositStatus(orderId: string): Promise<DepositStatusResponse> {
    return request<DepositStatusResponse>(`/api/payments/turbopay/deposits/${encodeURIComponent(orderId)}`, {
      method: 'GET',
    });
  },

  async getDepositHistory(): Promise<DepositHistoryItem[]> {
    const res = await request<{ success: boolean; deposits: DepositHistoryItem[] }>('/api/payments/turbopay/deposits', {
      method: 'GET',
    });
    return res.deposits;
  },

  async getPayoutAccounts(): Promise<PayoutAccount[]> {
    const res = await request<{ success: boolean; accounts: unknown }>('/api/auth/payout-accounts', {
      method: 'GET',
    });
    return normalizePayoutAccounts(res.accounts);
  },

  async savePayoutAccount(account: PayoutAccount): Promise<PayoutAccount[]> {
    const res = await request<{ success: boolean; accounts: unknown }>('/api/auth/payout-accounts', {
      method: 'POST',
      body: JSON.stringify({ ...account, provider: legacyPayoutProvider(account.bankCode) }),
    });
    return normalizePayoutAccounts(res.accounts);
  },

  async deletePayoutAccount(provider: PayoutProvider): Promise<PayoutAccount[]> {
    const res = await request<{ success: boolean; accounts: unknown }>(
      `/api/auth/payout-accounts/${encodeURIComponent(legacyPayoutProvider(provider))}`,
      { method: 'DELETE' },
    );
    return normalizePayoutAccounts(res.accounts);
  },

  async getWithdrawalTotpStatus(): Promise<{ configured: boolean }> {
    return request<{ success: boolean; configured: boolean }>('/api/auth/withdrawals/totp', { method: 'GET' });
  },

  async beginWithdrawalTotpSetup(): Promise<{ qrCodeDataUrl: string; manualEntryKey: string }> {
    return request<{ success: boolean; qrCodeDataUrl: string; manualEntryKey: string }>(
      '/api/auth/withdrawals/totp/setup',
      { method: 'POST' },
    );
  },

  async verifyWithdrawalTotpSetup(code: string): Promise<void> {
    await request<{ success: boolean }>('/api/auth/withdrawals/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async createWithdrawal(amount: number, provider: PayoutProvider, code: string): Promise<WithdrawalRecord> {
    const res = await request<{ success: boolean; withdrawal: WithdrawalRecord }>('/api/auth/withdrawals', {
      method: 'POST',
      body: JSON.stringify({ amount, provider, code }),
    });
    return res.withdrawal;
  },

  async getWithdrawalHistory(): Promise<WithdrawalRecord[]> {
    const res = await request<{ success: boolean; withdrawals: WithdrawalRecord[] }>('/api/auth/withdrawals', {
      method: 'GET',
    });
    return res.withdrawals;
  },

  async updateRunners(payload: {
    equippedRunnerId?: string;
    runnerCooldowns?: Record<string, number>;
  }): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/runners', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.user) {
      const currentStored = getStoredUser();
      if (currentStored) {
        setStoredSession(getStoredToken() || '', { ...currentStored, ...res.user });
      }
    }
    return res;
  },

  async repairRunner(runnerInstanceId: string, quantity: number): Promise<{
    success: boolean;
    message: string;
    user?: Partial<User>;
  }> {
    const res = await request<{ success: boolean; message: string; user?: Partial<User> }>('/api/auth/runners/repair', {
      method: 'POST',
      body: JSON.stringify({ runnerInstanceId, quantity }),
    });
    if (res.user) {
      const currentStored = getStoredUser();
      if (currentStored) setStoredSession(getStoredToken() || '', { ...currentStored, ...res.user });
    }
    return res;
  },

  async purchaseRunner(runnerId: string): Promise<{
    success: boolean;
    message: string;
    user?: Partial<User>;
    purchasedRunner?: OwnedRunner;
  }> {
    const res = await request<{
      success: boolean;
      message: string;
      user?: Partial<User>;
      purchasedRunner?: OwnedRunner;
    }>('/api/auth/runners/purchase', {
      method: 'POST',
      body: JSON.stringify({ runnerId }),
    });
    if (res.user) {
      const currentStored = getStoredUser();
      if (currentStored) {
        setStoredSession(getStoredToken() || '', { ...currentStored, ...res.user });
      }
    }
    return res;
  },

  async checkHealth(): Promise<{ status: string; system: string; database: string }> {
    return request<{ status: string; system: string; database: string }>('/api/health', {
      method: 'GET',
    });
  },
};
