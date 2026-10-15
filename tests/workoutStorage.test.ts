import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPausedWorkoutTiming,
  mergeWorkoutSnapshots,
  shouldPreferRemoteWorkoutSnapshot,
} from '../src/services/workoutStorage.js';

test('pausing a restored workout preserves its identity and elapsed time', () => {
  const workoutStartTime = 1_000;
  const elapsedSeconds = 1_100;
  const pausedAt = 1_500_000;
  const timing = getPausedWorkoutTiming(workoutStartTime, elapsedSeconds, pausedAt);

  assert.equal(timing.workoutStartTime, workoutStartTime);
  assert.equal(timing.pauseStartTime, pausedAt);
  assert.equal(
    (timing.pauseStartTime - timing.workoutStartTime - timing.pausedDuration) / 1000,
    elapsedSeconds
  );
});

test('prefers a different active account workout over a newer local session', () => {
  const local = {
    accountId: 'user-1',
    runnerIds: ['runner-1'],
    isTracking: true,
    pendingFinish: false,
    pendingWasPaused: false,
    lastWorkoutSummary: { earned: 0.08, distance: '0.00', time: '00:20', calories: 0, runnerName: 'Runner' },
    isPaused: false,
    workoutStartTime: 2_000,
    pauseStartTime: 0,
    pausedDuration: 0,
    elapsedSeconds: 20,
    distanceKm: 0,
    stepCount: 3,
    caloriesBurned: 0,
    tokensEarned: 0.08,
    routePoints: [],
    lastUpdated: 3_000,
  };
  const remote = { ...local, workoutStartTime: 1_000, lastUpdated: 2_000, isPaused: true };

  assert.equal(shouldPreferRemoteWorkoutSnapshot(local, remote), true);
});

test('prefers a server pause and preserves the greatest progress from both devices', () => {
  const local = {
    accountId: 'user-1',
    runnerIds: ['runner-1'],
    isTracking: true,
    pendingFinish: false,
    pendingWasPaused: false,
    lastWorkoutSummary: { earned: 0, distance: '0.00', time: '00:00', calories: 0, runnerName: 'Runner' },
    isPaused: false,
    workoutStartTime: 1_000,
    pauseStartTime: 0,
    pausedDuration: 0,
    elapsedSeconds: 1_100,
    distanceKm: 2.4,
    stepCount: 3_200,
    caloriesBurned: 128,
    tokensEarned: 4.8,
    routePoints: [],
    lastUpdated: 3_000,
  };
  const remote = {
    ...local,
    isPaused: true,
    elapsedSeconds: 1_200,
    distanceKm: 0,
    stepCount: 0,
    caloriesBurned: 0,
    tokensEarned: 0,
    lastUpdated: 2_000,
  };

  assert.equal(shouldPreferRemoteWorkoutSnapshot(local, remote), true);
  assert.deepEqual(mergeWorkoutSnapshots(local, remote), {
    ...remote,
    distanceKm: 2.4,
    stepCount: 3_200,
    caloriesBurned: 128,
    tokensEarned: 4.8,
    elapsedSeconds: 1_200,
    pendingFinish: false,
  });
});
