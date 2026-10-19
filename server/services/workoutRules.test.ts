import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateWorkoutRewardCents,
  calculateWorkoutRewardKmByRunner,
  haversineDistanceMeters,
  isPlausibleSensorWorkout,
} from './workoutRules.js';

test('server derives route distance from validated coordinates', () => {
  const meters = haversineDistanceMeters([[0, 0], [0, 1]]);
  assert.ok(meters > 111_000 && meters < 111_500);
  assert.equal(haversineDistanceMeters([[0, 0], [91, 1]]), 0);
  assert.equal(haversineDistanceMeters([]), 0);
});

test('workout rewards use server rates and each selected runner limit', () => {
  assert.equal(calculateWorkoutRewardCents(6_000, ['snk-1']), 5_040);
  assert.equal(calculateWorkoutRewardCents(7_000, ['snk-1']), 5_040);
  assert.equal(calculateWorkoutRewardCents(6_000, ['snk-1', 'snk-2']), 11_160);
  assert.equal(calculateWorkoutRewardCents(6_000, ['unknown']), 0);
  assert.equal(calculateWorkoutRewardCents(-1, ['snk-1']), 0);
});

test('workout rewards use configured earning rate and daily distance limit', () => {
  const rules = {
    'snk-1': { earningRate: 12.5, kmLimitPerDay: 6 },
    'snk-2': { earningRate: 20, kmLimitPerDay: 10 },
  };
  const accrued = { 'snk-1': 5, 'snk-2': 8 };

  assert.deepEqual(
    calculateWorkoutRewardKmByRunner(3_000, ['snk-1', 'snk-2'], rules, accrued),
    { 'snk-1': 1, 'snk-2': 2 },
  );
  assert.equal(calculateWorkoutRewardCents(3_000, ['snk-1', 'snk-2'], rules, accrued), 5_250);
  assert.equal(calculateWorkoutRewardCents(1_000, ['snk-1'], rules, { 'snk-1': 6 }), 0);
});

test('motion-sensor distance must match plausible steps and elapsed time', () => {
  assert.equal(isPlausibleSensorWorkout(6_000, 8_000, 1_800), true);
  assert.equal(isPlausibleSensorWorkout(6_000, 0, 1_800), false);
  assert.equal(isPlausibleSensorWorkout(6_000, 100, 1_800), false);
  assert.equal(isPlausibleSensorWorkout(6_000, 8_000, 10), false);
});
