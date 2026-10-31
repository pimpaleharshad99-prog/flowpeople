import React, { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  ShieldCheck,
  Camera,
  Maximize2,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../services/api';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'PUNCH_IN' | 'PUNCH_OUT';
  onSuccess: (data: any) => void;
  isAdmin?: boolean;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSuccess,
  isAdmin = false
}) => {
  const [activeTab, setActiveTab] = useState<'SCAN' | 'KIOSK'>(isAdmin ? 'KIOSK' : 'SCAN');
  
  // Scanner state
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Align attendance QR code inside viewport...');
  const [scanSuccess, setScanSuccess] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Kiosk display state
  const [kioskTokenData, setKioskTokenData] = useState<any | null>(null);
  const [qrSvgUrl, setQrSvgUrl] = useState<string>('');
  const [secondsRemaining, setSecondsRemaining] = useState<number>(15);
  const [kioskStats, setKioskStats] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'SCAN') {
        startCamera();
      } else {
        fetchKioskToken();
      }
    } else {
      stopCamera();
      clearInterval(rotationTimerRef.current as any);
    }
    return () => {
      stopCamera();
      clearInterval(rotationTimerRef.current as any);
    };
  }, [isOpen, activeTab]);

  // Video ref attachment
  useEffect(() => {
    if (streamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.warn);
    }
  }, [streamActive]);

  // 15-second rotation loop for kiosk mode
  useEffect(() => {
    if (activeTab === 'KIOSK' && isOpen) {
      rotationTimerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            fetchKioskToken();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);
    };
  }, [activeTab, isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    setScanError(null);
    setScannerStatus('Activating optical camera stream...');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(console.warn);
        }
        setStreamActive(true);
        setScannerStatus('Point camera at the rotating QR code on the workplace kiosk.');
      } else {
        throw new Error('Camera device API is not available on this browser.');
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(err.message || 'Unable to access camera.');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setStreamActive(false);
  };

  const fetchKioskToken = async () => {
    try {
      const data = await api.getActiveKioskQRToken('KIOSK-MAIN-01');
      setKioskTokenData(data);
      const url = await QRCode.toDataURL(data.qr_token, {
        width: 280,
        margin: 2,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      });
      setQrSvgUrl(url);

      api.getQRKioskStatus().then(setKioskStats).catch(() => {});
    } catch (err: any) {
      console.warn('Kiosk fetch error:', err);
    }
  };

  const handleProcessToken = async (tokenToSubmit: string) => {
    if (!tokenToSubmit.trim()) return;

    setScanning(true);
    setScanError(null);
    setScannerStatus('Validating cryptographic HMAC signature & anti-replay timestamp...');

    try {
      const punchType = mode === 'PUNCH_IN' ? 'IN' : 'OUT';
      const res = await api.scanQRPunch({
        qr_token: tokenToSubmit.trim(),
        punch_type: punchType,
        device: 'Workplace QR Scanner'
      });

      setScanSuccess(res);
      setScannerStatus(`Identity Verified! Clock-${punchType} confirmed at ${res.kiosk_id || 'Kiosk'}.`);
      setTimeout(() => {
        onSuccess(res);
        onClose();
      }, 1600);
    } catch (err: any) {
      setScanError(err.message || 'QR code verification rejected by server.');
      setScannerStatus('Validation failed. Scan a current, unexpired code.');
    } finally {
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface-glass-solid)] text-[var(--text-primary)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[var(--border-strong)] transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-glass)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)]">
                {activeTab === 'SCAN' ? `QR Attendance — Clock ${mode === 'PUNCH_IN' ? 'In' : 'Out'}` : 'Rotating QR Attendance Kiosk'}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {activeTab === 'SCAN' ? 'Scan the live rotating kiosk QR code' : 'Display terminal for employee check-ins'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-glass-hover)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        {isAdmin && (
          <div className="px-6 pt-3 pb-1 border-b border-[var(--border-subtle)] bg-[var(--surface-glass)]/50 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('SCAN')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'SCAN'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-glass-hover)]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('KIOSK')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'KIOSK'
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-glass-hover)]'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Kiosk Display Mode</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">
          {activeTab === 'SCAN' ? (
            /* SCANNER MODE */
            <div className="space-y-4">
              <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-[var(--border-subtle)] shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${streamActive ? 'block' : 'hidden'}`}
                />

                {!streamActive && (
                  <div className="text-center p-6 space-y-2 max-w-xs text-slate-300">
                    {cameraError ? (
                      <>
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                        <p className="text-xs font-semibold text-white">Camera Offline</p>
                        <p className="text-[11px] text-slate-400">{cameraError}</p>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-8 h-8 text-[var(--accent)] mx-auto animate-spin" />
                        <p className="text-xs">Connecting to optical camera sensor...</p>
                      </>
                    )}
                  </div>
                )}

                {/* QR Aiming Reticle Overlay */}
                {streamActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-teal-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(20,184,166,0.3)]">
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-teal-300" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-teal-300" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-300" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-300" />
                      <div className="absolute inset-x-0 h-0.5 bg-teal-400/80 top-1/2 -translate-y-1/2 animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Status / Feedback */}
              <div
                className={`p-3.5 rounded-xl border text-sm transition-all ${
                  scanSuccess
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : scanError
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    : 'bg-[var(--surface-glass)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {scanSuccess ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : scanError ? (
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                      QR Anti-Replay Telemetry
                    </p>
                    <p className="text-sm font-semibold mt-0.5">{scanError || scannerStatus}</p>

                    {scanSuccess && (
                      <div className="mt-2 pt-2 border-t border-current/15 text-xs font-mono grid grid-cols-2 gap-2">
                        <div>
                          <span className="opacity-75 block text-[10px]">Employee</span>
                          <span className="font-bold">{scanSuccess.employee_name} ({scanSuccess.employee_code})</span>
                        </div>
                        <div>
                          <span className="opacity-75 block text-[10px]">Status</span>
                          <span className="font-bold uppercase">{scanSuccess.punch_type} confirmed</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Manual QR Input / Quick Tester */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  Simulate QR Scan (Paste Kiosk Token)
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder="FPQR:1:1:KIOSK-MAIN-01:..."
                    className="flex-1 text-xs glass-input p-2 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleProcessToken(manualToken)}
                    disabled={scanning || !manualToken}
                    className="px-3 py-2 bg-[var(--accent)] text-white text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition flex items-center gap-1"
                  >
                    <span>Punch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* KIOSK DISPLAY MODE */
            <div className="space-y-4 text-center">
              {/* QR Code Container */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-slate-200 inline-block mx-auto">
                {qrSvgUrl ? (
                  <img src={qrSvgUrl} alt="Rotating QR Attendance Code" className="w-64 h-64 object-contain mx-auto" />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center text-slate-400">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                  </div>
                )}
              </div>

              {/* 15s Rotation Timer Bar */}
              <div className="p-3 bg-[var(--surface-glass)] border border-[var(--border-subtle)] rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--accent)]" />
                  <span className="font-semibold text-[var(--text-primary)]">Rotating Token</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[var(--accent)]">{secondsRemaining}s</span>
                  <div className="w-20 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[var(--accent)] h-full transition-all duration-1000"
                      style={{ width: `${(secondsRemaining / 15) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Kiosk Telemetry Badge */}
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono px-2">
                <span>Terminal: {kioskTokenData?.kiosk_id || 'KIOSK-MAIN-01'}</span>
                <span>Today's QR Punches: {kioskStats?.qr_punches_today || 0}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;

