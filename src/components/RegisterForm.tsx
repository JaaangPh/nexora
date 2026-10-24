import React, { useState } from 'react';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types/auth';
import { PhoneNumberInput } from './PhoneNumberInput';
import { TurnstileWidget } from './TurnstileWidget';

interface RegisterFormProps {
  onSuccess: (user: User) => void;
  onNavigateToLogin: () => void;
  initialInviteCode?: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onNavigateToLogin,
  initialInviteCode = '',
}) => {
  const [phoneNumber, setPhoneNumber] = useState('+63');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [turnstileResetCount, setTurnstileResetCount] = useState(0);

  // Submit Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Required fields check
    if (!/^\+\d{7,15}$/.test(phoneNumber)) {
      setErrorMessage('Please enter a valid international phone number, including the country code.');
      return;
    }
    if (!password) {
      setErrorMessage('Please create an account password.');
      return;
    }
    if (!confirmPassword) {
      setErrorMessage('Please confirm your password.');
      return;
    }
    // 2. Password mismatch check
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    // 3. Password minimum strength
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!turnstileToken) {
      setErrorMessage('Please complete the verification check before creating an account.');
      return;
    }

    // 4. Phone format check
    setIsLoading(true);

    try {
      const res = await api.register(phoneNumber, password, confirmPassword, inviteCode, turnstileToken);
      if (res.success && res.user) {
        setSuccessMessage('Registration successful! Redirecting to your secure portal...');
        setTimeout(() => {
          onSuccess(res.user!);
        }, 1000);
      } else {
        setErrorMessage(res.message || 'Registration rejected by the server.');
        setTurnstileToken('');
        setTurnstileResetCount((prev) => prev + 1);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please check your information.');
      setTurnstileToken('');
      setTurnstileResetCount((prev) => prev + 1);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="panel-register" role="tabpanel" aria-labelledby="tab-register" className="w-full">
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-[2px] w-6 rounded-full bg-[#2459C4]" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#2459C4]">
            Start your journey
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-black tracking-tight text-[#17233B] sm:text-[26px]">
          Make every move count.
        </h2>
        <p className="mt-1 text-xs font-normal leading-relaxed text-[#64748B] sm:text-sm">
          Create your account and get ready to move, track, and earn.
        </p>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div
          role="status"
          className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800 animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Error Alert Message */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700 animate-fade-in"
        >
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* 1. Phone Number */}
        <div>
          <label
            htmlFor="reg-phone"
            className="block text-xs sm:text-[13px] font-bold text-[#17233B] mb-1.5"
          >
            Phone Number
          </label>
          <PhoneNumberInput
            id="reg-phone"
            name="phoneNumber"
            value={phoneNumber}
            disabled={isLoading}
            onChange={(value) => {
              setPhoneNumber(value);
              if (errorMessage) setErrorMessage(null);
            }}
          />
        </div>

        {/* 2. Account Password */}
        <div>
          <label
            htmlFor="reg-password"
            className="block text-xs sm:text-[13px] font-bold text-[#17233B] mb-1.5"
          >
            Account Password
          </label>
          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Create your password"
              className="w-full pl-10 pr-11 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border border-[#DCE4EF] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 focus:border-[#2459C4] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#17233B] focus:outline-none focus:text-[#2459C4] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 3. Confirm Password */}
        <div>
          <label
            htmlFor="reg-confirm-password"
            className="block text-xs sm:text-[13px] font-bold text-[#17233B] mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="reg-confirm-password"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              disabled={isLoading}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Confirm your password"
              className="w-full pl-10 pr-11 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border border-[#DCE4EF] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 focus:border-[#2459C4] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              tabIndex={0}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#17233B] focus:outline-none focus:text-[#2459C4] transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 4. Invite Code */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="reg-invite-code"
              className="block text-xs sm:text-[13px] font-bold text-[#17233B]"
            >
              Invite Code (Optional)
            </label>
          </div>

          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              id="reg-invite-code"
              name="inviteCode"
              type="text"
              autoCapitalize="characters"
              disabled={isLoading}
              value={inviteCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setInviteCode(val);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Optional referral code (e.g. NT723906)"
              className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border border-[#DCE4EF] focus:border-[#2459C4] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <p className="mt-1 pl-1 text-[11px] font-medium text-[#64748B]">
            Optional. If provided, the referral code must belong to an existing member.
          </p>
        </div>

        {/* Cloudflare Turnstile */}
        <div className="pt-2 flex justify-center">
          <TurnstileWidget
            onVerify={(token) => {
              setTurnstileToken(token);
              setErrorMessage(null);
            }}
            onExpire={() => setTurnstileToken('')}
            onError={() => {
              setTurnstileToken('');
              setErrorMessage('Verification challenge failed. Please try again.');
            }}
            resetTrigger={turnstileResetCount}
          />
        </div>

        {/* Create Account Primary Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="btn-register"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#142B5B] via-[#1B408B] to-[#2459C4] hover:from-[#0F224A] hover:to-[#1E4BA8] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-950/20 flex items-center justify-center gap-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2459C4] focus:ring-offset-2 disabled:opacity-75 disabled:cursor-wait"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 text-cyan-300" />
                <span>Create Account</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Brief Privacy & Security Note */}
      <p className="text-[11px] sm:text-xs text-[#64748B] text-center mt-4 px-2 leading-relaxed font-normal">
        Your account information is securely submitted through the registration form.
      </p>

      {/* Switch to Login Link */}
      <div className="mt-4 text-center">
        <p className="text-xs text-[#64748B]">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateToLogin}
            className="font-bold text-[#2459C4] hover:underline focus:outline-none"
          >
            Sign In Here
          </button>
        </p>
      </div>
    </div>
  );
};
