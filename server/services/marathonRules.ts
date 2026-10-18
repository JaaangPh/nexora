export const MARATHON_PACKAGES = {
  '250': { targetMeters: 250_000, bountyCents: 100_000, durationMs: 7 * 24 * 60 * 60 * 1000 },
  '500': { targetMeters: 500_000, bountyCents: 250_000, durationMs: 7 * 24 * 60 * 60 * 1000 },
} as const;

export const MARATHON_RUNNER_LIMITS_KM: Record<string, number> = {
  'snk-1': 6,
  'snk-2': 10,
  'snk-3': 20,
  'snk-4': 35,
};

export const WORKOUT_RUNNER_EARNING_RATES: Record<string, number> = {
  'snk-1': 8.4,
  'snk-2': 10.2,
  'snk-3': 20.1,
  'snk-4': 40,
};

export function calculateWorkoutRewardCents(
  distanceMeters: number,
  runnerIds: string[],
  runnerRules: Record<string, { earningRate: number; kmLimitPerDay: number }> = Object.fromEntries(
    Object.keys(MARATHON_RUNNER_LIMITS_KM).map((id) => [id, {
      earningRate: WORKOUT_RUNNER_EARNING_RATES[id],
      kmLimitPerDay: MARATHON_RUNNER_LIMITS_KM[id],
    }]),
  ),
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  const distanceKm = distanceMeters / 1000;
  const reward = runnerIds.reduce((total, runnerId) => {
    const earningRate = runnerRules[runnerId]?.earningRate || 0;
    const limitKm = runnerRules[runnerId]?.kmLimitPerDay || 0;
    return total + Math.min(distanceKm, limitKm) * earningRate;
  }, 0);
  return Math.round(reward * 100);
}

export function isPlausibleSensorWorkout(
  distanceMeters: number,
  stepCount: number,
  elapsedSeconds: number,
): boolean {
  // Device-motion rewards require a plausible stride length and average speed.
  return Number.isFinite(distanceMeters) &&
    Number.isFinite(stepCount) &&
    Number.isFinite(elapsedSeconds) &&
    distanceMeters > 0 &&
    stepCount > 0 &&
    elapsedSeconds > 0 &&
    distanceMeters / elapsedSeconds <= 20 &&
    distanceMeters >= stepCount * 0.1 &&
    distanceMeters <= stepCount * 1.5;
}

export interface RunnerEligibility {
  eligible: boolean;
  ownsCobalt: boolean;
  ownsVortex: boolean;
}

export function ownsRequiredMarathonRunners(eligibility: RunnerEligibility): boolean {
  return eligibility.ownsCobalt && eligibility.ownsVortex;
}

export function displayedNexoraId(referralCode: string | undefined, userId: string): string {
  return (referralCode || userId).replace(/\D/g, '').slice(-5).padStart(5, '0');
}

export function marathonWorkoutInProgress(workoutSnapshot: unknown): boolean {
  if (!workoutSnapshot || typeof workoutSnapshot !== 'object') return false;
  const workout = workoutSnapshot as Record<string, unknown>;
  return workout.isTracking === true || workout.isPaused === true || workout.pendingFinish === true;
}

export function isBeforeMarathonDeadline(completedAt: number, deadlineAt: number): boolean {
  return completedAt < deadlineAt;
}

export interface OwnedRunnerLike {
  id?: unknown;
  runnerId?: unknown;
}

export function checkMarathonRunnerEligibility(
  ownedRunners: unknown,
  runnerInstanceIds?: string[]
): RunnerEligibility {
  const ownedIds = new Set<string>();
  const instanceIds = new Set(runnerInstanceIds || []);

  if (Array.isArray(ownedRunners)) {
    for (const runner of ownedRunners) {
      if (typeof runner === 'string') {
        ownedIds.add(runner);
        continue;
      }
      if (!runner || typeof runner !== 'object') continue;
      const owned = runner as OwnedRunnerLike;
      if (typeof owned.runnerId === 'string') ownedIds.add(owned.runnerId);
      if (typeof owned.id === 'string' && instanceIds.has(owned.id)) {
        const runnerId = owned.runnerId;
        if (typeof runnerId === 'string') ownedIds.add(runnerId);
      }
    }
  }

  const ownsCobalt = ownedIds.has('snk-3');
  const ownsVortex = ownedIds.has('snk-4');
  return { eligible: ownsCobalt || ownsVortex, ownsCobalt, ownsVortex };
}

export function allocateEqualCents(totalCents: number, recipientIds: string[]): Record<string, number> {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || recipientIds.length === 0) return {};

  const orderedIds = [...new Set(recipientIds)].sort();
  if (orderedIds.length === 0) return {};

  const base = Math.floor(totalCents / orderedIds.length);
  const remainder = totalCents % orderedIds.length;
  return Object.fromEntries(orderedIds.map((id, index) => [id, base + (index < remainder ? 1 : 0)]));
}

export function haversineDistanceMeters(routePoints: unknown): number {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return 0;
  const earthRadiusMeters = 6_371_000;
  let distanceMeters = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    const previous = routePoints[index - 1];
    const current = routePoints[index];
    if (
      !Array.isArray(previous) ||
      !Array.isArray(current) ||
      previous.length !== 2 ||
      current.length !== 2 ||
      !previous.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) ||
      !current.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    ) {
      return 0;
    }

    const [lat1, lon1] = previous as [number, number];
    const [lat2, lon2] = current as [number, number];
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90 || Math.abs(lon1) > 180 || Math.abs(lon2) > 180) return 0;

    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
    distanceMeters += 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  return Math.round(distanceMeters);
}

export function toCents(balance: unknown): number {
  const amount = Number(balance);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function fromCents(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}
