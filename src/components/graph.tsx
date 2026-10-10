import React, { useState } from 'react';
import { BarChart2, ExternalLink, RefreshCw, Zap, TrendingUp } from 'lucide-react';

interface CryptoPair {
  symbol: string;
  name: string;
  chain: string;
  address: string;
  network: string;
  tvSymbol: string;
}

// Fully verified and indexed active decentralized liquidity pools
const SUPPORTED_PAIRS: CryptoPair[] = [
  {
    symbol: 'BTC/USDC',
    name: 'Bitcoin',
    chain: 'arbitrum',
    address: '0x0e4831319a50228b9e450861297ab92dee15b44f', // Uniswap v3 WBTC/USDC ($8M+ liquidity)
    network: 'Arbitrum',
    tvSymbol: 'BINANCE:BTCUSDT',
  },
  {
    symbol: 'ETH/USDC',
    name: 'Ethereum',
    chain: 'ethereum',
    address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // Uniswap v3 ETH/USDC ($96M+ liquidity)
    network: 'Ethereum',
    tvSymbol: 'BINANCE:ETHUSDT',
  },
  {
    symbol: 'SOL/USDC',
    name: 'Solana',
    chain: 'solana',
    address: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE', // Orca SOL/USDC ($28.5M+ verified liquidity)
    network: 'Solana',
    tvSymbol: 'BINANCE:SOLUSDT',
  },
  {
    symbol: 'BNB/USDT',
    name: 'BNB Chain',
    chain: 'bsc',
    address: '0x16b9a82891338f9ba80e2d6970fdda79d1eb0dae', // PancakeSwap v2 WBNB/USDT ($58M+ liquidity)
    network: 'BSC',
    tvSymbol: 'BINANCE:BNBUSDT',
  },
];

export const GraphTab: React.FC = () => {
  const [activePair, setActivePair] = useState<CryptoPair>(SUPPORTED_PAIRS[0]);
  const [provider, setProvider] = useState<'dexscreener' | 'tradingview'>('dexscreener');
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handlePairChange = (pair: CryptoPair) => {
    if (pair.symbol !== activePair.symbol) {
      setIsLoading(true);
      setActivePair(pair);
    }
  };

  const handleProviderChange = (newProvider: 'dexscreener' | 'tradingview') => {
    if (newProvider !== provider) {
      setIsLoading(true);
      setProvider(newProvider);
    }
  };

  // DexScreener embed URL with loadChartSettings=0 to bypass third-party cookie/storage block stalls
  const dexscreenerUrl = `https://dexscreener.com/${activePair.chain}/${activePair.address}?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark`;
  
  // TradingView Real-Time Chart widget URL fallback
  const tradingviewUrl = `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
    activePair.tvSymbol
  )}&interval=15&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=08132B&theme=dark&style=1&timezone=Etc%2FUTC`;

  const currentChartUrl = provider === 'dexscreener' ? dexscreenerUrl : tradingviewUrl;
  const externalLink =
    provider === 'dexscreener'
      ? `https://dexscreener.com/${activePair.chain}/${activePair.address}`
      : `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activePair.tvSymbol)}`;

  return (
    <div className="space-y-3.5 animate-fade-in font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1E3A78] pb-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-extrabold text-white">Live Market Graph</h3>
        </div>

        {/* Source Provider Switcher */}
        <div className="flex items-center bg-[#07132B] p-0.5 rounded-xl border border-[#1E3E80]">
          <button
            type="button"
            onClick={() => handleProviderChange('dexscreener')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
              provider === 'dexscreener'
                ? 'bg-cyan-400 text-[#08132B] shadow-sm font-extrabold'
                : 'text-blue-300 hover:text-white'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>DEXSCREENER</span>
          </button>
          <button
            type="button"
            onClick={() => handleProviderChange('tradingview')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
              provider === 'tradingview'
                ? 'bg-cyan-400 text-[#08132B] shadow-sm font-extrabold'
                : 'text-blue-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>TRADINGVIEW</span>
          </button>
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
                onClick={() => handlePairChange(pair)}
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
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={externalLink}
            target="_blank"
            rel="noreferrer"
            title={`Open on ${provider === 'dexscreener' ? 'DexScreener' : 'TradingView'}`}
            className="p-1.5 rounded-lg bg-[#0D204A] hover:bg-[#152F66] text-blue-200 border border-[#1E3E80] transition-all active:scale-95 no-underline flex items-center justify-center"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
          </a>
        </div>
      </div>

      {/* Live Chart Container */}
      <div className="w-full h-[480px] sm:h-[530px] rounded-2xl overflow-hidden border border-[#1E3E80] shadow-2xl relative bg-[#091530]">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#091530]/90 backdrop-blur-sm pointer-events-none">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-bold text-cyan-300">
              Loading {activePair.symbol} {provider === 'dexscreener' ? 'DEX' : 'Spot'} Chart...
            </span>
            <span className="text-[10px] text-blue-300/60 mt-1">Connecting to live feed</span>
          </div>
        )}

        <iframe
          key={`${provider}-${activePair.symbol}-${activePair.address}-${iframeKey}`}
          src={currentChartUrl}
          title={`${provider === 'dexscreener' ? 'DexScreener' : 'TradingView'} ${activePair.symbol} Live Chart`}
          className="w-full h-full border-0"
          allow="clipboard-write; fullscreen"
          loading="eager"
          onLoad={() => setIsLoading(false)}
        />
      </div>

      {/* Footer info & quick switch fallback */}
      <div className="flex flex-col items-center justify-center gap-1 text-center pt-1">
        <p className="text-[10px] text-blue-200/60 font-medium">
          {provider === 'dexscreener'
            ? `Real-time decentralized on-chain liquidity data powered by DexScreener (${activePair.network})`
            : `Real-time global crypto spot market data powered by TradingView`}
        </p>
        {provider === 'dexscreener' && (
          <button
            type="button"
            onClick={() => handleProviderChange('tradingview')}
            className="text-[10px] text-cyan-400/80 hover:text-cyan-300 underline font-semibold transition-colors"
          >
            Slow connection? Switch to TradingView Chart
          </button>
        )}
      </div>
    </div>
  );
};

export default GraphTab;
