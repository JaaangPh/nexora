import { FieldValue } from 'firebase-admin/firestore';
import { getDb, FirestoreUser } from '../database/firebase.js';
import {
  calculateWorkoutRewardCents,
  calculateWorkoutRewardKmByRunner,
  fromCents,
  haversineDistanceMeters,
  isPlausibleGpsDistanceEstimate,
  toCents,
} from './workoutRules.js';
import { readRunnerRules, type RunnerRules } from './runnerRules.js';

export class WorkoutError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'WorkoutError';
  }
}

function validateCompletedWorkout(
  snapshot: Record<string, unknown>,
  user: FirestoreUser,
  completedAt: number,
  runnerRules: RunnerRules,
) {
  const routeMeters = haversineDistanceMeters(snapshot.routePoints);
  const reportedMeters = Number(snapshot.distanceKm || 0) * 1000;
  const ownedRunners = Array.isArray(user.ownedRunners) ? user.ownedRunners : [];
  const runners = ownedRunners.flatMap((runner) => {
    if (typeof runner === 'string') return [{ id: runner, runnerId: runner }];
    if (!runner || typeof runner !== 'object') return [];
    return [runner as { id?: string; runnerId?: string }];
  });
  const selectedIds = Array.isArray(snapshot.runnerIds)
    ? [...new Set(snapshot.runnerIds.filter((id): id is string => typeof id === 'string'))]
    : [];
  const selectedRunnersById = new Map<string, { id?: string; runnerId?: string }>();
  let validSelection = selectedIds.length > 0;
  for (const id of selectedIds) {
    const runner = runners.find((ownedRunner) => ownedRunner.id === id || ownedRunner.runnerId === id);
    if (!runner) {
      validSelection = false;
      continue;
    }
    selectedRunnersById.set(runner.id || runner.runnerId || id, runner);
  }
  const selectedRunners = [...selectedRunnersById.values()];
  const limitKm = selectedRunners.reduce(
    (sum, runner) => sum + (runnerRules[runner.runnerId as keyof RunnerRules]?.kmLimitPerDay || 0),
    0,
  );
  const serverStartedAt = Number(snapshot.serverStartedAt || 0);
  const startedAt = Number(snapshot.workoutStartTime || 0);
  const observedSeconds = Math.max(1, (completedAt - serverStartedAt) / 1000);
  const validTiming = validSelection && limitKm > 0 &&
    serverStartedAt > 0 && startedAt > 0 &&
    startedAt <= completedAt && Math.abs(serverStartedAt - startedAt) <= 120_000 &&
    completedAt >= serverStartedAt;
  const routePlausible = validTiming && routeMeters > 0 && routeMeters / observedSeconds <= 20;
  const gpsEstimatePlausible = validTiming &&
    routeMeters === 0 &&
    reportedMeters <= limitKm * 1000 &&
    isPlausibleGpsDistanceEstimate(reportedMeters, Number(snapshot.stepCount || 0), observedSeconds);
  const rewardMeters = routePlausible
    ? Math.min(routeMeters, limitKm * 1000)
    : gpsEstimatePlausible
      ? reportedMeters
      : 0;
  return {
    meters: routePlausible ? Math.min(routeMeters, limitKm * 1000) : 0,
    rewardMeters,
    rewardEligible: rewardMeters > 0,
    startedAt,
    serverStartedAt,
    completedAt,
    selectedRunnerIds: selectedRunners
      .map((runner) => runner.runnerId)
      .filter((runnerId): runnerId is string => typeof runnerId === 'string'),
  };
}

export async function completeWorkoutAndClearSnapshot(
  userIdInput: string | undefined,
  expectedWorkoutStartTime?: number,
) {
  if (!userIdInput) throw new WorkoutError(401, 'Authentication required.');
  const userId = userIdInput;
  const runnerRules = await readRunnerRules();
  const userRef = getDb().collection('users').doc(userId);
  let creditedMeters = 0;
  let creditedRewardCents = 0;
  let resultingBalance = 0;
  let workoutVerified = false;

  await getDb().runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const user = userSnapshot.exists ? userSnapshot.data() as FirestoreUser : null;
    if (!user) throw new WorkoutError(404, 'Account not found.');

    const snapshot = user.workoutSnapshot as Record<string, unknown> | undefined;
    if (!snapshot || snapshot.pendingFinish !== true || snapshot.isTracking === true) {
      if (expectedWorkoutStartTime && Number.isFinite(expectedWorkoutStartTime) && expectedWorkoutStartTime > 0) {
        const completedWorkoutRef = getDb().collection('completed_workouts')
          .doc(`${userId}_${Math.trunc(expectedWorkoutStartTime)}`);
        const completedWorkoutSnapshot = await transaction.get(completedWorkoutRef);
        const completedWorkout = completedWorkoutSnapshot.data();
        if (completedWorkoutSnapshot.exists && completedWorkout?.userId === userId) {
          creditedRewardCents = Number(completedWorkout.rewardCents || 0);
          resultingBalance = fromCents(toCents(user.balance));
          workoutVerified = completedWorkout.rewardVerified === true;
          creditedMeters = Number(completedWorkout.verifiedMeters || 0);
          return;
        }
      }
      throw new WorkoutError(409, 'Complete End & Earn before finishing this workout.');
    }

    const startedAt = Number(snapshot.workoutStartTime || 0);
    if (!Number.isFinite(startedAt) || startedAt <= 0) throw new WorkoutError(400, 'The workout start time is invalid.');
    if (expectedWorkoutStartTime && Math.trunc(expectedWorkoutStartTime) !== Math.trunc(startedAt)) {
      throw new WorkoutError(409, 'The workout changed before its reward could be credited. Refresh and try again.');
    }

    const workoutId = `${userId}_${Math.trunc(startedAt)}`;
    const workoutRef = getDb().collection('completed_workouts').doc(workoutId);
    const rewardRef = getDb().collection('wallet_transactions').doc(`${workoutId}_reward`);
    const now = Date.now();
    const rewardDay = new Date(now).toISOString().slice(0, 10);
    const dailyRewardLimitRef = getDb().collection('workout_reward_daily_limits')
      .doc(`${userId}_${rewardDay}`);
    const [workoutSnapshot, rewardSnapshot, dailyRewardLimitSnapshot] = await Promise.all([
      transaction.get(workoutRef),
      transaction.get(rewardRef),
      transaction.get(dailyRewardLimitRef),
    ]);
    const verification = validateCompletedWorkout(snapshot, user, now, runnerRules);
    workoutVerified = verification.rewardEligible;

    const dailyLimitData = dailyRewardLimitSnapshot.data();
    const dailyKmByRunner = dailyLimitData?.kmByRunner && typeof dailyLimitData.kmByRunner === 'object'
      ? dailyLimitData.kmByRunner as Record<string, number>
      : {};
    const earnedKmByRunner = verification.rewardEligible
      ? calculateWorkoutRewardKmByRunner(
        verification.rewardMeters,
        verification.selectedRunnerIds,
        runnerRules,
        dailyKmByRunner,
      )
      : {};
    const nextDailyKmByRunner = { ...dailyKmByRunner };
    for (const [runnerId, earnedKm] of Object.entries(earnedKmByRunner)) {
      const accruedKm = Number(nextDailyKmByRunner[runnerId] || 0);
      nextDailyKmByRunner[runnerId] = accruedKm + earnedKm;
    }

    const rewardCents = verification.rewardEligible
      ? calculateWorkoutRewardCents(
        verification.rewardMeters,
        verification.selectedRunnerIds,
        runnerRules,
        dailyKmByRunner,
      )
      : 0;
    const currentBalanceCents = toCents(user.balance);
    const shouldCreditReward = !workoutSnapshot.exists && !rewardSnapshot.exists && rewardCents > 0;
    creditedRewardCents = shouldCreditReward
      ? rewardCents
      : Number(rewardSnapshot.data()?.amountCents || 0);
    resultingBalance = fromCents(currentBalanceCents + (shouldCreditReward ? rewardCents : 0));
    creditedMeters = verification.meters;

    if (!workoutSnapshot.exists) {
      transaction.create(workoutRef, {
        id: workoutId,
        userId,
        startedAt,
        serverStartedAt: verification.serverStartedAt,
        completedAt: now,
        verified: verification.meters > 0,
        verifiedMeters: verification.meters,
        rewardVerified: verification.rewardEligible,
        rewardCents: creditedRewardCents,
        selectedRunnerIds: verification.selectedRunnerIds,
      });
    }

    if (shouldCreditReward) {
      transaction.create(rewardRef, {
        id: `${workoutId}_reward`,
        userId,
        type: 'workout_reward',
        workoutId,
        amountCents: rewardCents,
        amount: fromCents(rewardCents),
        createdAt: now,
      });
      transaction.set(dailyRewardLimitRef, {
        userId,
        date: rewardDay,
        kmByRunner: nextDailyKmByRunner,
        updatedAt: now,
      });
    }

    transaction.update(userRef, {
      workoutSnapshot: FieldValue.delete(),
      ...(shouldCreditReward ? { balance: resultingBalance } : {}),
    });
  });

  return {
    success: true,
    verified: workoutVerified,
    creditedMeters,
    creditedReward: fromCents(creditedRewardCents),
    balance: resultingBalance,
  };
}
