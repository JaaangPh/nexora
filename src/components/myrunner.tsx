import React, { useState } from 'react';
import { CheckCircle2, Footprints, Hourglass, ShoppingBag } from 'lucide-react';
import { User } from '../types/auth';
import { api } from '../services/api';
import { getOwnedRunnerInstances } from '../services/runnerInventory';
import { RUNNER_CATALOG } from './market';

interface MyRunnerTabProps {
  user: User;
  onUpdateUser?: (user: User) => void;
  onNavigateTab: (tab: 'market' | 'track') => void;
}

function getCooldownText(until: number): string {
  const remainingMs = until - Date.now();
  if (remainingMs <= 0) return '';
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.ceil((remainingMs % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export const MyRunnerTab: React.FC<MyRunnerTabProps> = ({ user, onUpdateUser, onNavigateTab }) => {
  const [updatingRunnerId, setUpdatingRunnerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const ownedRunners = getOwnedRunnerInstances(user.ownedRunners).flatMap((instance) => {
    const catalogRunner = RUNNER_CATALOG.find((runner) => runner.id === instance.runnerId);
    return catalogRunner ? [{ ...catalogRunner, ...instance }] : [];
  });

  const equipRunner = async (runnerId: string) => {
    setUpdatingRunnerId(runnerId);
    setErrorMessage('');
    try {
      const result = await api.updateRunners({ equippedRunnerId: runnerId });
      onUpdateUser?.({ ...user, ...result.user });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not select this Runner.');
    } finally {
      setUpdatingRunnerId(null);
    }
  };

  if (ownedRunners.length === 0) {
    return (
      <div className="rounded-3xl border border-[#232731] bg-[#171A21] p-6 text-center text-white">
        <Footprints className="mx-auto mb-3 h-9 w-9 text-[#D8FD2F]" />
        <h2 className="text-base font-black">No Runners Yet</h2>
        <p className="mt-1 text-xs text-slate-400">Purchased Runners will appear here with their own unique serial numbers.</p>
        <button
          type="button"
          onClick={() => onNavigateTab('market')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#D8FD2F] px-4 py-2.5 text-xs font-black uppercase text-black active:scale-95"
        >
          <ShoppingBag className="h-4 w-4" />
          Go to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-5 text-white">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-black">My Runners</h2>
          <p className="mt-1 text-[11px] text-slate-400">Each Runner is individually numbered and can be selected for Track.</p>
        </div>
        <span className="rounded-full border border-[#D8FD2F]/30 bg-[#D8FD2F]/10 px-2.5 py-1 text-[10px] font-black text-[#D8FD2F]">
          {ownedRunners.length} OWNED
        </span>
      </div>

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs font-semibold text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="space-y-3">
        {ownedRunners.map((runner) => {
          const isEquipped = user.equippedRunnerId === runner.id;
          const cooldownUntil = user.runnerCooldowns?.[runner.id] || 0;
          const cooldownText = getCooldownText(cooldownUntil);
          const isUpdating = updatingRunnerId === runner.id;

          return (
            <article key={runner.id} className="flex gap-3 rounded-2xl border border-[#232731] bg-[#171A21] p-3">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#292F3D] bg-[#10141D]">
                <img src={runner.image} alt={runner.name} className="h-full w-full object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black">{runner.name}</h3>
                    <p className="mt-0.5 font-mono text-xs font-bold text-[#D8FD2F]">#{runner.serial}</p>
                  </div>
                  <span className="rounded-md border border-white/10 bg-[#10141D] px-2 py-1 text-[9px] font-black text-slate-300">
                    {runner.category}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold text-slate-400">
                    <span className="text-emerald-400">+₱{runner.earningRate.toFixed(2)}/km</span>
                    <span> · {runner.kmLimitPerDay} km/day</span>
                  </div>
                  {cooldownText ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                      <Hourglass className="h-3 w-3" /> {cooldownText}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={isUpdating || !!cooldownText}
                  onClick={() => {
                    if (isEquipped) onNavigateTab('track');
                    else void equipRunner(runner.id);
                  }}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isEquipped
                      ? 'bg-[#D8FD2F] text-black'
                      : 'border border-white/10 bg-[#10141D] text-slate-200 hover:border-[#D8FD2F]/40'
                  }`}
                >
                  {isEquipped ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Footprints className="h-3.5 w-3.5" />}
                  {isUpdating ? 'Selecting...' : isEquipped ? 'Use in Track' : 'Select for Track'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onNavigateTab('market')}
        className="w-full rounded-xl border border-[#D8FD2F]/30 bg-[#171A21] py-3 text-xs font-black uppercase text-[#D8FD2F] hover:bg-[#20242D]"
      >
        Buy Another Runner
      </button>
    </div>
  );
};

export default MyRunnerTab;
