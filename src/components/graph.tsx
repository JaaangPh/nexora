import React, { useState } from 'react';
import { BarChart2, ExternalLink, RefreshCw } from 'lucide-react';

interface CryptoPair {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  network: string;
}

const SUPPORTED_PAIRS: CryptoPair[] = [
  {
    symbol: 'SOL/USDC',
    name: 'Solana',
    chain: 'solana',
    address: '7qbRF6YsyGuLUVs6Y1qW2LocxGTx6xUWSAfMifpfzK2M',
    network: 'Solana',
  },
  {
    symbol: 'ETH/USDC',
    name: 'Ethereum',
    chain: 'ethereum',
    address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    network: 'Ethereum',
  },
  {
    symbol: 'BTC/USDC',
    name: 'Bitcoin',
    chain: 'ethereum',
    address: '0x99ac8ca7087fa4a2a1fb63574997ca42d2426743',
    network: 'Ethereum',
  },
  {
    symbol: 'BNB/USDT',
    name: 'BNB Chain',
    chain: 'bsc',
    address: '0x16b9a82891338f9ba80e2d6970fdda79d1eb0dae',
    network: 'BSC',
  },
];

export const GraphTab: React.FC = () => {
  const [activePair, setActivePair] = useState<CryptoPair>(SUPPORTED_PAIRS[0]);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const dexscreenerUrl = `https://dexscreener.com/${activePair.chain}/${activePair.address}?embed=1&theme=dark&trades=0&info=0`;
  const externalLink = `https://dexscreener.com/${activePair.chain}/${activePair.address}`;

  return (
    <div className="space-y-3.5 animate-fade-in font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-extrabold text-white">Live Market Graph</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-cyan-300 tracking-wider uppercase">
            DEXSCREENER • LIVE
          </span>
        </div>
      </div>

      {/* Crypto Pairs Selector */}
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <div className="flex items-center gap-1.5">
          {SUPPORTED_PAIRS.map((pair) => {
            const isSelected = activePair.symbol === pair.symbol;
            return (
              <button
                key={pair.symbol}
                type="button"
                onClick={() => setActivePair(pair)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-400 text-[#08132B] shadow-md shadow-cyan-500/20 font-black'
                    : 'bg-[#0D204A] hover:bg-[#152F66] text-blue-200/80 hover:text-white border border-[#1E3E80]'
                }`}
              >
                <span>{pair.symbol}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                    isSelected ? 'bg-[#08132B]/20 text-[#08132B]' : 'bg-white/10 text-cyan-300'
                  }`}
                >
                  {pair.network}
                </span>
              </button>
            );
          })}
        </div>

        {/* Refresh & External Link Actions */}
        <div className="flex items-center gap-1 pl-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            title="Reload Chart"
            className="p-1.5 rounded-lg bg-[#0D204A] hover:bg-[#152F66] text-blue-200 border border-[#1E3E80] transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            title="Open on DexScreener"
            className="p-1.5 rounded-lg bg-[#0D204A] hover:bg-[#152F66] text-blue-200 border border-[#1E3E80] transition-all active:scale-95 no-underline flex items-center justify-center"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </a>
        </div>
      </div>

      {/* DexScreener Live Embed Frame */}
      <div className="w-full h-[480px] sm:h-[520px] rounded-2xl overflow-hidden border border-[#1E3E80] shadow-2xl relative bg-[#091530]">
        <iframe
          key={`${activePair.address}-${iframeKey}`}
          src={dexscreenerUrl}
          title={`DexScreener ${activePair.symbol} Live Chart`}
          className="w-full h-full border-0"
          allow="clipboard-write"
          loading="lazy"
        />
      </div>

      <div className="text-center">
        <p className="text-[10px] text-blue-200/50 font-medium">
          Real-time decentralized market data powered by DexScreener
        </p>
      </div>
    </div>
  );
};

export default GraphTab;
