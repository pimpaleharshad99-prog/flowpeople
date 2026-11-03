/**
 * FlowPeople Supabase Face Attendance Kiosk Service
 * Connects to the deployed Edge Function:
 * https://<project-ref>.supabase.co/functions/v1/kiosk-face-scan
 *
 * Enforces strict security & backend compatibility:
 * - Provisioning via public.attendance_devices & private.kiosk_credentials
 * - RPCs: public.register_kiosk_device(p_company_id, p_name) & public.rotate_kiosk_secret(p_device_id)
 * - Enrollment via public.enroll_face (3-10 samples, 128/512-D, model version, consent, biometric.manage)
 * - Revocation via public.remove_face(p_employee_id)
 * - Device secret stored in-memory only (never in localStorage or logged)
 * - Validates UUID device_id
 * - Validates 128 or 512-D finite numerical embeddings
 * - Controls scanning lifecycle and idempotency keys
 * - Maps all backend outcome states (CHECK_IN, CHECK_OUT, IGNORED_DUPLICATE, REJECTED_DEVICE, etc.)
 */

import { supabase } from '../lib/supabase';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const EDGE_FUNCTION_URL = rawSupabaseUrl
  ? `${rawSupabaseUrl.replace(/\/+$/, '')}/functions/v1/kiosk-face-scan`
  : '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// Authoritative Company Biometric Model Architecture Specification
export const APPROVED_BIOMETRIC_MODEL = {
  id: 'v2.0-facenet-norm',
  name: 'FaceNet Mobile 128-D L2-Normalized Embedding Model',
  dimensions: 128,
  normalization: 'L2_UNIT',
  inputDimensions: [160, 160, 3],
  preprocessing: 'Standardized zero-mean unit-variance [-1.0, 1.0]',
  similarityThreshold: 0.82
} as const;

export const ACTIVE_MODEL_VERSION = APPROVED_BIOMETRIC_MODEL.id;
export const SUPPORTED_MODEL_VERSIONS = ['v2.0-facenet-norm', 'facenet-v1-128'] as const;

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
  | 'REJECTED_MANUAL_MODE'
  | 'REJECTED_MODEL_VERSION_INCOMPATIBLE';

export interface KioskFaceScanPayload {
  device_id: string; // Valid UUID
  device_secret: string; // Authorized kiosk secret
  embedding: number[]; // Exactly 128 finite numbers
  face_count: number;
  liveness: boolean | null;
  quality: number | null;
  idempotency_key: string;
  model_version?: string; // Must be 'v2.0-facenet-norm'
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

export interface RegisteredKioskDevice {
  device_id: string;
  device_secret: string; // Plaintext secret returned ONCE
  name?: string;
  company_id?: string;
  created_at?: string;
}

export interface FaceEnrollmentParams {
  employeeId: string;
  samples: number[][]; // 3 to 10 face embedding samples
  modelVersion: string; // Must match kiosk detection model
  consentGiven: boolean;
}

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
  getCredentials: () => {
    return {
      deviceId: inMemoryDeviceId,
      deviceSecret: inMemoryDeviceSecret
    };
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
 */
export function isBiometricSdkAvailable(): boolean {
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
 * Validate embedding numbers: must be exactly 128 finite floats (matching approved FaceNet model)
 */
export function isValidEmbedding(vec: unknown): vec is number[] {
  if (!Array.isArray(vec)) return false;
  if (vec.length !== APPROVED_BIOMETRIC_MODEL.dimensions) return false;
  return vec.every((n) => typeof n === 'number' && Number.isFinite(n));
}

/**
 * Outcome code mapper for user-friendly notifications
 */
export function mapOutcomeFeedback(outcome: string | undefined, detail?: string): { outcome: KioskOutcome; title: string; message: string } {
  const normalized = (outcome || '').toUpperCase();

  switch (normalized) {
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
    case 'REJECTED_MODEL_VERSION_INCOMPATIBLE':
      return {
        outcome: 'REJECTED_MODEL_VERSION_INCOMPATIBLE',
        title: 'Incompatible Biometric Model',
        message: detail || `Facial scan was produced using an incompatible model version. Company standard is ${APPROVED_BIOMETRIC_MODEL.id} (${APPROVED_BIOMETRIC_MODEL.dimensions}-D).`
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
 * 1. Provision Kiosk Device via authorized RPC
 * Calls public.register_kiosk_device(p_company_id, p_name)
 * Returns device_id UUID and one-time plaintext device_secret
 */
export async function registerKioskDevice(companyId: string, name: string): Promise<RegisteredKioskDevice> {
  const { data, error } = await supabase.rpc('register_kiosk_device', {
    p_company_id: companyId,
    p_name: name
  });

  if (error) {
    throw new Error(`Device registration failed: ${error.message} (${error.code || 'UNKNOWN'})`);
  }

  if (!data || (!data.device_id && !data.id)) {
    throw new Error('Device registration returned unexpected empty response from server.');
  }

  return {
    device_id: data.device_id || data.id,
    device_secret: data.device_secret || data.secret,
    name: data.name || name,
    company_id: companyId,
    created_at: data.created_at || new Date().toISOString()
  };
}

/**
 * 1. Rotate Kiosk Device Secret via authorized RPC
 * Calls public.rotate_kiosk_secret(p_device_id)
 * Returns device_id and newly generated one-time plaintext secret
 */
export async function rotateKioskSecret(deviceId: string): Promise<{ device_id: string; device_secret: string }> {
  if (!isValidUuid(deviceId)) {
    throw new Error('Invalid device ID: must be a valid UUID');
  }

  const { data, error } = await supabase.rpc('rotate_kiosk_secret', {
    p_device_id: deviceId
  });

  if (error) {
    throw new Error(`Secret rotation failed: ${error.message} (${error.code || 'UNKNOWN'})`);
  }

  return {
    device_id: data.device_id || deviceId,
    device_secret: data.device_secret || data.secret
  };
}

/**
 * 4. Enroll Face via authorized RPC
 * Reuses public.enroll_face with strict validation:
 * - 3 to 10 face samples
 * - 128-D or 512-D consistent embeddings
 * - Model version matching
 * - Explicit employee consent
 */
export async function enrollFaceBiometrics(params: FaceEnrollmentParams): Promise<{ success: boolean; message: string }> {
  if (!params.consentGiven) {
    throw new Error('Explicit biometric consent is mandatory before enrolling facial templates.');
  }

  if (!Array.isArray(params.samples) || params.samples.length < 3 || params.samples.length > 10) {
    throw new Error(`Face enrollment requires between 3 and 10 face samples (received ${params.samples?.length || 0}).`);
  }

  const sampleDim = params.samples[0].length;
  if (sampleDim !== APPROVED_BIOMETRIC_MODEL.dimensions) {
    throw new Error(
      `Invalid embedding dimensionality: ${sampleDim}. Must match company standard ${APPROVED_BIOMETRIC_MODEL.id} (${APPROVED_BIOMETRIC_MODEL.dimensions}-D).`
    );
  }

  const hasInconsistentDims = params.samples.some((s) => s.length !== sampleDim || !isValidEmbedding(s));
  if (hasInconsistentDims) {
    throw new Error('All face samples must have identical dimensionality (128-D) and contain only finite numerical values.');
  }

  if (!params.modelVersion || !(SUPPORTED_MODEL_VERSIONS as readonly string[]).includes(params.modelVersion.trim())) {
    throw new Error(
      `Incompatible model version '${params.modelVersion}'. Company standard requires '${ACTIVE_MODEL_VERSION}' (${APPROVED_BIOMETRIC_MODEL.dimensions}-D).`
    );
  }

  const { data, error } = await supabase.rpc('enroll_face', {
    p_employee_id: params.employeeId,
    p_samples: params.samples,
    p_model_version: params.modelVersion.trim(),
    p_consent: true
  });

  if (error) {
    throw new Error(`Face enrollment RPC rejected: ${error.message}`);
  }

  return {
    success: true,
    message: data?.message || 'Face biometrics successfully enrolled.'
  };
}

/**
 * 4. Revoke / Remove Face Biometrics via authorized RPC
 * Calls public.remove_face(p_employee_id)
 */
export async function removeFaceBiometrics(employeeId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('remove_face', {
    p_employee_id: employeeId
  });

  if (error) {
    throw new Error(`Biometric template revocation failed: ${error.message}`);
  }

  return {
    success: true,
    message: data?.message || 'Biometric template revoked successfully.'
  };
}

/**
 * 2. Submit face scan to Supabase Edge Function:
 * https://<project-ref>.supabase.co/functions/v1/kiosk-face-scan
 *
 * Handles actual outcomes from the database RPC:
 * - CHECK_IN
 * - CHECK_OUT
 * - IGNORED_DUPLICATE
 * - REJECTED_DEVICE
 * - Other rejection outcomes
 * Does NOT assume invalid_device_secret format.
 */
export async function submitKioskFaceScan(payload: KioskFaceScanPayload): Promise<KioskScanResult> {
  // 1. Pre-flight Validation
  if (!isValidUuid(payload.device_id)) {
    return {
      success: false,
      outcome: 'REJECTED_DEVICE',
      title: 'Invalid Device ID',
      message: 'Terminal device_id must be a valid UUID string.'
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
      message: `Biometric embedding must contain exactly ${APPROVED_BIOMETRIC_MODEL.dimensions} finite floating-point values.`
    };
  }

  const modelVersion = (payload.model_version || ACTIVE_MODEL_VERSION).trim();
  if (!(SUPPORTED_MODEL_VERSIONS as readonly string[]).includes(modelVersion)) {
    return {
      success: false,
      outcome: 'REJECTED_MODEL_VERSION_INCOMPATIBLE',
      title: 'Incompatible Model Version',
      message: `Biometric model version '${modelVersion}' is not compatible. Required company standard is '${ACTIVE_MODEL_VERSION}' (${APPROVED_BIOMETRIC_MODEL.dimensions}-D).`
    };
  }

  try {
    const finalPayload = {
      ...payload,
      model_version: modelVersion
    };

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(finalPayload)
    });

    const data = await response.json().catch(() => ({}));

    // 2. Handle HTTP Errors (e.g. 400, 401, 403, 500)
    if (!response.ok) {
      // Determine outcome from data.outcome, status code, or error payload
      let outcomeCode: string = data.outcome || '';
      
      if (!outcomeCode) {
        if (response.status === 401 || response.status === 403) {
          outcomeCode = 'REJECTED_DEVICE';
        } else if (data.error && typeof data.error === 'string') {
          if (data.error.includes('device') || data.error.includes('secret') || data.error.includes('unauthorized')) {
            outcomeCode = 'REJECTED_DEVICE';
          } else if (data.error.includes('model') || data.error.includes('dimension') || data.error.includes('incompatible')) {
            outcomeCode = 'REJECTED_MODEL_VERSION_INCOMPATIBLE';
          } else if (data.error.includes('liveness')) {
            outcomeCode = 'REJECTED_LIVENESS';
          } else if (data.error.includes('quality')) {
            outcomeCode = 'REJECTED_QUALITY';
          } else {
            outcomeCode = 'REJECTED_NOT_RECOGNIZED';
          }
        } else {
          outcomeCode = 'REJECTED_NOT_RECOGNIZED';
        }
      }

      const mapped = mapOutcomeFeedback(outcomeCode, data.detail || data.message || data.error);
      return {
        success: false,
        outcome: mapped.outcome,
        title: mapped.title,
        message: mapped.message,
        rawError: typeof data.error === 'string' ? data.error : JSON.stringify(data.error || data.detail),
        status: response.status
      };
    }

    // 3. Handle HTTP 200 responses: Evaluate database RPC outcome
    const rawOutcome = (data.outcome || data.status || '').toUpperCase();

    // Check for explicit rejection / ignored outcomes returned with 200 OK
    if (rawOutcome && rawOutcome !== 'CHECK_IN' && rawOutcome !== 'CHECK_OUT') {
      const mapped = mapOutcomeFeedback(rawOutcome, data.detail || data.message);
      return {
        success: false,
        outcome: mapped.outcome,
        title: mapped.title,
        message: mapped.message,
        rawError: data.message || data.detail,
        status: 200
      };
    }

    // Determine actual punch outcome
    const outcome: 'CHECK_IN' | 'CHECK_OUT' =
      rawOutcome === 'CHECK_OUT' || data.punch_type === 'OUT' ? 'CHECK_OUT' : 'CHECK_IN';

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
