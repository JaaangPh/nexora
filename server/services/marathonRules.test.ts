import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocateEqualCents,
  calculateWorkoutRewardCents,
  checkMarathonRunnerEligibility,
  displayedNexoraId,
  haversineDistanceMeters,
  isPlausibleSensorWorkout,
  isBeforeMarathonDeadline,
  marathonWorkoutInProgress,
  ownsRequiredMarathonRunners,
} from './marathonRules.js';

test('displayed Nexora ID matches the five-digit value used on the Me page', () => {
  assert.equal(displayedNexoraId('NT723906', 'ignored-user-id'), '23906');
  assert.equal(displayedNexoraId(undefined, 'member-42'), '00042');
});

test('marathon runner eligibility accepts either required canonical runner', () => {
  assert.deepEqual(checkMarathonRunnerEligibility([{ runnerId: 'snk-3' }]), {
    eligible: true,
    ownsCobalt: true,
    ownsVortex: false,
  });
  assert.equal(checkMarathonRunnerEligibility([{ runnerId: 'snk-4' }]).eligible, true);
  assert.equal(checkMarathonRunnerEligibility([{ runnerId: 'snk-1' }]).eligible, false);
});

test('starting a marathon requires both canonical qualifying runners', () => {
  assert.equal(ownsRequiredMarathonRunners(checkMarathonRunnerEligibility([{ runnerId: 'snk-3' }])), false);
  assert.equal(ownsRequiredMarathonRunners(checkMarathonRunnerEligibility([{ runnerId: 'snk-4' }])), false);
  assert.equal(ownsRequiredMarathonRunners(checkMarathonRunnerEligibility([
    { runnerId: 'snk-3' },
    { runnerId: 'snk-4' },
  ])), true);
});

test('active, paused, and pending-finish workouts all block Marathon actions', () => {
  assert.equal(marathonWorkoutInProgress({ isTracking: true, isPaused: false, pendingFinish: false }), true);
  assert.equal(marathonWorkoutInProgress({ isTracking: true, isPaused: true, pendingFinish: false }), true);
  assert.equal(marathonWorkoutInProgress({ isTracking: false, isPaused: true, pendingFinish: false }), true);
  assert.equal(marathonWorkoutInProgress({ isTracking: false, isPaused: false, pendingFinish: true }), true);
  assert.equal(marathonWorkoutInProgress({ isTracking: false, isPaused: false, pendingFinish: false }), false);
});

test('a workout must complete strictly before the authoritative deadline', () => {
  assert.equal(isBeforeMarathonDeadline(999, 1000), true);
  assert.equal(isBeforeMarathonDeadline(1000, 1000), false);
  assert.equal(isBeforeMarathonDeadline(1001, 1000), false);
});

test('equal integer-cent allocations sum exactly and distribute remainders deterministically', () => {
  const shares = allocateEqualCents(100_001, ['z', 'b', 'a']);
  assert.deepEqual(shares, { a: 33_334, b: 33_334, z: 33_333 });
  assert.equal(Object.values(shares).reduce((sum, share) => sum + share, 0), 100_001);
});

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

test('motion-sensor reward distance must match plausible steps and elapsed time', () => {
  assert.equal(isPlausibleSensorWorkout(6_000, 8_000, 1_800), true);
  assert.equal(isPlausibleSensorWorkout(6_000, 0, 1_800), false);
  assert.equal(isPlausibleSensorWorkout(6_000, 100, 1_800), false);
  assert.equal(isPlausibleSensorWorkout(6_000, 8_000, 10), false);
});
