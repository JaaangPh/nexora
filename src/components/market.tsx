import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  Search,
  Zap,
  Flame,
  Shield,
  Heart,
  Sparkles,
  X,
  ShoppingBag,
  ChevronRight,
  Filter,
  Lock,
  Compass
} from 'lucide-react';
import { User } from '../types/auth';
import { api } from '../services/api';
import { RunnerPrice } from '../services/api';
import { getOwnedRunnerInstances } from '../services/runnerInventory';

export interface RunnerItem {
  id: string;
  name: string;
  category: string;
  level: string;
  serial: string;
  pricePhp: number;
  originalPrice?: number;
  discountPercentage?: number;
  image: string;
  speedRange: string;
  earningRate: number; // +₱/km
  comfort: number; // / 10
  healthLimit: number; // Health Limit (before Resilience)
  kmLimitPerDay: number; // KM Limit per day
  description: string;
  accentColor: string;
  // Aliases for compatibility with existing references
  efficiency: number;
  resilience: number;
}

export const RUNNER_CATALOG: RunnerItem[] = [
  {
    id: 'snk-1',
    name: 'Cyber Aero Walker',
    category: 'WALKER',
    level: 'LV.1',
    serial: '#30209201',
    pricePhp: 500,
    image: '/images/sneaker_cyan.jpg',
    speedRange: '1 - 6 KM',
    earningRate: 8.40,
    efficiency: 8.40,
    comfort: 5,
    healthLimit: 10,
    resilience: 10,
    kmLimitPerDay: 6,
    description: 'Comfortable daily commuter runner engineered for steady walking cadence and entry-level outdoor tracking.',
    accentColor: '#00E5FF'
  },
  {
    id: 'snk-2',
    name: 'Bio Surge Trainer',
    category: 'TRAINER',
    level: 'LV.1',
    serial: '#30209202',
    pricePhp: 1000,
    image: '/images/sneaker_green.jpg',
    speedRange: '1 - 10 KM',
    earningRate: 10.20,
    efficiency: 10.20,
    comfort: 7,
    healthLimit: 13,
    resilience: 13,
    kmLimitPerDay: 10,
    description: 'Eco-composite responsive trainer offering enhanced rebound, 10KM daily limits, and higher step yields.',
    accentColor: '#76FF03'
  },
  {
    id: 'snk-3',
    name: 'Cobalt Aero Jogger',
    category: 'JOGGER',
    level: 'LV.1',
    serial: '#30209203',
    pricePhp: 2000,
    image: '/images/sneaker_blue.jpg',
    speedRange: '1 - 20 KM',
    earningRate: 20.10,
    efficiency: 20.10,
    comfort: 8,
    healthLimit: 20,
    resilience: 20,
    kmLimitPerDay: 20,
    description: 'High-end performance jogger engineered for endurance athletes with a 20KM daily limit and high yield.',
    accentColor: '#2979FF'
  },
  {
    id: 'snk-4',
    name: 'Vortex Blaze Sprint',
    category: 'SPRINT',
    level: 'LV.1',
    serial: '#30209204',
    pricePhp: 3500,
    image: '/images/sneaker_orange.jpg',
    speedRange: '1 - 35 KM',
    earningRate: 40.00,
    efficiency: 40.00,
    comfort: 10,
    healthLimit: 25,
    resilience: 25,
    kmLimitPerDay: 35,
    description: 'Flagship elite racing runner delivering maximum token yields of ₱40/km, 10/10 comfort, and 35KM daily limit.',
    accentColor: '#FF6D00'
  }
];

// Backwards-compatible aliases
export const SNEAKER_CATALOG = RUNNER_CATALOG;
export type SneakerItem = RunnerItem;

interface MarketTabProps {
  user?: User;
  currentBalance?: number;
  onEquipSneaker?: (runner: RunnerItem) => void;
  onUpdateUser?: (user: User) => void;
  onNavigateTab?: (tab: 'home' | 'market' | 'track' | 'team' | 'me' | 'myrunners') => void;
  equippedSneakerId?: string;
}

export const MarketTab: React.FC<MarketTabProps> = ({
  user,
  currentBalance = 0,
  onEquipSneaker,
  onUpdateUser,
  onNavigateTab,
  equippedSneakerId
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRunner, setSelectedRunner] = useState<RunnerItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterSort, setFilterSort] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured');
  const [runnerPrices, setRunnerPrices] = useState<Record<string, RunnerPrice>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [priceLoadError, setPriceLoadError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    api.getRunnerPrices()
      .then((prices) => {
        if (isCurrent) setRunnerPrices(prices);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setPriceLoadError(error instanceof Error ? error.message : 'Could not load current runner prices.');
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingPrices(false);
      });
    return () => { isCurrent = false; };
  }, []);

  const ownedRunnerInstances = getOwnedRunnerInstances(user?.ownedRunners);
  const equippedId = user?.equippedRunnerId || equippedSneakerId || '';
  const catalogWithPrices = RUNNER_CATALOG.map((runner) => {
    const price = runnerPrices[runner.id];
    return {
      ...runner,
      originalPrice: price?.originalPrice ?? runner.pricePhp,
      pricePhp: price?.newPrice ?? runner.pricePhp,
      discountPercentage: price?.discountPercentage ?? 0,
    };
  });

  const filteredRunners = catalogWithPrices.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  }).sort((a, b) => {
    if (filterSort === 'priceAsc') return a.pricePhp - b.pricePhp;
    if (filterSort === 'priceDesc') return b.pricePhp - a.pricePhp;
    return 0;
  });

  const handleBuyRunner = async (runner: RunnerItem) => {
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const result = await api.purchaseRunner(runner.id);
      if (!result.user || !result.purchasedRunner) {
        throw new Error('The purchase response did not include the updated runner inventory.');
      }
      onUpdateUser?.({ ...user!, ...result.user });
      onEquipSneaker?.(runner);
      setPurchaseSuccess(`Purchased ${runner.name} #${result.purchasedRunner.serial}. Added to My Runners.`);
      window.setTimeout(() => {
        setPurchaseSuccess(null);
        setSelectedRunner(null);
        onNavigateTab?.('myrunners');
      }, 1200);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Failed to purchase runner. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in text-white pb-6 select-none">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER: Marketplace Title + Filter Controls       */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
            Runners Market
          </h2>
          <p className="text-[11px] font-semibold text-cyan-300/80 uppercase tracking-wider">
            Acquire Runners to Unlock Move & Earn Tracking
          </p>
        </div>

        <button
          onClick={() => setShowFilterModal(!showFilterModal)}
          aria-label="Filter Marketplace"
          className="w-10 h-10 rounded-2xl bg-[#0D204A] hover:bg-[#153170] border border-[#1E3E80] flex items-center justify-center text-cyan-300 hover:text-white transition-all shadow-md active:scale-95"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* SEARCH & CATEGORY FILTER PILLS */}
      {isLoadingPrices && (
        <p role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Loading current runner prices…
        </p>
      )}
      {priceLoadError && (
        <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          Runner prices could not be refreshed. {priceLoadError}
        </p>
      )}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-blue-300/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search runners, models, speed ranges..."
            className="w-full bg-[#0B1A3D]/90 border border-[#1E3A78] rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-white placeholder-blue-300/40 focus:outline-none focus:border-cyan-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Filter Categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {['ALL', 'WALKER', 'TRAINER', 'JOGGER', 'SPRINT'].map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold tracking-wide uppercase transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-cyan-400 text-[#08132B] shadow-md shadow-cyan-400/20'
                    : 'bg-[#0D204A] text-blue-200/70 hover:text-white border border-[#1E3E80]'
                }`}
              >
                {cat === 'ALL' ? 'ALL RUNNERS' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION TITLE: CATALOG                               */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-black tracking-widest text-blue-300 uppercase">
          AVAILABLE RUNNERS ({filteredRunners.length})
        </span>
        <span className="text-[10px] font-bold text-cyan-300/80 font-mono">
          Bal: ₱{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2-COLUMN RUNNER GRID                                 */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        {filteredRunners.map((runner) => {
          const ownedCount = ownedRunnerInstances.filter((owned) => owned.runnerId === runner.id).length;
          const isOwned = ownedCount > 0;
          const isEquipped = ownedRunnerInstances.some((owned) => owned.id === equippedId && owned.runnerId === runner.id);

          return (
            <div
              key={runner.id}
              onClick={() => setSelectedRunner(runner)}
              className={`bg-[#0C1B3E] border rounded-3xl p-3 flex flex-col justify-between shadow-lg hover:shadow-cyan-400/10 cursor-pointer transition-all transform hover:-translate-y-0.5 active:scale-[0.98] relative overflow-hidden group select-none ${
                isEquipped
                  ? 'border-emerald-500/80 shadow-emerald-500/10'
                  : isOwned
                  ? 'border-cyan-500/50'
                  : 'border-[#1E3A78]'
              }`}
            >
              {/* Top Badges */}
              <div className="flex items-center justify-between w-full z-10 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded-md border border-cyan-500/30">
                  {runner.category}
                </span>
                {isEquipped ? (
                  <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                    EQUIPPED
                  </span>
                ) : isOwned ? (
                  <span className="bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    OWNED ×{ownedCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {runner.level}
                  </span>
                )}
              </div>

              {/* Runner Image Container */}
              <div className="w-full aspect-square my-1 relative flex items-center justify-center overflow-hidden rounded-2xl bg-[#07132F]/80 border border-[#162B5B] group-hover:scale-105 transition-transform duration-300">
                <img
                  src={runner.image}
                  alt={runner.name}
                  className="w-full h-full object-contain drop-shadow-md"
                  loading="lazy"
                />
              </div>

              {/* Info: Name, Earning Rate & Price */}
              <div className="flex flex-col items-center text-center mt-1.5 w-full space-y-1">
                <h4 className="text-xs font-black text-white truncate max-w-full">
                  {runner.name}
                </h4>
                
                <div className="flex items-center justify-between w-full text-[10px] px-1 font-mono">
                  <span className="text-emerald-400 font-bold">
                    +₱{runner.earningRate.toFixed(2)}/km
                  </span>
                  <span className="text-slate-400 font-semibold">
                    {runner.kmLimitPerDay}KM/day
                  </span>
                </div>

                <div className="w-full pt-1.5 border-t border-[#193268] flex items-center justify-between gap-1 text-xs">
                  <span className="text-[10px] text-blue-300/70 font-bold">PRICE</span>
                  {isLoadingPrices ? (
                    <span className="text-[10px] text-cyan-200">Loading…</span>
                  ) : priceLoadError ? (
                    <span className="text-[10px] text-rose-200">Unavailable</span>
                  ) : (
                    <span className="flex min-w-0 items-center justify-end gap-1 font-mono">
                      {(runner.discountPercentage ?? 0) > 0 && (
                        <>
                          <span className="rounded-full bg-[#ff1744] px-1.5 py-0.5 text-[8px] font-black text-white whitespace-nowrap">
                            {runner.discountPercentage}% OFF
                          </span>
                          <span className="text-[9px] text-slate-400 line-through">
                            ₱{runner.originalPrice?.toLocaleString()}
                          </span>
                        </>
                      )}
                      <span className="font-black text-amber-400 text-sm whitespace-nowrap">
                        ₱{runner.pricePhp.toLocaleString()}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------------- */}
      {/* RUNNER DETAILS & BUY/EQUIP MODAL                     */}
      {/* ---------------------------------------------------- */}
      {selectedRunner && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#0B1A3D] border border-[#1E3E80] w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1E3A78]/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                  {selectedRunner.category} • {selectedRunner.level}
                </span>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {selectedRunner.name}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedRunner(null); setPurchaseError(null); }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Runner Preview Image */}
            <div className="w-full aspect-square rounded-2xl bg-[#07132F] border border-[#1A346C] p-4 flex items-center justify-center relative shadow-inner">
              <img
                src={selectedRunner.image}
                alt={selectedRunner.name}
                className="w-full h-full object-contain drop-shadow-2xl"
              />
              <span className="absolute bottom-2 right-3 text-[10px] font-mono font-bold text-slate-400">
                {selectedRunner.category} MODEL
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-blue-200/80 leading-relaxed">
              {selectedRunner.description}
            </p>

            {/* EXACT STATS SPECIFIED BY USER */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* 1. Speed Range */}
              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Speed Range</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedRunner.speedRange}
                </div>
              </div>

              {/* 2. Earning (before Efficiency) */}
              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Earning</span>
                </div>
                <div className="font-mono font-extrabold text-emerald-300 text-sm">
                  +₱{selectedRunner.earningRate.toFixed(2)}/km
                </div>
              </div>

              {/* 3. Comfort */}
              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Comfort</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedRunner.comfort} / 10
                </div>
              </div>

              {/* 4. Health Limit (before Resilience) */}
              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Health Limit</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedRunner.healthLimit}
                </div>
              </div>
            </div>

            {/* Daily KM Limit Bar */}
            <div className="bg-[#07132F] border border-cyan-500/30 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">Daily KM Limit</span>
              </div>
              <span className="text-sm font-black text-cyan-300 font-mono">
                {selectedRunner.kmLimitPerDay} KM / Day
              </span>
            </div>

            {/* Price & Action Button */}
            <div className="pt-2 flex items-center justify-between border-t border-[#1E3A78]/60">
              <div>
                <span className="text-[10px] text-blue-200/60 uppercase font-bold block">
                  PRICE
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {isLoadingPrices ? (
                    <span className="text-sm text-cyan-200">Loading…</span>
                  ) : priceLoadError ? (
                    <span className="text-sm text-rose-200">Unavailable</span>
                  ) : (
                    <>
                      {(selectedRunner.discountPercentage ?? 0) > 0 && (
                        <>
                          <span className="rounded-full bg-[#ff1744] px-2.5 py-1 text-[10px] font-black text-white">
                            {selectedRunner.discountPercentage}% OFF
                          </span>
                          <span className="font-mono text-sm text-slate-400 line-through">
                            ₱{selectedRunner.originalPrice?.toLocaleString()}
                          </span>
                        </>
                      )}
                      <span className="text-xl font-black text-amber-400 font-mono">
                        ₱{selectedRunner.pricePhp.toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleBuyRunner(selectedRunner)}
                disabled={isPurchasing || isLoadingPrices || Boolean(priceLoadError)}
                className="px-5 py-3 rounded-2xl bg-[#D8FD2F] hover:bg-[#cbf128] text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#D8FD2F]/20 transition-all active:scale-95 disabled:opacity-60"
              >
                {isLoadingPrices ? (
                  <span>Loading price...</span>
                ) : priceLoadError ? (
                  <span>Price unavailable</span>
                ) : isPurchasing ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Buy Another</span>
                  </>
                )}
              </button>
            </div>

            {/* Error Message */}
            {purchaseError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-center text-xs font-bold text-red-300 animate-fade-in">
                {purchaseError}
              </div>
            )}

            {/* Success Message */}
            {purchaseSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-center text-xs font-bold text-emerald-300 animate-fade-in">
                {purchaseSuccess}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILTER DRAWER / MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center p-0">
          <div className="bg-[#0B1A3D] border-t border-[#1E3E80] w-full max-w-sm rounded-t-[32px] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-cyan-400" />
                Filter & Sort Marketplace
              </h4>
              <button onClick={() => setShowFilterModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                Sort By Price
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setFilterSort('featured'); setShowFilterModal(false); }}
                  className={`py-2 text-xs font-bold rounded-xl border ${filterSort === 'featured' ? 'bg-cyan-400 text-[#08132B] border-cyan-400' : 'bg-[#08132B] text-slate-300 border-[#1E3A78]'}`}
                >
                  Featured
                </button>
                <button
                  onClick={() => { setFilterSort('priceAsc'); setShowFilterModal(false); }}
                  className={`py-2 text-xs font-bold rounded-xl border ${filterSort === 'priceAsc' ? 'bg-cyan-400 text-[#08132B] border-cyan-400' : 'bg-[#08132B] text-slate-300 border-[#1E3A78]'}`}
                >
                  Lowest
                </button>
                <button
                  onClick={() => { setFilterSort('priceDesc'); setShowFilterModal(false); }}
                  className={`py-2 text-xs font-bold rounded-xl border ${filterSort === 'priceDesc' ? 'bg-cyan-400 text-[#08132B] border-cyan-400' : 'bg-[#08132B] text-slate-300 border-[#1E3A78]'}`}
                >
                  Highest
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketTab;
