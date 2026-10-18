import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTurboPayPayout,
  getTurboPayPayoutBankCode,
  getTurboPayPayoutConfig,
  TurboPayPayoutConfigError,
  TurboPayPayoutRejectedError,
} from './turbopay.js';
import {
  isTurboPayPayoutBankCode,
  TURBOPAY_PAYOUT_BANKS,
} from '../../shared/turbopayBanks.js';

const payoutEnvironmentKeys = [
  'TURBOPAY_ENABLED',
  'TURBOPAY_API_URL',
  'TURBOPAY_MERCHANT_ID',
  'TURBOPAY_MERCHANT_KEY',
  'TURBOPAY_WITHDRAWAL_CALLBACK_URL',
] as const;

function withPayoutEnvironment(values: Record<(typeof payoutEnvironmentKeys)[number], string | undefined>, run: () => void): void {
  const originalValues = new Map(payoutEnvironmentKeys.map((key) => [key, process.env[key]]));
  try {
    for (const key of payoutEnvironmentKeys) {
      const value = values[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const key of payoutEnvironmentKeys) {
      const value = originalValues.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('maps supported payout providers to TurboPay bank codes', () => {
  assert.equal(getTurboPayPayoutBankCode('gcash'), 'gcash');
  assert.equal(getTurboPayPayoutBankCode('maya'), 'PMP');
  assert.equal(getTurboPayPayoutBankCode('gotyme'), 'GOT');
  assert.equal(getTurboPayPayoutBankCode('bpi'), 'bpi');
  assert.equal(getTurboPayPayoutBankCode('ALIPAY'), 'ALIPAY');
  assert.equal(getTurboPayPayoutBankCode('unknown'), null);
});

test('validates every bank code in the shared payout directory', () => {
  assert.equal(TURBOPAY_PAYOUT_BANKS.length, 89);
  for (const bank of TURBOPAY_PAYOUT_BANKS) {
    assert.equal(isTurboPayPayoutBankCode(bank.code), true, bank.name);
  }
  assert.equal(isTurboPayPayoutBankCode('not-a-bank'), false);
});

test('retains TurboPay rejection status and message for admin diagnostics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ status: '0', message: 'IP not found in allowed IPs (ref: ab12cd34)' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  );

  try {
    await assert.rejects(
      createTurboPayPayout('https://merchant.turbopay.ph', { merchant: 'M100001' }),
      (error: unknown) => {
        assert.ok(error instanceof TurboPayPayoutRejectedError);
        assert.equal(error.httpStatus, 403);
        assert.equal(error.providerStatus, '0');
        assert.match(error.message, /IP not found in allowed IPs/);
        assert.match(error.message, /ab12cd34/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports missing payout environment settings without exposing credentials', () => {
  withPayoutEnvironment({
    TURBOPAY_ENABLED: 'false',
    TURBOPAY_API_URL: undefined,
    TURBOPAY_MERCHANT_ID: undefined,
    TURBOPAY_MERCHANT_KEY: undefined,
    TURBOPAY_WITHDRAWAL_CALLBACK_URL: undefined,
  }, () => {
    assert.throws(
      () => getTurboPayPayoutConfig(),
      (error: unknown) => {
        assert.ok(error instanceof TurboPayPayoutConfigError);
        assert.match(error.message, /TURBOPAY_ENABLED=true/);
        assert.match(error.message, /TURBOPAY_MERCHANT_ID/);
        assert.match(error.message, /TURBOPAY_WITHDRAWAL_CALLBACK_URL/);
        assert.doesNotMatch(error.message, /secret|key=/i);
        return true;
      },
    );
  });
});

test('loads a valid payout configuration from the backend environment', () => {
  withPayoutEnvironment({
    TURBOPAY_ENABLED: 'true',
    TURBOPAY_API_URL: 'https://merchant.turbopay.ph',
    TURBOPAY_MERCHANT_ID: 'merchant-test',
    TURBOPAY_MERCHANT_KEY: 'secret-test',
    TURBOPAY_WITHDRAWAL_CALLBACK_URL: 'https://api.example.com/api/payments/turbopay/withdrawal-callback',
  }, () => {
    assert.deepEqual(getTurboPayPayoutConfig(), {
      apiUrl: 'https://merchant.turbopay.ph',
      merchantId: 'merchant-test',
      merchantKey: 'secret-test',
      callbackUrl: 'https://api.example.com/api/payments/turbopay/withdrawal-callback',
    });
  });
});
