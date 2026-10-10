import React from 'react';
import { Shield } from 'lucide-react';

interface SecurityNoticeProps {
  title?: string;
  description?: string;
}

export const SecurityNotice: React.FC<SecurityNoticeProps> = ({
  title = 'Secure Sign In',
  description = 'Your login information is protected. Never share your password with anyone.',
}) => {
  return (
    <div className="w-full bg-[#F6F9FD] border border-[#DCE4EF] rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 transition-colors">
      {/* Icon Badge */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#142B5B] to-[#2459C4] flex items-center justify-center flex-shrink-0 shadow-sm text-white">
        <Shield className="w-5 h-5 text-cyan-300" />
      </div>

      {/* Text Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs sm:text-sm font-bold text-[#17233B] tracking-tight">
          {title}
        </h4>
        <p className="text-[11px] sm:text-xs text-[#64748B] leading-relaxed mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
};
