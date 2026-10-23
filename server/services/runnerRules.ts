import { firestore } from '../database/firebase.js';

export const RUNNER_DEFAULT_RULES = {
  'snk-1': { earningRate: 8.4, kmLimitPerDay: 6, healthLimit: 10, repairCost: 10 },
  'snk-2': { earningRate: 10.2, kmLimitPerDay: 10, healthLimit: 10, repairCost: 10 },
  'snk-3': { earningRate: 20.1, kmLimitPerDay: 20, healthLimit: 10, repairCost: 10 },
  'snk-4': { earningRate: 40, kmLimitPerDay: 35, healthLimit: 10, repairCost: 10 },
} as const;

export type RunnerId = keyof typeof RUNNER_DEFAULT_RULES;
export interface RunnerRule {
  earningRate: number;
  kmLimitPerDay: number;
  healthLimit: number;
  repairCost: number;
}
export type RunnerRules = Record<RunnerId, RunnerRule>;

const RUNNER_RULES_PATH = 'market_settings/runner_rules';

export function isRunnerId(value: string): value is RunnerId {
  return Object.prototype.hasOwnProperty.call(RUNNER_DEFAULT_RULES, value);
}

function normalizeRunnerRules(value: unknown): RunnerRules {
  const stored = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return Object.fromEntries(
    Object.entries(RUNNER_DEFAULT_RULES).map(([runnerId, defaults]) => {
      const item = stored[runnerId] && typeof stored[runnerId] === 'object'
        ? stored[runnerId] as Record<string, unknown>
        : {};
      return [runnerId, {
        earningRate: typeof item.earningRate === 'number' && Number.isFinite(item.earningRate) && item.earningRate >= 0
          ? item.earningRate
          : defaults.earningRate,
        kmLimitPerDay: typeof item.kmLimitPerDay === 'number' && Number.isFinite(item.kmLimitPerDay) && item.kmLimitPerDay > 0
          ? item.kmLimitPerDay
          : defaults.kmLimitPerDay,
        healthLimit: typeof item.healthLimit === 'number' && Number.isInteger(item.healthLimit) && item.healthLimit > 0
          ? item.healthLimit
          : defaults.healthLimit,
        repairCost: typeof item.repairCost === 'number' && Number.isFinite(item.repairCost) && item.repairCost >= 0
          ? item.repairCost
          : defaults.repairCost,
      }];
    }),
  ) as RunnerRules;
}

export async function readRunnerRules(transaction?: FirebaseFirestore.Transaction): Promise<RunnerRules> {
  const settingsRef = firestore.doc(RUNNER_RULES_PATH);
  const snapshot = transaction
    ? await transaction.get(settingsRef)
    : await settingsRef.get();
  return normalizeRunnerRules(snapshot.data()?.rules);
}

export async function saveRunnerRule(runnerId: RunnerId, rule: RunnerRule): Promise<RunnerRules> {
  const settingsRef = firestore.doc(RUNNER_RULES_PATH);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(settingsRef);
    const rules = normalizeRunnerRules(snapshot.data()?.rules);
    rules[runnerId] = rule;
    transaction.set(settingsRef, { rules, updatedAt: new Date().toISOString() }, { merge: true });
    return rules;
  });
}
