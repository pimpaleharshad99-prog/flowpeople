import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  X, 
  RefreshCw, 
  Scan, 
  Maximize2, 
  Minimize2,
  Clock, 
  Volume2, 
  VolumeX, 
  Key, 
  ShieldAlert,
  Info,
  Copy,
  Check,
  PlusCircle
} from 'lucide-react';
import { Logo } from './brand/Logo';
import { 
  submitKioskFaceScan, 
  kioskDeviceManager, 
  isBiometricSdkAvailable, 
  generateIdempotencyKey,
  registerKioskDevice,
  rotateKioskSecret,
  RegisteredKioskDevice,
  KioskScanSuccess,
  KioskScanFailure,
  isValidUuid
} from '../services/kioskService';

interface FaceKioskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPunchRecorded?: () => void;
}

export const FaceKioskModal: React.FC<FaceKioskModalProps> = ({
  isOpen,
  onClose,
  onPunchRecorded
}) => {
  // Camera & Stream States
  const [streamActive, setStreamActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Scanning Lifecycle
  const [isScanning, setIsScanning] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [cooldownCountdown, setCooldownCountdown] = useState(0);
  const [currentIdempotencyKey, setCurrentIdempotencyKey] = useState<string>('');

  // Result States
  const [lastSuccess, setLastSuccess] = useState<KioskScanSuccess | null>(null);
  const [lastFailure, setLastFailure] = useState<KioskScanFailure | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Terminal Device Provisioning Dialog State (In-Memory Only)
  const [showDeviceSetup, setShowDeviceSetup] = useState(false);
  const [setupTab, setSetupTab] = useState<'PAIR' | 'REGISTER' | 'ROTATE'>('PAIR');
  const [inputDeviceId, setInputDeviceId] = useState(kioskDeviceManager.getDeviceId() || '');
  const [inputDeviceSecret, setInputDeviceSecret] = useState('');
  const [registerTerminalName, setRegisterTerminalName] = useState('Main Reception Kiosk 1');
  const [registerCompanyId, setRegisterCompanyId] = useState('00000000-0000-0000-0000-000000000001');
  const [provisionedRecord, setProvisionedRecord] = useState<RegisteredKioskDevice | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [deviceSetupError, setDeviceSetupError] = useState<string | null>(null);
  const [devicePaired, setDevicePaired] = useState(kioskDeviceManager.hasCredentials());

  // SDK Presence Check
  const sdkAvailable = isBiometricSdkAvailable();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cooldownTimerRef = useRef<any>(null);

  // Live Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Audio Feedback Synthesizer (Web Audio API)
  const playChime = useCallback((type: 'IN' | 'OUT' | 'ERROR') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'IN') {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.38);
      } else if (type === 'OUT') {
        osc.frequency.setValueAtTime(783.99, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.38);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(180, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.3);
      }
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio autoplay policy handled silently
    }
  }, [soundEnabled]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setPermissionDenied(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => {});
      }
      setStreamActive(true);
    } catch (err: any) {
      setStreamActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setCameraError('Camera access denied by user. Please grant camera permission to use the Face Kiosk.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No optical camera hardware detected on this device.');
      } else {
        setCameraError(err.message || 'Could not initialize optical camera hardware.');
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      setDevicePaired(kioskDeviceManager.hasCredentials());
      startCamera();
      setCurrentIdempotencyKey(generateIdempotencyKey());
    } else {
      stopCamera();
      setLastSuccess(null);
      setLastFailure(null);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    }
    return () => {
      stopCamera();
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [isOpen]);

  // Start Cooldown between scans
  const triggerCooldown = (seconds: number = 4) => {
    setIsCooldown(true);
    setCooldownCountdown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);

    cooldownTimerRef.current = setInterval(() => {
      setCooldownCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          setIsCooldown(false);
          // Re-arm for next distinct attempt with a new idempotency key
          setCurrentIdempotencyKey(generateIdempotencyKey());
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Perform Controlled Scan Lifecycle
  const handleTriggerScan = async () => {
    // 1. Guard against overlapping requests & active cooldowns
    if (isScanning || isCooldown) return;

    // 2. Pre-check: Device Credentials Provisioning
    if (!devicePaired || !kioskDeviceManager.hasCredentials()) {
      setLastFailure({
        success: false,
        outcome: 'REJECTED_DEVICE',
        title: 'Kiosk Terminal Unpaired',
        message: 'This attendance terminal has not been paired with authorized device credentials. Click "Pair Device" to configure.'
      });
      playChime('ERROR');
      return;
    }

    // 3. Pre-check: Genuine Biometric Neural Extractor SDK
    if (!sdkAvailable) {
      setLastFailure({
        success: false,
        outcome: 'SDK_UNAVAILABLE',
        title: 'Biometric Neural Extractor Missing',
        message: 'A genuine client-side facial recognition and liveness SDK (128-D or 512-D) is not configured in this frontend. Biometric submission is disabled to prevent mock attendance.'
      });
      playChime('ERROR');
      return;
    }

    // Controlled Scanning State
    setIsScanning(true);
    setLastFailure(null);

    try {
      // 4. Retrieve embedding from client-side biometric SDK
      const sdkInstance = (window as any).__FLOWPEOPLE_BIOMETRIC_SDK__;
      const extraction = await sdkInstance.extractEmbedding(videoRef.current);

      if (!extraction || !extraction.embedding) {
        throw new Error('Biometric feature extraction failed. Ensure your face is centered inside the reticle.');
      }

      // 5. Submit to Edge Function with idempotency key
      const keyToUse = currentIdempotencyKey || generateIdempotencyKey();
      setCurrentIdempotencyKey(keyToUse);

      const creds = kioskDeviceManager.getCredentials();
      const result = await submitKioskFaceScan({
        device_id: creds.deviceId || kioskDeviceManager.getDeviceId(),
        device_secret: creds.deviceSecret,
        embedding: extraction.embedding,
        face_count: extraction.face_count || 1,
        liveness: extraction.liveness ?? null,
        quality: extraction.quality ?? null,
        idempotency_key: keyToUse
      });

      if (result.success) {
        setLastSuccess(result);
        playChime(result.outcome === 'CHECK_IN' ? 'IN' : 'OUT');
        if (onPunchRecorded) onPunchRecorded();
        triggerCooldown(5); // 5s display duration
      } else {
        setLastFailure(result);
        playChime('ERROR');
        triggerCooldown(3);
      }
    } catch (err: any) {
      setLastFailure({
        success: false,
        outcome: 'NETWORK_ERROR',
        title: 'Scan Processing Interrupted',
        message: err.message || 'An error occurred during facial verification.'
      });
      playChime('ERROR');
      triggerCooldown(3);
    } finally {
      setIsScanning(false);
    }
  };

  // Device Provisioning Save
  const handleSaveDeviceCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceSetupError(null);

    const cleanId = inputDeviceId.trim();
    const cleanSecret = inputDeviceSecret.trim();

    if (!isValidUuid(cleanId)) {
      setDeviceSetupError('Device ID must be a valid UUID format (e.g. 550e8400-e29b-41d4-a716-446655440000).');
      return;
    }

    if (cleanSecret.length < 8) {
      setDeviceSetupError('Device Secret must be at least 8 characters long as issued by the backend provisioning process.');
      return;
    }

    // Save in-memory ONLY
    kioskDeviceManager.setCredentials(cleanId, cleanSecret);
    setDevicePaired(true);
    setShowDeviceSetup(false);
    setLastFailure(null);
  };

  // Register New Kiosk Device via authorized RPC (public.register_kiosk_device)
  const handleRegisterDeviceRpc = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceSetupError(null);
    setIsProvisioning(true);
    try {
      const res = await registerKioskDevice(registerCompanyId, registerTerminalName);
      setProvisionedRecord(res);
      setInputDeviceId(res.device_id);
      setInputDeviceSecret(res.device_secret);
    } catch (err: any) {
      setDeviceSetupError(err.message || 'Device registration RPC failed. Verify administrator permissions.');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Rotate Secret for an existing device via authorized RPC (public.rotate_kiosk_secret)
  const handleRotateSecretRpc = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceSetupError(null);
    setIsProvisioning(true);
    try {
      const res = await rotateKioskSecret(inputDeviceId.trim());
      setProvisionedRecord({
        device_id: res.device_id,
        device_secret: res.device_secret,
        name: 'Rotated Terminal'
      });
      setInputDeviceSecret(res.device_secret);
    } catch (err: any) {
      setDeviceSetupError(err.message || 'Secret rotation RPC failed.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div 
        ref={containerRef}
        className="w-full max-w-5xl h-[92vh] max-h-[820px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
      >
        {/* Top Kiosk Header */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Logo size={28} showTagline={false} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base tracking-tight text-white">
                  FlowPeople Face Attendance Kiosk
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  SUPABASE EDGE TERMINAL
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Automatic 1:N Facial Recognition &bull; Server Decides Check-In vs Departure
              </p>
            </div>
          </div>

          {/* Clock & Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden sm:block pr-2 border-r border-slate-700">
              <span className="font-mono text-sm font-bold text-teal-400 block">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-[10px] text-slate-400">
                {currentTime.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Terminal Provisioning Pairing Trigger */}
            <button
              onClick={() => setShowDeviceSetup(true)}
              className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                devicePaired
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
              }`}
              title="Kiosk Hardware Device Provisioning"
            >
              <Key className="w-4 h-4" />
              <span className="hidden md:inline">{devicePaired ? 'Device Paired' : 'Pair Device'}</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              title={soundEnabled ? 'Mute Chime' : 'Enable Chime'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer"
              title="Toggle Fullscreen Kiosk Mode"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 transition cursor-pointer"
              title="Close Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Viewport Area */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-950">
          {/* Real Video Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transform scale-x-[-1] ${
              streamActive ? 'block' : 'hidden'
            }`}
          />

          {/* Camera Loading State */}
          {cameraLoading && (
            <div className="text-center p-6 space-y-3">
              <RefreshCw className="w-10 h-10 text-teal-400 mx-auto animate-spin" />
              <p className="text-sm font-semibold text-white">Initializing Optical Camera...</p>
              <p className="text-xs text-slate-400">Requesting hardware sensor access.</p>
            </div>
          )}

          {/* Permission Denied or Camera Error State */}
          {(!streamActive && !cameraLoading) && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950 text-slate-400">
              <div className="w-16 h-16 rounded-full bg-slate-900 border-2 border-dashed border-rose-500/40 flex items-center justify-center mb-4 text-rose-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-base text-slate-200">
                {permissionDenied ? 'Camera Permission Required' : 'Optical Camera Unavailable'}
              </h4>
              <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
                {cameraError || 'The terminal cannot access an active video stream. Please check camera permissions in your browser.'}
              </p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-4 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Camera Connection</span>
              </button>
            </div>
          )}

          {/* Optical Face Positioning Reticle (Active when camera is running) */}
          {streamActive && !lastSuccess && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
              <div className={`w-48 h-60 sm:w-60 sm:h-76 rounded-[48%] border-2 transition-all duration-300 relative ${
                isScanning
                  ? 'border-teal-400 animate-pulse shadow-[0_0_35px_rgba(45,212,191,0.5)]'
                  : 'border-slate-500/60'
              }`}>
                {/* Corner Guide Brackets */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-teal-400 -mt-1 -ml-1" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-teal-400 -mt-1 -mr-1" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-400 -mb-1 -ml-1" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-400 -mb-1 -mr-1" />

                {/* Scanning Laser Bar */}
                {isScanning && (
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_12px_#2dd4bf] animate-[bounce_1.5s_infinite]" />
                )}
              </div>

              {/* Subtext Positioning Instructions */}
              <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-2 shadow-lg">
                <Scan className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  {isCooldown
                    ? `Ready for next employee in ${cooldownCountdown}s...`
                    : isScanning
                    ? 'Submitting to kiosk-face-scan edge function...'
                    : 'Center your face within the optical guide'}
                </span>
              </div>
            </div>
          )}

          {/* SUCCESSFUL RECOGNITION SCREEN (Section 5) */}
          {lastSuccess && (
            <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in-95 duration-200">
              <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl border border-emerald-500/50 bg-emerald-950/90 shadow-2xl text-center space-y-4 ring-2 ring-emerald-500/20">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                </div>

                <div className="space-y-1">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-300">
                    {lastSuccess.outcome === 'CHECK_IN' ? 'WELCOME BACK!' : 'HAVE A GREAT EVENING!'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {lastSuccess.employee.full_name}
                  </h3>
                  <p className="text-xs font-mono text-emerald-200/80">
                    {lastSuccess.employee.employee_code} &bull; {lastSuccess.employee.department}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 space-y-1.5 text-left text-xs font-medium">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attendance Action:</span>
                    <span className="font-bold text-emerald-400">
                      {lastSuccess.outcome === 'CHECK_IN' ? 'CHECK-IN SUCCESSFUL' : 'CHECK-OUT SUCCESSFUL'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recorded Time:</span>
                    <span className="font-mono text-slate-200">{lastSuccess.attendance.display_time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Attendance Status:</span>
                    <span className="font-bold text-white">{lastSuccess.attendance.status}</span>
                  </div>
                  {lastSuccess.attendance.working_duration && (
                    <div className="flex justify-between border-t border-slate-800 pt-1.5">
                      <span className="text-slate-400">Working Duration:</span>
                      <span className="font-mono text-emerald-300 font-bold">
                        {lastSuccess.attendance.working_duration}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  Terminal will re-arm for next staff member in {cooldownCountdown}s...
                </p>
              </div>
            </div>
          )}

          {/* REJECTED / FAILURE FEEDBACK POPUP (Section 4) */}
          {lastFailure && (
            <div className="absolute inset-x-4 top-4 z-20 animate-in slide-in-from-top-4 duration-200">
              <div className="p-4 rounded-xl border border-rose-500/50 bg-rose-950/95 text-rose-100 shadow-2xl flex items-start gap-3.5 ring-2 ring-rose-500/20 max-w-xl mx-auto">
                <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white">{lastFailure.title}</h4>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-900/60 text-rose-300 border border-rose-700/50">
                      {lastFailure.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                    {lastFailure.message}
                  </p>
                </div>
                <button
                  onClick={() => setLastFailure(null)}
                  className="text-rose-400 hover:text-white p-1 rounded transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* SDK Missing Advisory Banner */}
          {!sdkAvailable && (
            <div className="absolute inset-x-4 bottom-20 z-10 max-w-xl mx-auto p-3 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 shadow-xl">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-white">Biometric Neural Extractor Unconfigured</span>
                <span>
                  Client-side face embedding generator (128-D/512-D) is not active in this frontend. Live biometric scanning is cleanly disabled to prevent mock attendance.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-5 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Target Function: <code className="text-teal-300 font-mono text-[11px]">kiosk-face-scan</code></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTriggerScan}
              disabled={isScanning || isCooldown || !streamActive || !devicePaired || !sdkAvailable}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isCooldown
                  ? 'bg-slate-800 text-slate-500 border border-slate-700'
                  : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 shadow-teal-500/25 active:scale-95'
              }`}
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Verifying with Edge Function...</span>
                </>
              ) : (
                <>
                  <Scan className="w-4 h-4" />
                  <span>{isCooldown ? `Next in ${cooldownCountdown}s` : 'Trigger Scan Punch'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* In-Memory Device Credentials Setup Dialog (Section 1, 3 & 8) */}
        {showDeviceSetup && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-teal-400">
                  <Key className="w-5 h-5" />
                  <h4 className="font-bold text-sm text-white">Kiosk Device Provisioning & Pairing</h4>
                </div>
                <button onClick={() => setShowDeviceSetup(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-Tabs: Pair vs Register RPC vs Rotate */}
              <div className="flex rounded-xl bg-slate-800/80 p-1 border border-slate-700">
                <button
                  type="button"
                  onClick={() => { setSetupTab('PAIR'); setDeviceSetupError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    setupTab === 'PAIR' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pair Terminal
                </button>
                <button
                  type="button"
                  onClick={() => { setSetupTab('REGISTER'); setDeviceSetupError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    setupTab === 'REGISTER' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Register Device (RPC)
                </button>
                <button
                  type="button"
                  onClick={() => { setSetupTab('ROTATE'); setDeviceSetupError(null); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                    setupTab === 'ROTATE' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Rotate Secret
                </button>
              </div>

              {/* ONE-TIME SECRET NOTICE AFTER PROVISIONING */}
              {provisionedRecord && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>One-Time Device Credentials Generated</span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-emerald-500/20">
                    <div>
                      <span className="text-slate-400">Device ID: </span>
                      <span className="text-white select-all">{provisionedRecord.device_id}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                      <div className="min-w-0 truncate">
                        <span className="text-slate-400">Plaintext Secret: </span>
                        <span className="text-emerald-400 font-bold select-all">{provisionedRecord.device_secret}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(provisionedRecord.device_secret)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white shrink-0 inline-flex items-center gap-1 border border-slate-700"
                      >
                        {copiedSecret ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-300/90 leading-tight">
                    CRITICAL: This plaintext secret is generated by <code>private.kiosk_credentials</code> and will only be displayed ONCE. It is never persisted in browser storage. Copy it now.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      kioskDeviceManager.setCredentials(provisionedRecord.device_id, provisionedRecord.device_secret);
                      setDevicePaired(true);
                      setShowDeviceSetup(false);
                      setProvisionedRecord(null);
                    }}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow"
                  >
                    Pair Active Terminal with These Credentials
                  </button>
                </div>
              )}

              {/* TAB 1: PAIR EXISTING TERMINAL */}
              {setupTab === 'PAIR' && (
                <form onSubmit={handleSaveDeviceCredentials} className="space-y-3">
                  <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 text-[11px]">
                    Credentials are stored exclusively in temporary RAM for this session and are never written to localStorage or cookies.
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Device ID (UUID v4) *</label>
                    <input
                      type="text"
                      required
                      value={inputDeviceId}
                      onChange={(e) => setInputDeviceId(e.target.value)}
                      placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Device Secret *</label>
                    <input
                      type="password"
                      required
                      value={inputDeviceSecret}
                      onChange={(e) => setInputDeviceSecret(e.target.value)}
                      placeholder="Enter terminal device secret"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {deviceSetupError && (
                    <p className="text-[11px] text-rose-400 font-medium">{deviceSetupError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        kioskDeviceManager.clearCredentials();
                        setInputDeviceId('');
                        setInputDeviceSecret('');
                        setDevicePaired(false);
                        setShowDeviceSetup(false);
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                    >
                      Unpair Terminal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition shadow-sm"
                    >
                      Save & Pair Terminal
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 2: REGISTER NEW DEVICE (AUTHORIZED RPC) */}
              {setupTab === 'REGISTER' && (
                <form onSubmit={handleRegisterDeviceRpc} className="space-y-3">
                  <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-300 text-[11px]">
                    Calls backend RPC <code>public.register_kiosk_device(p_company_id, p_name)</code> to insert into <code>attendance_devices</code> and generate a secure secret in <code>private.kiosk_credentials</code>.
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Terminal Hardware Name *</label>
                    <input
                      type="text"
                      required
                      value={registerTerminalName}
                      onChange={(e) => setRegisterTerminalName(e.target.value)}
                      placeholder="e.g. Main Reception Face Terminal 1"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Company ID (UUID) *</label>
                    <input
                      type="text"
                      required
                      value={registerCompanyId}
                      onChange={(e) => setRegisterCompanyId(e.target.value)}
                      placeholder="Company UUID"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {deviceSetupError && (
                    <p className="text-[11px] text-rose-400 font-medium">{deviceSetupError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeviceSetup(false)}
                      className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProvisioning}
                      className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProvisioning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isProvisioning ? 'Registering...' : 'Register Device (RPC)'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: ROTATE SECRET (AUTHORIZED RPC) */}
              {setupTab === 'ROTATE' && (
                <form onSubmit={handleRotateSecretRpc} className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                    Calls <code>public.rotate_kiosk_secret(p_device_id)</code> to invalidate the existing terminal secret and generate a new one-time secret.
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">Existing Device ID (UUID) *</label>
                    <input
                      type="text"
                      required
                      value={inputDeviceId}
                      onChange={(e) => setInputDeviceId(e.target.value)}
                      placeholder="Existing Device UUID"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {deviceSetupError && (
                    <p className="text-[11px] text-rose-400 font-medium">{deviceSetupError}</p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeviceSetup(false)}
                      className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isProvisioning}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProvisioning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isProvisioning ? 'Rotating Secret...' : 'Rotate Secret (RPC)'}</span>
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
