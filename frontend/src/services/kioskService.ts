/**
 * FlowPeople Supabase Face Attendance Kiosk Service
 * Connects to the deployed Edge Function:
 * https://yzcrifmqwgfkfikkimeu.supabase.co/functions/v1/kiosk-face-scan
 *
 * Enforces strict security:
 * - Device secret stored in-memory only (never in localStorage or logged)
 * - Validates UUID device_id
 * - Validates 128 or 512-D finite numerical embeddings
 * - Controls scanning lifecycle and idempotency keys
 * - Maps all backend outcome states
 */

export const EDGE_FUNCTION_URL = 'https://yzcrifmqwgfkfikkimeu.supabase.co/functions/v1/kiosk-face-scan';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bEuL6GdEhvU5XlukkZpwng_LUNq3Nrp';

export type KioskOutcome =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'IGNORED_DUPLICATE'
  | 'IGNORED_COMPLETED'
  | 'REJECTED_DEVICE'
  | 'REJECTED_LIVENESS'
  | 'REJECTED_QUALITY'
  | 'REJECTED_NOT_RECOGNIZED'
  | 'REJECTED_LOW_CONFIDENCE'
  | 'REJECTED_AMBIGUOUS'
  | 'REJECTED_MULTIPLE_FACES'
  | 'REJECTED_INACTIVE'
  | 'REJECTED_MANUAL_MODE';

export interface KioskFaceScanPayload {
  device_id: string; // Valid UUID
  device_secret: string; // Authorized kiosk secret
  embedding: number[]; // Exactly 128 or 512 finite numbers
  face_count: number;
  liveness: boolean | null;
  quality: number | null;
  idempotency_key: string;
}

export interface KioskEmployee {
  id: string | number;
  full_name: string;
  employee_code: string;
  department?: string;
  role_title?: string;
  avatar_url?: string;
}

export interface KioskScanSuccess {
  success: true;
  outcome: 'CHECK_IN' | 'CHECK_OUT';
  employee: KioskEmployee;
  attendance: {
    status: string;
    punch_type: 'IN' | 'OUT';
    display_time: string;
    timestamp: string;
    working_duration?: string;
  };
  confidence?: number;
  message?: string;
}

export interface KioskScanFailure {
  success: false;
  outcome: KioskOutcome | 'NETWORK_ERROR' | 'INVALID_PAYLOAD' | 'SDK_UNAVAILABLE';
  title: string;
  message: string;
  rawError?: string;
  status?: number;
}

export type KioskScanResult = KioskScanSuccess | KioskScanFailure;

// In-Memory Device Credentials (NEVER persisted to localStorage or exposed in logs)
let inMemoryDeviceId: string = '';
let inMemoryDeviceSecret: string = '';

export const kioskDeviceManager = {
  getDeviceId: (): string => inMemoryDeviceId,
  hasCredentials: (): boolean => {
    return Boolean(inMemoryDeviceId && inMemoryDeviceSecret && isValidUuid(inMemoryDeviceId));
  },
  setCredentials: (deviceId: string, deviceSecret: string) => {
    inMemoryDeviceId = deviceId.trim();
    inMemoryDeviceSecret = deviceSecret.trim();
  },
  clearCredentials: () => {
    inMemoryDeviceId = '';
    inMemoryDeviceSecret = '';
  }
};

/**
 * UUID v4 validator
 */
export function isValidUuid(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Check if a genuine client-side facial recognition & liveness extractor SDK is installed
 * FlowPeople frontend does not bundle an on-device TensorFlow/MediaPipe neural extractor yet.
 */
export function isBiometricSdkAvailable(): boolean {
  // Check if any genuine client-side SDK window object or imported module is registered
  return typeof (window as any).__FLOWPEOPLE_BIOMETRIC_SDK__ !== 'undefined';
}

/**
 * Generate a cryptographically random idempotency key for a distinct scan attempt
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'fp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Validate embedding numbers
 */
export function isValidEmbedding(vec: unknown): vec is number[] {
  if (!Array.isArray(vec)) return false;
  if (vec.length !== 128 && vec.length !== 512) return false;
  return vec.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * Outcome code mapper for user-friendly notifications
 */
export function mapOutcomeFeedback(outcome: string | undefined, detail?: string): { outcome: KioskOutcome; title: string; message: string } {
  switch (outcome) {
    case 'CHECK_IN':
      return {
        outcome: 'CHECK_IN',
        title: 'Welcome Back!',
        message: 'Clock-In punch successfully recorded.'
      };
    case 'CHECK_OUT':
      return {
        outcome: 'CHECK_OUT',
        title: 'Have a Great Evening!',
        message: 'Clock-Out departure recorded. See you tomorrow!'
      };
    case 'IGNORED_DUPLICATE':
      return {
        outcome: 'IGNORED_DUPLICATE',
        title: 'Recent Punch Detected',
        message: detail || 'You have already punched attendance recently. Duplicate submission ignored.'
      };
    case 'IGNORED_COMPLETED':
      return {
        outcome: 'IGNORED_COMPLETED',
        title: 'Shift Completed',
        message: detail || 'Daily attendance schedule has already been completed for today.'
      };
    case 'REJECTED_DEVICE':
      return {
        outcome: 'REJECTED_DEVICE',
        title: 'Unauthorized Terminal',
        message: detail || 'This kiosk terminal hardware is not authorized. Please configure with valid device credentials.'
      };
    case 'REJECTED_LIVENESS':
      return {
        outcome: 'REJECTED_LIVENESS',
        title: 'Liveness Check Failed',
        message: detail || 'Optical liveness verification failed. Please step directly before the camera.'
      };
    case 'REJECTED_QUALITY':
      return {
        outcome: 'REJECTED_QUALITY',
        title: 'Low Image Quality',
        message: detail || 'Facial clarity is insufficient. Ensure adequate lighting and remove face coverings.'
      };
    case 'REJECTED_NOT_RECOGNIZED':
      return {
        outcome: 'REJECTED_NOT_RECOGNIZED',
        title: 'Face Not Recognized',
        message: detail || 'No matching employee profile found. Please register your Face ID in the HR Portal.'
      };
    case 'REJECTED_LOW_CONFIDENCE':
      return {
        outcome: 'REJECTED_LOW_CONFIDENCE',
        title: 'Low Match Confidence',
        message: detail || 'Facial template match confidence was below threshold. Please stand straight and try again.'
      };
    case 'REJECTED_AMBIGUOUS':
      return {
        outcome: 'REJECTED_AMBIGUOUS',
        title: 'Ambiguous Face Match',
        message: detail || 'Multiple potential biometric matches identified. Please consult HR administration.'
      };
    case 'REJECTED_MULTIPLE_FACES':
      return {
        outcome: 'REJECTED_MULTIPLE_FACES',
        title: 'Multiple People Detected',
        message: detail || 'Only one employee may stand before the scanner at a time.'
      };
    case 'REJECTED_INACTIVE':
      return {
        outcome: 'REJECTED_INACTIVE',
        title: 'Employee Profile Inactive',
        message: detail || 'Your employee record is currently inactive. Please contact HR administration.'
      };
    case 'REJECTED_MANUAL_MODE':
      return {
        outcome: 'REJECTED_MANUAL_MODE',
        title: 'Biometric Kiosk Disabled',
        message: detail || 'Biometric check-in is temporarily suspended. Please use web portal punch.'
      };
    default:
      return {
        outcome: 'REJECTED_NOT_RECOGNIZED',
        title: 'Verification Rejected',
        message: detail || 'Attendance scan was rejected by the server.'
      };
  }
}

/**
 * Submit face scan to Supabase Edge Function
 */
export async function submitKioskFaceScan(payload: KioskFaceScanPayload): Promise<KioskScanResult> {
  // 1. Pre-flight Validation
  if (!isValidUuid(payload.device_id)) {
    return {
      success: false,
      outcome: 'REJECTED_DEVICE',
      title: 'Invalid Device ID',
      message: 'Terminal device_id must be a valid UUID v4 string.'
    };
  }

  if (!payload.device_secret || payload.device_secret.trim().length === 0) {
    return {
      success: false,
      outcome: 'REJECTED_DEVICE',
      title: 'Missing Device Secret',
      message: 'Terminal device_secret is missing. Authorized kiosk provisioning is required.'
    };
  }

  if (!isValidEmbedding(payload.embedding)) {
    return {
      success: false,
      outcome: 'INVALID_PAYLOAD',
      title: 'Invalid Biometric Vector',
      message: 'Biometric embedding must contain exactly 128 or 512 finite floating-point values.'
    };
  }

  try {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errCode = data.error || data.outcome || (response.status === 400 && data.detail?.includes('device') ? 'REJECTED_DEVICE' : 'REJECTED_NOT_RECOGNIZED');
      const mapped = mapOutcomeFeedback(errCode, data.detail || data.message || data.error);
      return {
        success: false,
        outcome: mapped.outcome,
        title: mapped.title,
        message: mapped.message,
        rawError: data.error || data.detail,
        status: response.status
      };
    }

    // Success response parsing
    const outcome: 'CHECK_IN' | 'CHECK_OUT' = data.outcome === 'CHECK_OUT' || data.punch_type === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN';
    
    // Parse employee payload from backend
    const employeeData: KioskEmployee = {
      id: data.employee?.id ?? 'UNKNOWN',
      full_name: data.employee?.full_name || `${data.employee?.first_name || ''} ${data.employee?.last_name || ''}`.trim() || 'Employee',
      employee_code: data.employee?.employee_code || 'EMP',
      department: data.employee?.department || data.employee?.department_name || 'General',
      role_title: data.employee?.role_title || data.employee?.role || 'Staff',
      avatar_url: data.employee?.avatar_url
    };

    const now = new Date();
    const displayTime = data.attendance?.time || data.display_time || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      success: true,
      outcome,
      employee: employeeData,
      attendance: {
        status: data.attendance?.status || data.attendance_status || 'PRESENT',
        punch_type: outcome === 'CHECK_IN' ? 'IN' : 'OUT',
        display_time: displayTime,
        timestamp: data.timestamp || now.toISOString(),
        working_duration: data.attendance?.working_duration || data.working_hours_formatted
      },
      confidence: data.confidence,
      message: data.message
    };
  } catch (err: any) {
    return {
      success: false,
      outcome: 'NETWORK_ERROR',
      title: 'Connection Error',
      message: 'Failed to communicate with Supabase Kiosk Edge Function. Please check network connectivity.',
      rawError: err.message
    };
  }
}

