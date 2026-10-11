import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  Search,
  Navigation,
  Play,
  Pause,
  RotateCcw,
  Footprints,
  Flame,
  Clock,
  Compass,
  MapPin,
  CheckCircle2,
  Bike,
  Car,
  Layers,
  Radio,
  Zap,
  Award
} from 'lucide-react';
import { User } from '../types/auth';

interface TrackTabProps {
  user?: User;
  equippedSneakerName?: string;
  onWorkoutFinish?: (earnedTokens: number) => void;
}

type WorkoutMode = 'running' | 'cycling' | 'transit';

export const TrackTab: React.FC<TrackTabProps> = ({
  user,
  equippedSneakerName = 'Cyber Aero Walker',
  onWorkoutFinish
}) => {
  // Activity Mode
  const [selectedMode, setSelectedMode] = useState<WorkoutMode>('running');

  // Workout state
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(0.35); // 0 to 1 position along route
  const [isSimulating, setIsSimulating] = useState(false);

  // Stats
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(1.4);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [tokensEarned, setTokensEarned] = useState(0);

  // Real GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied'>('idle');
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<number | null>(null);

  // Route & Destination Search
  const [destination, setDestination] = useState('1584 Thornridge Cir. Shiloh');
  const [searchFocused, setSearchFocused] = useState(false);
  const [destinationName, setDestinationName] = useState('Arindo D.');

  // Canvas / Map ref
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Timer loop for tracking workout
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);

        // Increment stats
        setStepCount((prev) => prev + Math.floor(Math.random() * 2 + 1));
        setCaloriesBurned((prev) => Math.round(prev + 0.15));
        setTokensEarned((prev) => Number((prev + 0.005).toFixed(3)));

        // If simulated run is active, progress the marker along the curve
        if (isSimulating) {
          setSimulatedProgress((prev) => {
            const next = prev + 0.008;
            return next >= 1 ? 0.05 : next;
          });
          setDistanceKm((prev) => Number((prev + 0.002).toFixed(2)));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused, isSimulating]);

  // Handle Real GPS detection
  const startRealGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGpsStatus('searching');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setGpsStatus('active');

        // Watch position
        const id = navigator.geolocation.watchPosition(
          (watchPos) => {
            setRealCoords({
              lat: watchPos.coords.latitude,
              lng: watchPos.coords.longitude,
              accuracy: Math.round(watchPos.coords.accuracy)
            });
            setGpsStatus('active');
          },
          (err) => {
            console.warn('GPS Watch error:', err);
          },
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
        setGpsWatchId(id);
      },
      (err) => {
        console.warn('GPS error:', err);
        setGpsStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const stopRealGps = () => {
    if (gpsWatchId !== null) {
      navigator.geolocation.clearWatch(gpsWatchId);
      setGpsWatchId(null);
    }
    setGpsStatus('idle');
  };

  // Workout Controls
  const handleStartWorkout = () => {
    setIsTracking(true);
    setIsPaused(false);
    setIsSimulating(true);
    startRealGps();
  };

  const handlePauseWorkout = () => {
    setIsPaused(!isPaused);
  };

  const handleFinishWorkout = () => {
    setIsTracking(false);
    setIsPaused(false);
    setIsSimulating(false);
    stopRealGps();
    if (onWorkoutFinish) {
      onWorkoutFinish(tokensEarned);
    }
  };

  // Format Time (HH:MM:SS or MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Dynamic point coordinates on map based on progress
  // Route curve: from Arindo D. (start, x: 50, y: 140) to You (x: 290, y: 190)
  const userX = 50 + (290 - 50) * simulatedProgress;
  const userY = 140 + Math.sin(simulatedProgress * Math.PI) * 45 + (190 - 140) * simulatedProgress;

  return (
    <div className="w-full flex flex-col space-y-3 animate-fade-in text-white select-none">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP BAR (Matching Picture 2)                      */}
      {/* Left: User Avatar, Center: "GPS Map", Right: Filter */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between px-1 pt-1">
        {/* User Avatar Circle */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/40 shadow-lg">
            <img
              src="/images/user_avatar.jpg"
              alt="User Profile"
              className="w-full h-full object-cover"
            />
            {isTracking && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#D8FD2F] rounded-full border-2 border-[#121519] animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300">
                {isTracking ? 'TRACKING LIVE' : 'READY TO MOVE'}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs font-bold text-white block">
              {user?.username || 'Arindo Runner'}
            </span>
          </div>
        </div>

        {/* Center Title */}
        <h2 className="text-base font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
          GPS Map
        </h2>

        {/* Top-Right Settings / Layer Round Button */}
        <button
          onClick={startRealGps}
          title="Detect Live GPS"
          className="w-10 h-10 rounded-full bg-[#1A1D24] hover:bg-[#252932] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md active:scale-95"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* GPS Status Notice if searching/active */}
      {gpsStatus !== 'idle' && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#141820] border border-[#232936] rounded-xl text-[11px]">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${gpsStatus === 'active' ? 'text-emerald-400 animate-pulse' : 'text-amber-400 animate-spin'}`} />
            <span className="font-semibold text-slate-300">
              {gpsStatus === 'active'
                ? `GPS Locked: ${realCoords?.lat.toFixed(4)}, ${realCoords?.lng.toFixed(4)} (±${realCoords?.accuracy}m)`
                : gpsStatus === 'searching'
                ? 'Acquiring GPS Satellite Signal...'
                : 'GPS Permission Denied. Using Virtual Route.'}
            </span>
          </div>
          <button
            onClick={stopRealGps}
            className="text-[10px] font-bold text-slate-400 hover:text-white uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. MAIN MAP VIEW (Exact dark vector map design)       */}
      {/* Matches user screenshot Picture 2                    */}
      {/* ---------------------------------------------------- */}
      <div
        ref={mapContainerRef}
        className="relative w-full h-[320px] rounded-[32px] overflow-hidden bg-[#111418] border border-[#1E232B] shadow-2xl relative select-none"
      >
        {/* Vector SVG Street Map Background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="street-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1A1E24" strokeWidth="1" />
            </pattern>
            {/* Glow Filter */}
            <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Tone */}
          <rect width="100%" height="100%" fill="#111418" />
          <rect width="100%" height="100%" fill="url(#street-grid)" opacity="0.6" />

          {/* Road Network Lines (Dark vector paths) */}
          <g stroke="#1D222A" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M-20,40 Q80,80 180,50 T360,90" />
            <path d="M30,-20 Q70,120 120,240 T160,360" />
            <path d="M-30,180 C90,140 220,170 380,130" />
            <path d="M220,-30 C200,90 270,200 320,340" />
            <path d="M10,290 C120,260 250,290 380,260" />
          </g>

          {/* Inner Secondary Road Lines */}
          <g stroke="#262D38" strokeWidth="2.5" fill="none" strokeLinecap="round">
            <path d="M-20,40 Q80,80 180,50 T360,90" />
            <path d="M30,-20 Q70,120 120,240 T160,360" />
            <path d="M-30,180 C90,140 220,170 380,130" />
            <path d="M220,-30 C200,90 270,200 320,340" />
            <path d="M10,290 C120,260 250,290 380,260" />
          </g>

          {/* Diagonal Street Connectors */}
          <path d="M60,60 L240,240" stroke="#1F2530" strokeWidth="2" fill="none" />
          <path d="M280,40 L110,210" stroke="#1F2530" strokeWidth="2" fill="none" />

          {/* Street Labels (like Picture 2: "Arya Nagar Road", "Ram Nagar", etc.) */}
          <text x="210" y="110" fill="#3D4554" fontSize="9" fontWeight="700" letterSpacing="0.5">
            Ram Nagar
          </text>
          <text x="145" y="170" fill="#3D4554" fontSize="9" fontWeight="700" transform="rotate(-16 145 170)">
            Arya Nagar Road
          </text>
          <text x="50" y="225" fill="#3D4554" fontSize="9" fontWeight="700" transform="rotate(18 50 225)">
            Ram bagh
          </text>
          <text x="235" y="175" fill="#3D4554" fontSize="8" fontWeight="700" transform="rotate(-28 235 175)">
            Arya Nagar
          </text>

          {/* -------------------------------------------------- */}
          {/* TRAJECTORY ROUTE: Yellow/Lime Dashed Line          */}
          {/* Connecting Arindo D. to You                        */}
          {/* -------------------------------------------------- */}
          <path
            d="M 50 140 Q 150 190 290 190"
            fill="none"
            stroke="#D8FD2F"
            strokeWidth="3.5"
            strokeDasharray="6 6"
            filter="url(#neon-glow)"
            opacity="0.9"
          />

          {/* Animated Wave along the route */}
          <path
            d="M 50 140 Q 150 190 290 190"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeDasharray="4 16"
            className="animate-pulse"
            opacity="0.75"
          />
        </svg>

        {/* -------------------------------------------------- */}
        {/* WAYPOINT 1: "Arindo D." (Lime Green Tag & Dot)     */}
        {/* -------------------------------------------------- */}
        <div className="absolute top-[88px] left-[32px] flex flex-col items-center pointer-events-none z-20">
          {/* Lime Speech Bubble with text "Arindo D." */}
          <div className="bg-[#D8FD2F] text-[#0A0D11] text-[11px] font-black px-3.5 py-1 rounded-xl shadow-lg shadow-[#D8FD2F]/20 mb-1 flex items-center gap-1">
            <span>{destinationName}</span>
          </div>

          {/* Concentric Circle Marker */}
          <div className="relative w-8 h-8 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-[#D8FD2F]/20 animate-ping" />
            <div className="w-6 h-6 rounded-full border-2 border-[#D8FD2F] bg-[#111418] flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D8FD2F] shadow-sm shadow-[#D8FD2F]" />
            </div>
          </div>
        </div>

        {/* -------------------------------------------------- */}
        {/* WAYPOINT 2: "You" (White Tag & Glowing Dot)        */}
        {/* Dynamic position when running simulation           */}
        {/* -------------------------------------------------- */}
        <div
          className="absolute flex flex-col items-center pointer-events-none z-20 transition-all duration-300"
          style={{
            left: `${userX - 24}px`,
            top: `${userY - 52}px`
          }}
        >
          {/* White Speech Bubble "You" */}
          <div className="bg-white text-[#0A0D11] text-[11px] font-black px-3.5 py-1 rounded-xl shadow-xl mb-1 flex items-center gap-1">
            <span>You</span>
          </div>

          {/* White Glowing Dot */}
          <div className="relative w-7 h-7 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-white/20 animate-pulse" />
            <div className="w-5 h-5 rounded-full bg-white border-2 border-[#111418] shadow-lg shadow-white/40 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#0A0D11]" />
            </div>
          </div>
        </div>

        {/* Map Layer Mode Switcher (Floating pill inside map) */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-[#1A1D24]/90 backdrop-blur-md p-1 rounded-full border border-white/10 shadow-lg">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors ${
              isSimulating ? 'bg-[#D8FD2F] text-black' : 'text-slate-300 hover:text-white'
            }`}
          >
            {isSimulating ? 'SIM ACTIVE' : 'SIMULATE'}
          </button>
        </div>

        {/* Live Sneaker Equipped Indicator */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#1A1D24]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-lg">
          <Zap className="w-3.5 h-3.5 text-[#D8FD2F]" />
          <span className="text-[10px] font-extrabold text-white">
            {equippedSneakerName} (1.5x Boost)
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. BOTTOM CONTROL SHEET (Exact Match to Picture 2)   */}
      {/* Curved dark container (#1A1D22)                      */}
      {/* ---------------------------------------------------- */}
      <div className="bg-[#171A21] rounded-[32px] p-4 sm:p-5 border border-[#232731] shadow-2xl space-y-4">
        {/* Search Bar with Magnifying Glass */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search"
            className="w-full bg-[#20242D] border border-[#2B303C] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder-slate-400/80 focus:outline-none focus:border-[#D8FD2F]/60 transition-colors"
          />
        </div>

        {/* Destination Target: "To the location" & "1584 Thornridge Cir. Shiloh" */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-slate-400 font-medium">To the location</span>
          <span className="font-extrabold text-white text-right max-w-[200px] truncate">
            {destination}
          </span>
        </div>

        {/* -------------------------------------------------- */}
        {/* Large Stat (1.4 km) + Call to Action Pill Button   */}
        {/* -------------------------------------------------- */}
        <div className="flex items-center justify-between pt-1">
          {/* Big Distance Stat */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-white">
              {distanceKm}
            </span>
            <span className="text-sm font-bold text-slate-300">km</span>
          </div>

          {/* Action Button: Workout start/pause button matching Picture 2 */}
          {!isTracking ? (
            <button
              onClick={handleStartWorkout}
              className="px-5 py-3 rounded-full bg-[#353E2B] hover:bg-[#434F35] text-[#D8FD2F] border border-[#D8FD2F]/40 flex items-center gap-2 font-extrabold text-xs shadow-lg transition-all active:scale-95 group"
            >
              <Navigation className="w-4 h-4 group-hover:rotate-45 transition-transform" />
              <span>Start Workout</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseWorkout}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${
                  isPaused ? 'bg-[#D8FD2F] text-black' : 'bg-[#2A303D] text-white hover:bg-[#343B4B]'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={handleFinishWorkout}
                className="px-4 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-all active:scale-95"
              >
                End & Earn
              </button>
            </div>
          )}
        </div>

        {/* -------------------------------------------------- */}
        {/* LIVE WORKOUT HUD: TIME, CALORIES, STEPS, REWARDS   */}
        {/* Visible when tracking is active                    */}
        {/* -------------------------------------------------- */}
        {isTracking && (
          <div className="bg-[#12151B] p-3 rounded-2xl border border-[#232936] grid grid-cols-4 gap-2 text-center animate-fade-in">
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                TIME
              </span>
              <span className="text-xs font-mono font-black text-white">
                {formatTime(secondsElapsed)}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                STEPS
              </span>
              <span className="text-xs font-mono font-black text-[#D8FD2F]">
                {stepCount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                CALORIES
              </span>
              <span className="text-xs font-mono font-black text-orange-400">
                {caloriesBurned} kcal
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                EARNED
              </span>
              <span className="text-xs font-mono font-black text-cyan-300">
                +{tokensEarned} NEX
              </span>
            </div>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* 4. ACTIVITY MODE SELECTOR (Matches Picture 2)       */}
        {/* Running (80 min), Cycling (38 min), Driving (16 min)*/}
        {/* Running is styled in bright Lime #D8FD2F           */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Card 1: Running (80 min) - Active Lime in Picture 2 */}
          <button
            type="button"
            onClick={() => setSelectedMode('running')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all active:scale-95 ${
              selectedMode === 'running'
                ? 'bg-[#D8FD2F] text-[#0A0D11] shadow-lg shadow-[#D8FD2F]/20'
                : 'bg-[#20242D] text-slate-300 hover:text-white border border-[#2B303C]'
            }`}
          >
            <Footprints className="w-6 h-6 mb-1.5" />
            <span className="text-xs font-black tracking-tight">80 min</span>
          </button>

          {/* Card 2: Cycling (38 min) */}
          <button
            type="button"
            onClick={() => setSelectedMode('cycling')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all active:scale-95 ${
              selectedMode === 'cycling'
                ? 'bg-[#D8FD2F] text-[#0A0D11] shadow-lg shadow-[#D8FD2F]/20'
                : 'bg-[#20242D] text-slate-300 hover:text-white border border-[#2B303C]'
            }`}
          >
            <Bike className="w-6 h-6 mb-1.5" />
            <span className="text-xs font-black tracking-tight">38 min</span>
          </button>

          {/* Card 3: Driving / Transit (16 min) */}
          <button
            type="button"
            onClick={() => setSelectedMode('transit')}
            className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all active:scale-95 ${
              selectedMode === 'transit'
                ? 'bg-[#D8FD2F] text-[#0A0D11] shadow-lg shadow-[#D8FD2F]/20'
                : 'bg-[#20242D] text-slate-300 hover:text-white border border-[#2B303C]'
            }`}
          >
            <Car className="w-6 h-6 mb-1.5" />
            <span className="text-xs font-black tracking-tight">16 min</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackTab;
