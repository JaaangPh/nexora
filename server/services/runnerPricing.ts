import { firestore } from '../database/firebase.js';

export const RUNNER_BASE_PRICES: Record<string, number> = {
  'snk-1': 500,
  'snk-2': 1000,
  'snk-3': 2000,
  'snk-4': 3500,
};

export interface RunnerPrice {
  originalPrice: number;
  discountPercentage: number;
  newPrice: number;
}

const RUNNER_PRICING_PATH = 'market_settings/runner_pricing';

function normalizeDiscounts(value: unknown): Record<string, number> {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    Object.keys(RUNNER_BASE_PRICES).map((runnerId) => {
      const discount = stored[runnerId];
      return [runnerId, typeof discount === 'number' && Number.isFinite(discount) && discount >= 0 && discount <= 100
        ? discount
        : 0];
    }),
  );
}

export async function readRunnerPricing(): Promise<{
  discounts: Record<string, number>;
  originalPrices: Record<string, number>;
  newPrices: Record<string, number>;
}> {
  const snapshot = await firestore.doc(RUNNER_PRICING_PATH).get();
  return {
    discounts: normalizeDiscounts(snapshot.data()?.discounts),
    originalPrices: readStoredOriginalPrices(snapshot.data()?.originalPrices),
    newPrices: readStoredNewPrices(snapshot.data()?.newPrices),
  };
}

function readStoredOriginalPrices(value: unknown): Record<string, number> {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    Object.entries(RUNNER_BASE_PRICES).map(([runnerId, defaultPrice]) => {
      const price = stored[runnerId];
      return [runnerId, typeof price === 'number' && Number.isFinite(price) && price > 0
        ? price
        : defaultPrice];
    }),
  );
}

function readStoredNewPrices(value: unknown): Record<string, number> {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    Object.keys(RUNNER_BASE_PRICES).flatMap((runnerId) => {
      const price = stored[runnerId];
      return typeof price === 'number' && Number.isFinite(price) && price >= 0
        ? [[runnerId, price]]
        : [];
    }),
  );
}

export function getRunnerPrices(
  discounts: Record<string, number>,
  originalPrices: Record<string, number> = RUNNER_BASE_PRICES,
  newPrices: Record<string, number> = {},
): Record<string, RunnerPrice> {
  return Object.fromEntries(
    Object.entries(RUNNER_BASE_PRICES).map(([runnerId, defaultPrice]) => {
      const originalPrice = originalPrices[runnerId] ?? defaultPrice;
      const newPrice = newPrices[runnerId] ?? Math.round(originalPrice * (1 - (discounts[runnerId] ?? 0) / 100));
      const discountPercentage = originalPrice > 0
        ? Math.round((1 - newPrice / originalPrice) * 1_000_000) / 10_000
        : 0;
      return [runnerId, {
        originalPrice,
        discountPercentage,
        newPrice,
      }];
    }),
  );
}

export async function saveRunnerPricing(
  runnerId: string,
  originalPrice: number,
  newPrice: number,
): Promise<{ discounts: Record<string, number>; originalPrices: Record<string, number>; newPrices: Record<string, number> }> {
  const settingsRef = firestore.doc(RUNNER_PRICING_PATH);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(settingsRef);
    const discounts = normalizeDiscounts(snapshot.data()?.discounts);
    const originalPrices = readStoredOriginalPrices(snapshot.data()?.originalPrices);
    const newPrices = readStoredNewPrices(snapshot.data()?.newPrices);
    discounts[runnerId] = originalPrice > 0
      ? Math.round((1 - newPrice / originalPrice) * 1_000_000) / 10_000
      : 0;
    originalPrices[runnerId] = originalPrice;
    newPrices[runnerId] = newPrice;
    transaction.set(settingsRef, { discounts, originalPrices, newPrices, updatedAt: new Date().toISOString() }, { merge: true });
    return { discounts, originalPrices, newPrices };
  });
}
