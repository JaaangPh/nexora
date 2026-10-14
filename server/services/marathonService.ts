import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getDb, FirestoreUser } from '../database/firebase.js';
import {
  allocateEqualCents,
  calculateWorkoutRewardCents,
  checkMarathonRunnerEligibility,
  displayedNexoraId,
  fromCents,
  haversineDistanceMeters,
  isBeforeMarathonDeadline,
  marathonWorkoutInProgress,
  MARATHON_PACKAGES,
  MARATHON_RUNNER_LIMITS_KM,
  isPlausibleSensorWorkout,
  ownsRequiredMarathonRunners,
  toCents,
} from './marathonRules.js';

const MIN_TEAM_SIZE = 5;
const MAX_TEAM_SIZE = 10;
const MARATHON_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const WORKOUT_RESPONSE_BLOCK =
  'Finish your current workout using End & Earn before responding to this invitation.';

type TeamStatus = 'Lobby' | 'Active' | 'Completed' | 'Failed' | 'Cancelled';
type InviteStatus = 'Pending' | 'Accepted' | 'Declined' | 'Cancelled';

interface MarathonTeam {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  memberIdsHistory: string[];
  participantIds: string[];
  pendingInviteeIds: string[];
  invitationIds: string[];
  status: TeamStatus;
  packageId: '250' | '500' | null;
  targetMeters: number;
  bountyCents: number;
  durationMs: number;
  createdAt: number;
  startedAt?: number;
  deadlineAt?: number;
  endedAt?: number;
  totalMeters: number;
  contributionsMeters: Record<string, number>;
  fundingSharesCents?: Record<string, number>;
  payoutsCents?: Record<string, number>;
  payoutStatus?: 'pending' | 'paid' | 'refunded' | 'not_awarded';
  memberHistory?: Record<string, { joinedAt: number; leftAt?: number; role: 'leader' | 'member' }>;
}

interface MarathonInvitation {
  id: string;
  teamId: string;
  teamName: string;
  leaderId: string;
  inviteeId: string;
  status: InviteStatus;
  createdAt: number;
  targetMeters: number;
  bountyCents: number;
  respondedAt?: number;
}

export class MarathonError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'MarathonError';
  }
}

const teamRef = (id: string) => getDb().collection('marathons').doc(id);
const memberRef = (id: string) => getDb().collection('marathon_memberships').doc(id);
const cooldownRef = (id: string) => getDb().collection('marathon_cooldowns').doc(id);
const invitationRef = (id: string) => getDb().collection('marathon_invitations').doc(id);
const notificationRef = (id: string) => getDb().collection('marathon_notifications').doc(id);

function requireUserId(userId: string | undefined): string {
  if (!userId) throw new MarathonError(401, 'Authentication required.');
  return userId;
}

function getUserData(snapshot: FirebaseFirestore.DocumentSnapshot): FirestoreUser | null {
  return snapshot.exists ? snapshot.data() as FirestoreUser : null;
}

function workoutInProgress(user: FirestoreUser | null): boolean {
  return marathonWorkoutInProgress(user?.workoutSnapshot);
}

function cooldownUntil(snapshot: FirebaseFirestore.DocumentSnapshot): number {
  return Number(snapshot.data()?.cooldownUntil || 0);
}

function assertCooldown(snapshot: FirebaseFirestore.DocumentSnapshot, now: number): void {
  if (cooldownUntil(snapshot) > now) {
    throw new MarathonError(409, `Marathon cooldown is active until ${new Date(cooldownUntil(snapshot)).toISOString()}.`);
  }
}

function assertEligibleRunners(user: FirestoreUser | null): void {
  if (!user) throw new MarathonError(404, 'Account not found.');
  if (!checkMarathonRunnerEligibility(user.ownedRunners).eligible) {
    throw new MarathonError(409, 'Own at least one Cobalt Aero Jogger or Vortex Blaze Sprint to participate.');
  }
}

function assertNoWorkout(user: FirestoreUser | null): void {
  if (workoutInProgress(user)) throw new MarathonError(409, WORKOUT_RESPONSE_BLOCK);
}

function readTeam(snapshot: FirebaseFirestore.DocumentSnapshot): MarathonTeam {
  if (!snapshot.exists) throw new MarathonError(404, 'Marathon team not found.');
  return snapshot.data() as MarathonTeam;
}

function assertLeader(team: MarathonTeam, userId: string): void {
  if (team.leaderId !== userId) throw new MarathonError(403, 'Only the team leader can perform this action.');
}

function assertLobby(team: MarathonTeam): void {
  if (team.status !== 'Lobby') throw new MarathonError(409, 'This team is no longer in the lobby.');
}

function pushNotification(
  transaction: FirebaseFirestore.Transaction,
  userId: string,
  type: string,
  team: MarathonTeam,
  message: string,
  createdAt: number,
): void {
  const id = crypto.randomUUID();
  transaction.create(notificationRef(id), { id, userId, type, teamId: team.id, teamName: team.name, message, createdAt, read: false });
}

function allocateFundingShares(team: MarathonTeam): Record<string, number> {
  return allocateEqualCents(team.bountyCents, team.memberIds);
}

async function finalizeTeamInTransaction(
  transaction: FirebaseFirestore.Transaction,
  team: MarathonTeam,
  outcome: 'Completed' | 'Failed',
  endedAt: number,
): Promise<void> {
  const participants = [...new Set(team.participantIds)];
  const recipients = outcome === 'Completed' ? [...team.memberIds].sort() : [];
  const [participantSnapshots, recipientSnapshots, membershipSnapshots, pendingInvitations] = await Promise.all([
    Promise.all(participants.map((id) => transaction.get(getDb().collection('users').doc(id)))),
    Promise.all(recipients.map((id) => transaction.get(getDb().collection('users').doc(id)))),
    Promise.all(participants.map((id) => transaction.get(memberRef(id)))),
    Promise.all(team.invitationIds.map((id) => transaction.get(invitationRef(id)))),
  ]);

  const payoutMap = outcome === 'Completed'
    ? allocateEqualCents(team.bountyCents, recipients)
    : {};

  if (outcome === 'Failed') {
    for (const [index, userId] of participants.entries()) {
      const user = getUserData(participantSnapshots[index]);
      const refundCents = team.fundingSharesCents?.[userId] || 0;
      if (!user) throw new MarathonError(409, 'A participating account no longer exists.');
      if (toCents(user.balance) + refundCents > Number.MAX_SAFE_INTEGER) {
        throw new MarathonError(409, 'A participant balance exceeds the supported range.');
      }
    }
  }

  for (const [index, userId] of recipients.entries()) {
    const user = getUserData(recipientSnapshots[index]);
    if (!user) throw new MarathonError(409, 'A team member account no longer exists.');
    const currentCents = toCents(user.balance);
    const payoutCents = payoutMap[userId] || 0;
    if (currentCents + payoutCents > Number.MAX_SAFE_INTEGER) {
      throw new MarathonError(409, 'A team member balance exceeds the supported range.');
    }
  }

  transaction.update(teamRef(team.id), {
    status: outcome,
    endedAt,
    payoutsCents: payoutMap,
    payoutStatus: outcome === 'Completed' ? (recipients.length > 0 ? 'paid' : 'not_awarded') : 'refunded',
    invitationIds: [],
    pendingInviteeIds: [],
  });

  for (let index = 0; index < participantSnapshots.length; index += 1) {
    const userId = participants[index];
    if (membershipSnapshots[index].exists) transaction.delete(memberRef(userId));
    transaction.set(cooldownRef(userId), { userId, cooldownUntil: endedAt + MARATHON_COOLDOWN_MS, marathonId: team.id });
    pushNotification(
      transaction,
      userId,
      `marathon_${outcome.toLowerCase()}`,
      team,
      outcome === 'Completed'
        ? 'Your marathon was completed.'
        : 'Your marathon ended without reaching its target. Your bounty contribution was refunded.',
      endedAt,
    );
  }

  if (outcome === 'Completed') {
    for (const [index, userId] of recipients.entries()) {
      const currentCents = toCents(getUserData(recipientSnapshots[index])?.balance);
      const payoutCents = payoutMap[userId] || 0;
      transaction.update(getDb().collection('users').doc(userId), { balance: fromCents(currentCents + payoutCents) });
      const transactionId = `${team.id}_${userId}`;
      transaction.create(getDb().collection('wallet_transactions').doc(transactionId), {
        id: transactionId,
        userId,
        type: 'marathon_reward',
        marathonId: team.id,
        amountCents: payoutCents,
        amount: fromCents(payoutCents),
        createdAt: endedAt,
      });
    }
  } else {
    for (const [index, userId] of participants.entries()) {
      const user = getUserData(participantSnapshots[index])!;
      const refundCents = team.fundingSharesCents?.[userId] || 0;
      transaction.update(getDb().collection('users').doc(userId), {
        balance: fromCents(toCents(user.balance) + refundCents),
      });
      const transactionId = `${team.id}_${userId}_refund`;
      transaction.create(getDb().collection('wallet_transactions').doc(transactionId), {
        id: transactionId,
        userId,
        type: 'marathon_bounty_refund',
        marathonId: team.id,
        amountCents: refundCents,
        amount: fromCents(refundCents),
        createdAt: endedAt,
      });
    }
  }

  for (let index = 0; index < pendingInvitations.length; index += 1) {
    const invitation = pendingInvitations[index];
    if (!invitation.exists || invitation.data()?.status !== 'Pending') continue;
    transaction.update(invitation.ref, { status: 'Cancelled', respondedAt: endedAt });
  }
}

async function settleExpiredTeam(teamId: string): Promise<void> {
  await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(teamRef(teamId));
    if (!snapshot.exists) return;
    const team = snapshot.data() as MarathonTeam;
    if (team.status !== 'Active') return;
    const now = Date.now();
    if (now < Number(team.deadlineAt || 0)) return;
    await finalizeTeamInTransaction(transaction, team, 'Failed', Number(team.deadlineAt));
  });
}

function publicProfile(userId: string, user: FirestoreUser | null) {
  if (!user) return null;
  const runners = checkMarathonRunnerEligibility(user.ownedRunners);
  return {
    id: userId,
    nexoraId: displayedNexoraId(user.referralCode, userId),
    username: user.username || 'Nexora Member',
    profileImage: user.profileImage || null,
    ownsCobalt: runners.ownsCobalt,
    ownsVortex: runners.ownsVortex,
    eligible: runners.eligible,
    stillRunning: workoutInProgress(user),
  };
}

async function hydrateTeam(team: MarathonTeam) {
  const [userSnapshots, cooldownSnapshots, invitationQuery] = await Promise.all([
    Promise.all(team.memberIdsHistory.map((id) => getDb().collection('users').doc(id).get())),
    Promise.all(team.memberIdsHistory.map((id) => cooldownRef(id).get())),
    getDb().collection('marathon_invitations').where('teamId', '==', team.id).get(),
  ]);
  const members = team.memberIdsHistory.flatMap((id, index) => {
    const profile = publicProfile(id, getUserData(userSnapshots[index]));
    if (!profile) return [];
    const history = team.memberHistory?.[id];
    return [{
      ...profile,
      role: history?.role || (id === team.leaderId ? 'leader' : 'member'),
      joinedAt: history?.joinedAt || team.createdAt,
      leftAt: history?.leftAt || null,
      active: team.memberIds.includes(id),
      membershipStatus: team.memberIds.includes(id)
        ? 'active'
        : history?.leftAt
          ? 'departed'
          : 'historical',
      cooldownUntil: cooldownUntil(cooldownSnapshots[index]),
      verifiedKm: Number(team.contributionsMeters?.[id] || 0) / 1000,
    }];
  });
  const invitations = await Promise.all(invitationQuery.docs.map(async (snapshot) => {
    const invitation = snapshot.data() as MarathonInvitation;
    const invitee = await getDb().collection('users').doc(invitation.inviteeId).get();
    return {
      ...invitation,
      bounty: fromCents(invitation.bountyCents),
      invitee: publicProfile(invitation.inviteeId, getUserData(invitee)),
    };
  }));
  return {
    ...team,
    targetKm: team.targetMeters / 1000,
    bounty: fromCents(team.bountyCents),
    totalKm: Number(team.totalMeters || 0) / 1000,
    remainingKm: Math.max(0, (team.targetMeters - Number(team.totalMeters || 0)) / 1000),
    progressPercentage: team.targetMeters > 0
      ? Math.min(100, Number(team.totalMeters || 0) / team.targetMeters * 100)
      : 0,
    members,
    invitations,
    memberCount: team.memberIds.length,
    pendingInvitationCount: team.pendingInviteeIds.length,
    membersStillNeeded: Math.max(0, MIN_TEAM_SIZE - team.memberIds.length),
    payouts: Object.fromEntries(Object.entries(team.payoutsCents || {}).map(([id, cents]) => [id, fromCents(cents)])),
    payoutTransactionIds: Object.keys(team.payoutsCents || {})
      .filter((id) => (team.payoutsCents?.[id] || 0) > 0)
      .map((id) => ({ userId: id, transactionId: `${team.id}_${id}` })),
  };
}

export async function getMarathonDashboard(userIdInput: string | undefined) {
  const userId = requireUserId(userIdInput);
  const membership = await memberRef(userId).get();
  const currentTeamId = membership.data()?.teamId as string | undefined;
  if (currentTeamId) await settleExpiredTeam(currentTeamId);

  const [userSnapshot, cooldownSnapshot, membershipSnapshot, invitationQuery, historyQuery] = await Promise.all([
    getDb().collection('users').doc(userId).get(),
    cooldownRef(userId).get(),
    memberRef(userId).get(),
    getDb().collection('marathon_invitations').where('inviteeId', '==', userId).get(),
    getDb().collection('marathons').where('memberIdsHistory', 'array-contains', userId).get(),
  ]);
  const user = getUserData(userSnapshot);
  const teamId = membershipSnapshot.data()?.teamId as string | undefined;
  const currentSnapshot = teamId ? await teamRef(teamId).get() : null;
  const currentTeam = currentSnapshot?.exists ? await hydrateTeam(currentSnapshot.data() as MarathonTeam) : null;
  const invitationDocs = invitationQuery.docs.filter((item) => item.data().status === 'Pending');
  const invitations = await Promise.all(invitationDocs.map(async (document) => {
    const invitation = document.data() as MarathonInvitation;
    const [teamSnapshot, leaderSnapshot] = await Promise.all([
      teamRef(invitation.teamId).get(),
      getDb().collection('users').doc(invitation.leaderId).get(),
    ]);
    if (!teamSnapshot.exists || teamSnapshot.data()?.status !== 'Lobby') return null;
    const team = teamSnapshot.data() as MarathonTeam;
    return {
      ...invitation,
      bounty: fromCents(invitation.bountyCents),
      team: await hydrateTeam(team),
      leader: publicProfile(invitation.leaderId, getUserData(leaderSnapshot)),
      stillRunning: workoutInProgress(user),
      eligibility: checkMarathonRunnerEligibility(user?.ownedRunners),
      cooldownUntil: cooldownUntil(cooldownSnapshot),
      alreadyInTeam: !!teamId,
    };
  }));
  const historyTeams = await Promise.all(historyQuery.docs
    .filter((document) => document.id !== teamId && document.data()?.status !== 'Lobby')
    .map(async (document) => hydrateTeam(document.data() as MarathonTeam)));
  const notificationsQuery = await getDb().collection('marathon_notifications')
    .where('userId', '==', userId).limit(50).get();
  const notifications = notificationsQuery.docs
    .map((document) => document.data())
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
    .slice(0, 20);

  return {
    success: true,
    eligibility: checkMarathonRunnerEligibility(user?.ownedRunners),
    cooldownUntil: cooldownUntil(cooldownSnapshot),
    currentTeam,
    invitations: invitations.filter(Boolean),
    history: historyTeams,
    notifications,
  };
}

export async function searchMarathonUser(userIdInput: string | undefined, teamId: string, nexoraIdInput: string) {
  const userId = requireUserId(userIdInput);
  const nexoraId = typeof nexoraIdInput === 'string' ? nexoraIdInput.trim() : '';
  if (!/^\d{5}$/.test(nexoraId)) throw new MarathonError(400, 'Enter the five-digit Nexora ID shown on the Me page.');

  const snapshot = await teamRef(teamId).get();
  const team = readTeam(snapshot);
  assertLeader(team, userId);
  assertLobby(team);
  const referralCodeCandidates = Array.from({ length: 9 }, (_, index) => `NT${index + 1}${nexoraId}`);
  const userQuery = await getDb().collection('users').where('referralCode', 'in', referralCodeCandidates).get();
  if (userQuery.empty) throw new MarathonError(404, 'No Nexora user was found with that ID.');
  const matches = userQuery.docs.filter((document) => {
    const candidate = getUserData(document);
    return candidate && displayedNexoraId(candidate.referralCode, document.id) === nexoraId;
  });
  if (matches.length > 1) {
    throw new MarathonError(409, 'More than one account has this five-digit Nexora ID. Ask the user to contact support before inviting.');
  }
  if (matches.length === 0) throw new MarathonError(404, 'No Nexora user was found with that ID.');
  const targetSnapshot = matches[0];
  const target = getUserData(targetSnapshot);
  if (!target) throw new MarathonError(404, 'No Nexora user was found with that ID.');

  const [membership, cooldown, currentTeam] = await Promise.all([
    memberRef(target.id).get(),
    cooldownRef(target.id).get(),
    teamRef(team.id).get(),
  ]);
  const reservedIds = new Set(team.pendingInviteeIds);
  const activeTeam = currentTeam.exists ? currentTeam.data() as MarathonTeam : team;
  const isFull = activeTeam.memberIds.length + activeTeam.pendingInviteeIds.length >= MAX_TEAM_SIZE;
  const runnerEligibility = checkMarathonRunnerEligibility(target.ownedRunners);
  let status = 'Eligible';
  if (reservedIds.has(target.id)) status = 'Invitation pending';
  else if (isFull) status = 'Team full';
  else if (membership.exists) status = 'Already in another team';
  else if (cooldownUntil(cooldown) > Date.now()) status = 'On marathon cooldown';
  else if (!runnerEligibility.eligible) status = 'Missing both required runners';
  else if (workoutInProgress(target)) status = 'Still Running';

  return {
    success: true,
    profile: {
      id: target.id,
      nexoraId: displayedNexoraId(target.referralCode, target.id),
      username: target.username || 'Nexora Member',
      profileImage: target.profileImage || null,
      ownsCobalt: runnerEligibility.ownsCobalt,
      ownsVortex: runnerEligibility.ownsVortex,
      eligible: runnerEligibility.eligible,
      status,
      cooldownUntil: cooldownUntil(cooldown),
      canInvite: status === 'Eligible',
    },
  };
}

export async function createMarathonTeam(userIdInput: string | undefined, nameInput: string) {
  const userId = requireUserId(userIdInput);
  const name = typeof nameInput === 'string' ? nameInput.trim() : '';
  if (name.length < 3 || name.length > 40) throw new MarathonError(400, 'Team names must be 3 to 40 characters.');
  const id = crypto.randomUUID();
  const now = Date.now();
  const userRef = getDb().collection('users').doc(userId);

  await getDb().runTransaction(async (transaction) => {
    const [userSnapshot, membership, cooldown] = await Promise.all([
      transaction.get(userRef),
      transaction.get(memberRef(userId)),
      transaction.get(cooldownRef(userId)),
    ]);
    const user = getUserData(userSnapshot);
    assertEligibleRunners(user);
    assertNoWorkout(user);
    assertCooldown(cooldown, now);
    if (membership.exists) {
      throw new MarathonError(
        409,
        'You are already a member of another marathon team. Leave your current team before joining a different team.',
      );
    }

    const team: MarathonTeam = {
      id,
      name,
      leaderId: userId,
      memberIds: [userId],
      memberIdsHistory: [userId],
      participantIds: [],
      pendingInviteeIds: [],
      invitationIds: [],
      status: 'Lobby',
      packageId: null,
      targetMeters: 0,
      bountyCents: 0,
      durationMs: MARATHON_PACKAGES['250'].durationMs,
      createdAt: now,
      totalMeters: 0,
      contributionsMeters: {},
      memberHistory: { [userId]: { joinedAt: now, role: 'leader' } },
    };
    transaction.create(teamRef(id), team);
    transaction.create(memberRef(userId), { userId, teamId: id, role: 'leader', status: 'active', joinedAt: now });
    pushNotification(transaction, userId, 'team_created', team, 'You created a Marathon team.', now);
  });
  return { success: true, teamId: id };
}

export async function inviteMarathonUser(userIdInput: string | undefined, teamId: string, inviteeId: string) {
  const userId = requireUserId(userIdInput);
  const inviteId = crypto.randomUUID();
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const [teamSnapshot, leaderMembership, leaderCooldown, inviteeSnapshot, inviteeMembership, cooldown] = await Promise.all([
      transaction.get(teamRef(teamId)),
      transaction.get(memberRef(userId)),
      transaction.get(cooldownRef(userId)),
      transaction.get(getDb().collection('users').doc(inviteeId)),
      transaction.get(memberRef(inviteeId)),
      transaction.get(cooldownRef(inviteeId)),
    ]);
    const team = readTeam(teamSnapshot);
    assertLeader(team, userId);
    assertLobby(team);
    if (!leaderMembership.exists || leaderMembership.data()?.teamId !== teamId) {
      throw new MarathonError(403, 'You are no longer the leader of this team.');
    }
    assertCooldown(leaderCooldown, now);
    if (!inviteeSnapshot.exists || inviteeId === userId) throw new MarathonError(404, 'The selected user is unavailable.');
    const invitee = getUserData(inviteeSnapshot);
    assertEligibleRunners(invitee);
    assertNoWorkout(invitee);
    assertCooldown(cooldown, now);
    if (!team.packageId) throw new MarathonError(409, 'Select a bounty package before inviting players.');
    if (inviteeMembership.exists) throw new MarathonError(409, 'This user is already in another marathon team.');
    if (team.memberIds.includes(inviteeId)) throw new MarathonError(409, 'This user is already on your team.');
    if (team.pendingInviteeIds.includes(inviteeId)) throw new MarathonError(409, 'An invitation is already pending.');
    if (team.memberIds.length + team.pendingInviteeIds.length >= MAX_TEAM_SIZE) {
      throw new MarathonError(409, 'The team and its pending invitations already use all 10 spaces.');
    }

    const invitation: MarathonInvitation = {
      id: inviteId,
      teamId,
      teamName: team.name,
      leaderId: userId,
      inviteeId,
      status: 'Pending',
      createdAt: now,
      targetMeters: team.targetMeters,
      bountyCents: team.bountyCents,
    };
    transaction.create(invitationRef(inviteId), invitation);
    transaction.update(teamRef(teamId), {
      pendingInviteeIds: [...team.pendingInviteeIds, inviteeId],
      invitationIds: [...team.invitationIds, inviteId],
    });
    pushNotification(transaction, inviteeId, 'marathon_invite', team, `${team.name} invited you to join a Marathon team.`, now);
  });
  return { success: true, invitationId: inviteId };
}

export async function respondToMarathonInvitation(
  userIdInput: string | undefined,
  invitationId: string,
  action: 'accept' | 'decline',
) {
  const userId = requireUserId(userIdInput);
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(invitationRef(invitationId));
    if (!inviteSnapshot.exists) throw new MarathonError(404, 'Invitation not found.');
    const invitation = inviteSnapshot.data() as MarathonInvitation;
    if (invitation.inviteeId !== userId) throw new MarathonError(403, 'This invitation belongs to another user.');
    if (invitation.status !== 'Pending') throw new MarathonError(409, 'This invitation is no longer pending.');

    const [teamSnapshot, userSnapshot] = await Promise.all([
      transaction.get(teamRef(invitation.teamId)),
      transaction.get(getDb().collection('users').doc(userId)),
    ]);
    const team = readTeam(teamSnapshot);
    const user = getUserData(userSnapshot);
    assertNoWorkout(user);
    if (team.status !== 'Lobby' || !team.pendingInviteeIds.includes(userId)) {
      throw new MarathonError(409, 'This invitation is no longer valid.');
    }

    if (action === 'decline') {
      transaction.update(invitationRef(invitationId), { status: 'Declined', respondedAt: now });
      transaction.update(teamRef(team.id), {
        pendingInviteeIds: team.pendingInviteeIds.filter((id) => id !== userId),
        invitationIds: team.invitationIds.filter((id) => id !== invitationId),
      });
      pushNotification(transaction, team.leaderId, 'marathon_invite_declined', team, 'A player declined your team invitation.', now);
      return;
    }

    const [membership, cooldown] = await Promise.all([
      transaction.get(memberRef(userId)),
      transaction.get(cooldownRef(userId)),
    ]);
    assertEligibleRunners(user);
    assertCooldown(cooldown, now);
    if (membership.exists) {
      throw new MarathonError(409, 'You are already a member of another marathon team. Leave your current team before joining a different team.');
    }
    if (team.memberIds.length >= MAX_TEAM_SIZE) throw new MarathonError(409, 'The team is full.');

    const history = { ...(team.memberHistory || {}) };
    history[userId] = { joinedAt: now, role: 'member' };
    transaction.update(teamRef(team.id), {
      memberIds: [...team.memberIds, userId],
      memberIdsHistory: [...new Set([...team.memberIdsHistory, userId])],
      memberHistory: history,
      pendingInviteeIds: team.pendingInviteeIds.filter((id) => id !== userId),
      invitationIds: team.invitationIds.filter((id) => id !== invitationId),
    });
    transaction.create(memberRef(userId), { userId, teamId: team.id, role: 'member', status: 'active', joinedAt: now });
    transaction.update(invitationRef(invitationId), { status: 'Accepted', respondedAt: now });
    pushNotification(transaction, team.leaderId, 'marathon_invite_accepted', team, 'A player accepted your team invitation.', now);
  });
  return { success: true };
}

export async function cancelMarathonInvitation(userIdInput: string | undefined, teamId: string, invitationId: string) {
  const userId = requireUserId(userIdInput);
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const [teamSnapshot, invitationSnapshot] = await Promise.all([
      transaction.get(teamRef(teamId)),
      transaction.get(invitationRef(invitationId)),
    ]);
    const team = readTeam(teamSnapshot);
    assertLeader(team, userId);
    assertLobby(team);
    if (!invitationSnapshot.exists || invitationSnapshot.data()?.teamId !== teamId || invitationSnapshot.data()?.status !== 'Pending') {
      throw new MarathonError(404, 'Pending invitation not found.');
    }
    const invitation = invitationSnapshot.data() as MarathonInvitation;
    transaction.update(invitationRef(invitationId), { status: 'Cancelled', respondedAt: now });
    transaction.update(teamRef(teamId), {
      pendingInviteeIds: team.pendingInviteeIds.filter((id) => id !== invitation.inviteeId),
      invitationIds: team.invitationIds.filter((id) => id !== invitationId),
    });
    pushNotification(transaction, invitation.inviteeId, 'marathon_invite_cancelled', team, 'Your Marathon invitation was cancelled.', now);
  });
  return { success: true };
}

export async function updateMarathonTeam(
  userIdInput: string | undefined,
  teamId: string,
  changes: { name?: string; packageId?: '250' | '500' },
) {
  const userId = requireUserId(userIdInput);
  const name = changes.name?.trim();
  if (changes.name !== undefined && (!name || name.length < 3 || name.length > 40)) {
    throw new MarathonError(400, 'Team names must be 3 to 40 characters.');
  }
  if (changes.packageId !== undefined && !Object.hasOwn(MARATHON_PACKAGES, changes.packageId)) {
    throw new MarathonError(400, 'Choose a supported Marathon package.');
  }
  await getDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(teamRef(teamId));
    const team = readTeam(snapshot);
    assertLeader(team, userId);
    assertLobby(team);
    const update: Record<string, unknown> = {};
    if (name) update.name = name;
    let invitations: FirebaseFirestore.DocumentSnapshot[] = [];
    if (changes.packageId) {
      const packageInfo = MARATHON_PACKAGES[changes.packageId];
      update.packageId = changes.packageId;
      update.targetMeters = packageInfo.targetMeters;
      update.bountyCents = packageInfo.bountyCents;
      update.durationMs = packageInfo.durationMs;
    }
    if (name || changes.packageId) {
      invitations = await Promise.all(team.invitationIds.map((id) => transaction.get(invitationRef(id))));
    }
    transaction.update(teamRef(teamId), update);
    for (const invitation of invitations) {
      if (!invitation.exists || invitation.data()?.status !== 'Pending') continue;
      transaction.update(invitation.ref, {
        ...(name ? { teamName: name } : {}),
        ...(changes.packageId
          ? {
              targetMeters: MARATHON_PACKAGES[changes.packageId].targetMeters,
              bountyCents: MARATHON_PACKAGES[changes.packageId].bountyCents,
            }
          : {}),
      });
    }
  });
  return { success: true };
}

export async function startMarathon(userIdInput: string | undefined, teamId: string) {
  const userId = requireUserId(userIdInput);
  await getDb().runTransaction(async (transaction) => {
    const teamSnapshot = await transaction.get(teamRef(teamId));
    const team = readTeam(teamSnapshot);
    assertLeader(team, userId);
    assertLobby(team);
    if (team.memberIds.length < MIN_TEAM_SIZE) {
      throw new MarathonError(409, `At least ${MIN_TEAM_SIZE} accepted members are required.`);
    }
    if (team.memberIds.length > MAX_TEAM_SIZE) throw new MarathonError(409, 'Teams cannot exceed 10 members.');
    if (!team.packageId) throw new MarathonError(409, 'Select a bounty package before starting.');

    const [users, memberships, cooldowns, invitations] = await Promise.all([
      Promise.all(team.memberIds.map((id) => transaction.get(getDb().collection('users').doc(id)))),
      Promise.all(team.memberIds.map((id) => transaction.get(memberRef(id)))),
      Promise.all(team.memberIds.map((id) => transaction.get(cooldownRef(id)))),
      Promise.all(team.invitationIds.map((id) => transaction.get(invitationRef(id)))),
    ]);
    const fundingShares = allocateFundingShares(team);
    const now = Date.now();
    const affectedMembers: string[] = [];
    const membersMissingRunners: string[] = [];
    const insufficientBalance: string[] = [];

    for (let index = 0; index < team.memberIds.length; index += 1) {
      const memberId = team.memberIds[index];
      const member = getUserData(users[index]);
      if (!member) throw new MarathonError(409, 'A joined member account no longer exists.');
      const runnerEligibility = checkMarathonRunnerEligibility(member?.ownedRunners);
      if (!ownsRequiredMarathonRunners(runnerEligibility)) {
        const missingRunners = [
          !runnerEligibility.ownsCobalt ? 'Cobalt Aero Jogger' : null,
          !runnerEligibility.ownsVortex ? 'Vortex Blaze Sprint' : null,
        ].filter((runner): runner is string => runner !== null);
        membersMissingRunners.push(`${member?.referralCode || memberId} (missing ${missingRunners.join(' and ')})`);
      }
      assertCooldown(cooldowns[index], now);
      if (!memberships[index].exists || memberships[index].data()?.teamId !== teamId) {
        throw new MarathonError(409, 'The team roster changed. Refresh and try again.');
      }
      if (workoutInProgress(member)) affectedMembers.push(member?.referralCode || memberId);
      if (toCents(member?.balance) < (fundingShares[memberId] || 0)) {
        insufficientBalance.push(member?.referralCode || memberId);
      }
    }

    if (affectedMembers.length) {
      throw new MarathonError(409, `Still Running: ${affectedMembers.join(', ')}. Finish with End & Earn or remove the member before starting.`);
    }
    if (membersMissingRunners.length) {
      throw new MarathonError(
        409,
        `Every joined member must own both Cobalt Aero Jogger and Vortex Blaze Sprint to start: ${membersMissingRunners.join(', ')}.`,
      );
    }
    if (insufficientBalance.length) {
      throw new MarathonError(409, `Insufficient balance for the equal bounty contribution: ${insufficientBalance.join(', ')}.`);
    }

    for (let index = 0; index < team.memberIds.length; index += 1) {
      const memberId = team.memberIds[index];
      const member = getUserData(users[index])!;
      const nextBalance = toCents(member.balance) - (fundingShares[memberId] || 0);
      // Workout snapshot writes update the same user documents, so Firestore retries
      // this transaction if a member starts or pauses a workout before commit.
      transaction.update(getDb().collection('users').doc(memberId), { balance: fromCents(nextBalance) });
      const fundingId = `${teamId}_${memberId}_funding`;
      transaction.create(getDb().collection('wallet_transactions').doc(fundingId), {
        id: fundingId,
        userId: memberId,
        type: 'marathon_bounty_contribution',
        marathonId: teamId,
        amountCents: -(fundingShares[memberId] || 0),
        amount: -fromCents(fundingShares[memberId] || 0),
        createdAt: now,
      });
      pushNotification(transaction, memberId, 'marathon_started', team, 'Your Marathon has started. Your team has seven days to reach its target.', now);
    }

    for (const invitation of invitations) {
      if (invitation.exists && invitation.data()?.status === 'Pending') {
        transaction.update(invitation.ref, { status: 'Cancelled', respondedAt: now });
      }
    }
    transaction.update(teamRef(teamId), {
      status: 'Active',
      startedAt: now,
      deadlineAt: now + team.durationMs,
      participantIds: [...team.memberIds],
      totalMeters: 0,
      contributionsMeters: {},
      fundingSharesCents: fundingShares,
      payoutsCents: {},
      payoutStatus: 'pending',
      pendingInviteeIds: [],
      invitationIds: [],
    });
  });
  return { success: true };
}

export async function removeMarathonMember(userIdInput: string | undefined, teamId: string, memberId: string) {
  const userId = requireUserId(userIdInput);
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const [teamSnapshot, leaderMembership, targetMembership] = await Promise.all([
      transaction.get(teamRef(teamId)),
      transaction.get(memberRef(userId)),
      transaction.get(memberRef(memberId)),
    ]);
    const team = readTeam(teamSnapshot);
    assertLeader(team, userId);
    assertLobby(team);
    if (memberId === team.leaderId) throw new MarathonError(409, 'The leader cannot be removed.');
    if (!team.memberIds.includes(memberId) || targetMembership.data()?.teamId !== teamId) {
      throw new MarathonError(404, 'Active team member not found.');
    }
    if (!leaderMembership.exists || leaderMembership.data()?.teamId !== teamId) {
      throw new MarathonError(403, 'You are no longer the leader of this team.');
    }
    const history = { ...(team.memberHistory || {}) };
    if (history[memberId]) history[memberId] = { ...history[memberId], leftAt: now };
    transaction.update(teamRef(teamId), {
      memberIds: team.memberIds.filter((id) => id !== memberId),
      memberHistory: history,
    });
    transaction.delete(memberRef(memberId));
    pushNotification(transaction, memberId, 'marathon_member_removed', team, 'You were removed from the Marathon lobby.', now);
  });
  return { success: true };
}

export async function leaveMarathonTeam(userIdInput: string | undefined, teamId: string) {
  const userId = requireUserId(userIdInput);
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const [teamSnapshot, membership] = await Promise.all([
      transaction.get(teamRef(teamId)),
      transaction.get(memberRef(userId)),
    ]);
    const team = readTeam(teamSnapshot);
    if (!membership.exists || membership.data()?.teamId !== teamId) {
      throw new MarathonError(403, 'You are not a member of this team.');
    }
    if (team.leaderId === userId) throw new MarathonError(409, 'The leader must cancel this lobby; active leaders cannot leave.');
    if (team.status !== 'Lobby' && team.status !== 'Active') {
      throw new MarathonError(409, 'This Marathon has already ended.');
    }

    const history = { ...(team.memberHistory || {}) };
    if (history[userId]) history[userId] = { ...history[userId], leftAt: now };
    transaction.update(teamRef(teamId), { memberIds: team.memberIds.filter((id) => id !== userId), memberHistory: history });
    if (team.status === 'Lobby') transaction.delete(memberRef(userId));
    else transaction.update(memberRef(userId), { status: 'departed', leftAt: now });
    pushNotification(transaction, team.leaderId, 'marathon_member_left', team, 'A member left your Marathon team.', now);
  });
  return { success: true };
}

export async function cancelMarathonLobby(userIdInput: string | undefined, teamId: string) {
  const userId = requireUserId(userIdInput);
  const now = Date.now();
  await getDb().runTransaction(async (transaction) => {
    const teamSnapshot = await transaction.get(teamRef(teamId));
    const team = readTeam(teamSnapshot);
    assertLeader(team, userId);
    assertLobby(team);
    const [memberships, invitations] = await Promise.all([
      Promise.all(team.memberIds.map((id) => transaction.get(memberRef(id)))),
      Promise.all(team.invitationIds.map((id) => transaction.get(invitationRef(id)))),
    ]);
    for (let index = 0; index < team.memberIds.length; index += 1) {
      if (memberships[index].exists && memberships[index].data()?.teamId === teamId) {
        transaction.delete(memberRef(team.memberIds[index]));
      }
      pushNotification(transaction, team.memberIds[index], 'marathon_cancelled', team, 'The Marathon lobby was cancelled by its leader.', now);
    }
    for (const invitation of invitations) {
      if (!invitation.exists || invitation.data()?.status !== 'Pending') continue;
      const inviteeId = invitation.data()?.inviteeId as string;
      transaction.update(invitation.ref, { status: 'Cancelled', respondedAt: now });
      pushNotification(transaction, inviteeId, 'marathon_invite_cancelled', team, 'The Marathon lobby was cancelled.', now);
    }
    transaction.delete(teamRef(teamId));
  });
  return { success: true };
}

function validCompletedWorkout(snapshot: Record<string, unknown>, user: FirestoreUser, completedAt: number) {
  const points = snapshot.routePoints;
  const routeMeters = haversineDistanceMeters(points);
  const reportedMeters = Number(snapshot.distanceKm || 0) * 1000;
  const owned = Array.isArray(user.ownedRunners) ? user.ownedRunners : [];
  const runners = owned.flatMap((runner) => {
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
    (sum, runner) => sum + (MARATHON_RUNNER_LIMITS_KM[runner.runnerId || ''] || 0),
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
  const sensorPlausible = validTiming &&
    routeMeters === 0 &&
    reportedMeters <= limitKm * 1000 &&
    isPlausibleSensorWorkout(reportedMeters, Number(snapshot.stepCount || 0), observedSeconds);
  const rewardMeters = routePlausible
    ? Math.min(routeMeters, limitKm * 1000)
    : sensorPlausible
      ? reportedMeters
      : 0;
  return {
    meters: routePlausible ? Math.min(routeMeters, limitKm * 1000) : 0,
    eligible: routePlausible,
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
  const userId = requireUserId(userIdInput);
  const userRef = getDb().collection('users').doc(userId);
  let creditedMeters = 0;
  let creditedRewardCents = 0;
  let resultingBalance = 0;
  let workoutVerified = false;
  await getDb().runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    const user = getUserData(userSnapshot);
    if (!user) throw new MarathonError(404, 'Account not found.');
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
          return;
        }
      }
      throw new MarathonError(409, 'Complete End & Earn before finishing this workout.');
    }

    const startedAt = Number(snapshot.workoutStartTime || 0);
    if (!Number.isFinite(startedAt) || startedAt <= 0) throw new MarathonError(400, 'The workout start time is invalid.');
    if (expectedWorkoutStartTime && Math.trunc(expectedWorkoutStartTime) !== Math.trunc(startedAt)) {
      throw new MarathonError(409, 'The workout changed before its reward could be credited. Refresh and try again.');
    }
    const workoutId = `${userId}_${Math.trunc(startedAt)}`;
    const workoutRef = getDb().collection('completed_workouts').doc(workoutId);
    const rewardRef = getDb().collection('wallet_transactions').doc(`${workoutId}_reward`);
    const membershipSnapshot = await transaction.get(memberRef(userId));
    const workoutSnapshot = await transaction.get(workoutRef);
    const rewardSnapshot = await transaction.get(rewardRef);
    const now = Date.now();
    const verification = validCompletedWorkout(snapshot, user, now);
    workoutVerified = verification.rewardEligible;
    const rewardCents = verification.rewardEligible
      ? calculateWorkoutRewardCents(verification.rewardMeters, verification.selectedRunnerIds)
      : 0;
    const currentBalanceCents = toCents(user.balance);
    const shouldCreditReward = !workoutSnapshot.exists && !rewardSnapshot.exists && rewardCents > 0;
    creditedRewardCents = shouldCreditReward
      ? rewardCents
      : Number(rewardSnapshot.data()?.amountCents || 0);
    resultingBalance = fromCents(currentBalanceCents + (shouldCreditReward ? rewardCents : 0));
    const teamId = membershipSnapshot.data()?.teamId as string | undefined;
    const teamSnapshot = teamId ? await transaction.get(teamRef(teamId)) : null;
    const team = teamSnapshot?.exists ? teamSnapshot.data() as MarathonTeam : null;
    let nextTeam: MarathonTeam | null = null;

    if (!workoutSnapshot.exists && team?.status === 'Active' && team.memberIds.includes(userId)) {
      const isInWindow = verification.eligible &&
        verification.startedAt >= Number(team.startedAt || 0) &&
        verification.serverStartedAt >= Number(team.startedAt || 0) &&
        isBeforeMarathonDeadline(verification.completedAt, Number(team.deadlineAt || 0));
      if (isInWindow) {
        const contributions = { ...(team.contributionsMeters || {}) };
        contributions[userId] = Number(contributions[userId] || 0) + verification.meters;
        nextTeam = {
          ...team,
          totalMeters: Number(team.totalMeters || 0) + verification.meters,
          contributionsMeters: contributions,
        };
        creditedMeters = verification.meters;
      }
    }

    if (nextTeam && team) {
      if (nextTeam.totalMeters >= team.targetMeters && isBeforeMarathonDeadline(now, Number(team.deadlineAt || 0))) {
        await finalizeTeamInTransaction(transaction, nextTeam, 'Completed', now);
      } else {
        transaction.update(teamRef(team.id), {
          totalMeters: nextTeam.totalMeters,
          contributionsMeters: nextTeam.contributionsMeters,
        });
      }
    } else if (team?.status === 'Active' && now >= Number(team.deadlineAt || 0)) {
      await finalizeTeamInTransaction(transaction, team, 'Failed', Number(team.deadlineAt));
    }

    if (!workoutSnapshot.exists) {
      transaction.create(workoutRef, {
        id: workoutId,
        userId,
        startedAt,
        serverStartedAt: verification.serverStartedAt,
        completedAt: now,
        verified: verification.eligible,
        verifiedMeters: verification.meters,
        rewardVerified: verification.rewardEligible,
        rewardCents: creditedRewardCents,
        creditedMarathonId: creditedMeters > 0 ? teamId : null,
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
