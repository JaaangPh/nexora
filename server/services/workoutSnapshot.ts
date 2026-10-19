type WorkoutSnapshotData = Record<string, unknown>;

type FirestoreWorkoutRoutePoint = { latitude: number; longitude: number };

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function encodeWorkoutRoutePointsForFirestore(routePoints: unknown): FirestoreWorkoutRoutePoint[] {
  if (!Array.isArray(routePoints)) return [];
  return routePoints.map((point) => {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      typeof point[0] !== 'number' ||
      !Number.isFinite(point[0]) ||
      typeof point[1] !== 'number' ||
      !Number.isFinite(point[1])
    ) {
      throw new TypeError('Workout route contains an invalid point.');
    }
    return { latitude: point[0], longitude: point[1] };
  });
}

export function decodeWorkoutRoutePointsFromFirestore(routePoints: unknown): [number, number][] {
  if (!Array.isArray(routePoints)) return [];
  return routePoints.map((point) => {
    if (
      point &&
      typeof point === 'object' &&
      'latitude' in point &&
      'longitude' in point &&
      typeof point.latitude === 'number' &&
      Number.isFinite(point.latitude) &&
      typeof point.longitude === 'number' &&
      Number.isFinite(point.longitude)
    ) {
      return [point.latitude, point.longitude];
    }
    if (
      Array.isArray(point) &&
      point.length === 2 &&
      typeof point[0] === 'number' &&
      Number.isFinite(point[0]) &&
      typeof point[1] === 'number' &&
      Number.isFinite(point[1])
    ) {
      return [point[0], point[1]];
    }
    throw new TypeError('Stored workout route contains an invalid point.');
  });
}

export function isWorkoutSnapshotActive(snapshot: WorkoutSnapshotData): boolean {
  return snapshot.isTracking === true ||
    snapshot.isPaused === true ||
    snapshot.pendingFinish === true;
}

export function pauseWorkoutSnapshotForNewSession(
  snapshot: WorkoutSnapshotData | undefined,
  pausedAt: number
): WorkoutSnapshotData | undefined {
  if (!snapshot || snapshot.isTracking !== true || snapshot.pendingFinish === true) {
    return snapshot;
  }

  if (snapshot.isPaused === true) {
    return { ...snapshot, lastUpdated: pausedAt };
  }

  const elapsedSeconds = nonNegativeNumber(snapshot.elapsedSeconds) +
    Math.floor(Math.max(0, pausedAt - nonNegativeNumber(snapshot.lastUpdated)) / 1000);
  const workoutStartTime = nonNegativeNumber(snapshot.workoutStartTime);
  const pausedDuration = Math.max(
    0,
    pausedAt - workoutStartTime - elapsedSeconds * 1000
  );

  return {
    ...snapshot,
    isTracking: true,
    isPaused: true,
    pauseStartTime: pausedAt,
    pausedDuration,
    elapsedSeconds,
    lastUpdated: pausedAt,
  };
}

export function canReplaceWorkoutSnapshot(
  current: WorkoutSnapshotData | undefined,
  incoming: WorkoutSnapshotData
): boolean {
  return !current ||
    !isWorkoutSnapshotActive(current) ||
    Number(current.workoutStartTime) === Number(incoming.workoutStartTime);
}

export function mergeWorkoutSnapshotProgress(
  current: WorkoutSnapshotData | undefined,
  incoming: WorkoutSnapshotData
): WorkoutSnapshotData {
  if (!current || Number(current.workoutStartTime) !== Number(incoming.workoutStartTime)) {
    return incoming;
  }

  return {
    ...incoming,
    distanceKm: Math.max(nonNegativeNumber(current.distanceKm), nonNegativeNumber(incoming.distanceKm)),
    stepCount: Math.max(nonNegativeNumber(current.stepCount), nonNegativeNumber(incoming.stepCount)),
    caloriesBurned: Math.max(nonNegativeNumber(current.caloriesBurned), nonNegativeNumber(incoming.caloriesBurned)),
    tokensEarned: Math.max(nonNegativeNumber(current.tokensEarned), nonNegativeNumber(incoming.tokensEarned)),
    elapsedSeconds: Math.max(nonNegativeNumber(current.elapsedSeconds), nonNegativeNumber(incoming.elapsedSeconds)),
  };
}

export function shouldPreferRemoteWorkoutSnapshot(
  local: WorkoutSnapshotData | null,
  remote: WorkoutSnapshotData
): boolean {
  const sameWorkout = local &&
    Number(local.workoutStartTime) === Number(remote.workoutStartTime);
  if (!sameWorkout && isWorkoutSnapshotActive(remote)) return true;
  if (!local) return true;
  return Number(remote.lastUpdated) > Number(local.lastUpdated);
}
