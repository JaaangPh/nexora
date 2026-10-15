type WorkoutSnapshotData = Record<string, unknown>;

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
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
