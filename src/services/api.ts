import { Capacitor } from '@capacitor/core';
import { AuthResponse, InviteValidationResponse, InviteCodeItem, OwnedRunner, User } from '../types/auth';
import { WorkoutSnapshot } from '../types/workout';

export type DepositBankCode = 'gcash' | 'PMP' | 'GOT' | 'qrph' | 'usdt-trc20';
export type DepositStatus = 'pending' | 'paid' | 'failed' | 'expired';

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

  async getWorkoutSnapshot(): Promise<{ success: boolean; workoutSnapshot: WorkoutSnapshot | null }> {
    return request<{ success: boolean; workoutSnapshot: WorkoutSnapshot | null }>('/api/auth/workout', {
      method: 'GET',
    });
  },

  async saveWorkoutSnapshot(snapshot: WorkoutSnapshot): Promise<{ success: boolean; workoutSnapshot: WorkoutSnapshot }> {
    return request<{ success: boolean; workoutSnapshot: WorkoutSnapshot }>('/api/auth/workout', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });
  },

  async clearWorkoutSnapshot(): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/api/auth/workout', {
      method: 'DELETE',
    });
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
