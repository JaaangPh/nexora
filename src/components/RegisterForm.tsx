import React, { useState } from 'react';
import { Phone, Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, Loader2, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types/auth';

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
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Invite code real-time validation state
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    valid?: boolean;
    message?: string;
  } | null>(null);

  // Auto validate when prefilled from invite link
  React.useEffect(() => {
    if (initialInviteCode && initialInviteCode.trim()) {
      handleCheckInvite(initialInviteCode);
    }
  }, [initialInviteCode]);

  // Validate Invite Code with Backend
  const handleCheckInvite = async (codeToCheck?: string) => {
    const code = (codeToCheck || inviteCode).trim();
    if (!code) {
      setInviteStatus(null);
      return;
    }

    setIsValidatingCode(true);
    try {
      const res = await api.validateInvite(code);
      if (res.valid) {
        setInviteStatus({ valid: true, message: res.message || 'Valid Invite Code' });
      } else {
        setInviteStatus({ valid: false, message: res.message || 'Invalid or Expired Code' });
      }
    } catch {
      setInviteStatus({ valid: false, message: 'Could not verify code with server.' });
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Submit Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Required fields check
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your phone number.');
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
    if (!inviteCode.trim()) {
      setErrorMessage('An invite code is required to create a Nexora account.');
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

    // 4. Phone format check
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleanPhone)) {
      setErrorMessage('Please enter a valid phone number (7 to 15 digits).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await api.register(phoneNumber, password, confirmPassword, inviteCode);
      if (res.success && res.user) {
        setSuccessMessage('Registration successful! Redirecting to your secure portal...');
        setTimeout(() => {
          onSuccess(res.user!);
        }, 1000);
      } else {
        setErrorMessage(res.message || 'Registration rejected by the server.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create account. Please check your information.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="panel-register" role="tabpanel" aria-labelledby="tab-register" className="w-full">
      {/* Registration Heading & Subtitle */}
      <h2 className="text-2xl sm:text-[26px] font-black text-[#17233B] tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
        Create Account
      </h2>
      <p className="text-xs sm:text-sm text-[#64748B] mt-1 mb-6 font-normal leading-relaxed">
        Create your Nexora Technologies account using your phone number, password, and invite code.
      </p>

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
          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <Phone className="w-4 h-4" />
            </div>
            <input
              id="reg-phone"
              name="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              disabled={isLoading}
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Your phone number"
              className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border border-[#DCE4EF] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 focus:border-[#2459C4] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
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
              Invite Code
            </label>
            {inviteStatus && (
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${
                  inviteStatus.valid ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {inviteStatus.valid ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Valid Code
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3" /> Invalid
                  </>
                )}
              </span>
            )}
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
              required
              disabled={isLoading}
              value={inviteCode}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setInviteCode(val);
                setInviteStatus(null);
                if (errorMessage) setErrorMessage(null);
              }}
              onBlur={() => handleCheckInvite()}
              placeholder="Enter your invite code"
              className={`w-full pl-10 pr-24 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                inviteStatus?.valid === true
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20'
                  : inviteStatus?.valid === false
                  ? 'border-red-400 ring-1 ring-red-400/20'
                  : 'border-[#DCE4EF] focus:border-[#2459C4]'
              }`}
            />
            {/* Verify Button Inline */}
            <div className="absolute inset-y-0 right-1.5 flex items-center">
              <button
                type="button"
                onClick={() => handleCheckInvite()}
                disabled={isLoading || isValidatingCode || !inviteCode.trim()}
                className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-[#17233B] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isValidatingCode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Check'}
              </button>
            </div>
          </div>
          {inviteStatus?.message && (
            <p
              className={`text-[11px] mt-1 pl-1 font-medium ${
                inviteStatus.valid ? 'text-emerald-700' : 'text-red-500'
              }`}
            >
              {inviteStatus.message}
            </p>
          )}
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
