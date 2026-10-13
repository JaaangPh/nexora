import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Flag,
  Footprints,
  Loader2,
  Search,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { User } from '../types/auth';
import { api, MarathonDashboard, MarathonProfile, MarathonTeamView } from '../services/api';

interface MarathonTabProps {
  user: User;
}

const PACKAGE_OPTIONS = [
  { id: '250' as const, target: 250, bounty: 1000 },
  { id: '500' as const, target: 500, bounty: 2500 },
];

const money = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function countdown(target: number, now: number): string {
  const seconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZoneName: 'short',
  });
}

function ProfileLine({ profile, subtitle }: { profile: MarathonProfile; subtitle?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {profile.profileImage
        ? <img src={profile.profileImage} alt="" className="h-10 w-10 rounded-full border border-white/15 object-cover" />
        : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#173469] text-cyan-300"><UserRound className="h-5 w-5" /></div>}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{profile.username}</p>
        <p className="truncate text-[11px] text-blue-200/70">{subtitle || profile.nexoraId || 'Marathon member'}</p>
      </div>
    </div>
  );
}

export const MarathonTab: React.FC<MarathonTabProps> = ({ user }) => {
  const [data, setData] = useState<MarathonDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [searchId, setSearchId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchProfile, setSearchProfile] = useState<MarathonProfile | null>(null);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      setData(await api.getMarathonDashboard());
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load Marathon data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(true);
    const interval = window.setInterval(() => {
      setNow(Date.now());
      void refresh();
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [user.id]);

  const currentTeam = data?.currentTeam || null;
  const isLeader = currentTeam?.leaderId === user.id;
  const currentMember = currentTeam?.members.find((member) => member.id === user.id);
  const cooldownRemaining = (data?.cooldownUntil || 0) - now;
  const currentRemaining = currentTeam?.deadlineAt ? currentTeam.deadlineAt - now : 0;
  const activeLobbyMembers = currentTeam?.status === 'Lobby'
    ? currentTeam.members.filter((member) => member.active)
    : [];
  const membersStillRunning = activeLobbyMembers.filter((member) => member.stillRunning);
  const membersMissingRunners = activeLobbyMembers.filter((member) => !member.ownsCobalt || !member.ownsVortex);
  const membersOnCooldown = activeLobbyMembers.filter((member) => (member.cooldownUntil || 0) > now);
  const teamLeader = currentTeam?.members.find((member) => member.id === currentTeam.leaderId);
  const lobbyHasValidSize = !!currentTeam && currentTeam.memberCount >= 5 && currentTeam.memberCount <= 10;
  const canStartFromSnapshot = !!currentTeam &&
    currentTeam.status === 'Lobby' &&
    lobbyHasValidSize &&
    !!currentTeam.packageId &&
    membersMissingRunners.length === 0 &&
    membersStillRunning.length === 0 &&
    membersOnCooldown.length === 0 &&
    cooldownRemaining <= 0;
  const startChecklist = [
    { label: 'Team has 5–10 accepted members', satisfied: lobbyHasValidSize },
    { label: 'One bounty package is selected', satisfied: !!currentTeam?.packageId },
    { label: 'Every joined member owns both required runners', satisfied: membersMissingRunners.length === 0 },
    { label: 'No member is active, paused, or awaiting End & Earn', satisfied: membersStillRunning.length === 0 },
    { label: 'No member is on Marathon cooldown', satisfied: membersOnCooldown.length === 0 && cooldownRemaining <= 0 },
  ];
  const recentHistory = [...(data?.history || [])].sort(
    (left, right) => (right.endedAt || right.startedAt || right.createdAt) - (left.endedAt || left.startedAt || left.createdAt),
  );
  const teamsCreated = recentHistory.filter((team) => team.leaderId === user.id);
  const teamsParticipated = recentHistory.filter((team) => team.leaderId !== user.id);
  const canAccept = (invite: MarathonDashboard['invitations'][number]) =>
    invite.eligibility.eligible && !invite.stillRunning && !invite.alreadyInTeam && invite.cooldownUntil <= now;

  const runAction = async (action: () => Promise<unknown>, refreshAfter = true) => {
    setBusy(true);
    setError('');
    try {
      await action();
      if (refreshAfter) await refresh();
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The Marathon action could not be completed.');
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createTeam = () => runAction(async () => {
    if (!teamName.trim()) throw new Error('Enter a team name.');
    await api.createMarathonTeam(teamName);
    setTeamName('');
  });

  const searchForUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentTeam) return;
    setSearching(true);
    setSearchProfile(null);
    setError('');
    try {
      const result = await api.searchMarathonUser(currentTeam.id, searchId);
      setSearchProfile(result.profile);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not search for that Nexora ID.');
    } finally {
      setSearching(false);
    }
  };

  const selectedPackage = PACKAGE_OPTIONS.find((option) => option.id === currentTeam?.packageId);
  const completionDate = currentTeam?.deadlineAt ? new Date(currentTeam.deadlineAt).toLocaleString() : '';

  if (loading && !data) {
    return <div className="flex min-h-56 items-center justify-center gap-3 text-sm font-semibold text-blue-100"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" />Loading Marathon…</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="relative overflow-hidden rounded-2xl border border-[#2459C4]/40 bg-gradient-to-br from-[#102554] via-[#17376E] to-[#0E204A] p-5 shadow-xl">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300"><Trophy className="h-6 w-6" /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Nexora team challenge</p>
            <h2 className="mt-1 text-xl font-black text-white">Marathon</h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-blue-100/75">Build a team, contribute verified workout distance, and share the bounty when the collective target is reached within seven days.</p>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-[10px] font-bold">
          <span className={`rounded-full border px-2.5 py-1 ${data?.eligibility.eligible ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}`}>
            {data?.eligibility.eligible ? 'Runner eligible' : 'Requires Cobalt Aero Jogger or Vortex Blaze Sprint'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-blue-100">5–10 members</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-blue-100">7 days</span>
        </div>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300/30 bg-red-950/40 p-3 text-xs font-semibold text-red-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {cooldownRemaining > 0 && (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs text-amber-100">
          <p className="font-extrabold">Marathon cooldown</p>
          <p className="mt-1">You can participate again in {countdown(data!.cooldownUntil, now)} · expires {formatTimestamp(data!.cooldownUntil)}.</p>
        </div>
      )}

      <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
          <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-cyan-300" /><h3 className="text-sm font-extrabold text-white">Create a team</h3></div>
          <p className="mb-3 text-xs leading-relaxed text-blue-100/70">You become the leader and first member. You can invite up to nine more players. The team needs five accepted members before it can start.</p>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void createTeam(); }}>
            <input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={40} placeholder="Your team name" disabled={busy || !!currentTeam || !data?.eligibility.eligible || cooldownRemaining > 0} className="min-w-0 flex-1 rounded-xl border border-[#27477F] bg-[#081735] px-3 py-2.5 text-sm text-white placeholder:text-blue-200/40 focus:border-cyan-400 focus:outline-none disabled:opacity-50" />
            <button type="submit" disabled={busy || !!currentTeam || !data?.eligibility.eligible || cooldownRemaining > 0} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-black text-[#07132B] disabled:opacity-40">{busy ? 'Creating…' : 'Create team'}</button>
          </form>
          {currentTeam && <div role="status" className="mt-3 rounded-lg bg-amber-300/10 p-2 text-[11px] leading-relaxed text-amber-100">You are already a member of another marathon team. Leave your current team before joining a different team.<button type="button" onClick={() => document.getElementById('current-marathon-team')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="ml-1 font-bold text-cyan-200 underline">View Current Team</button></div>}
          {!data?.eligibility.eligible && <p className="mt-2 text-[11px] text-amber-200">Own at least one qualifying runner to participate.</p>}
      </section>

      {!!data?.invitations.length && (
        <section className="space-y-3">
          <h3 className="text-sm font-extrabold text-white">Marathon invitations <span className="ml-1 text-cyan-300">({data.invitations.length})</span></h3>
          {data.invitations.map((invite) => {
            const disabledReason = invite.stillRunning
              ? 'Finish your current workout using End & Earn before responding to this invitation.'
              : invite.alreadyInTeam
                ? 'You are already a member of another marathon team. Leave your current team before joining a different team.'
                : invite.cooldownUntil > now
                  ? `Cooldown until ${formatTimestamp(invite.cooldownUntil)}.`
                    : !invite.eligibility.eligible
                      ? 'Own at least one Cobalt Aero Jogger or Vortex Blaze Sprint before accepting.'
                    : '';
            return (
                <article key={invite.id} className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
                  <div className="flex flex-col gap-3">
                    <div><p className="font-extrabold text-white">{invite.teamName}</p><p className="mt-1 text-xs text-blue-100/70">{invite.team.targetKm} KM · {money(invite.bounty)} total pool · {invite.team.memberCount}/10 joined</p><p className="mt-1 text-[10px] text-blue-100/60">Cobalt Aero Jogger: {invite.eligibility.ownsCobalt ? 'owned' : 'missing'} · Vortex Blaze Sprint: {invite.eligibility.ownsVortex ? 'owned' : 'missing'}</p></div>
                    {invite.leader && <ProfileLine profile={invite.leader} subtitle={`Leader · ${invite.leader.nexoraId || ''}`} />}
                  </div>
                {disabledReason && <p role="status" className="mt-3 rounded-lg bg-amber-300/10 p-2 text-[11px] leading-relaxed text-amber-100">{disabledReason}</p>}
                {invite.alreadyInTeam && currentTeam && <button type="button" onClick={() => document.getElementById('current-marathon-team')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-2 text-[11px] font-bold text-cyan-200 underline">View Current Team</button>}
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy || !canAccept(invite)} onClick={() => void runAction(() => api.respondToMarathonInvitation(invite.id, 'accept'))} className="flex-1 rounded-xl bg-cyan-300 px-3 py-2.5 text-xs font-black text-[#07132B] disabled:opacity-40">Accept</button>
                  <button type="button" disabled={busy || invite.stillRunning} onClick={() => void runAction(() => api.respondToMarathonInvitation(invite.id, 'decline'))} className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">Decline</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {currentTeam && (
        <section id="current-marathon-team" className="space-y-4">
          <div className="rounded-2xl border border-[#2459C4]/50 bg-gradient-to-br from-[#102554] to-[#0D204A] p-4 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{currentTeam.status} Marathon</p>
                <h3 className="mt-1 break-words text-lg font-black text-white">{currentTeam.name}</h3>
                <p className="mt-1 text-xs text-blue-100/70">{currentTeam.memberCount}/10 joined · {currentTeam.pendingInvitationCount} pending invitation{currentTeam.pendingInvitationCount === 1 ? '' : 's'} · {currentTeam.membersStillNeeded} more needed to start</p>
              </div>
              <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${currentTeam.status === 'Active' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-200'}`}>{currentTeam.status === 'Active' ? 'ACTIVE' : currentTeam.status.toUpperCase()} · {isLeader ? 'LEADER' : 'MEMBER'}</span>
            </div>
            {teamLeader && <div className="mt-3 rounded-xl border border-white/10 bg-[#081735]/50 p-3"><ProfileLine profile={teamLeader} subtitle={`Original leader · ${teamLeader.nexoraId || ''}`} /></div>}

            {currentTeam.status === 'Active' && (
              <div className="mt-4 rounded-xl border border-cyan-300/20 bg-[#081735]/70 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white">Team progress · leaderboard</span>
                  <span className="font-mono font-extrabold text-cyan-200">{currentTeam.totalKm.toFixed(2)} / {currentTeam.targetKm} KM</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-300 transition-all" style={{ width: `${currentTeam.progressPercentage}%` }} /></div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-blue-100/70"><span>Achievement {currentTeam.progressPercentage.toFixed(1)}% · {currentTeam.remainingKm.toFixed(2)} KM remaining</span><span>{currentRemaining > 0 ? countdown(currentTeam.deadlineAt || now, now) : 'Deadline passed'}</span></div>
                <p className="mt-2 text-[10px] text-blue-100/55">Bounty pool {money(currentTeam.bounty)} · Ends {completionDate}. Only workouts finalized through End & Earn and credited by the server count.</p>
              </div>
            )}

            {currentTeam.status === 'Completed' && (
              <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs text-emerald-100">
                <p className="font-extrabold">Target completed · {currentTeam.totalKm.toFixed(2)} / {currentTeam.targetKm} KM</p>
                <p className="mt-1">Bounty pool {money(currentTeam.bounty)} · payout status {currentTeam.payoutStatus || 'finalized'} · completed {currentTeam.endedAt ? formatTimestamp(currentTeam.endedAt) : 'time unavailable'}</p>
                {Object.entries(currentTeam.payouts || {}).map(([id, amount]) => {
                  const transaction = currentTeam.payoutTransactionIds?.find((item) => item.userId === id);
                  return <p key={id} className="mt-1">{currentTeam.members.find((member) => member.id === id)?.username || id}: {money(amount)}{transaction && <span className="block break-all text-[9px] text-emerald-100/50">Wallet transaction {transaction.transactionId}</span>}</p>;
                })}
              </div>
            )}
            {currentTeam.status === 'Failed' && <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100"><p className="font-extrabold">Marathon failed · no bounty awarded</p><p className="mt-1">Final distance {currentTeam.totalKm.toFixed(2)} / {currentTeam.targetKm} KM · {currentTeam.remainingKm.toFixed(2)} KM short.</p><p className="mt-1">Expired {currentTeam.endedAt ? formatTimestamp(currentTeam.endedAt) : 'time unavailable'} · bounty pool {money(currentTeam.bounty)} · payout status {currentTeam.payoutStatus || 'finalized'}.</p><p className="mt-1">All original member contributions were refunded; no reward transactions were created.</p>{cooldownRemaining > 0 && <p className="mt-1 font-bold">Cooldown remaining {countdown(data?.cooldownUntil || now, now)} · expires {formatTimestamp(data?.cooldownUntil || now)}.</p>}</div>}
            {currentTeam.status === 'Cancelled' && <p className="mt-3 text-xs text-blue-100/60">This lobby was cancelled. Its history is read-only.</p>}
            {currentMember?.leftAt && currentTeam.status === 'Active' && <p className="mt-3 rounded-lg bg-amber-300/10 p-2 text-[11px] text-amber-100">You left the active roster. Your earlier verified KM remain; you cannot rejoin, and cooldown begins when the marathon ends.</p>}

            {isLeader && currentTeam.status === 'Lobby' && (
              <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void runAction(() => api.updateMarathonTeam(currentTeam.id, { name: renameValue || currentTeam.name })).then((succeeded) => { if (succeeded) setRenameValue(''); }); }}>
                  <input aria-label="Team name" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} placeholder={currentTeam.name} maxLength={40} disabled={busy} className="min-w-0 flex-1 rounded-lg border border-[#27477F] bg-[#081735] px-3 py-2 text-xs text-white placeholder:text-blue-100/40 focus:border-cyan-400 focus:outline-none" />
                  <button type="submit" disabled={busy || !renameValue.trim()} className="rounded-lg border border-white/15 px-3 text-[11px] font-bold text-white disabled:opacity-40">Rename</button>
                </form>
                <div>
                  <p className="mb-2 text-[11px] font-extrabold text-white">Choose bounty package</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PACKAGE_OPTIONS.map((option) => (
                      <button key={option.id} type="button" aria-pressed={currentTeam.packageId === option.id} disabled={busy} onClick={() => void runAction(() => api.updateMarathonTeam(currentTeam.id, { packageId: option.id }))} className={`rounded-xl border p-3 text-left transition-colors ${currentTeam.packageId === option.id ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-[#081735]/60'}`}>
                        <span className="flex items-center justify-between gap-2 text-sm font-black text-white">{option.target} KM{currentTeam.packageId === option.id && <span className="text-[9px] uppercase tracking-wider text-cyan-200">Selected</span>}</span>
                        <span className="mt-1 block text-xs font-bold text-cyan-200">{money(option.bounty)} total pool</span>
                        <span className="mt-1 block text-[10px] text-blue-100/55">7 days · 5–10 accepted members</span>
                        <span className="mt-2 block text-[10px] leading-relaxed text-blue-100/70">Awarded only if the team reaches its collective target within seven days.</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-blue-100/60">At start, the selected pool is debited from joined members’ database balances in equal cent-level shares. If the target is missed, no bounty is awarded and original contributions are refunded.</p>
                </div>
              </div>
            )}
          </div>

          {isLeader && currentTeam.status === 'Lobby' && (
            <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><Search className="h-4 w-4 text-cyan-300" />Invite by Nexora ID</h4>
              {cooldownRemaining > 0 && <p role="status" className="mb-3 rounded-lg bg-amber-300/10 p-2 text-[11px] text-amber-100">You cannot invite players during cooldown. Expires {formatTimestamp(data!.cooldownUntil)}.</p>}
              <form onSubmit={searchForUser} className="flex gap-2">
                <input aria-label="Nexora ID" value={searchId} onChange={(event) => { setSearchId(event.target.value); setSearchProfile(null); }} placeholder="NT123456" maxLength={8} disabled={busy || cooldownRemaining > 0 || currentTeam.memberCount + currentTeam.pendingInvitationCount >= 10} className="min-w-0 flex-1 rounded-xl border border-[#27477F] bg-[#081735] px-3 py-2.5 text-sm uppercase text-white placeholder:text-blue-100/35 focus:border-cyan-400 focus:outline-none disabled:opacity-50" />
                <button type="submit" disabled={searching || busy || cooldownRemaining > 0 || !searchId.trim() || currentTeam.memberCount + currentTeam.pendingInvitationCount >= 10} className="rounded-xl bg-[#2459C4] px-4 text-xs font-black text-white disabled:opacity-40">{searching ? 'Searching…' : 'Search'}</button>
              </form>
              {searchProfile && (
                <div className="mt-3 rounded-xl border border-white/10 bg-[#081735]/70 p-3">
                  <div className="flex items-center justify-between gap-2"><ProfileLine profile={searchProfile} subtitle={searchProfile.nexoraId} /><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${searchProfile.status === 'Eligible' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{searchProfile.status}</span></div>
                  <p className="mt-3 text-[10px] text-blue-100/70">Cobalt Aero Jogger: {searchProfile.ownsCobalt ? 'owned' : 'not owned'} · Vortex Blaze Sprint: {searchProfile.ownsVortex ? 'owned' : 'not owned'}</p>
                  {searchProfile.cooldownUntil && searchProfile.cooldownUntil > now && <p className="mt-2 text-[10px] text-amber-200">Cooldown expires {formatTimestamp(searchProfile.cooldownUntil)}.</p>}
                    <button type="button" disabled={busy || cooldownRemaining > 0 || !searchProfile.canInvite || !currentTeam.packageId || currentTeam.memberCount + currentTeam.pendingInvitationCount >= 10} onClick={() => void runAction(() => api.inviteMarathonUser(currentTeam.id, searchProfile.id)).then((succeeded) => { if (succeeded) setSearchProfile(null); })} className="mt-3 w-full rounded-lg bg-cyan-300 px-3 py-2 text-xs font-black text-[#07132B] disabled:opacity-40">{cooldownRemaining > 0 ? 'Invitation unavailable during cooldown' : currentTeam.packageId ? 'Invite' : 'Select a package before inviting'}</button>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><Users className="h-4 w-4 text-cyan-300" />Roster <span className="text-cyan-300">{currentTeam.memberCount}/10</span></h4>
            <div className="space-y-2.5">
              {[...currentTeam.members]
                .sort((left, right) => (right.verifiedKm || 0) - (left.verifiedKm || 0))
                .map((member, index) => (
                <article key={member.id} className="rounded-xl border border-white/8 bg-[#081735]/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="w-5 shrink-0 text-[10px] font-black text-cyan-300">#{index + 1}</span><ProfileLine profile={member} subtitle={`${member.role === 'leader' ? 'Leader' : 'Member'} · ${member.nexoraId || ''}`} /></div>
                    <span className="shrink-0 text-right text-[11px] font-mono font-bold text-cyan-200">{member.verifiedKm?.toFixed(2) || '0.00'} KM</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                    <span className={`rounded-full px-2 py-1 ${member.ownsCobalt ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>Cobalt {member.ownsCobalt ? '✓' : '—'}</span>
                    <span className={`rounded-full px-2 py-1 ${member.ownsVortex ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>Vortex {member.ownsVortex ? '✓' : '—'}</span>
                    {member.stillRunning && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-100">Still Running</span>}
                    {member.active && <span className="rounded-full bg-cyan-300/10 px-2 py-1 text-cyan-100">{currentTeam.status === 'Active' ? 'Active participant' : 'Joined'}</span>}
                    {(member.cooldownUntil || 0) > now && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-100">Cooldown · {countdown(member.cooldownUntil || now, now)}</span>}
                    {!member.active && <span className="rounded-full bg-white/10 px-2 py-1 text-blue-100/70">{member.membershipStatus === 'departed' ? 'Departed' : 'Historical member'}</span>}
                  </div>
                  {isLeader && currentTeam.status === 'Lobby' && member.id !== user.id && (
                    <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.username} from this lobby?`)) void runAction(() => api.removeMarathonMember(currentTeam.id, member.id)); }} className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-red-200 disabled:opacity-50"><XCircle className="h-3 w-3" />Remove member</button>
                  )}
                </article>
              ))}
            </div>
          </section>

          {isLeader && currentTeam.invitations.length > 0 && (
            <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
              <h4 className="mb-3 text-sm font-extrabold text-white">Invitation status</h4>
              <div className="space-y-2">
                {currentTeam.invitations.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#081735]/70 p-3">
                    <div className="min-w-0">
                      {invite.invitee && <ProfileLine profile={invite.invitee} subtitle={invite.invitee.nexoraId} />}
                      <p className="mt-1 text-[9px] text-blue-100/45">{new Date(invite.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`text-[9px] font-black uppercase ${invite.status === 'Pending' ? 'text-amber-200' : invite.status === 'Accepted' ? 'text-emerald-200' : 'text-blue-100/50'}`}>{invite.status}</span>
                      {invite.status === 'Pending' && <button type="button" disabled={busy} onClick={() => void runAction(() => api.cancelMarathonInvitation(currentTeam.id, invite.id))} className="text-[9px] font-bold text-red-200 disabled:opacity-50">Cancel</button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {currentTeam.status === 'Lobby' && (
            <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
              <h4 className="mb-3 text-sm font-extrabold text-white">Start eligibility checklist</h4>
              <ul className="space-y-2">
                {startChecklist.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-[11px]">
                    {item.satisfied ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" /> : <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-200" />}
                    <span className={item.satisfied ? 'text-emerald-100/80' : 'text-amber-100'}>{item.label}</span>
                  </li>
                ))}
              </ul>
              {membersStillRunning.length > 0 && <p className="mt-3 rounded-lg bg-amber-300/10 p-2 text-[10px] leading-relaxed text-amber-100">Still Running: {membersStillRunning.map((member) => member.nexoraId || member.username).join(', ')}. Complete End & Earn, or remove them from the Lobby and invite eligible replacements.</p>}
              {membersMissingRunners.length > 0 && <p className="mt-2 rounded-lg bg-amber-300/10 p-2 text-[10px] leading-relaxed text-amber-100">Both Cobalt Aero Jogger and Vortex Blaze Sprint are required to start. Missing eligibility: {membersMissingRunners.map((member) => member.nexoraId || member.username).join(', ')}.</p>}
              {membersOnCooldown.length > 0 && <p className="mt-2 rounded-lg bg-amber-300/10 p-2 text-[10px] leading-relaxed text-amber-100">Cooldown: {membersOnCooldown.map((member) => `${member.nexoraId || member.username} until ${formatTimestamp(member.cooldownUntil || now)}`).join('; ')}.</p>}
            </section>
          )}

          {currentTeam.status === 'Lobby' && isLeader && (
            <div className="space-y-2">
              <button type="button" disabled={busy || !canStartFromSnapshot} onClick={() => setShowStartConfirm(true)} className="w-full rounded-xl bg-gradient-to-r from-[#2459C4] to-cyan-500 px-4 py-3.5 text-sm font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40">Start Marathon</button>
              <p className="text-center text-[10px] leading-relaxed text-blue-100/55">Start requires 5–10 joined members, both required runners per member, no active or paused workouts, and enough balance for each equal share.</p>
            </div>
          )}

          {currentTeam.status === 'Lobby' && !isLeader && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm('Leave this Marathon lobby? You can join another team immediately; no cooldown applies before a marathon starts.')) void runAction(() => api.leaveMarathonTeam(currentTeam.id)); }} className="w-full rounded-xl border border-white/15 px-4 py-3 text-xs font-bold text-white disabled:opacity-50">Leave lobby</button>
          )}
          {currentTeam.status === 'Active' && !isLeader && currentMember?.active && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm('Leave the active roster? Your verified KM will remain, you cannot rejoin, and your three-day cooldown begins when the marathon ends.')) void runAction(() => api.leaveMarathonTeam(currentTeam.id)); }} className="w-full rounded-xl border border-amber-300/25 bg-amber-300/5 px-4 py-3 text-xs font-bold text-amber-100 disabled:opacity-50">Leave active team</button>
          )}
          {currentTeam.status === 'Lobby' && isLeader && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm('Cancel this lobby? Members and invitees will be notified and no cooldown will apply.')) void runAction(() => api.cancelMarathonLobby(currentTeam.id)); }} className="w-full rounded-xl border border-red-300/20 px-4 py-2.5 text-[11px] font-bold text-red-200 disabled:opacity-50">Cancel lobby</button>
          )}
        </section>
      )}

      {!currentTeam && !data?.invitations.length && (
        <div className="rounded-2xl border border-dashed border-[#27477F] p-5 text-center">
          <Footprints className="mx-auto h-7 w-7 text-cyan-300/70" />
          <p className="mt-2 text-sm font-bold text-white">No active team or invitations</p>
          <p className="mt-1 text-xs text-blue-100/55">Create a team or wait for a teammate to invite you.</p>
        </div>
      )}

      {!!data?.notifications.length && (
        <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-white"><ShieldCheck className="h-4 w-4 text-cyan-300" />Marathon updates</h3>
          <div className="space-y-2">{data.notifications.slice(0, 5).map((item) => <p key={item.id} className="flex gap-2 rounded-lg bg-[#081735]/70 p-2.5 text-[11px] text-blue-100/80"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />{item.message}<span className="ml-auto shrink-0 text-[9px] text-blue-100/40">{new Date(item.createdAt).toLocaleDateString()}</span></p>)}</div>
        </section>
      )}

      {!!recentHistory.length && (
        <section className="space-y-4">
          <h3 className="text-sm font-extrabold text-white">Marathon history</h3>
          {[
            { title: 'Teams created', teams: teamsCreated },
            { title: 'Teams participated in', teams: teamsParticipated },
          ].map(({ title, teams }) => teams.length > 0 && (
            <div key={title} className="space-y-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-blue-100/60">{title}</h4>
              {teams.map((team: MarathonTeamView) => {
                const originalLeader = team.members.find((member) => member.id === team.leaderId);
                return (
                  <article key={team.id} className="rounded-xl border border-[#1E3A78] bg-[#0D204A] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-extrabold text-white">{team.name}</p>
                      <span className="shrink-0 text-[9px] font-black uppercase text-blue-200/60">Archived · {team.status}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-blue-100/70">{team.totalKm.toFixed(2)} / {team.targetKm} KM · {money(team.bounty)} total pool · payout {team.payoutStatus || 'not applicable'}</p>
                    {team.status === 'Completed' && <p className="mt-1 text-[10px] font-bold text-emerald-200">Target achieved · completed {team.endedAt ? formatTimestamp(team.endedAt) : 'time unavailable'}</p>}
                    {team.status === 'Failed' && <p className="mt-1 text-[10px] text-amber-100">Failed · no bounty awarded · {team.remainingKm.toFixed(2)} KM short · expired {team.endedAt ? formatTimestamp(team.endedAt) : 'time unavailable'}</p>}
                    <p className="mt-1 text-[10px] text-blue-100/50">Original leader: {originalLeader?.username || team.leaderId} · Created {formatTimestamp(team.createdAt)}</p>
                    {team.startedAt && <p className="mt-1 text-[10px] text-blue-100/50">Started {formatTimestamp(team.startedAt)}</p>}
                    {team.endedAt && <p className="mt-1 text-[10px] text-blue-100/50">Ended {formatTimestamp(team.endedAt)}</p>}
                    <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                      {team.members.map((member) => (
                        <div key={member.id} className="flex justify-between gap-3 text-[10px] text-blue-100/65">
                          <span className="truncate">{member.username}{member.leftAt ? ' · departed' : ''}{member.id === user.id && (member.cooldownUntil || 0) > now ? ` · cooldown until ${formatTimestamp(member.cooldownUntil || now)}` : ''}</span>
                          <span className="shrink-0 font-mono">{member.verifiedKm?.toFixed(2) || '0.00'} KM</span>
                        </div>
                      ))}
                    </div>
                    {team.status === 'Completed' && Object.entries(team.payouts || {}).length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[10px] text-emerald-100/75">
                        <p className="font-bold">Final reward distribution · {money(team.bounty)} pool</p>
                        {Object.entries(team.payouts || {}).map(([id, amount]) => {
                          const transaction = team.payoutTransactionIds?.find((item) => item.userId === id);
                          return <p key={id}>{team.members.find((member) => member.id === id)?.username || id}: {money(amount)}{transaction && <span className="block break-all text-[9px] text-emerald-100/45">Wallet transaction {transaction.transactionId}</span>}</p>;
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {showStartConfirm && currentTeam && selectedPackage && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="marathon-start-title" className="w-full max-w-sm rounded-2xl border border-[#2459C4]/50 bg-[#091738] p-5 text-white shadow-2xl">
            <div className="mb-3 flex items-center gap-2"><Flag className="h-5 w-5 text-cyan-300" /><h3 id="marathon-start-title" className="text-base font-black">Confirm Marathon start</h3></div>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Team</dt><dd className="text-right font-bold">{currentTeam.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Joined members</dt><dd className="font-bold">{currentTeam.memberCount}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Target</dt><dd className="font-bold">{selectedPackage.target} KM</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Total bounty pool</dt><dd className="font-bold">{money(selectedPackage.bounty)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Duration</dt><dd className="font-bold">7 days</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Runner eligibility</dt><dd className="text-right font-bold">Every member needs Cobalt and Vortex</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Expected start</dt><dd className="text-right font-bold">{new Date(now).toLocaleString()}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-blue-100/60">Expected end</dt><dd className="text-right font-bold">{new Date(now + 7 * 86400000).toLocaleString()}</dd></div>
            </dl>
            {membersMissingRunners.length > 0 && <p role="alert" className="mt-3 rounded-xl bg-amber-300/10 p-3 text-[10px] leading-relaxed text-amber-100">Start blocked: every joined member must own both runners. Missing a required runner: {membersMissingRunners.map((member) => member.nexoraId || member.username).join(', ')}. Remove affected members from the Lobby or help them become eligible.</p>}
            {membersStillRunning.length > 0 && <p role="alert" className="mt-3 rounded-xl bg-amber-300/10 p-3 text-[10px] leading-relaxed text-amber-100">Start blocked: Still Running — {membersStillRunning.map((member) => member.nexoraId || member.username).join(', ')}. They must finish with End & Earn or be removed from the Lobby and replaced.</p>}
            {membersOnCooldown.length > 0 && <p role="alert" className="mt-3 rounded-xl bg-amber-300/10 p-3 text-[10px] leading-relaxed text-amber-100">Start blocked by cooldown: {membersOnCooldown.map((member) => `${member.nexoraId || member.username} until ${formatTimestamp(member.cooldownUntil || now)}`).join('; ')}.</p>}
            {cooldownRemaining > 0 && <p role="alert" className="mt-3 rounded-xl bg-amber-300/10 p-3 text-[10px] leading-relaxed text-amber-100">You cannot start or invite during your cooldown. Expires {formatTimestamp(data!.cooldownUntil)}.</p>}
            <p className="mt-4 rounded-xl bg-amber-300/10 p-3 text-[10px] leading-relaxed text-amber-100">Each joined member’s equal share is debited from their database balance when the server starts the race. If the target is reached, the entire bounty pool is divided equally among members still on the active roster at completion. If the target is missed, each original contribution is refunded and no bounty is paid.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => setShowStartConfirm(false)} className="flex-1 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-bold">Cancel</button>
              <button type="button" disabled={busy || !canStartFromSnapshot} onClick={() => void runAction(() => api.startMarathon(currentTeam.id)).then((succeeded) => { if (succeeded) setShowStartConfirm(false); })} className="flex-1 rounded-xl bg-cyan-300 px-3 py-2.5 text-xs font-black text-[#07132B] disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm & start'}</button>
            </div>
          </section>
        </div>
      )}
      <div className="flex items-center justify-center gap-1 pb-1 text-[9px] text-blue-100/35"><Clock3 className="h-3 w-3" />Progress refreshes every 10 seconds · server deadline is authoritative <XCircle className="hidden" /></div>
    </div>
  );
};

export default MarathonTab;
