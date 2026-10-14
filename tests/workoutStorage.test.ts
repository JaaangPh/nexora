import assert from 'node:assert/strict';
import test from 'node:test';
import { getPausedWorkoutTiming } from '../src/services/workoutStorage.js';

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
