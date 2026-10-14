type WorkoutSnapshotData = Record<string, unknown>;

function nonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
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
