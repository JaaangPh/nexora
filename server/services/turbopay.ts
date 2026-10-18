import { createHash, timingSafeEqual } from 'node:crypto';

export type TurboPayPayload = Record<string, string | number>;

export interface TurboPayConfig {
  apiUrl: string;
  merchantId: string;
  merchantKey: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface TurboPayPayoutConfig {
  apiUrl: string;
  merchantId: string;
  merchantKey: string;
  callbackUrl: string;
}

export function getTurboPayCredentials(): Pick<TurboPayConfig, 'merchantId' | 'merchantKey'> {
  const merchantId = process.env.TURBOPAY_MERCHANT_ID;
  const merchantKey = process.env.TURBOPAY_MERCHANT_KEY;

  if (!merchantId || !merchantKey) {
    throw new Error('TurboPay merchant credentials are not configured.');
  }
  return { merchantId, merchantKey };
}

export function getTurboPayConfig(): TurboPayConfig {
  const { merchantId, merchantKey } = getTurboPayCredentials();
  const apiUrl = process.env.TURBOPAY_API_URL;
  const callbackUrl = process.env.TURBOPAY_CALLBACK_URL;
  const returnUrl = process.env.TURBOPAY_RETURN_URL;

  if (process.env.TURBOPAY_ENABLED !== 'true') {
    throw new Error('TurboPay deposits are disabled.');
  }
  if (!apiUrl || !callbackUrl || !returnUrl) {
    throw new Error('TurboPay API, callback, and return URLs are not configured.');
  }

  let parsedApiUrl: URL;
  let parsedCallbackUrl: URL;
  let parsedReturnUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
    parsedCallbackUrl = new URL(callbackUrl);
    parsedReturnUrl = new URL(returnUrl);
  } catch {
    throw new Error('TurboPay API, callback, and return URLs must be valid absolute URLs.');
  }

  if (
    parsedApiUrl.protocol !== 'https:' ||
    parsedApiUrl.hostname !== 'merchant.turbopay.ph' ||
    parsedCallbackUrl.protocol !== 'https:' ||
    parsedReturnUrl.protocol !== 'https:'
  ) {
    throw new Error('TurboPay API must use the official HTTPS host; callback and return URLs must use HTTPS.');
  }

  return {
    apiUrl: parsedApiUrl.origin,
    merchantId,
    merchantKey,
    callbackUrl: parsedCallbackUrl.toString(),
    returnUrl: parsedReturnUrl.toString(),
  };
}

export function getTurboPayPayoutConfig(): TurboPayPayoutConfig {
  const { merchantId, merchantKey } = getTurboPayCredentials();
  const apiUrl = process.env.TURBOPAY_API_URL;
  const callbackUrl = process.env.TURBOPAY_WITHDRAWAL_CALLBACK_URL;

  if (process.env.TURBOPAY_ENABLED !== 'true') {
    throw new Error('TurboPay payouts are disabled.');
  }
  if (!apiUrl || !callbackUrl) {
    throw new Error('TurboPay API and withdrawal callback URLs are not configured.');
  }

  let parsedApiUrl: URL;
  let parsedCallbackUrl: URL;
  try {
    parsedApiUrl = new URL(apiUrl);
    parsedCallbackUrl = new URL(callbackUrl);
  } catch {
    throw new Error('TurboPay API and withdrawal callback URLs must be valid absolute URLs.');
  }

  if (
    parsedApiUrl.protocol !== 'https:' ||
    parsedApiUrl.hostname !== 'merchant.turbopay.ph' ||
    parsedCallbackUrl.protocol !== 'https:'
  ) {
    throw new Error('TurboPay API must use the official HTTPS host and the withdrawal callback must use HTTPS.');
  }

  return {
    apiUrl: parsedApiUrl.origin,
    merchantId,
    merchantKey,
    callbackUrl: parsedCallbackUrl.toString(),
  };
}

export class TurboPayTransferRejectedError extends Error {}
export class TurboPayPayoutRejectedError extends Error {}

export function createTurboPaySignature(payload: TurboPayPayload, merchantKey: string): string {
  const canonicalPayload = Object.keys(payload)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}=${String(payload[key])}`)
    .join('&');

  return createHash('md5')
    .update(`${canonicalPayload}&key=${merchantKey}`, 'utf8')
    .digest('hex');
}

export function verifyTurboPaySignature(payload: TurboPayPayload, merchantKey: string): boolean {
  const suppliedSignature = payload.sign;
  if (typeof suppliedSignature !== 'string' || !/^[a-fA-F0-9]{32}$/.test(suppliedSignature)) {
    return false;
  }

  const expected = Buffer.from(createTurboPaySignature(payload, merchantKey), 'hex');
  const supplied = Buffer.from(suppliedSignature, 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function createTurboPayTransfer(
  apiUrl: string,
  payload: TurboPayPayload
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${apiUrl}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('TurboPay returned an invalid response.');
    }

    const data = result as Record<string, unknown>;
    if (!response.ok || String(data.status) !== '1') {
      throw new TurboPayTransferRejectedError('TurboPay rejected this payment request.');
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createTurboPayPayout(
  apiUrl: string,
  payload: TurboPayPayload
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${apiUrl}/api/daifu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result: unknown = await response.json().catch(() => null);
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('TurboPay returned an invalid payout response.');
    }

    const data = result as Record<string, unknown>;
    if (!response.ok || String(data.status) !== '1') {
      throw new TurboPayPayoutRejectedError('TurboPay rejected this payout request.');
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
