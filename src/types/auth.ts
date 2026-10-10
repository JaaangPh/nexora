export interface User {
  id: string;
  phoneNumber: string;
  role: 'member' | 'admin';
  inviteCodeUsed?: string;
  referralCode?: string; // e.g. "NT723906"
  status?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface InviteValidationResponse {
  success: boolean;
  valid: boolean;
  message: string;
  code?: string;
  remainingUses?: string | number;
}

export interface InviteCodeItem {
  code: string;
  description: string;
  max_uses: number;
  times_used: number;
  is_active: number;
}
