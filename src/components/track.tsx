import React, { useState, useEffect, useRef, useId } from 'react';
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
  Award,
  AlertTriangle,
  LocateFixed,
  Globe,
  Settings,
  X
} from 'lucide-react';
import { Geolocation, Position } from '@capacitor/geolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User } from '../types/auth';

interface TrackTabProps {
  user?: User;
  equippedSneakerName?: string;
  onWorkoutFinish?: (earnedTokens: number) => void;
}

type WorkoutMode = 'running' | 'cycling' | 'transit';
type MapLayerType = 'google-road' | 'google-hybrid' | 'google-sat';

// Mathematical Haversine formula to compute exact distance between two coordinates in kilometers
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const TrackTab: React.FC<TrackTabProps> = ({
  user,
  equippedSneakerName = 'Cyber Aero Walker',
  onWorkoutFinish
}) => {
  // Activity Mode
  const [selectedMode, setSelectedMode] = useState<WorkoutMode>('running');

  // Workout status: starts inactive.
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Stats: Real initial distance is 0.00 km (NO artificial movement)
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [tokensEarned, setTokensEarned] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied'>('idle');
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsWatchId, setGpsWatchId] = useState<string | null>(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  // Modal to request turning on GPS / Location
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Optional Demo Mode (explicitly separate from Real GPS)
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Map settings
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google-road');
  const [destination, setDestination] = useState('Central Park Fitness Loop');

  // Map & Leaflet References
  const mapElementId = useId().replace(/:/g, '-');
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routePointsRef = useRef<[number, number][]>([]);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE REAL LEAFLET MAP WITH GOOGLE MAPS TILE LAYER
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = document.getElementById(`map-${mapElementId}`);
    if (!container || mapRef.current) return;

    // Default center (e.g. Metro / Default before GPS fix)
    const initialLat = 14.5995;
    const initialLng = 120.9842;

    const map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    // Google Maps Tile Layer
    const tileUrl = getGoogleTileUrl(mapLayer);
    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    tileLayerRef.current = tiles;

    // Live Route Polyline (neon lime track path)
    const polyline = L.polyline([], {
      color: '#CCFF00',
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    routePolylineRef.current = polyline;
    mapRef.current = map;

    // Immediately try to detect current location to center map smoothly
    checkInitialGps(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map layer when changed
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getGoogleTileUrl(mapLayer));
  }, [mapLayer]);

  function getGoogleTileUrl(layer: MapLayerType): string {
    switch (layer) {
      case 'google-sat':
        return 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      case 'google-hybrid':
        return 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'google-road':
      default:
        return 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  }

  // --------------------------------------------------------------------------
  // 2. CHECK INITIAL LOCATION (Passive check on mount)
  // --------------------------------------------------------------------------
  const checkInitialGps = async (mapInstance?: L.Map) => {
    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 6000
      });
      if (pos && pos.coords) {
        const { latitude, longitude, accuracy } = pos.coords;
        setRealCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setGpsStatus('active');
        lastPositionRef.current = { lat: latitude, lng: longitude };

        const targetMap = mapInstance || mapRef.current;
        if (targetMap) {
          targetMap.setView([latitude, longitude], 16);
          updateMapMarker(latitude, longitude, Math.round(accuracy));
        }
      }
    } catch {
      // Permission not requested yet or GPS is off; will request upon clicking Start Workout
      setGpsStatus('idle');
    }
  };

  // --------------------------------------------------------------------------
  // 3. UPDATE USER MARKER & POLYLINE ON REAL MAP
  // --------------------------------------------------------------------------
  const updateMapMarker = (lat: number, lng: number, accuracy: number) => {
    const map = mapRef.current;
    if (!map) return;

    // Custom Glowing GPS Beacon Marker Icon
    const customIcon = L.divIcon({
      className: 'custom-gps-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; background: rgba(34, 211, 238, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 18px; height: 18px; background: #00E5FF; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 10px #00E5FF;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
    }

    // Accuracy Circle
    if (!accuracyCircleRef.current) {
      accuracyCircleRef.current = L.circle([lat, lng], {
        radius: Math.max(accuracy, 10),
        color: '#00E5FF',
        weight: 1,
        fillColor: '#00E5FF',
        fillOpacity: 0.12
      }).addTo(map);
    } else {
      accuracyCircleRef.current.setLatLng([lat, lng]);
      accuracyCircleRef.current.setRadius(Math.max(accuracy, 10));
    }
  };

  // --------------------------------------------------------------------------
  // 4. GPS ACTIVATION & PERMISSION FLOW (Works on APK, Android, iOS Safari & Web)
  // --------------------------------------------------------------------------
  const handleStartWorkoutClick = async () => {
    // If Demo Mode is enabled, skip hardware GPS requirement
    if (isDemoMode) {
      startWorkoutTracking();
      return;
    }

    setIsRequestingPermission(true);
    setGpsErrorMessage(null);

    try {
      // 1. Check or Request Permission via Capacitor Geolocation
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          setShowGpsModal(true);
          setGpsErrorMessage('Location permission was denied. Please allow location access in your device settings.');
          setIsRequestingPermission(false);
          return;
        }
      } else if (perm.location === 'denied') {
        setShowGpsModal(true);
        setGpsErrorMessage('Location permission is denied. Please open your device Settings and grant Location permission to Nexora.');
        setIsRequestingPermission(false);
        return;
      }

      // 2. Test reading GPS position to ensure GPS Hardware is turned ON
      setGpsStatus('searching');
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      if (!pos || !pos.coords) {
        throw new Error('Device location is unavailable. Make sure your device GPS is turned on.');
      }

      // GPS verified! Start tracking
      const { latitude, longitude, accuracy } = pos.coords;
      setRealCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
      setGpsStatus('active');
      lastPositionRef.current = { lat: latitude, lng: longitude };

      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 17);
        updateMapMarker(latitude, longitude, Math.round(accuracy));
      }

      setShowGpsModal(false);
      startWorkoutTracking();
      startContinuousGpsWatch();
    } catch (err: any) {
      console.warn('GPS Error on start workout:', err);
      setGpsStatus('denied');
      setShowGpsModal(true);

      const msg = err.message || '';
      if (msg.includes('disabled') || msg.includes('Location services are not enabled') || msg.includes('location unavailable')) {
        setGpsErrorMessage('Your device GPS / Location is turned OFF. Please turn on Location in your device settings to start tracking.');
      } else if (msg.includes('denied') || msg.includes('permission')) {
        setGpsErrorMessage('Location permission is required to track outdoor workouts. Please allow location access in your settings.');
      } else {
        setGpsErrorMessage('Could not acquire GPS satellite signal. Please turn on your device GPS and ensure clear sky view.');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  // --------------------------------------------------------------------------
  // 5. CONTINUOUS REAL-TIME GPS WATCH (Captures genuine device movements)
  // --------------------------------------------------------------------------
  const startContinuousGpsWatch = async () => {
    try {
      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (position: Position | null, err) => {
          if (err) {
            console.warn('Continuous GPS watch error:', err);
            return;
          }

          if (position && position.coords) {
            const { latitude, longitude, accuracy, speed } = position.coords;
            setRealCoords({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
            setGpsStatus('active');

            // Actual device speed from GPS (in km/h)
            if (speed !== null && speed > 0) {
              setCurrentSpeedKmh(Number((speed * 3.6).toFixed(1)));
            } else {
              setCurrentSpeedKmh(0);
            }

            // Update user position on Google Map
            updateMapMarker(latitude, longitude, Math.round(accuracy));

            // Genuine movement calculation:
            // Calculate distance only when the device actually changes coordinates (> 4 meters)
            if (isTracking && !isPaused && !isDemoMode) {
              if (lastPositionRef.current) {
                const deltaKm = calculateHaversineKm(
                  lastPositionRef.current.lat,
                  lastPositionRef.current.lng,
                  latitude,
                  longitude
                );

                // Discard GPS jitter (< 4 meters) while stationary
                if (deltaKm >= 0.004 && accuracy <= 50) {
                  setDistanceKm((prev) => {
                    const next = Number((prev + deltaKm).toFixed(2));
                    // Update steps and calories based on REAL distance
                    setStepCount(Math.round(next * 1350));
                    setCaloriesBurned(Math.round(next * 65));
                    setTokensEarned(Number((next * 8.4).toFixed(3)));
                    return next;
                  });

                  // Add breadcrumb to polyline trail
                  routePointsRef.current.push([latitude, longitude]);
                  if (routePolylineRef.current) {
                    routePolylineRef.current.setLatLngs(routePointsRef.current);
                  }

                  lastPositionRef.current = { lat: latitude, lng: longitude };

                  // Keep map centered on user
                  if (mapRef.current) {
                    mapRef.current.panTo([latitude, longitude]);
                  }
                }
              } else {
                lastPositionRef.current = { lat: latitude, lng: longitude };
              }
            }
          }
        }
      );
      setGpsWatchId(watchId);
    } catch (e) {
      console.warn('Failed to start watchPosition:', e);
    }
  };

  const startWorkoutTracking = () => {
    setIsTracking(true);
    setIsPaused(false);
    // Reset path when starting fresh
    if (distanceKm === 0) {
      routePointsRef.current = [];
      if (routePolylineRef.current) routePolylineRef.current.setLatLngs([]);
    }
  };

  const handlePauseWorkout = () => {
    setIsPaused(!isPaused);
  };

  const handleFinishWorkout = async () => {
    setIsTracking(false);
    setIsPaused(false);

    if (gpsWatchId) {
      await Geolocation.clearWatch({ id: gpsWatchId });
      setGpsWatchId(null);
    }

    if (onWorkoutFinish) {
      onWorkoutFinish(tokensEarned);
    }
  };

  // --------------------------------------------------------------------------
  // 6. WORKOUT TIMER (Only counts elapsed time; NO artificial distance ticking!)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);

        // In Demo Mode only: simulate movement
        if (isDemoMode) {
          setDistanceKm((prev) => {
            const next = Number((prev + 0.004).toFixed(2));
            setStepCount(Math.round(next * 1350));
            setCaloriesBurned(Math.round(next * 65));
            setTokensEarned(Number((next * 8.4).toFixed(3)));
            return next;
          });
          setCurrentSpeedKmh(7.8);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused, isDemoMode]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (realCoords) {
      mapRef.current.setView([realCoords.lat, realCoords.lng], 17);
    } else {
      checkInitialGps();
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col space-y-3 animate-fade-in text-white select-none">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP BAR                                           */}
      {/* Left: User Avatar, Center: "GPS Map", Right: Layers  */}
      {/* ---------------------------------------------------- */}
      <div className="flex items-center justify-between px-1 pt-1">
        {/* User Profile Avatar */}
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
                {isTracking ? (isPaused ? 'WORKOUT PAUSED' : 'TRACKING LIVE') : 'READY TO MOVE'}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${gpsStatus === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
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

        {/* Layer / Recenter Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleRecenter}
            title="Recenter Location"
            className="w-10 h-10 rounded-full bg-[#1A1D24] hover:bg-[#252932] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md active:scale-95"
          >
            <LocateFixed className="w-4 h-4 text-cyan-400" />
          </button>
          <button
            onClick={() => {
              setMapLayer((prev) =>
                prev === 'google-road'
                  ? 'google-hybrid'
                  : prev === 'google-hybrid'
                  ? 'google-sat'
                  : 'google-road'
              );
            }}
            title="Switch Google Map Layer (Road / Satellite)"
            className="w-10 h-10 rounded-full bg-[#1A1D24] hover:bg-[#252932] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shadow-md active:scale-95"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GPS Status Indicator Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#12161F] border border-[#232936] rounded-xl text-[11px]">
        <div className="flex items-center gap-2">
          <Radio className={`w-3.5 h-3.5 ${gpsStatus === 'active' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="font-semibold text-slate-300">
            {gpsStatus === 'active' && realCoords
              ? `GPS Locked: ${realCoords.lat.toFixed(4)}, ${realCoords.lng.toFixed(4)} (±${realCoords.accuracy}m)`
              : gpsStatus === 'searching'
              ? 'Connecting to GPS Satellites...'
              : 'GPS Standby (Tap Start Workout)'}
          </span>
        </div>

        {/* Simulator / Demo Mode Toggle */}
        <button
          onClick={() => setIsDemoMode(!isDemoMode)}
          className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
            isDemoMode ? 'bg-amber-400 text-black' : 'bg-white/10 text-slate-400 hover:text-white'
          }`}
        >
          {isDemoMode ? 'DEMO ACTIVE' : 'DEMO MODE'}
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. REAL INTERACTIVE GOOGLE MAP                       */}
      {/* ---------------------------------------------------- */}
      <div className="relative w-full h-[320px] rounded-[32px] overflow-hidden border border-[#242A36] shadow-2xl bg-[#0F1318]">
        {/* Real Leaflet Map Container */}
        <div id={`map-${mapElementId}`} className="w-full h-full z-10" />

        {/* Floating Google Map Badge */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-[#11141B]/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/15 text-[10px] font-black tracking-wider text-white shadow-lg">
          <Globe className="w-3 h-3 text-cyan-400" />
          <span>GOOGLE MAPS • {mapLayer === 'google-road' ? 'ROADMAP' : 'SATELLITE'}</span>
        </div>

        {/* Floating Live Sneaker Equipped Badge */}
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#11141B]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-lg">
          <Zap className="w-3.5 h-3.5 text-[#D8FD2F]" />
          <span className="text-[10px] font-extrabold text-white">
            {equippedSneakerName} (+8.4 NEX/km)
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. BOTTOM CONTROL SHEET (Exact Match to Picture 2)   */}
      {/* ---------------------------------------------------- */}
      <div className="bg-[#171A21] rounded-[32px] p-4 sm:p-5 border border-[#232731] shadow-2xl space-y-4">
        {/* Search Bar with Magnifying Glass */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Search destination or route..."
            className="w-full bg-[#20242D] border border-[#2B303C] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white placeholder-slate-400/80 focus:outline-none focus:border-[#D8FD2F]/60 transition-colors"
          />
        </div>

        {/* Location Target Display */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-slate-400 font-medium">To the location</span>
          <span className="font-extrabold text-white text-right max-w-[200px] truncate">
            {destination}
          </span>
        </div>

        {/* -------------------------------------------------- */}
        {/* Large Distance Stat + Action Button                */}
        {/* -------------------------------------------------- */}
        <div className="flex items-center justify-between pt-1">
          {/* Big Distance Stat (Real GPS distance; does NOT increase if standing still!) */}
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-white">
              {distanceKm.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-slate-300">km</span>
          </div>

          {/* Action Button */}
          {!isTracking ? (
            <button
              onClick={handleStartWorkoutClick}
              disabled={isRequestingPermission}
              className="px-5 py-3 rounded-full bg-[#353E2B] hover:bg-[#434F35] text-[#D8FD2F] border border-[#D8FD2F]/40 flex items-center gap-2 font-extrabold text-xs shadow-lg transition-all active:scale-95 group"
            >
              <Navigation className="w-4 h-4 group-hover:rotate-45 transition-transform" />
              <span>{isRequestingPermission ? 'Connecting GPS...' : 'Start Workout'}</span>
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
        {/* LIVE WORKOUT HUD: TIME, STEPS, CALORIES, EARNINGS  */}
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
        {/* Running (80 min in Lime #D8FD2F), Cycling, Transit  */}
        {/* -------------------------------------------------- */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Card 1: Running */}
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

          {/* Card 2: Cycling */}
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

          {/* Card 3: Driving / Transit */}
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

      {/* ==================================================== */}
      {/* 5. REQUEST TO TURN ON GPS / LOCATION PERMISSION MODAL */}
      {/* Displayed if GPS is not turned on or denied          */}
      {/* ==================================================== */}
      {showGpsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151922] border border-[#2C3344] rounded-[32px] p-6 w-full max-w-sm text-white shadow-2xl relative space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <button
                onClick={() => setShowGpsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Turn On GPS / Location
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {gpsErrorMessage || 'Nexora Move Tracker requires real device GPS to track your outdoor running, calculate distance, and record your route on Google Maps.'}
              </p>
            </div>

            {/* Platform Instructions Card */}
            <div className="bg-[#0E1118] border border-[#232936] rounded-2xl p-3.5 text-[11px] space-y-2 text-slate-300">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span>How to turn on Location:</span>
              </div>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-300 leading-normal">
                <li>
                  <strong className="text-white">Android / APK:</strong> Swipe down your notification bar and turn ON <span className="text-amber-300 font-bold">Location</span>, then allow app permissions.
                </li>
                <li>
                  <strong className="text-white">iPhone (iOS):</strong> Go to <em>Settings &gt; Privacy &gt; Location Services</em> &gt; Turn ON.
                </li>
                <li>
                  <strong className="text-white">Browser:</strong> Tap the lock or tune icon in the address bar &gt; Allow Location.
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleStartWorkoutClick}
                disabled={isRequestingPermission}
                className="w-full py-3.5 rounded-2xl bg-[#D8FD2F] hover:bg-[#c6ec22] text-[#0A0D11] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D8FD2F]/20 active:scale-95 transition-all"
              >
                {isRequestingPermission ? 'Connecting to GPS...' : 'I Turned It On — Start Run'}
              </button>

              <button
                onClick={() => {
                  setShowGpsModal(false);
                  setIsDemoMode(true);
                  startWorkoutTracking();
                }}
                className="w-full py-2.5 rounded-2xl bg-[#1F2430] hover:bg-[#282F3F] text-slate-300 font-bold text-xs active:scale-95 transition-all border border-white/10"
              >
                Test With Indoor Simulator
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackTab;
