import React, { useState } from 'react';
import { Phone, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types/auth';
import { SecurityNotice } from './SecurityNotice';

interface LoginFormProps {
  onSuccess: (user: User) => void;
  onNavigateToRegister: () => void;
  prefilledPhone?: string;
  prefilledPassword?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onNavigateToRegister,
  prefilledPhone = '',
  prefilledPassword = '',
}) => {
  const [phoneNumber, setPhoneNumber] = useState(prefilledPhone);
  const [password, setPassword] = useState(prefilledPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (prefilledPhone) setPhoneNumber(prefilledPhone);
    if (prefilledPassword) setPassword(prefilledPassword);
  }, [prefilledPhone, prefilledPassword]);

  // Field validation helper
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side quick checks
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter your phone number.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await api.login(phoneNumber, password);
      if (response.success && response.user) {
        onSuccess(response.user);
      } else {
        setErrorMessage(response.message || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid phone number or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="panel-login" role="tabpanel" aria-labelledby="tab-login" className="w-full">
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-[2px] w-6 rounded-full bg-[#2459C4]" />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#2459C4]">
            Member Access
          </span>
        </div>
        <h2 className="font-['Plus_Jakarta_Sans',sans-serif] text-2xl font-black tracking-tight text-[#17233B] sm:text-[26px]">
          Welcome back, runner.
        </h2>
        <p className="mt-1 text-xs font-normal text-[#64748B] sm:text-sm">
          Pick up where you left off and get moving.
        </p>
      </div>

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

      {/* Form Fields */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Phone Number Field */}
        <div>
          <label
            htmlFor="login-phone"
            className="block text-xs sm:text-[13px] font-bold text-[#17233B] mb-1.5"
          >
            Phone Number
          </label>
          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <Phone className="w-4 h-4" />
            </div>
            <input
              id="login-phone"
              name="phone"
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
              placeholder="Enter your phone number"
              className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-[#F8FAFC] text-[#17233B] text-sm rounded-2xl border border-[#DCE4EF] placeholder:text-[#94A3B8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2459C4]/25 focus:border-[#2459C4] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Account Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs sm:text-[13px] font-bold text-[#17233B]"
            >
              Account Password
            </label>
          </div>
          <div className="relative rounded-2xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Enter your password"
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

        {/* Login Primary Button */}
        <div className="pt-2">
          <button
            type="submit"
            id="btn-login"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#142B5B] via-[#1B408B] to-[#2459C4] hover:from-[#0F224A] hover:to-[#1E4BA8] active:scale-[0.99] text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-950/20 flex items-center justify-center gap-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2459C4] focus:ring-offset-2 disabled:opacity-75 disabled:cursor-wait"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 text-cyan-300" />
                <span>Login</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Security Notice Card */}
      <div className="mt-5">
        <SecurityNotice
          title="Secure Sign In"
          description="Your login information is protected. Never share your password with anyone."
        />
      </div>

      {/* Quick Switch Link */}
      <div className="mt-5 text-center">
        <p className="text-xs text-[#64748B]">
          Don't have an account yet?{' '}
          <button
            type="button"
            onClick={onNavigateToRegister}
            className="font-bold text-[#2459C4] hover:underline focus:outline-none"
          >
            Create an Account
          </button>
        </p>
      </div>

      {/* Secure Member Portal Footer */}
      <footer className="mt-6 text-center">
        <p className="text-[11px] text-[#94A3B8] font-medium tracking-tight">
          Nexora Technologies • Secure Member Portal
        </p>
      </footer>
    </div>
  );
};
