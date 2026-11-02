import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  ShieldCheck,
  Cpu,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { fingerprintScanner, ScannerHardwareStatus } from '../services/fingerprintScanner';

interface FingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'PUNCH_IN' | 'PUNCH_OUT' | 'ENROLL';
  onSuccess: (data: any) => void;
  targetUserId?: number;
  targetUserName?: string;
}

export const FingerprintModal: React.FC<FingerprintModalProps> = ({
  isOpen,
  onClose,
  mode,
  onSuccess,
  targetUserId,
  targetUserName
}) => {
  const [hardwareStatus, setHardwareStatus] = useState<ScannerHardwareStatus | null>(null);
  const [checkingHardware, setCheckingHardware] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState('Probing biometric fingerprint hardware...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen) {
      initScanner();
    } else {
      resetState();
    }
  }, [isOpen]);

  const resetState = () => {
    setScanning(false);
    setErrorMsg(null);
    setSuccessData(null);
    setStatusText('Ready for fingerprint scan.');
  };

  const initScanner = async () => {
    setCheckingHardware(true);
    setErrorMsg(null);
    setStatusText('Detecting optical biometric scanner & USB bridge drivers...');

    try {
      const [hw, srvStatus] = await Promise.all([
        fingerprintScanner.detectHardware(),
        api.getFingerprintStatus().catch(() => ({ enrolled: false }))
      ]);

      setHardwareStatus(hw);
      setIsEnrolled(srvStatus.enrolled);

      if (hw.detectedDevices.length > 0) {
        setStatusText(`Connected: ${hw.detectedDevices[0]}. Place your finger/thumb on the sensor.`);
      } else {
        setStatusText('No physical scanner hardware detected. Check USB connection or platform biometric settings.');
      }
    } catch (err: any) {
      console.warn('Scanner init error:', err);
      setErrorMsg(err.message || 'Error communicating with biometric hardware.');
    } finally {
      setCheckingHardware(false);
    }
  };

  const handleScanFingerprint = async () => {
    setScanning(true);
    setErrorMsg(null);
    setStatusText('Scanner active: Place thumb firmly on optical sensor surface...');

    try {
      // 1. Fetch one-time challenge from server
      const challengeData = await api.getFingerprintChallenge();

      if (mode === 'ENROLL') {
        // Enrolling new finger
        const cred = await fingerprintScanner.enrollFingerprint(challengeData.user, challengeData.challenge);
        setStatusText('Registering biometric public credential with server...');
        const res = await api.enrollFingerprint({
          credential_id: cred.credential_id,
          public_key: cred.public_key,
          device_name: cred.device,
          target_user_id: targetUserId
        });
        setSuccessData(res);
        setStatusText('Fingerprint credential successfully enrolled and verified!');
        setIsEnrolled(true);
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1500);
      } else {
        // Verification / Attendance punch
        const assertion = await fingerprintScanner.captureFingerprint(challengeData.challenge);
        setStatusText('Verifying biometric credential on server...');
        const punchType = mode === 'PUNCH_IN' ? 'IN' : 'OUT';
        const res = await api.verifyFingerprintPunch({
          punch_type: punchType,
          credential_id: assertion.credential_id,
          challenge: challengeData.challenge,
          signature: assertion.signature,
          device: assertion.device,
          target_user_id: targetUserId
        });

        setSuccessData(res);
        setStatusText(`Identity Verified! Clock-${punchType} confirmed by server.`);
        setTimeout(() => {
          onSuccess(res);
          onClose();
        }, 1600);
      }
    } catch (err: any) {
      console.error('Fingerprint scan failed:', err);
      setErrorMsg(err.message || 'Fingerprint verification failed. Hardware rejected scan.');
      setStatusText('Verification halted. Please review hardware instructions below.');
    } finally {
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  const hasHardware = hardwareStatus && hardwareStatus.detectedDevices.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[var(--surface-glass-solid)] text-[var(--text-primary)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[var(--border-strong)] transition-all">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-glass)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent-border)] text-[var(--accent)]">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[var(--text-primary)]">
                {mode === 'ENROLL' ? 'Fingerprint Biometric Enrollment' : `Fingerprint Clock ${mode === 'PUNCH_IN' ? 'In' : 'Out'}`}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {targetUserName ? `Target: ${targetUserName}` : 'Zero-Trust Biometric Security'}
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

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Scanner Visual Surface */}
          <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-[var(--border-subtle)] p-6 text-center shadow-inner">
            <div className="relative mb-4">
              <div
                className={`w-28 h-28 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  successData
                    ? 'border-[#4A5A3F] bg-[#ECEEE7] shadow-sm'
                    : errorMsg
                    ? 'border-rose-500 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                    : scanning
                    ? 'border-[#590907] bg-[#ECEEE7] animate-pulse shadow-sm'
                    : hasHardware
                    ? 'border-[#DFE1D8] bg-[#FAF6F0]'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <Fingerprint
                  className={`w-14 h-14 transition-all ${
                    successData
                      ? 'text-[#4A5A3F] scale-110'
                      : errorMsg
                      ? 'text-rose-400'
                      : scanning
                      ? 'text-[#590907] animate-pulse'
                      : hasHardware
                      ? 'text-[#590907]'
                      : 'text-slate-600'
                  }`}
                />
              </div>

              {scanning && (
                <div className="absolute inset-0 rounded-full border-2 border-[#590907] animate-ping opacity-75 pointer-events-none" />
              )}
            </div>

            {/* Hardware badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-slate-900/90 border border-slate-800 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-[#590907]" />
              <span>
                {checkingHardware
                  ? 'Probing Hardware...'
                  : hasHardware
                  ? 'Sensor Ready'
                  : 'Hardware Not Configured'}
              </span>
            </div>
          </div>

          {/* Status / Feedback Banner */}
          <div
            className={`p-3.5 rounded-xl border text-sm transition-all ${
              successData
                ? 'bg-[#ECEEE7] border-[#C8CAC0] text-[#4A5A3F]'
                : errorMsg
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-[var(--surface-glass)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-start gap-3">
              {successData ? (
                <CheckCircle2 className="w-5 h-5 text-[#4A5A3F] shrink-0 mt-0.5" />
              ) : errorMsg ? (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-[var(--accent)] shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                  Biometric Terminal Telemetry
                </p>
                <p className="text-sm font-semibold mt-0.5">{errorMsg || statusText}</p>

                {successData && successData.employee_name && (
                  <div className="mt-2 pt-2 border-t border-current/15 text-xs font-mono grid grid-cols-2 gap-2">
                    <div>
                      <span className="opacity-75 block text-[10px]">Employee</span>
                      <span className="font-bold">{successData.employee_name} ({successData.employee_code})</span>
                    </div>
                    <div>
                      <span className="opacity-75 block text-[10px]">Status</span>
                      <span className="font-bold uppercase">{successData.punch_type} confirmed</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Hardware Driver Instructions if not detected */}
          {!hasHardware && !checkingHardware && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 space-y-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold">
                <Info className="w-4 h-4 shrink-0" />
                <span>Scanner Driver & Bridge Requirement</span>
              </div>
              <p>
                Dedicated optical USB scanners (SecuGen Hamster, DigitalPersona U.are.U, Mantra MFS100) require their respective manufacturer WebAPI service running on localhost, or a browser with platform biometrics (Windows Hello / Touch ID).
              </p>
              <button
                type="button"
                onClick={initScanner}
                className="mt-1 text-[11px] underline font-semibold text-[#590907]"
              >
                Retry Hardware Detection
              </button>
            </div>
          )}

          {/* Action Trigger */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleScanFingerprint}
              disabled={scanning || checkingHardware}
              className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold py-3 px-5 rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Scanning Thumbprint...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  <span>
                    {mode === 'ENROLL' ? 'Scan & Enroll Fingerprint' : `Scan Fingerprint & Clock ${mode === 'PUNCH_IN' ? 'In' : 'Out'}`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FingerprintModal;

