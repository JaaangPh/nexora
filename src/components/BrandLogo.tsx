import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 rounded-xl',
    md: 'w-20 h-20 rounded-2xl shadow-xl shadow-black/25',
    lg: 'w-24 h-24 rounded-3xl shadow-2xl shadow-black/30',
  };

  return (
    <div
      className={`relative bg-white flex items-center justify-center p-2.5 transition-transform duration-300 hover:scale-105 ${sizeClasses[size]} ${className}`}
      style={{
        border: '1px solid rgba(255, 255, 255, 0.9)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#142B5B" />
            <stop offset="50%" stop-color="#2459C4" />
            <stop offset="100%" stop-color="#18B7D5" />
          </linearGradient>
          <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#142B5B" flood-opacity="0.3" />
          </filter>
        </defs>

        {/* Outer Circular Tech Ring with Accent Gap */}
        <circle
          cx="50"
          cy="50"
          r="44"
          stroke="url(#logoGrad)"
          strokeWidth="4"
          strokeDasharray="230 20"
          strokeLinecap="round"
        />

        {/* Inner Tech Orbital Ring */}
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="#18B7D5"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="10 8"
        />

        {/* Stylized Bold Tech 'N' */}
        <path
          d="M34 66 V34 C34 32.34 35.34 31 37 31 H39.5 C40.8 31 42 31.7 42.7 32.8 L59.5 58 V34 C59.5 32.34 60.84 31 62.5 31 H64.5 C66.16 31 67.5 32.34 67.5 34 V66 C67.5 67.66 66.16 69 64.5 69 H62 C60.7 69 59.5 68.3 58.8 67.2 L42 42 V66 C42 67.66 40.66 69 39 69 H37 C35.34 69 34 67.66 34 66 Z"
          fill="url(#logoGrad)"
          filter="url(#logoShadow)"
        />

        {/* Cyber Nodes */}
        <circle cx="66" cy="33" r="3" fill="#18B7D5" />
        <circle cx="36" cy="67" r="3" fill="#18B7D5" />
        <circle cx="50" cy="50" r="2.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
};
