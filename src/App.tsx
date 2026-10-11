import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthTabs, AuthMode } from './components/AuthTabs';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { Dashboard } from './components/Dashboard';
import { InviteCodeHelper } from './components/InviteCodeHelper';
import { User } from './types/auth';
import { getStoredUser, getStoredToken, setStoredSession, api } from './services/api';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AuthMode>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [prefilledInviteCode, setPrefilledInviteCode] = useState<string>('');

  // 1. Check URL for invitation link or referral code on mount
  useEffect(() => {
    // Check path: e.g. /register/NT723906
    const path = window.location.pathname;
    const pathMatch = path.match(/\/register\/([A-Za-z0-9\-_]+)/i);

    // Check search params: e.g. ?ref=NT723906 or ?invite=NT723906
    const searchParams = new URLSearchParams(window.location.search);
    const queryCode = searchParams.get('ref') || searchParams.get('invite') || searchParams.get('code');

    // Check hash: e.g. #/register/NT723906
    const hash = window.location.hash;
    const hashMatch = hash.match(/#\/register\/([A-Za-z0-9\-_]+)/i);

    const detected = (pathMatch && pathMatch[1]) || (hashMatch && hashMatch[1]) || queryCode;

    if (detected) {
      const formatted = detected.trim().toUpperCase();
      console.log('[Referral] Detected referral code in URL:', formatted);
      setPrefilledInviteCode(formatted);
      setActiveTab('register');
    }
  }, []);

  // 2. Check existing session on load
  useEffect(() => {
    const cachedUser = getStoredUser();
    if (cachedUser) {
      setCurrentUser(cachedUser);
      // Validate session with backend
      api
        .getMe()
        .then((res) => {
          if (res.user) {
            setCurrentUser({
              ...res.user,
              balance: res.user.balance !== undefined ? res.user.balance : (cachedUser.balance ?? 0),
              totalDeposit: res.user.totalDeposit !== undefined ? res.user.totalDeposit : (cachedUser.totalDeposit ?? 0),
            });
          }
        })
        .catch(() => {
          setCurrentUser(null);
        })
        .finally(() => {
          setIsInitializing(false);
        });
    } else {
      setIsInitializing(false);
    }
  }, []);

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    const token = getStoredToken();
    if (token) {
      setStoredSession(token, updatedUser);
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleRegisterSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setActiveTab('login');
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
  };

  const handleSelectInviteCode = (code: string) => {
    setPrefilledInviteCode(code);
    setActiveTab('register');
  };

  const [prefilledPhone, setPrefilledPhone] = useState<string>('');
  const [prefilledPassword, setPrefilledPassword] = useState<string>('');

  const handleFillAdmin = () => {
    setActiveTab('login');
    setPrefilledPhone('+18005550199');
    setPrefilledPassword('AdminPassword2025!');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#142B5B] border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wider text-[#142B5B] uppercase">
            Loading Nexora Portal...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#060D1E] flex flex-col justify-center items-center antialiased font-sans selection:bg-[#2459C4] selection:text-white">
      {/* Centered Device / App Canvas Container */}
      <div className={`w-full max-w-[440px] mx-auto ${currentUser ? 'h-screen sm:h-[840px] sm:my-6 sm:rounded-[36px]' : 'min-h-screen sm:min-h-0 sm:my-6 sm:rounded-[36px]'} bg-[#08132B] shadow-2xl shadow-blue-950/40 overflow-hidden flex flex-col border sm:border-[#1E3A78]/50 relative`}>
        <main className="w-full flex-1 flex flex-col h-full overflow-hidden">
          {currentUser ? (
            /* Authenticated Member View (Full Mobile App Experience) */
            <Dashboard user={currentUser} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
          ) : (
            /* Unauthenticated Member View */
            <>
              <Header />
              <section className="relative -mt-9 z-20 px-4 sm:px-6 pb-8 bg-white rounded-t-[32px] flex-1 flex flex-col shadow-card">
                <div className="pt-4 flex-1 flex flex-col">
                  {/* Tab Switcher */}
                  <div className="mb-6">
                    <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />
                  </div>

                  {/* Tab Panels */}
                  <div className="flex-1">
                    {activeTab === 'login' ? (
                      <LoginForm
                        key={`${prefilledPhone}-${prefilledPassword}`}
                        prefilledPhone={prefilledPhone}
                        prefilledPassword={prefilledPassword}
                        onSuccess={handleLoginSuccess}
                        onNavigateToRegister={() => setActiveTab('register')}
                      />
                    ) : (
                      <RegisterForm
                        key={prefilledInviteCode}
                        initialInviteCode={prefilledInviteCode}
                        onSuccess={handleRegisterSuccess}
                        onNavigateToLogin={() => setActiveTab('login')}
                      />
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
export default App;
