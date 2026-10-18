import React, { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Building2, Check, CheckCircle2, Copy, Loader2, ShieldCheck, X } from 'lucide-react';
import { api, PayoutAccount, PayoutProvider, WithdrawalRecord } from '../services/api';
import { getTurboPayPayoutBank } from '../../shared/turbopayBanks';
import { getMinimumPayoutCents } from '../../shared/withdrawalRules';

interface WithdrawTabProps {
  balance: number;
  onClose: () => void;
  onUpdateBalance: (balance: number) => void;
  onGoToPayoutAccounts: () => void;
}

const payoutBankLabel = (provider: PayoutProvider) => getTurboPayPayoutBank(provider)?.name || provider;
type PayoutMethod = 'gcash' | 'maya' | 'gotyme' | 'usdt' | 'bank-transfer';

const payoutMethodForAccount = (account: PayoutAccount): PayoutMethod => {
  switch (account.bankCode) {
    case 'gcash':
      return 'gcash';
    case 'PMP':
      return 'maya';
    case 'GOT':
      return 'gotyme';
    case 'usdt-trc20':
      return 'usdt';
    default:
      return 'bank-transfer';
  }
};

const payoutMethodLabels: Record<PayoutMethod, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  gotyme: 'GoTyme',
  usdt: 'USDT',
  'bank-transfer': 'Bank Transfer',
};

const payoutMethodLogos: Record<PayoutMethod, string> = {
  gcash: '/images/payment/gcash.png',
  maya: '/images/payment/maya.png',
  gotyme: '/images/payment/gotyme.png',
  usdt: '/images/payment/usdt.png',
  'bank-transfer': '/images/payment/banktransfer.png',
};

const money = (value: number) => `₱${value.toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export const WithdrawTab: React.FC<WithdrawTabProps> = ({
  balance,
  onClose,
  onUpdateBalance,
  onGoToPayoutAccounts,
}) => {
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticatorConfigured, setIsAuthenticatorConfigured] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [manualEntryKey, setManualEntryKey] = useState('');
  const [manualKeyCopied, setManualKeyCopied] = useState(false);
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [setupJustCompleted, setSetupJustCompleted] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<PayoutProvider | ''>('');
  const [selectedPayoutMethod, setSelectedPayoutMethod] = useState<PayoutMethod | ''>('');
  const [isPayoutMethodMenuOpen, setIsPayoutMethodMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<WithdrawalRecord | null>(null);

  const amount = Number(amountInput);
  const amountCents = Math.round(amount * 100);
  const feeCents = amountCents > 0 ? Math.round(amountCents * 0.02) : 0;
  const totalDeductedCents = amountCents + feeCents;
  const fee = feeCents / 100;
  const selectedAccount = accounts.find((account) => account.provider === selectedProvider);
  const minimumPayoutCents = getMinimumPayoutCents(selectedAccount?.bankCode || selectedProvider);
  const minimumPayout = minimumPayoutCents / 100;
  const bankTransferAccounts = accounts.filter((account) => payoutMethodForAccount(account) === 'bank-transfer');
  const availablePayoutMethods = (['gcash', 'maya', 'gotyme', 'usdt', 'bank-transfer'] as const)
    .filter((method) => accounts.some((account) => payoutMethodForAccount(account) === method));

  const generateSetup = async () => {
    setError('');
    setManualKeyCopied(false);
    try {
      const setup = await api.beginWithdrawalTotpSetup();
      setQrCodeDataUrl(setup.qrCodeDataUrl);
      setManualEntryKey(setup.manualEntryKey);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not prepare authenticator setup.');
    }
  };

  const handleCopyManualEntryKey = async () => {
    try {
      await navigator.clipboard.writeText(manualEntryKey);
      setManualKeyCopied(true);
    } catch (copyError) {
      console.error('[Withdrawal Authenticator Key Copy Error]', copyError);
      setError('Could not copy the setup key. Please select and copy it manually.');
    }
  };

  useEffect(() => {
    let isActive = true;
    Promise.all([api.getPayoutAccounts(), api.getWithdrawalTotpStatus()])
      .then(async ([savedAccounts, status]) => {
        if (!isActive) return;
        setAccounts(savedAccounts);
        setSelectedProvider(savedAccounts[0]?.provider || '');
        setSelectedPayoutMethod(savedAccounts[0] ? payoutMethodForAccount(savedAccounts[0]) : '');
        setIsAuthenticatorConfigured(status.configured);
        if (savedAccounts.length > 0 && !status.configured) {
          const setup = await api.beginWithdrawalTotpSetup();
          if (isActive) {
            setQrCodeDataUrl(setup.qrCodeDataUrl);
            setManualEntryKey(setup.manualEntryKey);
          }
        }
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load withdrawal setup.');
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  const handleConnectAuthenticator = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.verifyWithdrawalTotpSetup(authenticatorCode);
      setIsAuthenticatorConfigured(true);
      setSetupJustCompleted(true);
      setAuthenticatorCode('');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify the authenticator code.');
    }
  };

  const handleSubmitWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!Number.isFinite(amount) || Math.abs(amount * 100 - amountCents) > 0.000001 || amountCents < minimumPayoutCents) {
      setError(`Enter an amount to receive of at least ${money(minimumPayout)} with no more than two decimal places.`);
      return;
    }
    if (totalDeductedCents > Math.round(balance * 100)) {
    setError('Your available balance is not enough to cover the payout amount and 2% fee.');
      return;
    }
    if (!selectedProvider || !selectedAccount) {
      setError('Choose a saved payout account.');
      return;
    }

    setIsSubmitting(true);
    try {
      const withdrawal = await api.createWithdrawal(amount, selectedProvider, authenticatorCode);
      setSuccess(withdrawal);
      setAuthenticatorCode('');
      onUpdateBalance(withdrawal.balance ?? balance - (withdrawal.totalDeducted ?? withdrawal.amount + withdrawal.fee));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit withdrawal request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderHeader = () => (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-cyan-300">
          <Banknote className="h-4 w-4" />
        </span>
        <h2 id="withdraw-title" className="text-base font-extrabold text-white">Withdraw Funds</h2>
      </div>
      <button type="button" onClick={onClose} aria-label="Close withdrawal" className="text-blue-200 hover:text-white">
        <X className="h-5 w-5" />
      </button>
    </header>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#2459C4]/60 bg-[#091738] p-5 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {renderHeader()}
        <div className="mb-4 flex items-center justify-between rounded-xl border border-[#1E3A78] bg-[#08132B] p-3 text-xs">
          <span className="font-semibold text-blue-200/70">Available Balance</span>
          <strong className="font-mono text-cyan-300">{money(balance)}</strong>
        </div>

        {error && <p role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-semibold text-red-200">{error}</p>}

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-blue-100/70">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading withdrawal setup...
          </div>
        ) : success ? (
          <div className="space-y-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" />
            <h3 className="text-base font-extrabold text-white">Request submitted</h3>
            <p className="break-all font-mono text-[11px] text-emerald-100/70">{success.orderId}</p>
            <p className="text-xs leading-5 text-emerald-100/80">
              Your request is pending review. {money(success.payoutAmount)} will be sent to {payoutBankLabel(success.bankCode)} if accepted.
            </p>
            <p className="text-[11px] text-emerald-100/65">
              {money(success.totalDeducted ?? success.amount + success.fee)} was deducted, including the {money(success.fee)} fee.
            </p>
            <button type="button" onClick={onClose} className="w-full rounded-xl bg-[#D8FD2F] px-4 py-3 text-xs font-extrabold text-[#08132B]">
              Done
            </button>
          </div>
        ) : accounts.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-center">
            <p className="text-sm font-bold text-amber-100">Add a payout account to withdraw</p>
            <p className="text-xs leading-5 text-amber-100/70">Save a GCash, Maya, or GoTyme account first. You can add or update these in Payout Accounts.</p>
            <button
              type="button"
              onClick={onGoToPayoutAccounts}
              className="w-full rounded-xl bg-[#D8FD2F] px-4 py-3 text-xs font-extrabold text-[#08132B]"
            >
              Add payout account
            </button>
          </div>
        ) : !isAuthenticatorConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-xs leading-5 text-cyan-100">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-cyan-300" />
              Connect Google Authenticator once to protect withdrawals.
            </div>
            <ol className="list-inside list-decimal space-y-2 text-xs leading-5 text-blue-100/80">
              <li>
                Install Google Authenticator from the{' '}
                <a className="font-bold text-cyan-300 underline" href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer">Google Play Store</a>
                {' '}or{' '}
                <a className="font-bold text-cyan-300 underline" href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noreferrer">Apple App Store</a>.
              </li>
              <li>Open the app, tap the plus (+) button, then choose “Scan a QR code.”</li>
              <li>Scan this code. If scanning is unavailable, choose “Enter a setup key” and use the key below.</li>
              <li>Enter the six-digit code shown in Google Authenticator to finish connecting.</li>
            </ol>
            {qrCodeDataUrl ? (
              <div className="flex flex-col items-center rounded-2xl bg-white p-4">
                <img src={qrCodeDataUrl} alt="Google Authenticator setup QR code" className="h-48 w-48" />
                <p className="mt-2 text-[10px] font-semibold text-slate-700">Scan this QR code in Google Authenticator</p>
              </div>
            ) : (
              <button type="button" onClick={() => void generateSetup()} className="w-full rounded-xl border border-cyan-300/30 px-4 py-2.5 text-xs font-bold text-cyan-200">
                Generate setup QR code
              </button>
            )}
            {qrCodeDataUrl && (
              <button
                type="button"
                onClick={() => void generateSetup()}
                className="w-full text-[10px] font-semibold text-cyan-300 underline"
              >
                QR code expired? Generate a new setup code
              </button>
            )}
            {manualEntryKey && (
              <button
                type="button"
                onClick={() => void handleCopyManualEntryKey()}
                aria-label={manualKeyCopied ? 'Manual setup key copied' : 'Copy manual setup key'}
                className="w-full rounded-xl border border-[#1E3A78] bg-[#08132B] p-3 text-left transition hover:border-cyan-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold text-blue-200/60">Manual setup key</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
                    {manualKeyCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {manualKeyCopied ? 'Copied!' : 'Tap to copy'}
                  </span>
                </span>
                <span className="mt-1 block break-all font-mono text-xs font-bold tracking-wider text-white">{manualEntryKey}</span>
              </button>
            )}
            <form onSubmit={handleConnectAuthenticator} className="space-y-3">
              <label className="block text-xs font-semibold text-blue-100/80">
                Google Authenticator code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={authenticatorCode}
                  onChange={(event) => setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-3 text-center font-mono text-lg tracking-[0.4em] text-white outline-none focus:border-cyan-400"
                />
              </label>
              <button
                type="submit"
                disabled={!manualEntryKey || authenticatorCode.length !== 6}
                className="w-full rounded-xl bg-[#D8FD2F] px-4 py-3 text-xs font-extrabold text-[#08132B] disabled:opacity-50"
              >
                Connect Google Authenticator
              </button>
            </form>
          </div>
        ) : (
          <form onSubmit={handleSubmitWithdrawal} className="space-y-3">
            {setupJustCompleted && (
              <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
                Google Authenticator connected. Use a fresh code for your withdrawal; the setup code cannot be reused.
              </p>
            )}
            <label className="block text-xs font-semibold text-blue-100/80">
              Amount to receive (minimum {money(minimumPayout)})
              <input
                type="number"
                inputMode="decimal"
                min={minimumPayout}
                step="0.01"
                max={balance / 1.02}
                required
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder={minimumPayout.toFixed(2)}
                className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>

            <label className="block text-xs font-semibold text-blue-100/80">
              Payout method
              {accounts.length > 0 ? (
                <div className="relative mt-1.5">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isPayoutMethodMenuOpen}
                    onClick={() => setIsPayoutMethodMenuOpen((open) => !open)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-2 text-left text-sm text-white outline-none focus:border-cyan-400"
                  >
                    {selectedPayoutMethod ? (
                      <>
                        <img
                          src={payoutMethodLogos[selectedPayoutMethod]}
                          alt=""
                          className="h-8 w-8 rounded-md object-contain"
                        />
                        <span className="flex-1 font-semibold">{payoutMethodLabels[selectedPayoutMethod]}</span>
                      </>
                    ) : (
                      <span className="flex-1 text-blue-100/60">Choose a payout method</span>
                    )}
                    <span aria-hidden="true" className="text-xs text-blue-100/60">
                      {isPayoutMethodMenuOpen ? '▲' : '▼'}
                    </span>
                  </button>
                  {isPayoutMethodMenuOpen && (
                    <div
                      role="listbox"
                      aria-label="Payout methods"
                      className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-[#1E3A78] bg-[#0D204A] p-1 shadow-xl"
                    >
                      {availablePayoutMethods.map((method) => (
                        <button
                          key={method}
                          type="button"
                          role="option"
                          aria-selected={selectedPayoutMethod === method}
                          onClick={() => {
                            setSelectedPayoutMethod(method);
                            setIsPayoutMethodMenuOpen(false);
                            if (method === 'bank-transfer') {
                              setSelectedProvider(bankTransferAccounts[0]?.provider || '');
                            } else {
                              const matchingAccount = accounts.find((account) => payoutMethodForAccount(account) === method);
                              setSelectedProvider(matchingAccount?.provider || '');
                            }
                          }}
                          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm text-white hover:bg-white/5"
                        >
                          <img
                            src={payoutMethodLogos[method]}
                            alt=""
                            className="h-7 w-7 rounded-md object-contain"
                          />
                          <span className="flex-1 font-semibold">{payoutMethodLabels[method]}</span>
                          {selectedPayoutMethod === method && <Check className="h-4 w-4 text-[#D8FD2F]" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <span className="mt-1.5 block rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
                  No payout accounts saved yet.
                </span>
              )}
            </label>

            {selectedPayoutMethod === 'bank-transfer' && bankTransferAccounts.length > 0 && (
              <label className="block text-xs font-semibold text-blue-100/80">
                Saved bank account
                <select
                  value={selectedProvider}
                  onChange={(event) => setSelectedProvider(event.target.value as PayoutProvider)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-3 text-sm text-white outline-none focus:border-cyan-400"
                >
                  {bankTransferAccounts.map((account) => (
                    <option key={account.bankCode} value={account.provider}>
                      {account.bankName} · {account.accountHolder} · •••• {account.accountNumber.slice(-4)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedAccount && (
              <div className="rounded-xl border border-[#1E3A78] bg-[#0D204A] p-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-200">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-blue-100/60">{selectedAccount.bankName}</p>
                    <p className="font-semibold text-white">{selectedAccount.accountHolder}</p>
                    <p className="mt-1 break-all font-mono text-blue-100/70">{selectedAccount.accountNumber}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-[#1E3A78] bg-[#08132B] p-3 text-xs">
              <div className="flex justify-between text-blue-100/70"><span>Amount to receive</span><span>{money(Number.isFinite(amount) ? amount : 0)}</span></div>
              <div className="flex justify-between text-blue-100/70"><span>Fee (2%)</span><span>{money(fee)}</span></div>
              <div className="flex justify-between border-t border-[#1E3A78] pt-2 font-bold text-white"><span>Total deducted from balance</span><span>{money(totalDeductedCents / 100)}</span></div>
            </div>

            <label className="block text-xs font-semibold text-blue-100/80">
              Google Authenticator code
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={authenticatorCode}
                onChange={(event) => setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit code"
                className="mt-1.5 w-full rounded-xl border border-[#1E3A78] bg-[#08132B] px-3 py-3 text-center font-mono text-lg tracking-[0.4em] text-white outline-none focus:border-cyan-400"
              />
            </label>
            <p className="text-[10px] leading-4 text-blue-100/60">
              The amount you enter is the payout amount. A 2% fee is added to it; for example, a ₱100 payout deducts ₱102 from your balance.
            </p>
            <button
              type="submit"
              disabled={isSubmitting || accounts.length === 0 || !selectedProvider || amountCents < minimumPayoutCents || totalDeductedCents > Math.round(balance * 100) || authenticatorCode.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D8FD2F] px-4 py-3 text-xs font-extrabold text-[#08132B] disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Submitting...' : 'Confirm Withdrawal'}
            </button>
          </form>
        )}

        {!isLoading && !success && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-100/80">
            <p className="mb-1 font-extrabold">⚠️ WARNING: WITHDRAWAL REQUESTS</p>
            <p>
              All withdrawal requests are subject to verification and review by our merchants. Please allow up to 24 hours for the verification process to be completed. Any rejected withdrawal request will be marked as Failed, and the amount will be refunded to your account. Thank you for your patience and understanding.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default WithdrawTab;
