import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Header } from './components/Header';
import { AuthTabs, AuthMode } from './components/AuthTabs';
import { LoginForm } from './components/LoginForm';
import { RegisterForm } from './components/RegisterForm';
import { Dashboard } from './components/Dashboard';
import { AboutWhitepaper } from './components/about';
import { InviteCodeHelper } from './components/InviteCodeHelper';
import { Admin } from './components/admin';
import { User } from './types/auth';
import { getStoredUser, getStoredToken, setStoredSession, api } from './services/api';
import { hasWorkoutInProgressInStorage } from './services/workoutStorage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AuthMode>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [prefilledInviteCode, setPrefilledInviteCode] = useState<string>('');
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState('');
  const [isUpdatingApp, setIsUpdatingApp] = useState(
    () => sessionStorage.getItem('nexora_update_in_progress') === '1'
  );
  const [isRefreshingAccount, setIsRefreshingAccount] = useState(false);
  const updateAvailableRef = useRef(false);
  const pullStartRef = useRef<{ x: number; y: number } | null>(null);
  const refreshInProgressRef = useRef(false);

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

  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentUser(null);
      setActiveTab('login');
      setSessionExpiredNotice('You were signed out because this account was opened on another device.');
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
      if (currentPath !== '/' && currentPath !== '/about') window.history.pushState({}, '', '/');
    };

    window.addEventListener('nexora:session-expired', handleSessionExpired);
    return () => window.removeEventListener('nexora:session-expired', handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    document.body.classList.add('nexora-native');
    return () => document.body.classList.remove('nexora-native');
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    let isChecking = false;
    const validateCurrentSession = async () => {
      if (isChecking || document.visibilityState !== 'visible') return;
      isChecking = true;
      try {
        await api.getMe();
      } catch {
        // The API request dispatches the session-expired event for invalidated sessions.
      } finally {
        isChecking = false;
      }
    };

    const intervalId = window.setInterval(validateCurrentSession, 20000);
    window.addEventListener('focus', validateCurrentSession);
    document.addEventListener('visibilitychange', validateCurrentSession);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', validateCurrentSession);
      document.removeEventListener('visibilitychange', validateCurrentSession);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let isChecking = false;
    const reloadWhenSafe = () => {
      if (!updateAvailableRef.current || hasWorkoutInProgressInStorage()) return;
      updateAvailableRef.current = false;
      sessionStorage.setItem('nexora_update_in_progress', '1');
      setIsUpdatingApp(true);
      window.setTimeout(() => window.location.reload(), 300);
    };

    const checkForAppUpdate = async () => {
      if (isChecking || document.visibilityState !== 'visible') return;
      isChecking = true;
      try {
        const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const version = await response.json() as { buildId?: string };
        if (version.buildId && version.buildId !== __APP_BUILD_ID__) {
          updateAvailableRef.current = true;
          reloadWhenSafe();
        }
      } catch {
        // Offline APK sessions will retry when the app is visible again.
      } finally {
        isChecking = false;
      }
    };

    const handleSafeToUpdate = () => reloadWhenSafe();
    const handleRequestedUpdateCheck = () => void checkForAppUpdate();
    const intervalId = window.setInterval(checkForAppUpdate, 60000);
    window.addEventListener('focus', checkForAppUpdate);
    document.addEventListener('visibilitychange', checkForAppUpdate);
    window.addEventListener('nexora:workout-safe-to-update', handleSafeToUpdate);
    window.addEventListener('nexora:check-app-update', handleRequestedUpdateCheck);
    void checkForAppUpdate();

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkForAppUpdate);
      document.removeEventListener('visibilitychange', checkForAppUpdate);
      window.removeEventListener('nexora:workout-safe-to-update', handleSafeToUpdate);
      window.removeEventListener('nexora:check-app-update', handleRequestedUpdateCheck);
    };
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
              ownedRunners: res.user.ownedRunners && res.user.ownedRunners.length > 0 ? res.user.ownedRunners : (cachedUser.ownedRunners || []),
              equippedRunnerId: res.user.equippedRunnerId || cachedUser.equippedRunnerId,
              runnerCooldowns: res.user.runnerCooldowns || cachedUser.runnerCooldowns || {},
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

  useEffect(() => {
    if (!isInitializing && isUpdatingApp) {
      sessionStorage.removeItem('nexora_update_in_progress');
      setIsUpdatingApp(false);
    }
  }, [isInitializing, isUpdatingApp]);

  const handleUpdateUser = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    const token = getStoredToken();
    if (token) {
      setStoredSession(token, updatedUser);
    }
  };

  const refreshAccountFromPull = async () => {
    if (!currentUser || refreshInProgressRef.current) return;
    refreshInProgressRef.current = true;
    setIsRefreshingAccount(true);
    let timeoutId = 0;
    try {
      const result = await Promise.race([
        api.getMe(),
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('Account refresh timed out.')), 15000);
        }),
      ]);
      handleUpdateUser({ ...currentUser, ...result.user });
      if (Capacitor.isNativePlatform()) {
        window.dispatchEvent(new Event('nexora:check-app-update'));
      }
    } catch {
      // Keep cached account data when offline; API auth failures log the user out.
    } finally {
      window.clearTimeout(timeoutId);
      refreshInProgressRef.current = false;
      setIsRefreshingAccount(false);
    }
  };

  const handleDashboardTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!Capacitor.isNativePlatform()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const scrollContainer = target.closest('.dashboard-scroll');
    if (!(scrollContainer instanceof HTMLElement) || scrollContainer.scrollTop > 0) {
      pullStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    pullStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleDashboardTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = pullStartRef.current;
    pullStartRef.current = null;
    if (!start || !currentUser) return;
    const touch = event.changedTouches[0];
    const pullDistance = touch.clientY - start.y;
    const horizontalDistance = Math.abs(touch.clientX - start.x);
    if (pullDistance >= 90 && pullDistance > horizontalDistance * 1.4) {
      void refreshAccountFromPull();
    }
  };

  const handleLoginSuccess = (user: User) => {
    setSessionExpiredNotice('');
    setCurrentUser(user);
  };

  const handleRegisterSuccess = (user: User) => {
    setSessionExpiredNotice('');
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    let persistWorkout = Promise.resolve();
    window.dispatchEvent(new CustomEvent('nexora:logout', {
      detail: {
        waitUntil: (promise: Promise<void>) => {
          persistWorkout = promise;
        },
      },
    }));
    await persistWorkout;
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

  if (window.location.pathname.replace(/\/+$/, '') === '/about') {
    return <AboutWhitepaper />;
  }

  if (window.location.pathname.replace(/\/+$/, '') === '/admin') {
    return <Admin />;
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#142B5B] border-t-cyan-400 rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-wider text-[#142B5B] uppercase">
            {isUpdatingApp ? 'Updating Stepora...' : 'Loading Stepora Portal...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full bg-[#060D1E] flex flex-col justify-center items-center antialiased font-sans selection:bg-[#2459C4] selection:text-white"
      onTouchStart={handleDashboardTouchStart}
      onTouchEnd={handleDashboardTouchEnd}
    >
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
              <section className="relative -mt-9 z-20 min-h-0 px-4 sm:px-6 pb-8 bg-white rounded-t-[32px] flex-1 flex flex-col overflow-y-auto shadow-card">
                <div className="pt-4 flex-1 flex flex-col">
                  {sessionExpiredNotice && (
                    <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                      {sessionExpiredNotice}
                    </p>
                  )}
                  {/* Tab Switcher */}
                  <div className="mb-6">
                    <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} />
                  </div>

                  {/* Tab Panels */}
                  <div className="flex-1">
                    {activeTab === 'login' ? (
                      <LoginForm
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
      {(isUpdatingApp || isRefreshingAccount) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#060D1E] text-white">
          <RefreshCw className="h-10 w-10 animate-spin text-[#D8FD2F]" />
          <span className="text-sm font-extrabold uppercase tracking-wider">
            {isUpdatingApp ? 'Updating Nexora...' : 'Refreshing account...'}
          </span>
        </div>
      )}
    </div>
  );
};
export default App;
