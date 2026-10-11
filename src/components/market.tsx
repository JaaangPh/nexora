import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Search,
  Zap,
  Flame,
  Shield,
  Heart,
  Sparkles,
  CheckCircle2,
  X,
  ShoppingBag,
  ArrowUpRight,
  ChevronRight,
  Filter
} from 'lucide-react';

export interface SneakerItem {
  id: string;
  name: string;
  category: 'SLOW' | 'NORMAL' | 'FAST' | 'TRAINER';
  level: string;
  serial: string;
  priceAvax: number;
  pricePhp: number;
  image: string;
  speedRange: string;
  efficiency: number;
  comfort: number;
  resilience: number;
  durability: number;
  description: string;
  accentColor: string;
}

export const SNEAKER_CATALOG: SneakerItem[] = [
  {
    id: 'snk-1',
    name: 'Cyber Aero Walker',
    category: 'SLOW',
    level: 'LV.1',
    serial: '#30209202',
    priceAvax: 1.5,
    pricePhp: 2450,
    image: '/images/sneaker_cyan.jpg',
    speedRange: '1 - 6 km/h',
    efficiency: 8.4,
    comfort: 7.2,
    resilience: 9.1,
    durability: 100,
    description: 'Engineered for smooth low-impact walks and daily commuting with high energy recovery.',
    accentColor: '#00E5FF'
  },
  {
    id: 'snk-2',
    name: 'Bio Surge Trainer',
    category: 'SLOW',
    level: 'LV.1',
    serial: '#30209202',
    priceAvax: 1.5,
    pricePhp: 2450,
    image: '/images/sneaker_green.jpg',
    speedRange: '1 - 6 km/h',
    efficiency: 8.8,
    comfort: 8.0,
    resilience: 8.6,
    durability: 100,
    description: 'Eco-composite lightweight sneaker optimized for steady cadence and maximum comfort.',
    accentColor: '#76FF03'
  },
  {
    id: 'snk-3',
    name: 'Vortex Blaze Sprint',
    category: 'FAST',
    level: 'LV.1',
    serial: '#30209202',
    priceAvax: 1.5,
    pricePhp: 2450,
    image: '/images/sneaker_orange.jpg',
    speedRange: '8 - 20 km/h',
    efficiency: 10.5,
    comfort: 6.8,
    resilience: 9.4,
    durability: 100,
    description: 'High-tempo racing shoe designed for competitive fast runs and maximum token yields.',
    accentColor: '#FF6D00'
  },
  {
    id: 'snk-4',
    name: 'Cobalt Aero Jogger',
    category: 'NORMAL',
    level: 'LV.1',
    serial: '#30209202',
    priceAvax: 1.5,
    pricePhp: 2450,
    image: '/images/sneaker_blue.jpg',
    speedRange: '4 - 10 km/h',
    efficiency: 9.2,
    comfort: 7.9,
    resilience: 8.9,
    durability: 100,
    description: 'Versatile all-around jogging sneaker with balanced efficiency and durable treads.',
    accentColor: '#2979FF'
  }
];

interface MarketTabProps {
  currentBalance?: number;
  onEquipSneaker?: (sneaker: SneakerItem) => void;
  equippedSneakerId?: string;
}

export const MarketTab: React.FC<MarketTabProps> = ({
  currentBalance = 1000,
  onEquipSneaker,
  equippedSneakerId = 'snk-1'
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSneaker, setSelectedSneaker] = useState<SneakerItem | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);
  const [equippedId, setEquippedId] = useState<string>(equippedSneakerId);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterSort, setFilterSort] = useState<'featured' | 'priceAsc' | 'priceDesc'>('featured');

  const filteredSneakers = SNEAKER_CATALOG.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  }).sort((a, b) => {
    if (filterSort === 'priceAsc') return a.priceAvax - b.priceAvax;
    if (filterSort === 'priceDesc') return b.priceAvax - a.priceAvax;
    return 0;
  });

  const handleBuyOrEquip = (sneaker: SneakerItem) => {
    setIsPurchasing(true);
    setTimeout(() => {
      setIsPurchasing(false);
      setEquippedId(sneaker.id);
      if (onEquipSneaker) {
        onEquipSneaker(sneaker);
      }
      setPurchaseSuccess(`Equipped ${sneaker.name} successfully! Ready for Move Tracking.`);
      setTimeout(() => {
        setPurchaseSuccess(null);
        setSelectedSneaker(null);
      }, 1500);
    }, 800);
  };

  return (
    <div className="space-y-4 animate-fade-in text-white">
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER: Marketplace Title + Filter Controls       */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
            Marketplace
          </h2>
          <p className="text-[11px] font-semibold text-cyan-300/80 uppercase tracking-wider">
            Move-To-Earn Sneaker Gear
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
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-blue-300/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sneakers, serials, attributes..."
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
          {['ALL', 'SLOW', 'NORMAL', 'FAST'].map((cat) => {
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
                {cat === 'ALL' ? 'ALL SNEAKERS' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SECTION TITLE: NEW BEST                              */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-black tracking-widest text-blue-300 uppercase">
          NEW BEST
        </span>
        <span className="text-[10px] font-bold text-cyan-300/70 uppercase tracking-wider">
          {filteredSneakers.length} Available
        </span>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2-COLUMN SNEAKER GRID (Matches User Picture 1)       */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        {filteredSneakers.map((sneaker) => {
          const isEquipped = equippedId === sneaker.id;

          return (
            <div
              key={sneaker.id}
              onClick={() => setSelectedSneaker(sneaker)}
              className="bg-white rounded-3xl p-3 flex flex-col justify-between shadow-lg hover:shadow-cyan-400/10 cursor-pointer transition-all transform hover:-translate-y-0.5 active:scale-[0.98] relative overflow-hidden group select-none"
            >
              {/* Equipped Badge */}
              {isEquipped && (
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-10 bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm uppercase tracking-wider">
                  EQUIPPED
                </div>
              )}

              {/* Top Row: Category Tag (e.g. SLOW) & Level (e.g. LV.1) */}
              <div className="flex items-center justify-between w-full z-10">
                <span className="text-xs font-black text-slate-800 tracking-tight">
                  {sneaker.category}
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {sneaker.level}
                </span>
              </div>

              {/* Sneaker Image Container */}
              <div className="w-full aspect-square my-1 relative flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50 group-hover:scale-105 transition-transform duration-300">
                <img
                  src={sneaker.image}
                  alt={sneaker.name}
                  className="w-full h-full object-contain drop-shadow-md"
                  loading="lazy"
                />
              </div>

              {/* Bottom Info: Serial ID and Price */}
              <div className="flex flex-col items-center text-center mt-1 w-full">
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider">
                  {sneaker.serial}
                </span>
                <span className="text-xs font-black text-slate-900 tracking-tight mt-0.5">
                  {sneaker.priceAvax} AVAX
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------------------------------------------- */}
      {/* BOTTOM BANNER: Better than everything                */}
      {/* Matches user screenshot Picture 1                    */}
      {/* ---------------------------------------------------- */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl border border-purple-500/30 group">
        <div className="w-full h-36 relative">
          <img
            src="/images/m2e_banner.jpg"
            alt="Better than everything"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-purple-950/90 via-[#0B1533]/80 to-transparent" />
          
          <div className="absolute inset-0 p-4 flex flex-col justify-center max-w-[70%]">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-300 mb-0.5">
              SEASON EXCLUSIVE
            </span>
            <h3 className="text-base sm:text-lg font-black text-white leading-tight drop-shadow-md">
              Better than everything
            </h3>
            <p className="text-[11px] text-purple-200/90 font-medium mt-1 leading-snug line-clamp-2">
              Supercharge your step earnings with high-tier Move-To-Earn gear.
            </p>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-extrabold text-cyan-300">
              <span>EXPLORE DROPS</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* SNEAKER DETAILS & EQUIP MODAL                        */}
      {/* ---------------------------------------------------- */}
      {selectedSneaker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-[#0B1A3D] border border-[#1E3E80] w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#1E3A78]/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                  {selectedSneaker.category} • {selectedSneaker.level}
                </span>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {selectedSneaker.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSneaker(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sneaker Preview Image */}
            <div className="w-full aspect-square rounded-2xl bg-white p-4 flex items-center justify-center relative shadow-inner">
              <img
                src={selectedSneaker.image}
                alt={selectedSneaker.name}
                className="w-full h-full object-contain drop-shadow-xl"
              />
              <span className="absolute bottom-2 right-3 text-[10px] font-mono font-bold text-slate-500">
                {selectedSneaker.serial}
              </span>
            </div>

            {/* Attributes Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-cyan-300 font-bold mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Speed Range</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedSneaker.speedRange}
                </div>
              </div>

              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Efficiency</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  +{selectedSneaker.efficiency} NEX/km
                </div>
              </div>

              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold mb-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span>Comfort</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedSneaker.comfort} / 10
                </div>
              </div>

              <div className="bg-[#08132B] p-2.5 rounded-xl border border-[#1E3A78]/50">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Resilience</span>
                </div>
                <div className="font-mono font-extrabold text-white text-sm">
                  {selectedSneaker.resilience} / 10
                </div>
              </div>
            </div>

            {/* Price & Action Button */}
            <div className="pt-2 flex items-center justify-between border-t border-[#1E3A78]/60">
              <div>
                <span className="text-[10px] text-blue-200/60 uppercase font-bold block">
                  PRICE
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {selectedSneaker.priceAvax} AVAX
                </span>
                <span className="text-[10px] text-cyan-300 font-bold block">
                  ≈ ₱{selectedSneaker.pricePhp.toLocaleString()}
                </span>
              </div>

              <button
                onClick={() => handleBuyOrEquip(selectedSneaker)}
                disabled={isPurchasing}
                className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                  equippedId === selectedSneaker.id
                    ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                    : 'bg-cyan-400 text-[#08132B] hover:bg-cyan-300 shadow-cyan-400/20'
                }`}
              >
                {isPurchasing ? (
                  <span>Processing...</span>
                ) : equippedId === selectedSneaker.id ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Equipped & Active</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Equip & Run</span>
                  </>
                )}
              </button>
            </div>

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
