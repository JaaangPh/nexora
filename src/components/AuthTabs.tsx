import React from 'react';

export type AuthMode = 'login' | 'register';

interface AuthTabsProps {
  activeTab: AuthMode;
  onTabChange: (tab: AuthMode) => void;
  disabled?: boolean;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, onTabChange, disabled = false }) => {
  return (
    <div
      role="tablist"
      aria-label="Authentication Options"
      className="w-full bg-[#F1F5F9] p-1.5 rounded-2xl flex items-center gap-1 shadow-inner select-none"
    >
      <button
        type="button"
        role="tab"
        id="tab-login"
        aria-selected={activeTab === 'login'}
        aria-controls="panel-login"
        disabled={disabled}
        onClick={() => onTabChange('login')}
        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2459C4]/40 ${
          activeTab === 'login'
            ? 'bg-gradient-to-r from-[#142B5B] to-[#2459C4] text-white shadow-md shadow-blue-900/20'
            : 'text-[#64748B] hover:text-[#17233B] hover:bg-white/50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        Login
      </button>

      <button
        type="button"
        role="tab"
        id="tab-register"
        aria-selected={activeTab === 'register'}
        aria-controls="panel-register"
        disabled={disabled}
        onClick={() => onTabChange('register')}
        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#2459C4]/40 ${
          activeTab === 'register'
            ? 'bg-gradient-to-r from-[#142B5B] to-[#2459C4] text-white shadow-md shadow-blue-900/20'
            : 'text-[#64748B] hover:text-[#17233B] hover:bg-white/50'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        Create Account
      </button>
    </div>
  );
};
