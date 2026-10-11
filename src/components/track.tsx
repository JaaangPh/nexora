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
  X,
  SunMedium,
  Smartphone,
  Sparkles
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User } from '../types/auth';
import { SNEAKER_CATALOG } from './market';

interface TrackTabProps {
  user?: User;
  equippedSneakerName?: string;
  onWorkoutFinish?: (earned: number) => void;
}

type WorkoutMode = 'running' | 'cycling' | 'transit';
type MapLayerType = 'google-road' | 'google-hybrid' | 'google-sat';

// Haversine formula to compute exact distance between two coordinates in kilometers
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

  // Equipped Sneaker Earning Rate in ₱ per km
  const equippedSneakerItem = SNEAKER_CATALOG.find((s) => s.name === equippedSneakerName);
  const earningRate = equippedSneakerItem ? equippedSneakerItem.efficiency : 8.4;
  const earningRateRef = useRef(earningRate);
  earningRateRef.current = earningRate;

  // Workout Finish Modal & Last Summary State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [lastWorkoutSummary, setLastWorkoutSummary] = useState({
    earned: 0,
    distance: '0.00',
    time: '00:00',
    calories: 0,
  });

  // Workout state
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Stats: Real initial values
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [tokensEarned, setTokensEarned] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied'>('idle');
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  // Watch references (Capacitor native string ID vs Web number ID)
  const nativeWatchIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);

  // Insecure context detection (iOS Safari blocks Geolocation on non-HTTPS origins)
  const isInsecureContext = typeof window !== 'undefined'
    ? (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    : false;

  // Modal to request turning on GPS / Location
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Screen Wake Lock & Keep Screen Awake state
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const wakeLockRef = useRef<any>(null);

  // Optional Demo Mode
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Map settings
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google-road');
  const [destination, setDestination] = useState('Central Park Fitness Loop');

  // CRITICAL REFS to completely prevent stale closures and preserve state when screen is OFF
  const isTrackingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isDemoModeRef = useRef(false);
  const totalDistanceKmRef = useRef<number>(0.0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const motionStepCountRef = useRef<number>(0);
  const gpsStepCountRef = useRef<number>(0);

  // Timestamp refs to handle screen lock & off state perfectly
  const workoutStartTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);

  // Accelerometer step detector refs
  const lastAccelMagnitudeRef = useRef<number>(9.8);
  const lastStepTimestampRef = useRef<number>(0);
  const pedometerPeakArmedRef = useRef<boolean>(false);

  // Map & Leaflet References
  const mapElementId = useId().replace(/:/g, '-');
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const routePointsRef = useRef<[number, number][]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    isTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isDemoModeRef.current = isDemoMode;
  }, [isDemoMode]);

  // --------------------------------------------------------------------------
  // 1. INITIALIZE REAL LEAFLET MAP WITH GOOGLE MAPS TILE LAYER
  // --------------------------------------------------------------------------
  useEffect(() => {
    const container = document.getElementById(`map-${mapElementId}`);
    if (!container || mapRef.current) return;

    const initialLat = 14.5995;
    const initialLng = 120.9842;

    const map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    const tileUrl = getGoogleTileUrl(mapLayer);
    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    tileLayerRef.current = tiles;

    const polyline = L.polyline([], {
      color: '#CCFF00',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    routePolylineRef.current = polyline;
    mapRef.current = map;

    // Check location passively on load
    checkInitialGps(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

  interface DeviceFix {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed: number | null;
  }

  // Cross-platform GPS position fetcher: handles Capacitor APK, iOS Safari, Android Chrome
  const getDevicePosition = async (): Promise<DeviceFix> => {
    // 1. Native Capacitor platform (Android APK)
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'prompt' || perm.location === 'prompt-with-rationale') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          throw new Error('Location permission denied on device.');
        }
      } else if (perm.location === 'denied') {
        throw new Error('Location permission is denied. Please open Settings and enable Location for Nexora.');
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });

      if (!pos || !pos.coords) {
        throw new Error('GPS satellite fix unavailable. Please check that GPS is turned on.');
      }

      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        speed: pos.coords.speed
      };
    }

    // 2. Web browser (iOS Safari, Chrome, etc.)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser.');
    }

    // Fast attempt: High Accuracy GPS (6 second timeout)
    const tryHighAccuracy = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 10000
        });
      });

    // Fallback: Standard Accuracy (cellular / Wi-Fi / cached)
    const tryStandardAccuracy = () =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 9000,
          maximumAge: 30000
        });
      });

    let rawPos: GeolocationPosition;
    try {
      rawPos = await tryHighAccuracy();
    } catch (highErr: any) {
      // If user clicked "Don't Allow" (code 1), fail immediately with actionable explanation
      if (highErr && highErr.code === 1) {
        if (isInsecureContext) {
          throw new Error('iOS Safari blocks GPS over unencrypted HTTP. Use HTTPS or tap "Start Run with Motion Sensors".');
        }
        throw new Error('Location permission was denied. Tap the search bar settings icon in Safari/Chrome to Allow location.');
      }

      console.warn('High accuracy GPS timed out or unavailable, attempting standard accuracy fallback...', highErr);
      try {
        rawPos = await tryStandardAccuracy();
      } catch (fallbackErr: any) {
        if (fallbackErr && fallbackErr.code === 1) {
          throw new Error('Location permission was denied. Please allow location access in your browser settings.');
        }
        throw fallbackErr;
      }
    }

    return {
      latitude: rawPos.coords.latitude,
      longitude: rawPos.coords.longitude,
      accuracy: Math.round(rawPos.coords.accuracy),
      speed: rawPos.coords.speed
    };
  };

  // --------------------------------------------------------------------------
  // 2. CHECK INITIAL LOCATION (Passive)
  // --------------------------------------------------------------------------
  const checkInitialGps = async (mapInstance?: L.Map) => {
    try {
      const pos = await getDevicePosition();
      const { latitude, longitude, accuracy } = pos;
      setRealCoords({ lat: latitude, lng: longitude, accuracy });
      setGpsStatus('active');
      lastPositionRef.current = { lat: latitude, lng: longitude };

      const targetMap = mapInstance || mapRef.current;
      if (targetMap) {
        targetMap.setView([latitude, longitude], 17);
        updateMapMarker(latitude, longitude, accuracy);
      }
    } catch {
      setGpsStatus('idle');
    }
  };

  // --------------------------------------------------------------------------
  // 3. UPDATE USER MARKER & ACCURACY ON REAL MAP
  // --------------------------------------------------------------------------
  const updateMapMarker = (lat: number, lng: number, accuracy: number) => {
    const map = mapRef.current;
    if (!map) return;

    const customIcon = L.divIcon({
      className: 'custom-gps-marker',
      html: `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 34px; height: 34px; background: rgba(0, 229, 255, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 18px; height: 18px; background: #00E5FF; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 12px #00E5FF;"></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([lat, lng], { icon: customIcon }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
    }

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
  // 4. SCREEN WAKE LOCK (Prevents mobile screen from sleeping during run)
  // --------------------------------------------------------------------------
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock request error:', err);
    }
  };

  const releaseWakeLock = () => {
    try {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch (err) {
      console.warn('Wake Lock release error:', err);
    }
  };

  // --------------------------------------------------------------------------
  // 5. ACCELEROMETER / DEVICE MOTION STEP COUNTER (Instant real-time steps)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!isTrackingRef.current || isPausedRef.current) return;

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const magnitude = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      const now = Date.now();

      // Peak-to-Valley Biometric Pedometer:
      // 1. Arm step cycle on forward heel strike peak (> 11.2 m/s²)
      if (magnitude >= 11.2) {
        pedometerPeakArmedRef.current = true;
      }

      // 2. Count step when foot drops/recoils into valley (< 9.0 m/s²) with cadence debounce (>= 330ms)
      if (
        pedometerPeakArmedRef.current &&
        magnitude <= 9.0 &&
        now - lastStepTimestampRef.current >= 330
      ) {
        lastStepTimestampRef.current = now;
        pedometerPeakArmedRef.current = false;
        motionStepCountRef.current += 1;

        // Reconcile with total steps
        const totalSteps = Math.max(motionStepCountRef.current, gpsStepCountRef.current);
        setStepCount(totalSteps);

        // Distance from steps (average human stride ~0.74m/step = 0.00074 km)
        const motionDistanceKm = Number((totalSteps * 0.00074).toFixed(3));
        if (totalDistanceKmRef.current < motionDistanceKm) {
          totalDistanceKmRef.current = motionDistanceKm;
          setDistanceKm(motionDistanceKm);
          setTokensEarned(Number((motionDistanceKm * earningRateRef.current).toFixed(2)));
        }

        // Realistic MET Calories: ~62 kcal per km or ~0.04 kcal per step (no double counting)
        setCaloriesBurned(() => {
          return Math.max(Math.round(totalDistanceKmRef.current * 62), Math.round(totalSteps * 0.04));
        });
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    }
    return () => {
      if (window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // 6. SCREEN LOCK / OFF STATE CATCHUP (VISIBILITY CHANGE LISTENER)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isTrackingRef.current && !isPausedRef.current) {
        // 1. Immediately re-sync elapsed time
        const now = Date.now();
        const elapsed = Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current) / 1000);
        setSecondsElapsed(Math.max(0, elapsed));

        // 2. Invalidate leaflet map to redraw smoothly
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }

        // 3. Immediately query fresh GPS position to catch up distance moved while screen was off
        try {
          const pos = await getDevicePosition();
          handleNewGpsFix(pos.latitude, pos.longitude, pos.accuracy, pos.speed);
        } catch (e) {
          console.warn('Screen turn-on GPS refresh error:', e);
        }

        // 4. Re-acquire screen wake lock if enabled
        if (keepScreenOn) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [keepScreenOn]);

  // --------------------------------------------------------------------------
  // 7. GENUINE GPS MOVEMENT PROCESSOR (Haversine Distance + Steps + Calories)
  // --------------------------------------------------------------------------
  const handleNewGpsFix = (lat: number, lng: number, accuracy: number, speed: number | null) => {
    setRealCoords({ lat, lng, accuracy });
    setGpsStatus('active');

    if (speed !== null && speed > 0) {
      setCurrentSpeedKmh(Number((speed * 3.6).toFixed(1)));
    }

    updateMapMarker(lat, lng, accuracy);

    // Only accumulate distance if workout is actively tracking and not demo mode
    if (isTrackingRef.current && !isPausedRef.current && !isDemoModeRef.current) {
      if (lastPositionRef.current) {
        const delta = calculateHaversineKm(
          lastPositionRef.current.lat,
          lastPositionRef.current.lng,
          lat,
          lng
        );

        // High-precision GPS noise & indoor drift filter:
        // 1. Must have good satellite accuracy (<= 35m) to filter out indoor multipath bounce
        // 2. Must move at least 5 meters (0.005 km)
        // 3. Must have active movement velocity (speed >= 0.4 m/s or delta >= 0.008 km)
        const hasGoodAccuracy = accuracy <= 35;
        const hasMovedSignificantly = delta >= 0.005;
        const isGenuineMovement = speed === null || speed >= 0.4 || delta >= 0.008;

        if (hasGoodAccuracy && hasMovedSignificantly && isGenuineMovement) {
          // Accumulate raw unrounded distance
          totalDistanceKmRef.current += delta;
          const currentTotalKm = totalDistanceKmRef.current;

          setDistanceKm(currentTotalKm);

          // Steps based on distance (~1350 steps per km)
          const stepsFromGps = Math.floor(currentTotalKm * 1350);
          gpsStepCountRef.current = stepsFromGps;
          const combinedSteps = Math.max(motionStepCountRef.current, stepsFromGps);
          setStepCount(combinedSteps);

          // Calories burned (~62 kcal per km or ~0.04 kcal per step, no double-counting)
          const cals = Math.max(Math.round(currentTotalKm * 62), Math.round(combinedSteps * 0.04));
          setCaloriesBurned(cals);

          // Reward calculation (+₱ per km based on sneaker efficiency)
          setTokensEarned(Number((currentTotalKm * earningRateRef.current).toFixed(2)));

          // Append to polyline on map
          routePointsRef.current.push([lat, lng]);
          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(routePointsRef.current);
          }

          lastPositionRef.current = { lat, lng };

          if (mapRef.current) {
            mapRef.current.panTo([lat, lng]);
          }
        }
      } else {
        lastPositionRef.current = { lat, lng };
      }
    }
  };

  // --------------------------------------------------------------------------
  // 8. START WORKOUT CLICK (Permissions & GPS verification)
  // --------------------------------------------------------------------------
  const handleStartWorkoutClick = async () => {
    if (isDemoMode) {
      startWorkoutTracking();
      return;
    }

    // iOS 13+ user gesture required to enable accelerometer
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        await (DeviceMotionEvent as any).requestPermission();
      } catch (e) {
        console.warn('DeviceMotion permission request:', e);
      }
    }

    setIsRequestingPermission(true);
    setGpsErrorMessage(null);

    try {
      setGpsStatus('searching');
      const pos = await getDevicePosition();

      const { latitude, longitude, accuracy, speed } = pos;
      setRealCoords({ lat: latitude, lng: longitude, accuracy });
      setGpsStatus('active');
      lastPositionRef.current = { lat: latitude, lng: longitude };

      if (mapRef.current) {
        mapRef.current.setView([latitude, longitude], 17);
        updateMapMarker(latitude, longitude, accuracy);
      }

      setShowGpsModal(false);
      startWorkoutTracking();
      startContinuousGpsWatch();
    } catch (err: any) {
      console.warn('GPS Error on start workout:', err);
      setGpsStatus('denied');
      setShowGpsModal(true);

      const msg = err?.message || '';
      if (msg.includes('HTTP') || msg.includes('secure')) {
        setGpsErrorMessage(msg);
      } else if (msg.includes('denied') || msg.includes('permission') || err?.code === 1) {
        setGpsErrorMessage('Location permission was denied. Tap the address bar settings icon in Safari/Chrome to Allow location access.');
      } else if (msg.includes('unavailable') || err?.code === 2) {
        setGpsErrorMessage('Your device GPS / Location is turned OFF. Please turn on Location in your device settings.');
      } else if (msg.includes('timed out') || err?.code === 3) {
        setGpsErrorMessage('GPS satellite signal timed out. You can tap "Start Run with Motion Sensors" to begin tracking immediately!');
      } else {
        setGpsErrorMessage(msg || 'Could not connect to GPS. Please ensure Location is enabled in Settings.');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleStartWorkoutWithMotion = async () => {
    // Request motion permission if iOS
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        await (DeviceMotionEvent as any).requestPermission();
      } catch (e) {
        console.warn('DeviceMotion permission request:', e);
      }
    }

    setShowGpsModal(false);
    setGpsStatus('searching');
    startWorkoutTracking();
    // Continue attempting GPS in background so if permission or satellites become active, map seamlessly updates
    startContinuousGpsWatch();
  };

  // --------------------------------------------------------------------------
  // 9. CONTINUOUS REAL-TIME GPS WATCH (Cross-Platform)
  // --------------------------------------------------------------------------
  const startContinuousGpsWatch = async () => {
    stopContinuousGpsWatch();

    if (Capacitor.isNativePlatform()) {
      try {
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (position: Position | null, err) => {
            if (err) {
              console.warn('Native GPS watch error:', err);
              return;
            }

            if (position && position.coords) {
              handleNewGpsFix(
                position.coords.latitude,
                position.coords.longitude,
                Math.round(position.coords.accuracy),
                position.coords.speed
              );
            }
          }
        );
        nativeWatchIdRef.current = watchId;
      } catch (e) {
        console.warn('Native watchPosition failed:', e);
      }
      return;
    }

    // Web browser / iOS Safari
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (pos && pos.coords) {
              handleNewGpsFix(
                pos.coords.latitude,
                pos.coords.longitude,
                Math.round(pos.coords.accuracy),
                pos.coords.speed
              );
            }
          },
          (err) => {
            console.warn('Web watchPosition notice:', err.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 2000
          }
        );
        webWatchIdRef.current = watchId;
      } catch (e) {
        console.warn('Web watchPosition failed:', e);
      }
    }
  };

  const stopContinuousGpsWatch = async () => {
    if (nativeWatchIdRef.current) {
      try {
        await Geolocation.clearWatch({ id: nativeWatchIdRef.current });
      } catch (e) {}
      nativeWatchIdRef.current = null;
    }
    if (webWatchIdRef.current !== null) {
      try {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
      } catch (e) {}
      webWatchIdRef.current = null;
    }
  };

  const startWorkoutTracking = () => {
    isTrackingRef.current = true;
    isPausedRef.current = false;
    setIsTracking(true);
    setIsPaused(false);

    // Initialize timestamps for drift-free screen-off timekeeping
    workoutStartTimeRef.current = Date.now();
    pausedDurationRef.current = 0;

    // Reset distance if starting fresh
    if (totalDistanceKmRef.current === 0) {
      totalDistanceKmRef.current = 0.0;
      motionStepCountRef.current = 0;
      gpsStepCountRef.current = 0;
      routePointsRef.current = [];
      if (routePolylineRef.current) routePolylineRef.current.setLatLngs([]);
    }

    if (keepScreenOn) {
      requestWakeLock();
    }
  };

  const handlePauseWorkout = () => {
    if (!isPaused) {
      pauseStartTimeRef.current = Date.now();
      isPausedRef.current = true;
      setIsPaused(true);
      releaseWakeLock();
    } else {
      pausedDurationRef.current += (Date.now() - pauseStartTimeRef.current);
      isPausedRef.current = false;
      setIsPaused(false);
      if (keepScreenOn) {
        requestWakeLock();
      }
    }
  };

  const handleFinishWorkout = async () => {
    isTrackingRef.current = false;
    isPausedRef.current = false;
    setIsTracking(false);
    setIsPaused(false);
    releaseWakeLock();

    await stopContinuousGpsWatch();

    const finalEarned = Math.round(tokensEarned * 100) / 100;
    const finalDistance = distanceKm.toFixed(2);
    const finalTime = formatTime(secondsElapsed);
    const finalCalories = caloriesBurned;

    setLastWorkoutSummary({
      earned: finalEarned,
      distance: finalDistance,
      time: finalTime,
      calories: finalCalories,
    });
    setShowFinishModal(true);

    if (onWorkoutFinish) {
      onWorkoutFinish(finalEarned);
    }
  };

  const handleDismissFinishModal = () => {
    setShowFinishModal(false);
    totalDistanceKmRef.current = 0.0;
    motionStepCountRef.current = 0;
    gpsStepCountRef.current = 0;
    routePointsRef.current = [];
    if (routePolylineRef.current) {
      routePolylineRef.current.setLatLngs([]);
    }
    setDistanceKm(0);
    setStepCount(0);
    setCaloriesBurned(0);
    setTokensEarned(0);
    setSecondsElapsed(0);
  };

  // --------------------------------------------------------------------------
  // 10. TIMER LOOP (Timestamp-based: keeps accurate time even when screen was OFF)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current) / 1000);
        setSecondsElapsed(Math.max(0, elapsed));

        // In Demo Mode only: simulate movement
        if (isDemoModeRef.current) {
          totalDistanceKmRef.current += 0.003;
          setDistanceKm(totalDistanceKmRef.current);
          setStepCount(Math.round(totalDistanceKmRef.current * 1350));
          setCaloriesBurned(Math.round(totalDistanceKmRef.current * 65));
          setTokensEarned(Number((totalDistanceKmRef.current * earningRateRef.current).toFixed(2)));
          setCurrentSpeedKmh(7.8);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking, isPaused]);

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

  // Format distance display (if less than 0.1km, show meters too for immediate feedback)
  const displayDistance = distanceKm.toFixed(2);
  const displayMeters = Math.round(distanceKm * 1000);

  return (
    <div className="w-full flex flex-col space-y-3 animate-fade-in text-white select-none">
      {/* ---------------------------------------------------- */}
      {/* 1. TOP BAR                                           */}
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
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white block">
                {user?.username || 'Nexora Runner'}
              </span>
              <span className="text-[10px] font-extrabold text-[#D8FD2F] font-mono bg-[#D8FD2F]/10 px-2 py-0.5 rounded-md border border-[#D8FD2F]/20">
                ₱{(user?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
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

      {/* GPS Status & Screen Keep-Awake Bar */}
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

        {/* Keep Screen On Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !keepScreenOn;
              setKeepScreenOn(next);
              if (next && isTracking && !isPaused) requestWakeLock();
              else releaseWakeLock();
            }}
            title="Keep Screen Awake during workout"
            className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
              keepScreenOn ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30' : 'bg-white/5 text-slate-500'
            }`}
          >
            <SunMedium className="w-3 h-3" />
            <span>{keepScreenOn ? 'AWAKE ON' : 'AWAKE OFF'}</span>
          </button>

          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
              isDemoMode ? 'bg-amber-400 text-black' : 'bg-white/10 text-slate-400 hover:text-white'
            }`}
          >
            {isDemoMode ? 'DEMO' : 'DEMO'}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. REAL INTERACTIVE GOOGLE MAP                       */}
      {/* ---------------------------------------------------- */}
      <div className="relative w-full h-[320px] rounded-[32px] overflow-hidden border border-[#242A36] shadow-2xl bg-[#0F1318]">
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
            {equippedSneakerName} (+₱{earningRate.toFixed(2)}/km)
          </span>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. BOTTOM CONTROL SHEET                              */}
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
          {/* Big Distance Stat */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-white">
                {displayDistance}
              </span>
              <span className="text-sm font-bold text-slate-300">km</span>
            </div>
            {distanceKm > 0 && distanceKm < 0.5 && (
              <span className="text-[10px] font-mono font-bold text-[#D8FD2F] block">
                {displayMeters} meters walked
              </span>
            )}
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
                +₱{tokensEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* -------------------------------------------------- */}
        {/* 4. ACTIVITY MODE SELECTOR                           */}
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
      {/* ==================================================== */}
      {showGpsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151922] border border-[#2C3344] rounded-[32px] p-6 w-full max-w-sm text-white shadow-2xl relative space-y-4">
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

            <div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Turn On GPS / Location
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {gpsErrorMessage || 'Nexora Move Tracker requires real device GPS to track your outdoor running, calculate distance, and record your route on Google Maps.'}
              </p>
            </div>

            {/* Insecure context warning for iOS Safari */}
            {isInsecureContext && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-[11px] text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>iOS Safari Security Notice:</span>
                </div>
                <p className="leading-tight">
                  Apple iOS blocks GPS over plain HTTP. Tap <strong className="text-white">Start Run with Motion Sensors</strong> below to immediately track your steps, calories, pace, and tokens using your iPhone sensors!
                </p>
              </div>
            )}

            {/* Platform Instructions Card */}
            <div className="bg-[#0E1118] border border-[#232936] rounded-2xl p-3.5 text-[11px] space-y-2 text-slate-300">
              <div className="font-bold text-amber-300 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                <span>How to enable Location:</span>
              </div>
              <ul className="space-y-1.5 list-disc pl-4 text-slate-300 leading-normal">
                <li>
                  <strong className="text-white">iPhone (iOS Safari):</strong>
                  <div className="text-[10px] text-slate-300 mt-0.5 space-y-0.5">
                    <div>• <em>Settings &gt; Privacy &amp; Security &gt; Location Services</em> &gt; Turn <strong>ON</strong>.</div>
                    <div>• <em>Settings &gt; Safari &gt; Location</em> &gt; Set to <strong>Allow</strong>.</div>
                    <div>• In Safari, tap the <strong>aA</strong> / Settings icon in the search bar &gt; <em>Website Settings &gt; Location: Allow</em>.</div>
                  </div>
                </li>
                <li>
                  <strong className="text-white">Android / APK:</strong> Swipe down notification bar &gt; turn ON <span className="text-amber-300 font-bold">Location</span> &gt; Allow app permissions.
                </li>
                <li>
                  <strong className="text-white">Mobile Browser:</strong> Tap the lock or tune icon in the address bar &gt; Allow Location.
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleStartWorkoutClick}
                disabled={isRequestingPermission}
                className="w-full py-3.5 rounded-2xl bg-[#D8FD2F] hover:bg-[#c6ec22] text-[#0A0D11] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D8FD2F]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                <span>{isRequestingPermission ? 'Connecting to GPS...' : 'I Turned It On — Start Run'}</span>
              </button>

              <button
                onClick={handleStartWorkoutWithMotion}
                className="w-full py-3 rounded-2xl bg-[#1C2538] hover:bg-[#25324D] text-cyan-300 border border-cyan-500/30 font-extrabold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Start Run with Motion Sensors</span>
              </button>

              <button
                onClick={() => {
                  setShowGpsModal(false);
                  setIsDemoMode(true);
                  startWorkoutTracking();
                }}
                className="w-full py-2.5 rounded-2xl bg-[#1F2430] hover:bg-[#282F3F] text-slate-400 font-bold text-xs active:scale-95 transition-all border border-white/10"
              >
                Test With Indoor Simulator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. WORKOUT COMPLETED / REWARD CLAIMED MODAL          */}
      {/* ==================================================== */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151922] border border-[#2C3344] rounded-[32px] p-6 w-full max-w-sm text-white shadow-2xl relative space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D8FD2F]/20 border border-[#D8FD2F]/40 text-[#D8FD2F] flex items-center justify-center mx-auto shadow-lg shadow-[#D8FD2F]/15">
              <Sparkles className="w-7 h-7 text-[#D8FD2F] animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Workout Complete!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Your workout has ended and earnings have been credited to your balance.
              </p>
            </div>

            <div className="bg-[#0E1118] border border-[#232936] rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Reward Earned
              </span>
              <div className="text-3xl font-black font-mono text-[#D8FD2F]">
                +₱{lastWorkoutSummary.earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1C2230] text-center">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase">Distance</span>
                  <span className="text-xs font-mono font-bold text-white">{lastWorkoutSummary.distance} km</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase">Time</span>
                  <span className="text-xs font-mono font-bold text-white">{lastWorkoutSummary.time}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase">Burned</span>
                  <span className="text-xs font-mono font-bold text-orange-400">{lastWorkoutSummary.calories} kcal</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismissFinishModal}
              className="w-full py-3.5 rounded-2xl bg-[#D8FD2F] hover:bg-[#c6ec22] text-[#0A0D11] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D8FD2F]/20 active:scale-95 transition-all"
            >
              Collect & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackTab;

