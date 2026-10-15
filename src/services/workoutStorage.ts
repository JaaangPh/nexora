import type { WorkoutSnapshot } from '../types/workout';

export const ACTIVE_WORKOUT_STORAGE_PREFIX = 'nexora_active_workout:';

export function getActiveWorkoutStorageKey(userId?: string): string | null {
  return userId ? `${ACTIVE_WORKOUT_STORAGE_PREFIX}${encodeURIComponent(userId)}` : null;
}

export function getPausedWorkoutTiming(
  workoutStartTime: number,
  elapsedSeconds: number,
  pausedAt: number
): { workoutStartTime: number; pauseStartTime: number; pausedDuration: number } {
  return {
    workoutStartTime,
    pauseStartTime: pausedAt,
    pausedDuration: Math.max(0, pausedAt - workoutStartTime - elapsedSeconds * 1000),
  };
}

export function shouldPreferRemoteWorkoutSnapshot(
  local: WorkoutSnapshot | null,
  remote: WorkoutSnapshot
): boolean {
  const sameWorkout = local &&
    Number(local.workoutStartTime) === Number(remote.workoutStartTime);
  if (!sameWorkout && (remote.isTracking || remote.isPaused || remote.pendingFinish)) return true;
  if (!local) return true;
  if (sameWorkout && remote.pendingFinish && !local.pendingFinish) return true;
  if (sameWorkout && remote.isPaused && !local.isPaused) return true;
  if (
    sameWorkout &&
    (
      remote.distanceKm > local.distanceKm ||
      remote.stepCount > local.stepCount ||
      remote.caloriesBurned > local.caloriesBurned ||
      remote.tokensEarned > local.tokensEarned ||
      remote.elapsedSeconds > local.elapsedSeconds
    )
  ) return true;
  return remote.lastUpdated > local.lastUpdated;
}

export function mergeWorkoutSnapshots(
  local: WorkoutSnapshot | null,
  remote: WorkoutSnapshot
): WorkoutSnapshot {
  if (!local || Number(local.workoutStartTime) !== Number(remote.workoutStartTime)) {
    return remote;
  }

  const preferRemote = shouldPreferRemoteWorkoutSnapshot(local, remote);
  const preferred = preferRemote ? remote : local;
  return {
    ...preferred,
    distanceKm: Math.max(local.distanceKm, remote.distanceKm),
    stepCount: Math.max(local.stepCount, remote.stepCount),
    caloriesBurned: Math.max(local.caloriesBurned, remote.caloriesBurned),
    tokensEarned: Math.max(local.tokensEarned, remote.tokensEarned),
    elapsedSeconds: Math.max(local.elapsedSeconds, remote.elapsedSeconds),
    isPaused: local.isPaused || remote.isPaused,
    pendingFinish: local.pendingFinish || remote.pendingFinish,
  };
}

export function hasWorkoutInProgressInStorage(): boolean {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(ACTIVE_WORKOUT_STORAGE_PREFIX)) keys.push(key);
    }

    return keys.some((key) => {
      try {
        const workout = JSON.parse(localStorage.getItem(key) || 'null');
        return !!(workout?.isTracking || workout?.pendingFinish);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
