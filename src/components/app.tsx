import React from 'react';
import { Smartphone, X, ShieldCheck, Star, Download } from 'lucide-react';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppModal: React.FC<AppModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white text-[#17233B] rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl relative animate-scale-up font-sans">
        
        {/* Modal Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-20 px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-[#2459C4]" />
            <h3 className="text-sm font-extrabold text-[#0B1A3D]">App Details</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          
          {/* 1. App Header Info */}
          <div className="flex items-center gap-4">
            <img
              src="/logo.png"
              alt="Nexora Technologies App Icon"
              className="w-16 h-16 rounded-2xl shadow-xl border border-cyan-400/30 flex-shrink-0 object-cover"
            />
            <div>
              <h2 className="text-xl font-black text-[#0B1A3D] leading-tight font-['Plus_Jakarta_Sans',sans-serif]">
                Nexora Technologies
              </h2>
              <p className="text-xs font-bold text-[#DC2626] mt-0.5">
                Nexora Technologies Team
              </p>
            </div>
          </div>

          {/* 2. Stats Bar */}
          <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center">
            <div>
              <div className="text-sm font-extrabold text-[#0B1A3D] flex items-center justify-center gap-1">
                <span>4.9</span>
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Rating</span>
            </div>
            <div>
              <div className="text-sm font-extrabold text-[#0B1A3D]">100K+</div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Downloads</span>
            </div>
            <div>
              <div className="text-sm font-extrabold text-[#0B1A3D]">25 MB</div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Size</span>
            </div>
          </div>

          {/* 3. Primary Download APK Button */}
          <a
            href="/downloads/nexora-technologies.apk"
            download="NexoraTechnologies.apk"
            className="w-full py-3.5 px-6 rounded-full bg-[#B91C1C] hover:bg-[#991B1B] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 transition-all no-underline cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download APK</span>
          </a>

          {/* 4. About this app */}
          <div>
            <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-1.5">About this app</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Nexora Technologies — Move With Purpose. Earn with every step. Explore the Sneaker Marketplace, track your outdoor workouts with live GPS, and manage your account seamlessly.
            </p>
          </div>

          {/* 5. App information Table */}
          <div>
            <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">App information</h4>
            <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs">
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Version</span>
                <span className="font-extrabold text-[#0B1A3D]">1.0.0</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Updated on</span>
                <span className="font-extrabold text-[#0B1A3D]">October 11, 2026</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Downloads</span>
                <span className="font-extrabold text-[#0B1A3D]">100,000+</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">APK Size</span>
                <span className="font-extrabold text-[#0B1A3D]">25 MB</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Requires Android</span>
                <span className="font-extrabold text-[#0B1A3D]">7.0 and up</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Category</span>
                <span className="font-extrabold text-[#0B1A3D]">Health, Fitness & Lifestyle</span>
              </div>
              <div className="flex justify-between p-3 bg-white">
                <span className="text-slate-400 font-medium">Developer</span>
                <span className="font-extrabold text-[#0B1A3D]">Nexora Technologies</span>
              </div>
            </div>
          </div>

          {/* 6. What's new */}
          <div>
            <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">What's new</h4>
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 text-xs space-y-2">
              <p className="text-[11px] text-slate-400 font-semibold mb-2">Last updated • October 10, 2026</p>
              <ul className="space-y-2 font-medium text-slate-700">
                <li className="flex items-center gap-2">🚀 <span>Improved app performance.</span></li>
                <li className="flex items-center gap-2">🔒 <span>Enhanced account security.</span></li>
                <li className="flex items-center gap-2">🐞 <span>Fixed login and registration bugs.</span></li>
                <li className="flex items-center gap-2">⚡ <span>Faster loading speed.</span></li>
              </ul>
            </div>
          </div>

          {/* 7. Data safety */}
          <div>
            <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">Data safety</h4>
            <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  🔒
                </div>
                <div>
                  <h5 className="font-extrabold text-[#0B1A3D]">Data is encrypted in transit</h5>
                  <p className="text-slate-500 text-[11px] mt-0.5">Your information is protected while being transferred.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  💔
                </div>
                <div>
                  <h5 className="font-extrabold text-[#0B1A3D]">No data shared with third parties</h5>
                  <p className="text-slate-500 text-[11px] mt-0.5">Your personal information is not sold or shared.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                  🗑️
                </div>
                <div>
                  <h5 className="font-extrabold text-[#0B1A3D]">You can request data deletion</h5>
                  <p className="text-slate-500 text-[11px] mt-0.5">Contact support if you want your account removed.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 8. Ratings & reviews */}
          <div>
            <h4 className="text-sm font-extrabold text-[#0B1A3D] mb-2">Ratings & reviews</h4>
            <div className="border border-slate-100 rounded-2xl p-4 bg-white text-xs">
              <div className="flex items-center gap-5 mb-1">
                <div className="text-center flex-shrink-0">
                  <span className="text-4xl font-black text-[#0B1A3D] block">4.9</span>
                  <div className="flex items-center justify-center text-amber-400 gap-0.5 my-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold block">Based on 12,845 reviews</span>
                </div>

                {/* Progress Bars */}
                <div className="flex-1 space-y-1.5 text-[10px] font-bold text-slate-600">
                  {[
                    { star: 5, width: '85%' },
                    { star: 4, width: '10%' },
                    { star: 3, width: '3%' },
                    { star: 2, width: '1%' },
                    { star: 1, width: '1%' },
                  ].map((item) => (
                    <div key={item.star} className="flex items-center gap-2">
                      <span className="w-2">{item.star}</span>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div style={{ width: item.width }} className="h-full bg-[#B91C1C] rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AppModal;
