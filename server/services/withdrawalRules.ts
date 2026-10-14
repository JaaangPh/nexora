export const MINIMUM_PAYOUT_CENTS = 10_000;
const WITHDRAWAL_FEE_BASIS_POINTS = 200;

export interface WithdrawalAmounts {
  payoutAmountCents: number;
  feeCents: number;
  totalDeductedCents: number;
}

export function amountToCents(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) return null;
  return cents;
}

export function calculateWithdrawalAmounts(payoutAmountCents: number): WithdrawalAmounts | null {
  if (!Number.isSafeInteger(payoutAmountCents) || payoutAmountCents <= 0) return null;
  const feeCents = Math.round((payoutAmountCents * WITHDRAWAL_FEE_BASIS_POINTS) / 10_000);
  const totalDeductedCents = payoutAmountCents + feeCents;
  if (!Number.isSafeInteger(totalDeductedCents)) return null;
  return { payoutAmountCents, feeCents, totalDeductedCents };
}
