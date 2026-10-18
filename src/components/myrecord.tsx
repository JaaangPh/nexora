import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { api, DepositHistoryItem, DepositStatus, PayoutProvider, WithdrawalRecord, WithdrawalStatus } from '../services/api';

type StatusFilter = 'all' | 'pending' | 'success' | 'failed' | 'expired';
type MemberTransaction =
  | { type: 'deposit'; record: DepositHistoryItem }
  | { type: 'withdrawal'; record: WithdrawalRecord };

interface MyRecordTabProps {
  onBack: () => void;
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'success', label: 'Success' },
  { id: 'failed', label: 'Failed' },
  { id: 'expired', label: 'Expired' },
];

const STATUS_STYLES: Record<DepositStatus | WithdrawalStatus, { label: string; className: string; Icon: typeof Clock3 }> = {
  pending: {
    label: 'Pending',
    className: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    Icon: Clock3,
  },
  processing: {
    label: 'Processing',
    className: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    Icon: Clock3,
  },
  accepted: {
    label: 'Processing',
    className: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    Icon: Clock3,
  },
  paid: {
    label: 'Success',
    className: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    className: 'border-rose-300/20 bg-rose-300/10 text-rose-300',
    Icon: XCircle,
  },
  expired: {
    label: 'Expired',
    className: 'border-slate-300/20 bg-slate-300/10 text-slate-300',
    Icon: Clock3,
  },
};

function getPaymentMethodLabel(bankCode: DepositHistoryItem['bankCode']): string {
  switch (bankCode) {
    case 'gcash': return 'GCash';
    case 'PMP': return 'Maya';
    case 'GOT': return 'GoTyme';
    case 'qrph': return 'QRPh';
    case 'usdt-trc20': return 'USDT (TRC20)';
  }
}

function getPayoutProviderLabel(provider: PayoutProvider | string): string {
  switch (provider) {
    case 'gcash': return 'GCash';
    case 'maya': return 'Maya';
    case 'gotyme': return 'GoTyme';
    default: return provider;
  }
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function money(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const MyRecordTab: React.FC<MyRecordTabProps> = ({ onBack }) => {
  const [deposits, setDeposits] = useState<DepositHistoryItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [depositHistory, withdrawalHistory] = await Promise.all([
        api.getDepositHistory(),
        api.getWithdrawalHistory(),
      ]);
      setDeposits(depositHistory);
      setWithdrawals(withdrawalHistory);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your transaction history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, reloadCount]);

  const filteredTransactions = useMemo(() => {
    const transactions: MemberTransaction[] = [
      ...deposits.map((record) => ({ type: 'deposit' as const, record })),
      ...withdrawals.map((record) => ({ type: 'withdrawal' as const, record })),
    ];
    return transactions
      .filter(({ record }) =>
        filter === 'all' ||
        (filter === 'success' ? record.status === 'paid' : record.status === filter)
      )
      .sort((first, second) => Date.parse(second.record.createdAt) - Date.parse(first.record.createdAt));
  },
    [deposits, filter, withdrawals],
  );

  return (
    <section className="animate-fade-in space-y-5 text-white">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to profile"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#142B5B] text-white transition-colors hover:bg-[#1E3A78]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight text-white">My Record</h1>
          <p className="mt-0.5 text-xs font-medium text-blue-200/70">
            Your deposit and withdrawal activity
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadCount((count) => count + 1)}
          disabled={isLoading}
          aria-label="Refresh transactions"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#2459C4]/40 bg-[#102554] text-cyan-300 transition-colors hover:bg-[#163470] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="rounded-full border border-[#2459C4]/40 bg-[#08132B] p-1">
        <div className="grid grid-cols-6 gap-1" role="tablist" aria-label="Filter transactions by status">
          {STATUS_FILTERS.map(({ id, label }) => {
            const isActive = filter === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(id)}
                className={`min-h-9 rounded-full px-1 text-[11px] font-bold transition-colors ${
                  isActive
                    ? 'bg-[#D8FD2F] text-[#0B1A3D] shadow-sm'
                    : 'text-blue-100/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-5 text-center">
          <p className="text-sm font-bold text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => setReloadCount((count) => count + 1)}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#142B5B] px-4 py-2 text-xs font-bold text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-[#1E3A78] bg-[#0D204A]">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
          <p className="mt-3 text-xs font-semibold text-blue-100/70">Loading your records…</p>
        </div>
      ) : filteredTransactions.length > 0 ? (
        <div className="space-y-3">
          {filteredTransactions.map(({ type, record }) => {
            const status = STATUS_STYLES[record.status];
            const StatusIcon = status.Icon;
            const deposit = type === 'deposit' ? record : null;
            const withdrawal = type === 'withdrawal' ? record : null;
            const paymentUrl = deposit?.status === 'expired'
              ? undefined
              : deposit?.redirectUrl || deposit?.qrcodeUrl || deposit?.gcashQrUrl;
            return (
              <article
                key={`${type}:${record.orderId}`}
                className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4 shadow-lg shadow-[#050B1A]/20"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#D8FD2F] text-[#0B1A3D]">
                    {type === 'deposit' ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-extrabold text-white">{type === 'deposit' ? 'Deposit' : 'Withdrawal'}</h2>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${status.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-blue-200/55">
                      {record.orderId}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#1E3A78] pt-3">
                  <div>
                    <p className="text-[10px] font-semibold text-blue-200/60">
                      {deposit ? getPaymentMethodLabel(deposit.bankCode) : getPayoutProviderLabel(withdrawal!.bankCode)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-blue-100/80">{formatCreatedAt(record.createdAt)}</p>
                  </div>
                  <p className="whitespace-nowrap text-base font-black text-white">
                    {money(record.amount)}
                  </p>
                </div>

                {withdrawal && (
                  <div className="mt-3 rounded-xl border border-[#1E3A78] bg-[#08132B] p-3 text-xs">
                    <p className="font-semibold text-white">Bank account: {getPayoutProviderLabel(withdrawal.bankCode)}</p>
                    <p className="mt-1 text-blue-100/70">{withdrawal.accountHolder} · {withdrawal.accountNumber}</p>
                    {withdrawal.referenceNo && (
                      <p className="mt-2 break-all text-[11px] text-blue-100/70">
                        Ref. No: <span className="font-mono text-white">{withdrawal.referenceNo}</span>
                      </p>
                    )}
                    <div className="mt-2 flex justify-between text-[11px] text-blue-100/60">
                      <span>Fee (2%): {money(withdrawal.fee)}</span>
                      <span>Payout: {money(withdrawal.payoutAmount)}</span>
                    </div>
                    <p className="mt-1 text-right text-[11px] font-semibold text-blue-100/80">
                      Total deducted: {money(withdrawal.totalDeducted ?? withdrawal.amount)}
                    </p>
                  </div>
                )}

                {paymentUrl && (
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-300/15"
                  >
                    <WalletCards className="h-4 w-4" />
                    Open payment link
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[210px] flex-col items-center justify-center rounded-2xl border border-[#1E3A78] bg-[#0D204A] px-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2459C4]/30 bg-[#102554] text-cyan-300">
            <WalletCards className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm font-extrabold text-white">
            {filter === 'all' ? 'No transaction history' : `No ${STATUS_FILTERS.find((item) => item.id === filter)?.label.toLowerCase()} transactions`}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-blue-100/60">
            {filter === 'all'
              ? 'Deposits and withdrawal requests will appear here.'
              : `No ${STATUS_FILTERS.find((item) => item.id === filter)?.label.toLowerCase()} transactions were found.`}
          </p>
        </div>
      )}
    </section>
  );
};

export default MyRecordTab;
