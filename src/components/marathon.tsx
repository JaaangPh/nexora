import React, { useState } from 'react';
import { AlertTriangle, Flag, Footprints, Trophy, Users } from 'lucide-react';
import { User } from '../types/auth';

interface MarathonTabProps {
  user: User;
}

const previewMembers = [
  { name: 'Runner One', distance: '18.42 KM', color: 'bg-cyan-300' },
  { name: 'Runner Two', distance: '14.08 KM', color: 'bg-blue-300' },
  { name: 'Runner Three', distance: '11.36 KM', color: 'bg-violet-300' },
];

export const MarathonTab: React.FC<MarathonTabProps> = ({ user }) => {
  const [showDevelopmentNotice, setShowDevelopmentNotice] = useState(true);

  return (
  <>
    {showDevelopmentNotice && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="presentation">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="marathon-development-title"
          aria-describedby="marathon-development-description"
          className="w-full max-w-sm rounded-2xl border border-amber-300/30 bg-[#091738] p-5 text-white shadow-2xl"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/10 text-amber-200">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 id="marathon-development-title" className="mt-3 text-center text-lg font-black">
            Marathon under development
          </h2>
          <p id="marathon-development-description" className="mt-2 text-center text-sm leading-relaxed text-blue-100/75">
            Marathon is under development and it will be available soon.
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => setShowDevelopmentNotice(false)}
            className="mt-5 w-full rounded-xl bg-cyan-300 px-4 py-3 text-xs font-black text-[#07132B] transition-colors hover:bg-cyan-200"
          >
            Got it
          </button>
        </section>
      </div>
    )}
    <div className="space-y-5 animate-fade-in">
    <header className="relative overflow-hidden rounded-2xl border border-[#2459C4]/40 bg-gradient-to-br from-[#102554] via-[#17376E] to-[#0E204A] p-5 shadow-xl">
      <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <div className="rounded-xl bg-cyan-300/10 p-2.5 text-cyan-300">
          <Trophy className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Stepora team challenge</p>
          <h2 className="mt-1 text-xl font-black text-white">Marathon</h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-blue-100/75">
            Build a team, contribute workout distance, and reach a shared goal together.
          </p>
        </div>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2 text-[10px] font-bold">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-blue-100">5–10 members</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-blue-100">7 days</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-blue-100">Team challenge preview</span>
      </div>
    </header>

    <aside role="status" className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs leading-relaxed text-amber-100">
      Marathon is currently a design preview. Teams, invitations, progress, and payouts are not active or connected to the server.
    </aside>

    <section className="rounded-2xl border border-[#1E3A78] bg-[#0D204A] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-cyan-300" />
        <h3 className="text-sm font-extrabold text-white">Create a team</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-blue-100/70">
        Bring your community together for a shared movement challenge.
      </p>
      <div className="flex gap-2">
        <input
          aria-label="Team name preview"
          value={`${user.username || 'Your'}'s team`}
          readOnly
          className="min-w-0 flex-1 rounded-xl border border-[#27477F] bg-[#081735] px-3 py-2.5 text-sm text-white"
        />
        <button
          type="button"
          disabled
          className="rounded-xl bg-cyan-300 px-4 py-2.5 text-xs font-black text-[#07132B] opacity-50"
        >
          Create team
        </button>
      </div>
      <p className="mt-2 text-[10px] text-blue-100/50">Actions are disabled in this design preview.</p>
    </section>

    <section className="rounded-2xl border border-[#2459C4]/40 bg-gradient-to-br from-[#102554] to-[#0D204A] p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Active challenge preview</p>
          <h3 className="mt-1 text-lg font-black text-white">Stepora Striders</h3>
          <p className="mt-1 text-xs text-blue-100/70">5 members · 7 days remaining</p>
        </div>
        <span className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">
          DESIGN ONLY
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-cyan-300/20 bg-[#081735]/70 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white">Team progress</span>
          <span className="font-mono font-extrabold text-cyan-200">43.86 / 250 KM</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[18%] rounded-full bg-gradient-to-r from-cyan-400 to-blue-400" />
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {previewMembers.map((member, index) => (
          <div key={member.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${member.color} text-xs font-black text-[#07132B}`}>
                {index + 1}
              </span>
              <div>
                <p className="text-xs font-bold text-white">{member.name}</p>
                <p className="text-[10px] text-blue-100/55">Challenge participant preview</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-200">
              <Footprints className="h-3 w-3" /> {member.distance}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[10px] font-bold text-blue-100/60">
        <Flag className="h-3.5 w-3.5" /> Sample interface only · no real team or payout data
      </div>
    </section>
    </div>
  </>
  );
};

export default MarathonTab;
