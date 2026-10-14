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
