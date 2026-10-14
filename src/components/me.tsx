import React, { useEffect, useRef, useState } from 'react';
import {
  User as UserIcon,
  Edit2,
  Camera,
  Save,
  X,
  Loader2,
  Check,
  Copy,
  LogOut,
  Users,
  Footprints,
  CreditCard,
  Headphones,
  ClipboardList,
  Smartphone,
  ChevronRight,
  Plus,
  Trash2,
} from 'lucide-react';
import { User } from '../types/auth';
import { api, PayoutAccount, PayoutProvider } from '../services/api';

interface MeTabProps {
  user: User;
  onLogout: () => void;
  onUpdateUser?: (user: User) => void;
  onNavigateTab: (tab: 'market' | 'track' | 'team' | 'marathon' | 'myrunners' | 'myrecord') => void;
  onOpenCustomerService: () => void;
  onOpenAppModal: () => void;
}

export const MeTab: React.FC<MeTabProps> = ({
  user,
  onLogout,
  onUpdateUser,
  onNavigateTab,
  onOpenCustomerService,
  onOpenAppModal,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [profileImage, setProfileImage] = useState(user.profileImage);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [profileImageMessage, setProfileImageMessage] = useState<string | null>(null);
  const [isManagingPayoutAccounts, setIsManagingPayoutAccounts] = useState(false);
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [isLoadingPayoutAccounts, setIsLoadingPayoutAccounts] = useState(false);
  const [selectedPayoutProvider, setSelectedPayoutProvider] = useState<PayoutProvider | null>(null);
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutAccountHolder, setPayoutAccountHolder] = useState('');
  const [payoutAccountError, setPayoutAccountError] = useState<string | null>(null);
  const [isSavingPayoutAccount, setIsSavingPayoutAccount] = useState(false);
  const [deletingPayoutProvider, setDeletingPayoutProvider] = useState<PayoutProvider | null>(null);
  const profileImageInput = useRef<HTMLInputElement>(null);
  const usernameMigrationAttempted = useRef(false);

  useEffect(() => {
    setProfileImage(user.profileImage);
  }, [user.profileImage]);

  useEffect(() => {
    if (!isManagingPayoutAccounts) return;

    let isActive = true;
    setIsLoadingPayoutAccounts(true);
    setPayoutAccountError(null);
    api.getPayoutAccounts()
      .then((accounts) => {
        if (isActive) setPayoutAccounts(accounts);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setPayoutAccountError(error instanceof Error ? error.message : 'Could not load payout accounts.');
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingPayoutAccounts(false);
      });

    return () => {
      isActive = false;
    };
  }, [isManagingPayoutAccounts]);

  useEffect(() => {
    if (
      usernameMigrationAttempted.current ||
      !user.username ||
      !/^NexoraMember_\d+$/i.test(user.username)
    ) return;

    usernameMigrationAttempted.current = true;
    let isActive = true;
    api.getMe()
      .then(({ user: refreshedUser }) => {
        if (isActive) onUpdateUser?.(refreshedUser);
      })
      .catch((error: unknown) => {
        if (isActive) {
          setUsernameError(error instanceof Error ? error.message : 'Could not refresh your account username.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [user.id, user.username, onUpdateUser]);

  const nexoraId = (user.referralCode || user.id)
    .replace(/\D/g, '')
    .slice(-5)
    .padStart(5, '0');
  const menuItems = [
    { label: 'TEAM MARATHON', icon: Users, onClick: () => onNavigateTab('marathon') },
    { label: 'MY RUNNERS', icon: Footprints, onClick: () => onNavigateTab('myrunners') },
    { label: 'BANK ACCOUNT', icon: CreditCard, onClick: () => setIsManagingPayoutAccounts(true) },
    { label: 'CUSTOMER SERVICE', icon: Headphones, onClick: onOpenCustomerService },
    { label: 'MY RECORDS', icon: ClipboardList, onClick: () => onNavigateTab('myrecord') },
    { label: 'DOWNLOAD APP', icon: Smartphone, onClick: onOpenAppModal },
  ];

  const handleCopyId = () => {
    navigator.clipboard.writeText(nexoraId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveUsername = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) return;

    setIsSavingUsername(true);
    setUsernameError(null);

    try {
      const res = await api.updateUsername(clean);
      if (res.user && onUpdateUser) {
        onUpdateUser(res.user);
      }
      setUsernameSuccess(true);
      setIsEditingUsername(false);
      setTimeout(() => setUsernameSuccess(false), 2500);
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username.');
    } finally {
      setIsSavingUsername(false);
    }
  };

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setProfileImageMessage(null);
    if (!file.type.startsWith('image/')) {
      setProfileImageMessage('Choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfileImageMessage('Choose an image smaller than 10 MB.');
      return;
    }

    setIsUploadingProfileImage(true);
    try {
      const bitmap = await createImageBitmap(file);
      let compressedImage: Blob | null = null;
      try {
        const squareSize = Math.min(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Your device could not prepare this photo.');

        for (const size of [320, 256, 192]) {
          canvas.width = size;
          canvas.height = size;
          context.drawImage(
            bitmap,
            (bitmap.width - squareSize) / 2,
            (bitmap.height - squareSize) / 2,
            squareSize,
            squareSize,
            0,
            0,
            size,
            size
          );

          for (const quality of [0.82, 0.68, 0.54, 0.4]) {
            compressedImage = await new Promise<Blob | null>((resolve) => {
              canvas.toBlob(resolve, 'image/jpeg', quality);
            });
            if (compressedImage && compressedImage.size <= 60 * 1024) break;
          }
          if (compressedImage && compressedImage.size <= 60 * 1024) break;
        }
      } finally {
        bitmap.close();
      }

      if (!compressedImage || compressedImage.size > 60 * 1024) {
        throw new Error('This photo could not be compressed small enough. Try another image.');
      }

      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Could not prepare the selected photo.'));
        };
        reader.onerror = () => reject(new Error('Could not read the selected photo.'));
        reader.readAsDataURL(compressedImage);
      });

      const response = await api.updateProfileImage(imageDataUrl);
      if (!response.user) throw new Error('The server did not return the updated profile.');
      setProfileImage(response.user.profileImage);
      onUpdateUser?.(response.user);
      setProfileImageMessage('Profile photo updated.');
    } catch (error: unknown) {
      setProfileImageMessage(error instanceof Error ? error.message : 'Failed to update profile photo.');
    } finally {
      setIsUploadingProfileImage(false);
    }
  };

  const openPayoutAccountForm = (provider: PayoutProvider) => {
    const existingAccount = payoutAccounts.find((account) => account.provider === provider);
    setSelectedPayoutProvider(provider);
    setPayoutAccountNumber(existingAccount?.accountNumber || '');
    setPayoutAccountHolder(existingAccount?.accountHolder || '');
    setPayoutAccountError(null);
  };

  const handleSavePayoutAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPayoutProvider) return;

    const accountNumber = payoutAccountNumber.replace(/[\s-]/g, '');
    const accountHolder = payoutAccountHolder.trim();
    if (!/^\d{7,20}$/.test(accountNumber)) {
      setPayoutAccountError('Enter an account number containing 7 to 20 digits.');
      return;
    }
    if (accountHolder.length < 2 || accountHolder.length > 80) {
      setPayoutAccountError('Enter the account holder name (2 to 80 characters).');
      return;
    }

    setIsSavingPayoutAccount(true);
    setPayoutAccountError(null);
    try {
      const accounts = await api.savePayoutAccount({
        provider: selectedPayoutProvider,
        accountNumber,
        accountHolder,
      });
      setPayoutAccounts(accounts);
      setSelectedPayoutProvider(null);
    } catch (error: unknown) {
      setPayoutAccountError(error instanceof Error ? error.message : 'Could not save this payout account.');
    } finally {
      setIsSavingPayoutAccount(false);
    }
  };

  const handleDeletePayoutAccount = async (provider: PayoutProvider) => {
    setDeletingPayoutProvider(provider);
    setPayoutAccountError(null);
    try {
      const accounts = await api.deletePayoutAccount(provider);
      setPayoutAccounts(accounts);
      if (selectedPayoutProvider === provider) setSelectedPayoutProvider(null);
    } catch (error: unknown) {
      setPayoutAccountError(error instanceof Error ? error.message : 'Could not remove this payout account.');
    } finally {
      setDeletingPayoutProvider(null);
    }
  };

  const providerLabels: Record<PayoutProvider, string> = {
    gcash: 'GCash',
    maya: 'Maya',
    gotyme: 'GoTyme',
  };
  const renderProviderLogo = (provider: PayoutProvider, compact = false) => (
    <span
      className={`inline-flex items-center gap-2 ${compact ? 'min-w-[84px]' : ''}`}
      aria-label={providerLabels[provider]}
    >
      {provider === 'gotyme' && (
        <svg viewBox="0 0 20 20" className="h-5 w-5 flex-shrink-0" aria-hidden="true">
          <path d="M2 3h4v14H2zM8 3h4v14H8zM14 3h4v14h-4z" fill="#26C6B8" />
        </svg>
      )}
      <span
        className={`font-black tracking-tight ${
          provider === 'gcash' ? 'text-[#007DFE]' : provider === 'maya' ? 'text-[#35B36F]' : 'text-white'
        } ${compact ? 'text-sm' : 'text-base'}`}
      >
        {providerLabels[provider]}
      </span>
    </span>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="relative overflow-hidden rounded-2xl border border-[#232731] bg-[#171A21] p-4 shadow-xl">
        <div className="relative flex items-center gap-3">
          <div className="relative h-12 w-12 flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#D8FD2F] text-[#08132B]">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-6 w-6" />
              )}
            </div>
            <input
              ref={profileImageInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfileImageChange}
              aria-label="Choose a profile photo"
            />
            <button
              type="button"
              onClick={() => profileImageInput.current?.click()}
              disabled={isUploadingProfileImage}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#171A21] bg-[#D8FD2F] text-[#08132B] disabled:opacity-60"
              aria-label={profileImage ? 'Change profile photo' : 'Upload profile photo'}
              title={profileImage ? 'Change profile photo' : 'Upload profile photo'}
            >
              {isUploadingProfileImage
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Camera className="h-3 w-3" />}
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-white">{user.phoneNumber}</p>
            <p className="text-xs font-medium text-slate-300">Welcome back, {user.username || 'Member'}</p>
          </div>
        </div>
        {profileImageMessage && (
          <p
            role="status"
            className={`mt-2 text-[11px] font-semibold ${profileImageMessage.includes('updated') ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {profileImageMessage}
          </p>
        )}

        <div className="relative mt-4 grid grid-cols-2 divide-x divide-[#232731] rounded-xl border border-[#232731] bg-[#10141D] px-3 py-2.5">
          <div className="pr-3">
            <p className="text-[11px] font-semibold text-slate-400">Main Balance</p>
            <p className="text-lg font-black text-white">
              ₱{(user.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="pl-3">
            <p className="text-[11px] font-semibold text-slate-400">Total Deposit</p>
            <p className="text-lg font-black text-[#D8FD2F]">
              ₱{(user.totalDeposit ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </section>

      {/* Editable Username Card */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Account Username</span>
          {!isEditingUsername && (
            <button
              onClick={() => {
                setUsernameInput(user.username || '');
                setIsEditingUsername(true);
              }}
              className="text-xs text-cyan-400 hover:text-white font-bold flex items-center gap-1 active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
        </div>

        {isEditingUsername ? (
          <form onSubmit={handleSaveUsername} className="flex items-center gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter new username"
              className="flex-1 px-3 py-2 text-xs font-bold text-white bg-[#08132B] border border-[#2459C4] rounded-xl focus:outline-none"
              autoFocus
            />
            <button
              type="submit"
              disabled={isSavingUsername || !usernameInput.trim()}
              className="px-3 py-2 bg-cyan-400 text-[#08132B] text-xs font-bold rounded-xl flex items-center gap-1 disabled:opacity-50"
            >
              {isSavingUsername ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditingUsername(false)}
              className="p-2 text-blue-200 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-base font-black font-mono text-white">
              {user.username || 'Pablo'}
            </p>
            {usernameSuccess && (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>
        )}
        {usernameError && <p className="text-[11px] text-red-400 font-semibold">{usernameError}</p>}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#1E3E80] bg-[#0D204A] px-3">
        {menuItems.map(({ label, icon: Icon, onClick }, index) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className={`flex min-h-[58px] w-full items-center gap-3 text-left transition-colors hover:bg-white/5 active:bg-white/10 ${
              index < menuItems.length - 1 ? 'border-b border-[#1E3A78]' : ''
            }`}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#D8FD2F] text-[#0B1A3D]">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="flex-1 text-xs font-semibold tracking-wide text-white">{label}</span>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-200/60" />
          </button>
        ))}
      </section>

      {/* User Details Box */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3 text-xs">
        <div className="flex justify-between items-center border-b border-[#1E3A78] pb-2">
          <span className="text-blue-200/70 font-semibold">Role</span>
          <span className="font-bold text-cyan-300 capitalize">{user.role}</span>
        </div>
        <div className="flex justify-between items-center border-b border-[#1E3A78] pb-2">
          <span className="text-blue-200/70 font-semibold">Invite Key</span>
          <span className="font-bold text-white font-mono">{user.inviteCodeUsed || 'NEXORA-2025'}</span>
        </div>
        <div>
          <span className="text-blue-200/70 font-semibold block mb-1">STEPORA ID</span>
          <div className="flex items-center justify-between bg-[#08132B] p-2 rounded-xl border border-[#1E3A78]">
            <span className="font-mono text-[11px] text-cyan-200 truncate pr-2">{nexoraId}</span>
            <button onClick={handleCopyId} className="text-cyan-400 hover:text-white font-bold flex items-center gap-1 flex-shrink-0">
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>

      {isManagingPayoutAccounts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => {
            setIsManagingPayoutAccounts(false);
            setSelectedPayoutProvider(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-accounts-title"
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#2459C4]/60 bg-[#091738] p-5 text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="payout-accounts-title" className="text-lg font-extrabold">Payout Accounts</h2>
                <p className="mt-1 text-xs leading-5 text-blue-100/70">
                  Add one account for each provider. Saved details are private to your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsManagingPayoutAccounts(false);
                  setSelectedPayoutProvider(null);
                }}
                aria-label="Close payout accounts"
                className="rounded-lg p-1 text-blue-200 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoadingPayoutAccounts ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-blue-100/70">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading saved accounts...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {(['gcash', 'maya', 'gotyme'] as const).map((provider) => {
                    const account = payoutAccounts.find((item) => item.provider === provider);
                    return (
                      <div key={provider} className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex min-h-9 flex-1 items-center">
                            {renderProviderLogo(provider, true)}
                          </div>
                          {account ? (
                            <>
                              <div className="min-w-0 flex-1 text-right">
                                <p className="truncate text-xs font-semibold text-white">{account.accountHolder}</p>
                                <p className="text-[11px] text-blue-100/60">
                                  •••• {account.accountNumber.slice(-4)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleDeletePayoutAccount(provider)}
                                disabled={deletingPayoutProvider === provider}
                                aria-label={`Remove ${providerLabels[provider]} account`}
                                className="rounded-lg p-2 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {deletingPayoutProvider === provider
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => openPayoutAccountForm(provider)}
                                className="rounded-lg bg-[#17366F] px-3 py-2 text-xs font-bold text-white hover:bg-[#2459C4]"
                              >
                                Edit
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openPayoutAccountForm(provider)}
                              className="flex items-center gap-1 rounded-lg bg-[#D8FD2F] px-3 py-2 text-xs font-extrabold text-[#08132B]"
                            >
                              <Plus className="h-3.5 w-3.5" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedPayoutProvider && (
                  <form onSubmit={handleSavePayoutAccount} className="mt-4 space-y-3 rounded-2xl border border-[#2459C4]/50 bg-[#0D204A] p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-extrabold">
                        {payoutAccounts.some((item) => item.provider === selectedPayoutProvider) ? 'Edit' : 'Add'}{' '}
                        {providerLabels[selectedPayoutProvider]} account
                      </h3>
                      {renderProviderLogo(selectedPayoutProvider, true)}
                    </div>
                    <label className="block text-xs font-semibold text-blue-100/80">
                      Account Holder
                      <input
                        type="text"
                        autoComplete="name"
                        maxLength={80}
                        value={payoutAccountHolder}
                        onChange={(event) => setPayoutAccountHolder(event.target.value)}
                        required
                        className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                        placeholder="Name registered to the account"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-blue-100/80">
                      Account Number
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={20}
                        value={payoutAccountNumber}
                        onChange={(event) => setPayoutAccountNumber(event.target.value.replace(/[^\d -]/g, ''))}
                        required
                        className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                        placeholder="7 to 20 digits"
                      />
                    </label>
                    {payoutAccountError && (
                      <p role="alert" className="text-xs font-semibold text-red-300">{payoutAccountError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPayoutProvider(null)}
                        className="flex-1 rounded-xl border border-[#1E3A78] px-3 py-2.5 text-xs font-bold text-blue-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPayoutAccount}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D8FD2F] px-3 py-2.5 text-xs font-extrabold text-[#08132B] disabled:opacity-50"
                      >
                        {isSavingPayoutAccount && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSavingPayoutAccount ? 'Saving...' : 'Save Account'}
                      </button>
                    </div>
                  </form>
                )}

                {payoutAccountError && !selectedPayoutProvider && (
                  <p role="alert" className="mt-3 text-xs font-semibold text-red-300">{payoutAccountError}</p>
                )}
                <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-100/80">
                  Payout account setup is available, but withdrawals are not integrated yet. Adding an account does not submit a withdrawal or move funds.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default MeTab;
