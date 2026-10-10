import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Header: React.FC = () => {
  return (
    <header className="relative w-full pt-10 pb-16 px-4 overflow-hidden select-none" style={{
      background: 'linear-gradient(165deg, #091530 0%, #142B5B 50%, #1E4BA8 85%, #2459C4 100%)'
    }}>
      {/* Background Subtle Geometric Circles & Grid Overlay */}
      <div className="absolute inset-0 bg-tech-grid opacity-25 pointer-events-none" />
      
      {/* Curved Concentric Orbital Lines */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-white/5 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full border border-cyan-400/10 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

      {/* Header Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md mx-auto">
        {/* Brand Logo in Rounded White Container */}
        <div className="mb-4 animate-fade-in">
          <BrandLogo size="md" />
        </div>

        {/* Brand Heading */}
        <h1 className="text-2xl sm:text-[26px] font-extrabold text-white tracking-tight drop-shadow-sm font-['Plus_Jakarta_Sans',sans-serif]">
          Nexora Technologies
        </h1>

        {/* Tagline */}
        <p className="text-blue-100/85 text-xs sm:text-sm font-medium mt-1 tracking-normal">
          Secure Access to Your Account
        </p>

        {/* SECURE MEMBER ACCESS Pill Badge */}
        <div className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 backdrop-blur-md transition-all shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-[11px] font-bold text-white tracking-wider uppercase">
            SECURE MEMBER ACCESS
          </span>
        </div>

        {/* Accent Horizontal Dash Indicator */}
        <div className="w-12 h-1 bg-white/40 rounded-full mt-3.5" />
      </div>
    </header>
  );
};
