import React from 'react';
import { Layers } from 'lucide-react';

interface TradesTabProps {
  currentBalance: number;
}

export const TradesTab: React.FC<TradesTabProps> = ({ currentBalance }) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-extrabold text-white">Automated Trading</h3>
        </div>
        <span className="text-xs font-mono font-bold text-cyan-300">
          Bal: ₱{currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Quick Trade Order</h4>
        <div className="grid grid-cols-2 gap-2">
          <button className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-[#08132B] font-extrabold text-xs rounded-xl transition-all active:scale-95">
            BUY / LONG
          </button>
          <button className="py-2.5 bg-red-500 hover:bg-red-400 text-white font-extrabold text-xs rounded-xl transition-all active:scale-95">
            SELL / SHORT
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-200/80 mb-2">Active Positions</h4>
        <div className="bg-[#0A1738] border border-[#1E3E80] rounded-2xl p-6 text-center">
          <p className="text-xs text-blue-200/60">No active trading positions open.</p>
        </div>
      </div>
    </div>
  );
};

export default TradesTab;
