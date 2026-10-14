import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeWorkoutSnapshotProgress } from './workoutSnapshot.js';

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
