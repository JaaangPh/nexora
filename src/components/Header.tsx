import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const Header: React.FC = () => {
  return (
    <header className="relative w-full min-h-[270px] px-5 pt-5 pb-14 overflow-hidden select-none bg-[#091530]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[center_58%]"
        style={{
          backgroundImage:
            'linear-gradient(180deg, rgba(6,13,30,.38) 0%, rgba(9,21,48,.08) 42%, rgba(9,21,48,.94) 100%), url("/images/m2e_banner.jpg")',
          backgroundSize: 'auto 350px',
          backgroundPosition: 'center 100%',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-tech-grid opacity-20" />
      <div className="absolute -right-12 -top-16 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#08132B]/80 px-2.5 py-2 backdrop-blur-md">
          <BrandLogo size="sm" />
          <div>
            <p className="text-sm font-black tracking-wide text-white">NEXORA</p>
            <p className="text-[9px] font-bold tracking-[0.2em] text-cyan-100/80">MOVE TO EARN</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#08132B]/55 px-2.5 py-1.5 backdrop-blur-md">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[9px] font-bold tracking-wider text-white">SECURE ACCESS</span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-12 text-center">
        <p className="text-[10px] font-extrabold tracking-[0.22em] text-cyan-200">
          YOUR NEXT MILE STARTS HERE
        </p>
        <p className="mt-1 text-xs font-semibold text-white/90">
          Move with purpose. Earn as you go.
        </p>
      </div>
    </header>
  );
};
