import React, { useState, useEffect, useRef, useId } from 'react';
import {
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
  AlertTriangle,
  LocateFixed,
  Globe,
  Settings,
  X,
  SunMedium,
  Smartphone,
  Sparkles,
  Lock,
  ShoppingBag,
  Hourglass
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { User } from '../types/auth';
import { RUNNER_CATALOG, RunnerItem } from './market';
import { api, getApiBaseUrl } from '../services/api';
import { getActiveWorkoutStorageKey } from '../services/workoutStorage';
import { WorkoutSnapshot } from '../types/workout';
import { getOwnedRunnerInstances } from '../services/runnerInventory';

interface TrackTabProps {
  user?: User;
  isActiveTab?: boolean;
  onNavigateTab?: (tab: 'home' | 'market' | 'track' | 'team' | 'me') => void;
  equippedSneakerName?: string;
  onEquipSneaker?: (runner: RunnerItem) => void;
  onWorkoutFinish?: (earned: number, runnerIds?: string[]) => void;
}

type WorkoutMode = 'running' | 'cycling' | 'transit';
type MapLayerType = 'google-road' | 'google-hybrid' | 'google-sat';

const CONNECTION_CHECK_INTERVAL_MS = 10 * 1000;

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
  isActiveTab = true,
  onNavigateTab,
  onWorkoutFinish,
}) => {
  const activeWorkoutStorageKey = getActiveWorkoutStorageKey(user?.id);

  // Activity Mode
  const [selectedMode, setSelectedMode] = useState<WorkoutMode>('running');

  // Owned runners detection
  const runnerInstances = getOwnedRunnerInstances(user?.ownedRunners);
  const ownedRunners = runnerInstances.flatMap((instance) => {
    const catalogRunner = RUNNER_CATALOG.find((runner) => runner.id === instance.runnerId);
    return catalogRunner
      ? [{ ...catalogRunner, id: instance.id, serial: `#${instance.serial}` }]
      : [];
  });
  const runnerInventoryKey = runnerInstances.map((runner) => `${runner.id}:${runner.serial}`).join(',');
  const normalizeRunnerIds = (runnerIds: string[]) => runnerIds.map((runnerId) =>
    runnerInstances.find((runner) => runner.id === runnerId || runner.runnerId === runnerId)?.id || runnerId
  );
  const eligibleOwnedRunners = ownedRunners.filter((runner) => (user?.runnerCooldowns?.[runner.id] || 0) <= Date.now());

  // Determine initial selected runner
  const [selectedRunnerIds, setSelectedRunnerIds] = useState<string[]>(() => {
    if (user?.equippedRunnerId && eligibleOwnedRunners.some((runner) => runner.id === user.equippedRunnerId)) {
      return [user.equippedRunnerId];
    }
    return eligibleOwnedRunners[0] ? [eligibleOwnedRunners[0].id] : [];
  });
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [workoutSyncError, setWorkoutSyncError] = useState('');
  const [isWorkoutHydrated, setIsWorkoutHydrated] = useState(false);

  // Keep the selection limited to owned runners when account data changes.
  useEffect(() => {
    if (isTrackingRef.current || showFinishModal) return;
    setSelectedRunnerIds((current) => {
      const retained = current.filter((runnerId) => eligibleOwnedRunners.some((runner) => runner.id === runnerId));
      if (retained.length > 0) return retained;
      const fallbackId = user?.equippedRunnerId && eligibleOwnedRunners.some((runner) => runner.id === user.equippedRunnerId)
        ? user.equippedRunnerId
        : eligibleOwnedRunners[0]?.id;
      return fallbackId ? [fallbackId] : [];
    });
  }, [user?.equippedRunnerId, user?.runnerCooldowns, runnerInventoryKey, showFinishModal]);

  const selectedRunners = ownedRunners.filter((runner) => selectedRunnerIds.includes(runner.id));
  const selectedRunnerNames = selectedRunners.map((runner) => `${runner.name} ${runner.serial}`).join(' + ');
  const selectedEarningRate = selectedRunners.reduce((total, runner) => total + runner.earningRate, 0);
  const workoutDistanceLimit = selectedRunners.reduce((total, runner) => total + runner.kmLimitPerDay, 0);
  const selectedRunnersRef = useRef<RunnerItem[]>(selectedRunners);
  selectedRunnersRef.current = selectedRunners;

  // Workout Finish Modal & Last Summary State
  const [lastWorkoutSummary, setLastWorkoutSummary] = useState({
    earned: 0,
    distance: '0.00',
    time: '00:00',
    calories: 0,
    runnerName: '',
  });
  const [sessionRunnerIds, setSessionRunnerIds] = useState<string[]>([]);

  // Workout state
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine
  );

  // Stats
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0.0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [tokensEarned, setTokensEarned] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const latestWorkoutStatsRef = useRef({ caloriesBurned, tokensEarned });
  latestWorkoutStatsRef.current = { caloriesBurned, tokensEarned };

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'active' | 'denied'>('idle');
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState<string | null>(null);

  // Watch references (Capacitor native string ID vs Web number ID)
  const nativeWatchIdRef = useRef<string | null>(null);
  const webWatchIdRef = useRef<number | null>(null);

  // Insecure context detection
  const isInsecureContext = typeof window !== 'undefined'
    ? (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    : false;

  // Modal to request turning on GPS / Location
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Screen Wake Lock & Keep Screen Awake state
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const wakeLockRef = useRef<any>(null);

  // Map settings
  const [mapLayer, setMapLayer] = useState<MapLayerType>('google-road');

  // CRITICAL REFS to prevent stale closures and preserve state across background/tab changes
  const isTrackingRef = useRef(false);
  const isPausedRef = useRef(false);
  const totalDistanceKmRef = useRef<number>(0.0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const motionStepCountRef = useRef<number>(0);
  const gpsStepCountRef = useRef<number>(0);
  const routePointsRef = useRef<[number, number][]>([]);

  // Timing refs
  const workoutStartTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const sessionRunnerIdsRef = useRef<string[]>([]);
  const finishWasPausedRef = useRef(false);
  const remoteWorkoutSyncChainRef = useRef<Promise<void>>(Promise.resolve());

  // Leaflet map refs
  const rawId = useId();
  const mapElementId = useRef(`map_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.floor(Math.random() * 10000)}`).current;
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const googleTileLayerRef = useRef<L.TileLayer | null>(null);

  // Pedometer refs
  const lastAccelMagnitudeRef = useRef<number>(9.8);
  const pedometerPeakArmedRef = useRef<boolean>(true);
  const lastStepTimestampRef = useRef<number>(0);

  // Helper: check if a runner is in 24h cooldown
  const getRunnerCooldown = (runnerId: string) => {
    const cd = user?.runnerCooldowns?.[runnerId] || 0;
    const now = Date.now();
    if (cd > now) {
      const diff = cd - now;
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return { isCooling: true, remaining: `${h}h ${m}m`, cdTimestamp: cd };
    }
    return { isCooling: false, remaining: '', cdTimestamp: cd };
  };

  const coolingSelectedRunners = selectedRunners.filter((runner) => getRunnerCooldown(runner.id).isCooling);

  const calculateWorkoutEarnings = (distance: number, runners = selectedRunnersRef.current) =>
    Number(runners.reduce((total, runner) => total + Math.min(distance, runner.kmLimitPerDay) * runner.earningRate, 0).toFixed(2));

  // --------------------------------------------------------------------------
  // 1. SAVE/RESTORE ACTIVE WORKOUT SESSION (Background / Reload persistence)
  // --------------------------------------------------------------------------
  const queueRemoteWorkoutSnapshot = (snapshot: WorkoutSnapshot): Promise<void> => {
    const nextSync = remoteWorkoutSyncChainRef.current
      .catch(() => undefined)
      .then(() => api.saveWorkoutSnapshot(snapshot))
      .then(() => undefined)
      .catch((error) => {
        console.warn('[Workout Snapshot Sync] Failed to save workout progress to the account.', error);
      });
    remoteWorkoutSyncChainRef.current = nextSync;
    return nextSync;
  };

  const saveWorkoutSnapshot = (
    pendingFinish = false,
    summary = lastWorkoutSummary,
    syncRemotely = false
  ): Promise<void> => {
    if ((!isTrackingRef.current && !pendingFinish) || !activeWorkoutStorageKey || !user?.id) {
      return Promise.resolve();
    }
    const now = Date.now();
    const activePauseDuration = isPausedRef.current && pauseStartTimeRef.current > 0
      ? now - pauseStartTimeRef.current
      : 0;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current - activePauseDuration) / 1000)
    );
    const snapshot: WorkoutSnapshot = {
        accountId: user.id,
        runnerIds: sessionRunnerIdsRef.current.length > 0
          ? sessionRunnerIdsRef.current
          : selectedRunnersRef.current.map((runner) => runner.id),
        isTracking: isTrackingRef.current,
        pendingFinish,
        pendingWasPaused: finishWasPausedRef.current,
        lastWorkoutSummary: summary,
        isPaused: isPausedRef.current,
        workoutStartTime: workoutStartTimeRef.current,
        pauseStartTime: pauseStartTimeRef.current,
        pausedDuration: pausedDurationRef.current,
        elapsedSeconds,
        distanceKm: totalDistanceKmRef.current,
        stepCount: Math.max(motionStepCountRef.current, gpsStepCountRef.current),
        caloriesBurned: latestWorkoutStatsRef.current.caloriesBurned,
        tokensEarned: latestWorkoutStatsRef.current.tokensEarned,
        routePoints: routePointsRef.current.slice(-1000),
        lastUpdated: now,
    };
    try {
      localStorage.setItem(activeWorkoutStorageKey, JSON.stringify({
        ...snapshot,
        routePoints: routePointsRef.current,
      }));
    } catch (e) {
      console.warn('[Workout Snapshot] Failed to save workout progress locally.', e);
    }
    return syncRemotely ? queueRemoteWorkoutSnapshot(snapshot) : Promise.resolve();
  };

  const restoreWorkoutSnapshot = (data: WorkoutSnapshot, forcePaused: boolean) => {
    const restoredRunnerIds = normalizeRunnerIds(data.runnerIds || []);
    if (data.pendingFinish) {
      if (data.lastWorkoutSummary) setLastWorkoutSummary(data.lastWorkoutSummary);
      sessionRunnerIdsRef.current = restoredRunnerIds;
      setSessionRunnerIds(restoredRunnerIds);
      finishWasPausedRef.current = !!data.pendingWasPaused;
      if (restoredRunnerIds.length) setSelectedRunnerIds(restoredRunnerIds);
      setIsTracking(false);
      isTrackingRef.current = false;
      isPausedRef.current = false;
      setIsPaused(false);
      setShowFinishModal(true);
      releaseWakeLock();
      void stopContinuousGpsWatch();
      return;
    }
    if (!data.isTracking || !data.workoutStartTime) return;

    const now = Date.now();
    const savedElapsedSeconds = Number.isFinite(data.elapsedSeconds)
      ? data.elapsedSeconds
      : Math.max(
          0,
          Math.floor((now - data.workoutStartTime - (data.pausedDuration || 0) -
            (data.isPaused && data.pauseStartTime ? now - data.pauseStartTime : 0)) / 1000)
        );
    const shouldPause = forcePaused || data.isPaused;

    isTrackingRef.current = true;
    isPausedRef.current = shouldPause;
    workoutStartTimeRef.current = forcePaused
      ? now - savedElapsedSeconds * 1000
      : data.workoutStartTime;
    pauseStartTimeRef.current = shouldPause ? now : 0;
    pausedDurationRef.current = forcePaused ? 0 : data.pausedDuration || 0;
    totalDistanceKmRef.current = data.distanceKm || 0;
    motionStepCountRef.current = data.stepCount || 0;
    gpsStepCountRef.current = data.stepCount || 0;
    routePointsRef.current = data.routePoints || [];
    sessionRunnerIdsRef.current = restoredRunnerIds;
    setSessionRunnerIds(restoredRunnerIds);
    if (restoredRunnerIds.length) setSelectedRunnerIds(restoredRunnerIds);
    setIsTracking(true);
    setIsPaused(shouldPause);
    setDistanceKm(data.distanceKm || 0);
    setStepCount(data.stepCount || 0);
    setCaloriesBurned(data.caloriesBurned || 0);
    setTokensEarned(data.tokensEarned || 0);
    latestWorkoutStatsRef.current = {
      caloriesBurned: data.caloriesBurned || 0,
      tokensEarned: data.tokensEarned || 0,
    };
    setSecondsElapsed(savedElapsedSeconds);

    if (!shouldPause) {
      startContinuousGpsWatch();
      requestWakeLock();
    }
  };

  // Restore local state immediately, then reconcile it with the account snapshot.
  useEffect(() => {
    if (!activeWorkoutStorageKey || !user?.id) {
      setIsWorkoutHydrated(true);
      return;
    }
    let isCancelled = false;
    let localSnapshot: WorkoutSnapshot | null = null;
    try {
      const saved = localStorage.getItem(activeWorkoutStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as WorkoutSnapshot;
        if (parsed.accountId === user.id) {
          localSnapshot = parsed;
          restoreWorkoutSnapshot(parsed, false);
        }
      }
    } catch (err) {
      console.warn('Failed restoring workout session:', err);
    }

    if (!navigator.onLine) {
      setIsWorkoutHydrated(true);
      return () => {
        isCancelled = true;
      };
    }

    api.getWorkoutSnapshot().then(({ workoutSnapshot }) => {
      if (isCancelled || !workoutSnapshot) return;
      if (!localSnapshot || workoutSnapshot.lastUpdated > localSnapshot.lastUpdated) {
        restoreWorkoutSnapshot(workoutSnapshot, true);
        if (workoutSnapshot.pendingFinish) {
          void queueRemoteWorkoutSnapshot(workoutSnapshot);
        } else {
          void saveWorkoutSnapshot(false, workoutSnapshot.lastWorkoutSummary, true);
        }
      } else {
        void queueRemoteWorkoutSnapshot(localSnapshot);
      }
    }).catch((error) => {
      console.warn('[Workout Snapshot Sync] Failed to retrieve account workout progress.', error);
    }).finally(() => {
      if (!isCancelled) setIsWorkoutHydrated(true);
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  // When tab visibility changes or user refocuses, recompute elapsed time
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (isTrackingRef.current && !isPausedRef.current && workoutStartTimeRef.current > 0) {
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current) / 1000));
        setSecondsElapsed(elapsed);
        void saveWorkoutSnapshot(false, lastWorkoutSummary, true);
      }
      if (isActiveTab && mapRef.current) {
        setTimeout(() => mapRef.current?.invalidateSize(), 200);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [isActiveTab]);

  // When switching back to TrackTab, resize map so tiles are sharp
  useEffect(() => {
    if (isActiveTab && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
  }, [isActiveTab]);

  // --------------------------------------------------------------------------
  // 2. SCREEN WAKE LOCK
  // --------------------------------------------------------------------------
  const requestWakeLock = async () => {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      } catch (err) {
        console.warn('Wake Lock request notice:', err);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch (err) {}
      wakeLockRef.current = null;
    }
  };

  // --------------------------------------------------------------------------
  // 3. MAP INITIALIZATION & TILE LAYERS
  // --------------------------------------------------------------------------
  const getGoogleLayerUrl = (type: MapLayerType): string => {
    switch (type) {
      case 'google-hybrid':
        return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      case 'google-sat':
        return 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      case 'google-road':
      default:
        return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    }
  };

  useEffect(() => {
    if (mapRef.current) return;
    const container = document.getElementById(`map-${mapElementId}`);
    if (!container) return;

    const defaultLat = 14.5995;
    const defaultLng = 120.9842;

    const map = L.map(container, {
      center: [defaultLat, defaultLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    const tileLayer = L.tileLayer(getGoogleLayerUrl(mapLayer), {
      maxZoom: 21,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    googleTileLayerRef.current = tileLayer;

    const polyline = L.polyline([], {
      color: '#00E5FF',
      weight: 5,
      opacity: 0.9,
      smoothFactor: 1,
    }).addTo(map);
    polyline.setLatLngs(routePointsRef.current);
    routePolylineRef.current = polyline;

    mapRef.current = map;
    checkInitialGps();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapElementId]);

  useEffect(() => {
    if (!mapRef.current || !googleTileLayerRef.current) return;
    googleTileLayerRef.current.setUrl(getGoogleLayerUrl(mapLayer));
  }, [mapLayer]);

  const updateMapMarker = (lat: number, lng: number, accuracy?: number) => {
    if (!mapRef.current) return;

    if (!markerRef.current) {
      const pulsingIcon = L.divIcon({
        className: 'custom-gps-pin',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; inset: -4px; background: rgba(0, 229, 255, 0.4); border-radius: 9999px; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; inset: 0; background: #00E5FF; border: 3px solid #FFFFFF; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      markerRef.current = L.marker([lat, lng], { icon: pulsingIcon }).addTo(mapRef.current);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }

    if (accuracy && accuracy <= 100) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle([lat, lng], {
          radius: accuracy,
          color: '#00E5FF',
          fillColor: '#00E5FF',
          fillOpacity: 0.12,
          weight: 1.5,
        }).addTo(mapRef.current);
      } else {
        accuracyCircleRef.current.setLatLng([lat, lng]);
        accuracyCircleRef.current.setRadius(accuracy);
      }
    }
  };

  const getDevicePosition = async (): Promise<{ latitude: number; longitude: number; accuracy: number; speed: number | null }> => {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        const req = await Geolocation.requestPermissions();
        if (req.location !== 'granted') {
          throw new Error('Location permission is denied.');
        }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
        speed: pos.coords.speed,
      };
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
              speed: pos.coords.speed,
            });
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
        );
      });
    }

    throw new Error('Geolocation is not supported on this device.');
  };

  const checkInitialGps = async () => {
    try {
      setGpsStatus('searching');
      const pos = await getDevicePosition();
      setRealCoords({ lat: pos.latitude, lng: pos.longitude, accuracy: pos.accuracy });
      setGpsStatus('active');
      lastPositionRef.current = { lat: pos.latitude, lng: pos.longitude };

      if (mapRef.current) {
        mapRef.current.setView([pos.latitude, pos.longitude], 17);
        updateMapMarker(pos.latitude, pos.longitude, pos.accuracy);
      }
    } catch (err: any) {
      setGpsStatus('idle');
      console.warn('Initial GPS check:', err?.message || err);
    }
  };

  // --------------------------------------------------------------------------
  // 4. ACCELEROMETER HARDWARE PEDOMETER (Background Steps)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!isTrackingRef.current || isPausedRef.current) return;

      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      const delta = magnitude - lastAccelMagnitudeRef.current;
      lastAccelMagnitudeRef.current = magnitude;

      const now = Date.now();
      const minStepIntervalMs = 280;

      if (delta > 2.2 && pedometerPeakArmedRef.current && (now - lastStepTimestampRef.current > minStepIntervalMs)) {
        lastStepTimestampRef.current = now;
        pedometerPeakArmedRef.current = false;
        motionStepCountRef.current += 1;

        const totalSteps = Math.max(motionStepCountRef.current, gpsStepCountRef.current);
        setStepCount(totalSteps);

        const motionDistanceKm = Number((totalSteps * 0.00074).toFixed(3));
        const runners = selectedRunnersRef.current;
        const currentLimit = runners.reduce((total, runner) => total + runner.kmLimitPerDay, 0);

        if (currentLimit > 0 && totalDistanceKmRef.current < motionDistanceKm) {
          const cappedDist = Math.min(motionDistanceKm, currentLimit);
          totalDistanceKmRef.current = cappedDist;
          setDistanceKm(cappedDist);
          setTokensEarned(calculateWorkoutEarnings(cappedDist, runners));
        }

        setCaloriesBurned(Math.max(Math.round(totalDistanceKmRef.current * 62), Math.round(totalSteps * 0.04)));
        saveWorkoutSnapshot();
      }

      if (delta < -1.2) {
        pedometerPeakArmedRef.current = true;
      }
    };

    if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    }
    return () => {
      if (typeof window !== 'undefined' && window.DeviceMotionEvent) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // 5. GPS FIX HANDLER
  // --------------------------------------------------------------------------
  const handleNewGpsFix = (lat: number, lng: number, accuracy: number, speed: number | null) => {
    setRealCoords({ lat, lng, accuracy });
    setGpsStatus('active');

    if (mapRef.current) {
      updateMapMarker(lat, lng, accuracy);
    }

    if (speed !== null && speed >= 0) {
      setCurrentSpeedKmh(Number((speed * 3.6).toFixed(1)));
    }

    if (isTrackingRef.current && !isPausedRef.current) {
      if (lastPositionRef.current) {
        const delta = calculateHaversineKm(
          lastPositionRef.current.lat,
          lastPositionRef.current.lng,
          lat,
          lng
        );

        const hasGoodAccuracy = accuracy <= 35;
        const hasMovedSignificantly = delta >= 0.005;
        const isGenuineMovement = speed === null || speed >= 0.4 || delta >= 0.008;

        if (hasGoodAccuracy && hasMovedSignificantly && isGenuineMovement) {
          const runners = selectedRunnersRef.current;
          const currentLimit = runners.reduce((total, runner) => total + runner.kmLimitPerDay, 0);

          const rawTotal = totalDistanceKmRef.current + delta;
          const cappedDist = Math.min(rawTotal, currentLimit);
          if (currentLimit <= 0) return;
          totalDistanceKmRef.current = cappedDist;

          setDistanceKm(cappedDist);

          const stepsFromGps = Math.floor(cappedDist * 1350);
          gpsStepCountRef.current = stepsFromGps;
          const combinedSteps = Math.max(motionStepCountRef.current, stepsFromGps);
          setStepCount(combinedSteps);

          const cals = Math.max(Math.round(cappedDist * 62), Math.round(combinedSteps * 0.04));
          setCaloriesBurned(cals);

          setTokensEarned(calculateWorkoutEarnings(cappedDist, runners));

          routePointsRef.current.push([lat, lng]);
          if (routePolylineRef.current) {
            routePolylineRef.current.setLatLngs(routePointsRef.current);
          }

          lastPositionRef.current = { lat, lng };

          if (mapRef.current) {
            mapRef.current.panTo([lat, lng]);
          }

          saveWorkoutSnapshot();
        }
      } else {
        lastPositionRef.current = { lat, lng };
      }
    }
  };

  // --------------------------------------------------------------------------
  // 6. CONTINUOUS GPS WATCH
  // --------------------------------------------------------------------------
  const startContinuousGpsWatch = async () => {
    stopContinuousGpsWatch();

    if (Capacitor.isNativePlatform()) {
      try {
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true },
          (position: Position | null, err) => {
            if (err || !position || !position.coords) return;
            handleNewGpsFix(
              position.coords.latitude,
              position.coords.longitude,
              Math.round(position.coords.accuracy),
              position.coords.speed
            );
          }
        );
        nativeWatchIdRef.current = watchId;
      } catch (e) {
        console.warn('Native watchPosition failed:', e);
      }
      return;
    }

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
          (err) => console.warn('Web watchPosition:', err.message),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
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

  // --------------------------------------------------------------------------
  // 7. START WORKOUT
  // --------------------------------------------------------------------------
  const handleStartWorkoutClick = async () => {
    if (ownedRunners.length === 0) {
      if (onNavigateTab) onNavigateTab('market');
      return;
    }

    if (selectedRunners.length === 0 || coolingSelectedRunners.length > 0) {
      return;
    }

    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        await (DeviceMotionEvent as any).requestPermission();
      } catch (e) {}
    }

    setIsRequestingPermission(true);
    setGpsErrorMessage(null);

    try {
      setGpsStatus('searching');
      const pos = await getDevicePosition();

      const { latitude, longitude, accuracy } = pos;
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
        setGpsErrorMessage('Location permission was denied. Please allow location access in your browser or device settings.');
      } else if (msg.includes('unavailable') || err?.code === 2) {
        setGpsErrorMessage('Your device GPS / Location is turned OFF. Please turn on Location in Settings.');
      } else {
        setGpsErrorMessage(msg || 'Could not connect to GPS satellites.');
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleStartWorkoutWithMotion = async () => {
    if (selectedRunners.length === 0 || coolingSelectedRunners.length > 0) return;
    if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
      try {
        await (DeviceMotionEvent as any).requestPermission();
      } catch (e) {}
    }

    setShowGpsModal(false);
    setGpsStatus('searching');
    startWorkoutTracking();
    startContinuousGpsWatch();
  };

  const startWorkoutTracking = () => {
    sessionRunnerIdsRef.current = selectedRunnersRef.current.map((runner) => runner.id);
    setSessionRunnerIds(sessionRunnerIdsRef.current);
    isTrackingRef.current = true;
    isPausedRef.current = false;
    setIsTracking(true);
    setIsPaused(false);

    workoutStartTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    pauseStartTimeRef.current = 0;

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

    void saveWorkoutSnapshot(false, lastWorkoutSummary, true);
  };

  // --------------------------------------------------------------------------
  // 8. PAUSE & RESUME WORKOUT (Allows leaving and coming back)
  // --------------------------------------------------------------------------
  const pauseWorkout = (syncRemotely = false): Promise<void> => {
    if (!isTrackingRef.current) return Promise.resolve();
    if (isPausedRef.current) {
      return syncRemotely
        ? saveWorkoutSnapshot(false, lastWorkoutSummary, true)
        : Promise.resolve();
    }
    const now = Date.now();
    setSecondsElapsed(Math.max(
      0,
      Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current) / 1000)
    ));
    pauseStartTimeRef.current = now;
    isPausedRef.current = true;
    setIsPaused(true);
    releaseWakeLock();
    void stopContinuousGpsWatch();
    return saveWorkoutSnapshot(false, lastWorkoutSummary, syncRemotely);
  };

  const handlePauseWorkout = () => {
    if (isPausedRef.current) {
      if (isOffline) return;
      if (pauseStartTimeRef.current > 0) {
        pausedDurationRef.current += Date.now() - pauseStartTimeRef.current;
      }
      pauseStartTimeRef.current = 0;
      isPausedRef.current = false;
      setIsPaused(false);
      if (keepScreenOn) requestWakeLock();
      void startContinuousGpsWatch();
      void saveWorkoutSnapshot(false, lastWorkoutSummary, true);
      return;
    }
    void pauseWorkout(true);
  };

  // --------------------------------------------------------------------------
  // 9. END & EARN -> OPEN CELEBRATION MODAL
  // --------------------------------------------------------------------------
  const handleFinishWorkout = async () => {
    if (!isTrackingRef.current) return;
    const now = Date.now();
    const activePauseDuration = isPausedRef.current && pauseStartTimeRef.current > 0
      ? now - pauseStartTimeRef.current
      : 0;
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current - activePauseDuration) / 1000)
    );
    setSecondsElapsed(elapsedSeconds);
    finishWasPausedRef.current = isPausedRef.current;
    const summary = {
      earned: Math.round(latestWorkoutStatsRef.current.tokensEarned * 100) / 100,
      distance: totalDistanceKmRef.current.toFixed(2),
      time: formatTime(elapsedSeconds),
      calories: latestWorkoutStatsRef.current.caloriesBurned,
      runnerName: selectedRunnersRef.current.map((runner) => runner.name).join(' + ') || 'Runner',
    };
    isTrackingRef.current = false;
    isPausedRef.current = false;
    setIsTracking(false);
    setIsPaused(false);
    releaseWakeLock();

    await stopContinuousGpsWatch();

    setLastWorkoutSummary(summary);
    setShowFinishModal(true);
    await saveWorkoutSnapshot(true, summary, true);
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      pauseWorkout();
    };
    const handleLogout = (event: Event) => {
      const detail = (event as CustomEvent<{ waitUntil?: (promise: Promise<void>) => void }>).detail;
      const persistence = pauseWorkout(true);
      detail?.waitUntil?.(persistence);
    };
    window.addEventListener('nexora:session-expired', handleSessionExpired);
    window.addEventListener('nexora:logout', handleLogout);
    return () => {
      window.removeEventListener('nexora:session-expired', handleSessionExpired);
      window.removeEventListener('nexora:logout', handleLogout);
    };
  }, []);

  useEffect(() => {
    let isCheckingConnection = false;
    const shouldMonitorConnection = isTracking;

    const markOffline = () => {
      setIsOffline(true);
      if (!isTrackingRef.current) return;
      pauseWorkout();
      saveWorkoutSnapshot();
    };

    const markOnline = () => {
      setIsOffline(false);
      void saveWorkoutSnapshot(false, lastWorkoutSummary, isTrackingRef.current);
    };

    const checkConnection = async () => {
      if (isCheckingConnection) return;
      if (!navigator.onLine) {
        markOffline();
        return;
      }

      isCheckingConnection = true;
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/health`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
        markOnline();
      } catch {
        markOffline();
      } finally {
        window.clearTimeout(timeoutId);
        isCheckingConnection = false;
      }
    };

    const handleOnline = () => void checkConnection();
    window.addEventListener('offline', markOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleOnline);

    if (!navigator.onLine) markOffline();
    else if (shouldMonitorConnection) void checkConnection();

    const intervalId = shouldMonitorConnection
      ? window.setInterval(() => void checkConnection(), CONNECTION_CHECK_INTERVAL_MS)
      : null;
    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      window.removeEventListener('offline', markOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleOnline);
    };
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking || isOffline) return;
    const intervalId = window.setInterval(() => {
      void saveWorkoutSnapshot(false, lastWorkoutSummary, true);
    }, 10_000);
    return () => window.clearInterval(intervalId);
  }, [isTracking, isOffline]);

  const handleCancelFinish = () => {
    setShowFinishModal(false);
    isTrackingRef.current = true;
    isPausedRef.current = finishWasPausedRef.current;
    setIsTracking(true);
    setIsPaused(finishWasPausedRef.current);

    if (finishWasPausedRef.current) {
      const now = Date.now();
      if (pauseStartTimeRef.current > 0) {
        pausedDurationRef.current += now - pauseStartTimeRef.current;
      }
      pauseStartTimeRef.current = now;
      releaseWakeLock();
    } else {
      pauseStartTimeRef.current = 0;
      void startContinuousGpsWatch();
      if (keepScreenOn) requestWakeLock();
    }
    void saveWorkoutSnapshot(false, lastWorkoutSummary, true);
  };

  // --------------------------------------------------------------------------
  // 10. COLLECT & CONTINUE (Claims reward, sets 24h cooldown, resets)
  // --------------------------------------------------------------------------
  const handleCollectAndContinue = async () => {
    setWorkoutSyncError('');
    try {
      await remoteWorkoutSyncChainRef.current;
      await api.clearWorkoutSnapshot();
    } catch (error) {
      console.error('[Workout Snapshot Sync] Failed to clear the collected workout.', error);
      setWorkoutSyncError('Could not sync your workout to your account. Check your connection and try again.');
      return;
    }

    setShowFinishModal(false);

    const finalEarned = lastWorkoutSummary.earned;
    const runnerIds = sessionRunnerIdsRef.current.length > 0
      ? sessionRunnerIdsRef.current
      : sessionRunnerIds;

    onWorkoutFinish?.(finalEarned, runnerIds);

    // Clear active workout session
    try {
      if (activeWorkoutStorageKey) localStorage.removeItem(activeWorkoutStorageKey);
    } catch (e) {}
    window.dispatchEvent(new Event('nexora:workout-safe-to-update'));
    sessionRunnerIdsRef.current = [];
    setSessionRunnerIds([]);
    setSelectedRunnerIds((current) => current.filter((runnerId) => !runnerIds.includes(runnerId)));

    // Reset stats for next session
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
  // 11. TIMER INTERVAL
  // --------------------------------------------------------------------------
  useEffect(() => {
    let interval: any = null;
    if (isTracking && !isPaused) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.max(0, Math.floor((now - workoutStartTimeRef.current - pausedDurationRef.current) / 1000));
        setSecondsElapsed(elapsed);
        saveWorkoutSnapshot();
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

  const displayDistance = distanceKm.toFixed(2);
  const displayMeters = Math.round(distanceKm * 1000);
  const currentLimit = workoutDistanceLimit;
  const isLimitReached = currentLimit > 0 && distanceKm >= currentLimit;

  return (
    <div className="w-full flex flex-col space-y-3 animate-fade-in text-white select-none pb-4">
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
                {user?.username || 'Nexora Member'}
              </span>
              <span className="text-[10px] font-extrabold text-[#D8FD2F] font-mono bg-[#D8FD2F]/10 px-2 py-0.5 rounded-md border border-[#D8FD2F]/20">
                ₱{(user?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Center Title */}
        <h2 className="text-base font-extrabold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
          GPS Track
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

      {/* GPS Status & Screen Keep-Awake Bar (DEMO REMOVED) */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#12161F] border border-[#232936] rounded-xl text-[11px]">
        <div className="flex items-center gap-2">
          <Radio className={`w-3.5 h-3.5 ${gpsStatus === 'active' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="font-semibold text-slate-300">
            {gpsStatus === 'active' && realCoords
              ? `GPS Locked: ${realCoords.lat.toFixed(4)}, ${realCoords.lng.toFixed(4)} (±${realCoords.accuracy}m)`
              : gpsStatus === 'searching'
              ? 'Connecting to GPS Satellites...'
              : 'GPS Standby'}
          </span>
        </div>

        {/* Keep Screen On Toggle Button */}
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

        {/* Floating Live Runner Equipped Badge */}
        {selectedRunners.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#11141B]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/15 shadow-lg">
            <Zap className="w-3.5 h-3.5 text-[#D8FD2F]" />
            <span className="text-[10px] font-extrabold text-white">
              {selectedRunners.length} Runners (+₱{selectedEarningRate.toFixed(2)}/km)
            </span>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. BOTTOM CONTROL SHEET                              */}
      {/* ---------------------------------------------------- */}
      <div className="bg-[#171A21] rounded-[32px] p-4 sm:p-5 border border-[#232731] shadow-2xl space-y-4">
        
        {/* REPLACED SEARCH BAR: CHOOSE AVAILABLE RUNNERS */}
        {!isTracking ? (
          <div>
            {ownedRunners.length === 0 ? (
              /* LOCKED STATE: NO RUNNERS OWNED */
              <div className="bg-[#10141D] border border-amber-500/40 rounded-2xl p-4 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Runners Required to Workout</h4>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    You do not own any Runners yet. Purchase a Runner in the Marketplace to enable Track and start earning rewards!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab ? onNavigateTab('market') : null}
                  className="w-full py-2.5 rounded-xl bg-[#D8FD2F] hover:bg-[#cbf128] text-black font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Go to Marketplace</span>
                </button>
              </div>
            ) : (
              /* RUNNER SELECTOR */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    Choose Runners ({ownedRunners.length} Owned)
                  </span>
                  {selectedRunners.length > 0 && (
                    <span className="text-cyan-400 font-extrabold text-[10px]">
                      {selectedRunners.length} selected · +₱{selectedEarningRate.toFixed(2)}/km · {workoutDistanceLimit} KM max
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {ownedRunners.map((runner) => {
                    const isSelected = selectedRunnerIds.includes(runner.id);
                    const cdInfo = getRunnerCooldown(runner.id);

                    return (
                      <button
                        key={runner.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedRunnerIds((current) => {
                          if (current.includes(runner.id)) return current.filter((id) => id !== runner.id);
                          if (cdInfo.isCooling) return current;
                          return [...current, runner.id];
                        })}
                        className={`p-2.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                          isSelected && cdInfo.isCooling
                            ? 'bg-red-950/30 border-red-500/50'
                            : cdInfo.isCooling
                            ? 'bg-[#12151D] border-red-500/30 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-[#1C263A] border-[#D8FD2F] shadow-lg shadow-[#D8FD2F]/10'
                            : 'bg-[#161A22] border-[#292F3D] hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <img
                            src={runner.image}
                            alt={runner.name}
                            className="w-8 h-8 object-contain rounded-lg bg-[#0E121A] p-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <h5 className="text-[11px] font-black text-white truncate">
                              {runner.name} {runner.serial}
                            </h5>
                            <span className="text-[9px] font-mono text-emerald-400 font-bold block">
                              +₱{runner.earningRate.toFixed(2)}/km
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[9px] font-bold border-t border-white/5 pt-1">
                          <span className="text-slate-400">
                            Max {runner.kmLimitPerDay}KM
                          </span>
                          {cdInfo.isCooling ? (
                            <span className="text-red-400 flex items-center gap-0.5 font-mono">
                              <Hourglass className="w-2.5 h-2.5" />
                              {cdInfo.remaining}
                            </span>
                          ) : isSelected ? (
                            <span className="text-[#D8FD2F] font-black uppercase">
                              SELECTED · REMOVE
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              READY
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE RUNNER DISPLAY WHEN TRACKING */
          selectedRunners.length > 0 && (
            <div className="bg-[#121620] border border-[#252C3D] rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={selectedRunners[0].image}
                  alt={selectedRunnerNames}
                  className="w-10 h-10 object-contain rounded-xl bg-[#090C12] p-1 border border-white/10"
                />
                <div>
                  <h4 className="text-xs font-black text-white">{selectedRunnerNames}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono mt-0.5">
                    <span className="text-emerald-400 font-bold">+₱{selectedEarningRate.toFixed(2)}/km combined</span>
                    <span>•</span>
                    <span>Max: {workoutDistanceLimit}KM</span>
                  </div>
                </div>
              </div>

              {isLimitReached && (
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg text-[9px] font-black uppercase">
                  Daily Limit Reached
                </span>
              )}
            </div>
          )
        )}

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
              {workoutDistanceLimit > 0 && (
                <span className="text-xs font-mono font-bold text-slate-400 ml-1">
                  / {workoutDistanceLimit} km
                </span>
              )}
            </div>
            {distanceKm > 0 && distanceKm < 0.5 && (
              <span className="text-[10px] font-mono font-bold text-[#D8FD2F] block">
                {displayMeters} meters walked
              </span>
            )}
            {isLimitReached && (
              <span className="text-[10px] font-bold text-amber-400 block animate-pulse">
                Daily KM Limit Achieved! Click End & Earn to claim.
              </span>
            )}
          </div>

          {/* Action Button */}
          {!isTracking ? (
            ownedRunners.length === 0 ? (
              <button
                type="button"
                onClick={() => onNavigateTab ? onNavigateTab('market') : null}
                className="px-5 py-3 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-2 font-extrabold text-xs shadow-lg transition-all"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Buy Runner First</span>
              </button>
            ) : selectedRunners.length === 0 ? (
              <button
                disabled
                className="px-5 py-3 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-2 font-extrabold text-xs cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Select a Runner</span>
              </button>
            ) : coolingSelectedRunners.length > 0 ? (
              <button
                disabled
                className="px-5 py-3 rounded-full bg-red-950/60 text-red-300 border border-red-500/30 flex items-center gap-1.5 font-extrabold text-xs cursor-not-allowed"
              >
                <Hourglass className="w-4 h-4 text-red-400" />
                <span>Deselect cooling Runners</span>
              </button>
            ) : (
              <button
                onClick={handleStartWorkoutClick}
                disabled={isRequestingPermission || !isWorkoutHydrated}
                className="px-5 py-3 rounded-full bg-[#353E2B] hover:bg-[#434F35] text-[#D8FD2F] border border-[#D8FD2F]/40 flex items-center gap-2 font-extrabold text-xs shadow-lg transition-all active:scale-95 group"
              >
                <Navigation className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                <span>
                  {!isWorkoutHydrated ? 'Loading Workout...' : isRequestingPermission ? 'Connecting GPS...' : 'Start Workout'}
                </span>
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePauseWorkout}
                disabled={!isWorkoutHydrated}
                title={isPaused ? 'Resume Workout' : 'Pause Workout'}
                className={`p-3 rounded-full flex items-center justify-center transition-all ${
                  isPaused ? 'bg-[#D8FD2F] text-black shadow-lg shadow-[#D8FD2F]/20' : 'bg-[#2A303D] text-white hover:bg-[#343B4B]'
                }`}
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
              <button
                onClick={() => void handleFinishWorkout()}
                disabled={!isWorkoutHydrated}
                className="px-4 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs transition-all active:scale-95 shadow-lg shadow-red-600/20"
              >
                End & Earn
              </button>
            </div>
          )}
        </div>

        {/* -------------------------------------------------- */}
        {/* LIVE WORKOUT HUD: TIME, STEPS, CALORIES, EARNINGS  */}
        {/* -------------------------------------------------- */}
        {isTracking && isOffline && (
          <div
            role="alert"
            className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100"
          >
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Internet or mobile signal lost — workout paused
            </div>
            <p className="mt-1 text-xs leading-5">
              Your time, steps, calories, and earnings are frozen. When your connection returns, tap Resume to continue.
            </p>
          </div>
        )}
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
      {/* 5. REQUEST TO TURN ON GPS / LOCATION MODAL           */}
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
                {gpsErrorMessage || 'Nexora Move Tracker requires real device GPS to track your outdoor workouts and calculate distance on Google Maps.'}
              </p>
            </div>

            {/* Insecure context warning */}
            {isInsecureContext && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-[11px] text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>iOS Safari Security Notice:</span>
                </div>
                <p className="leading-tight">
                  Apple iOS blocks GPS over plain HTTP. Tap <strong className="text-white">Start Run with Motion Sensors</strong> below to immediately track your steps, calories, and rewards using device motion sensors!
                </p>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                onClick={handleStartWorkoutClick}
                disabled={isRequestingPermission || !isWorkoutHydrated}
                className="w-full py-3.5 rounded-2xl bg-[#D8FD2F] hover:bg-[#c6ec22] text-[#0A0D11] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#D8FD2F]/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                <span>{isRequestingPermission ? 'Connecting to GPS...' : 'I Turned It On — Start Run'}</span>
              </button>

              <button
                onClick={handleStartWorkoutWithMotion}
                disabled={!isWorkoutHydrated}
                className="w-full py-3 rounded-2xl bg-[#1C2538] hover:bg-[#25324D] text-cyan-300 border border-cyan-500/30 font-extrabold text-xs active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Start Run with Motion Sensors</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 6. WORKOUT COMPLETED / 24H COOLDOWN SUMMARY MODAL     */}
      {/* ==================================================== */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#151922] border border-[#2C3344] rounded-[32px] p-6 w-full max-w-sm text-white shadow-2xl relative space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#D8FD2F]/20 border border-[#D8FD2F]/40 text-[#D8FD2F] flex items-center justify-center mx-auto shadow-lg shadow-[#D8FD2F]/15">
              <Sparkles className="w-7 h-7 text-[#D8FD2F] animate-pulse" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Workout Complete!
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Your workout using <span className="text-[#D8FD2F] font-bold">{lastWorkoutSummary.runnerName}</span> has ended. Collect your reward to place each selected Runner on a 24-hour cooldown.
              </p>
            </div>

            <div className="bg-[#0E1118] border border-[#232936] rounded-2xl p-4 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Estimated Reward (Not Credited)
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

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-[10px] text-amber-200 flex items-center justify-center gap-1.5 font-semibold">
              <Hourglass className="w-3.5 h-3.5 text-amber-400" />
              <span>Workout reward credits are paused; selected Runners will still be locked for 24 hours.</span>
            </div>

            {workoutSyncError && (
              <p role="alert" className="text-xs font-semibold text-red-300">
                {workoutSyncError}
              </p>
            )}

            <button
              onClick={handleCancelFinish}
              disabled={!isWorkoutHydrated}
              className="w-full py-3 rounded-2xl bg-[#202633] hover:bg-[#2b3445] text-white border border-white/10 font-black text-xs uppercase tracking-wider active:scale-95 transition-all"
            >
              Cancel & Continue Workout
            </button>
            <button
              onClick={handleCollectAndContinue}
              disabled={!isWorkoutHydrated}
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
