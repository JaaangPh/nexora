import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 rounded-2xl shadow-lg shadow-cyan-500/20',
    md: 'w-20 h-20 rounded-3xl shadow-2xl shadow-cyan-500/30',
    lg: 'w-28 h-28 rounded-[32px] shadow-2xl shadow-cyan-500/40',
    xl: 'w-36 h-36 rounded-[40px] shadow-2xl shadow-cyan-500/50',
  };

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden transition-transform duration-300 hover:scale-105 border border-cyan-400/40 bg-[#010F30] p-0.5 ${sizeClasses[size]} ${className}`}
    >
      <img
        src="/logo.png"
        alt="Nexora Technologies Logo"
        className="w-full h-full object-cover rounded-[inherit]"
        loading="eager"
      />
    </div>
  );
};

export default BrandLogo;

