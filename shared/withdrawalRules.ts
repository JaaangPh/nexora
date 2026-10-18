import { TurboPayPayoutBankCode } from './turbopayBanks';

export const MINIMUM_PAYOUT_CENTS = 10_000;
export const USDT_MINIMUM_PAYOUT_CENTS = 80_000;

export function getMinimumPayoutCents(bankCode: TurboPayPayoutBankCode | string): number {
  return bankCode === 'usdt-trc' || bankCode === 'usdt-trc20'
    ? USDT_MINIMUM_PAYOUT_CENTS
    : MINIMUM_PAYOUT_CENTS;
}
