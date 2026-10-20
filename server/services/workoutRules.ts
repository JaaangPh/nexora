export const WORKOUT_RUNNER_LIMITS_KM: Record<string, number> = {
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

export function calculateWorkoutRewardKmByRunner(
  distanceMeters: number,
  runnerIds: string[],
  runnerRules: Record<string, { earningRate: number; kmLimitPerDay: number }> = Object.fromEntries(
    Object.keys(WORKOUT_RUNNER_LIMITS_KM).map((id) => [id, {
      earningRate: WORKOUT_RUNNER_EARNING_RATES[id],
      kmLimitPerDay: WORKOUT_RUNNER_LIMITS_KM[id],
    }]),
  ),
  accruedKmByRunner: Record<string, number> = {},
): Record<string, number> {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return {};
  const distanceKm = distanceMeters / 1000;
  return Object.fromEntries([...new Set(runnerIds)].flatMap((runnerId) => {
    const limitKm = runnerRules[runnerId]?.kmLimitPerDay || 0;
    const accruedKm = accruedKmByRunner[runnerId];
    const validAccruedKm = Number.isFinite(accruedKm) && accruedKm > 0 ? accruedKm : 0;
    const earnedKm = Math.min(distanceKm, Math.max(0, limitKm - validAccruedKm));
    return earnedKm > 0 ? [[runnerId, earnedKm]] : [];
  }));
}

export function calculateWorkoutRewardCents(
  distanceMeters: number,
  runnerIds: string[],
  runnerRules: Record<string, { earningRate: number; kmLimitPerDay: number }> = Object.fromEntries(
    Object.keys(WORKOUT_RUNNER_LIMITS_KM).map((id) => [id, {
      earningRate: WORKOUT_RUNNER_EARNING_RATES[id],
      kmLimitPerDay: WORKOUT_RUNNER_LIMITS_KM[id],
    }]),
  ),
  accruedKmByRunner: Record<string, number> = {},
): number {
  const earnedKmByRunner = calculateWorkoutRewardKmByRunner(
    distanceMeters,
    runnerIds,
    runnerRules,
    accruedKmByRunner,
  );
  const reward = Object.entries(earnedKmByRunner).reduce(
    (total, [runnerId, earnedKm]) => total + earnedKm * (runnerRules[runnerId]?.earningRate || 0),
    0,
  );
  return Math.round(reward * 100);
}

export function isPlausibleGpsDistanceEstimate(
  distanceMeters: number,
  stepCount: number,
  elapsedSeconds: number,
): boolean {
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
