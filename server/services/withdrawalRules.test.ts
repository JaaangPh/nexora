import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountToCents,
  calculateWithdrawalAmounts,
  MINIMUM_PAYOUT_CENTS,
} from './withdrawalRules.js';

test('minimum withdrawal pays out 100 and deducts 102 including the fee', () => {
  assert.equal(MINIMUM_PAYOUT_CENTS, 10_000);
  assert.deepEqual(calculateWithdrawalAmounts(MINIMUM_PAYOUT_CENTS), {
    payoutAmountCents: 10_000,
    feeCents: 200,
    totalDeductedCents: 10_200,
  });
});

test('withdrawal fee is added to the requested payout amount', () => {
  assert.deepEqual(calculateWithdrawalAmounts(25_000), {
    payoutAmountCents: 25_000,
    feeCents: 500,
    totalDeductedCents: 25_500,
  });
});

test('withdrawal amounts are calculated in integer cents', () => {
  assert.deepEqual(calculateWithdrawalAmounts(10_001), {
    payoutAmountCents: 10_001,
    feeCents: 200,
    totalDeductedCents: 10_201,
  });
  assert.equal(amountToCents('100.00'), 10_000);
  assert.equal(amountToCents('100.001'), null);
});
