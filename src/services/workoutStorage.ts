export const ACTIVE_WORKOUT_STORAGE_PREFIX = 'nexora_active_workout:';

export function getActiveWorkoutStorageKey(userId?: string): string | null {
  return userId ? `${ACTIVE_WORKOUT_STORAGE_PREFIX}${encodeURIComponent(userId)}` : null;
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
