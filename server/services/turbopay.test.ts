import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getTurboPayPayoutBankCode,
  getTurboPayPayoutConfig,
  TurboPayPayoutConfigError,
} from './turbopay.js';

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
  assert.equal(getTurboPayPayoutBankCode('maya'), 'MYA');
  assert.equal(getTurboPayPayoutBankCode('gotyme'), 'GOT');
  assert.equal(getTurboPayPayoutBankCode('unknown'), null);
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
