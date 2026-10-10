import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';

export const GraphTab: React.FC = () => {
  const [selectedTf, setSelectedTf] = useState<string>('1H');

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-extrabold text-white">Live Market Graph</h3>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
          NEX/USDT • LIVE
        </span>
      </div>

      {/* Market Summary */}
      <div className="bg-[#0D204A] border border-[#1E3E80] rounded-xl p-3.5 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-blue-200/70 block uppercase">NEX INDEX PRICE</span>
          <span className="text-xl font-black font-mono text-cyan-300">$1,482.50</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-emerald-400 block">+4.82% 24h</span>
          <span className="text-xs font-mono text-blue-200/80">Vol: $1.42M</span>
        </div>
      </div>

      {/* Simulated Candlestick / Line Chart */}
      <div className="bg-[#0A1738] border border-[#1E3E80] rounded-2xl p-4 shadow-inner">
        <div className="flex items-center justify-between text-xs text-blue-200/70 mb-3">
          <span className="font-bold">Timeframe:</span>
          <div className="flex items-center gap-1">
            {['1M', '5M', '1H', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedTf(tf)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                  selectedTf === tf ? 'bg-cyan-500 text-[#091530]' : 'bg-[#142B5B] text-blue-200 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Graph Graphic */}
        <div className="w-full h-44 flex items-end justify-between gap-1 pt-4 pb-1 px-1 relative border-b border-[#1E3A78]">
          {/* Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between opacity-15 pointer-events-none">
            <div className="border-b border-cyan-400 w-full" />
            <div className="border-b border-cyan-400 w-full" />
            <div className="border-b border-cyan-400 w-full" />
          </div>
          
          {/* Simulated Candle Bars */}
          {[40, 55, 35, 60, 75, 50, 65, 80, 70, 85, 95, 90, 110, 105, 125, 120, 140].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                style={{ height: `${h}%` }}
                className={`w-full rounded-t-sm ${
                  i % 3 === 0 ? 'bg-red-400/80' : 'bg-emerald-400/90 shadow-sm shadow-emerald-500/20'
                }`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[9px] font-mono text-blue-200/50 mt-2">
          <span>10:00</span>
          <span>12:00</span>
          <span>14:00</span>
          <span>16:00</span>
          <span>Now</span>
        </div>
      </div>
    </div>
  );
};

export default GraphTab;
