import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReplaceWorkoutSnapshot,
  isWorkoutSnapshotActive,
  mergeWorkoutSnapshotProgress,
  pauseWorkoutSnapshotForNewSession,
  shouldPreferRemoteWorkoutSnapshot,
} from './workoutSnapshot.js';

test('keeps workout progress when a newer device snapshot has reset counters', () => {
  const current = {
    workoutStartTime: 1_000,
    distanceKm: 2.4,
    stepCount: 3_200,
    caloriesBurned: 128,
    tokensEarned: 4.8,
    elapsedSeconds: 1_100,
    isPaused: true,
  };

  const incoming = {
    workoutStartTime: 1_000,
    distanceKm: 0,
    stepCount: 0,
    caloriesBurned: 0,
    tokensEarned: 0,
    elapsedSeconds: 1_200,
    isPaused: true,
    lastUpdated: 2_000,
  };

  assert.deepEqual(mergeWorkoutSnapshotProgress(current, incoming), {
    ...incoming,
    distanceKm: 2.4,
    stepCount: 3_200,
    caloriesBurned: 128,
    tokensEarned: 4.8,
    elapsedSeconds: 1_200,
  });
});

test('does not carry progress into a different workout', () => {
  const incoming = {
    workoutStartTime: 2_000,
    distanceKm: 0,
    stepCount: 0,
    caloriesBurned: 0,
    tokensEarned: 0,
    elapsedSeconds: 0,
  };

  assert.equal(
    mergeWorkoutSnapshotProgress({ workoutStartTime: 1_000, stepCount: 3_200 }, incoming),
    incoming
  );
});

test('does not allow a different device workout to replace an active server workout', () => {
  const activeServerWorkout = { workoutStartTime: 1_000, isTracking: true, isPaused: true };
  const differentIncomingWorkout = { workoutStartTime: 2_000 };

  assert.equal(isWorkoutSnapshotActive(activeServerWorkout), true);
  assert.equal(canReplaceWorkoutSnapshot(activeServerWorkout, differentIncomingWorkout), false);
  assert.equal(
    canReplaceWorkoutSnapshot(activeServerWorkout, { workoutStartTime: 1_000 }),
    true
  );
  assert.equal(
    isWorkoutSnapshotActive({
      workoutStartTime: 1_000,
      isTracking: false,
      isPaused: false,
      pendingFinish: false,
    }),
    false
  );
});

test('prefers the active account workout over a newer conflicting local workout', () => {
  const local = { workoutStartTime: 2_000, lastUpdated: 3_000, isTracking: true };
  const remote = { workoutStartTime: 1_000, lastUpdated: 2_000, isPaused: true };

  assert.equal(shouldPreferRemoteWorkoutSnapshot(local, remote), true);
});

test('pauses the active workout when a new account session starts without resetting progress', () => {
  const active = {
    workoutStartTime: 1_000,
    lastUpdated: 1_101_000,
    elapsedSeconds: 1_100,
    pausedDuration: 0,
    distanceKm: 2.4,
    stepCount: 3_200,
    caloriesBurned: 128,
    tokensEarned: 4.8,
    isTracking: true,
    isPaused: false,
    pendingFinish: false,
  };

  assert.deepEqual(pauseWorkoutSnapshotForNewSession(active, 1_106_000), {
    ...active,
    isPaused: true,
    pauseStartTime: 1_106_000,
    pausedDuration: 0,
    elapsedSeconds: 1_105,
    lastUpdated: 1_106_000,
  });
});

test('does not move the pause time of an already paused workout on login', () => {
  const paused = {
    workoutStartTime: 1_000,
    lastUpdated: 1_101_000,
    elapsedSeconds: 1_100,
    pausedDuration: 10_000,
    pauseStartTime: 1_111_000,
    isTracking: true,
    isPaused: true,
    pendingFinish: false,
  };

  assert.deepEqual(pauseWorkoutSnapshotForNewSession(paused, 1_500_000), {
    ...paused,
    lastUpdated: 1_500_000,
  });
});
