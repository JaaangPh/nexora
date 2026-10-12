export interface WorkoutSummary {
  earned: number;
  distance: string;
  time: string;
  calories: number;
  runnerName: string;
}

export interface WorkoutSnapshot {
  accountId: string;
  runnerIds: string[];
  isTracking: boolean;
  pendingFinish: boolean;
  pendingWasPaused: boolean;
  lastWorkoutSummary: WorkoutSummary;
  isPaused: boolean;
  workoutStartTime: number;
  pauseStartTime: number;
  pausedDuration: number;
  elapsedSeconds: number;
  distanceKm: number;
  stepCount: number;
  caloriesBurned: number;
  tokensEarned: number;
  routePoints: [number, number][];
  lastUpdated: number;
}
