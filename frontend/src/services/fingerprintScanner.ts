/**
 * FlowPeople Modular Fingerprint & Thumb Scanner Integration Service
 * 
 * Architecture:
 * 1. WebAuthn Platform Biometrics (Windows Hello Fingerprint, Apple Touch ID, Android Biometrics)
 * 2. Vendor Local Bridge Adapters (SecuGen WebAPI, DigitalPersona U.are.U WebSDK, Mantra MFS100 RD)
 */

export interface ScannerHardwareStatus {
  hasWebAuthn: boolean;
  activeVendorBridge: string | null;
  detectedDevices: string[];
  recommendedSetup: string;
}

export interface BiometricAssertion {
  credential_id: string;
  signature?: string;
  device: string;
  rawAssertion?: any;
}

const VENDOR_BRIDGES = [
  { name: 'SecuGen WebAPI', url: 'https://127.0.0.1:8443/SGIFPScan' },
  { name: 'DigitalPersona WebSDK', url: 'http://127.0.0.1:11101/device/status' },
  { name: 'Mantra MFS100 RD Service', url: 'http://127.0.0.1:11100/rd/info' },
];

export const fingerprintScanner = {
  /**
   * Probes system for platform biometric authenticators and vendor local bridge services.
   */
  detectHardware: async (): Promise<ScannerHardwareStatus> => {
    let hasWebAuthn = false;
    const detectedDevices: string[] = [];

    // 1. Check Native Platform WebAuthn
    if (window.PublicKeyCredential) {
      try {
        hasWebAuthn = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (hasWebAuthn) {
          detectedDevices.push('Platform Biometric Authenticator (Windows Hello / Touch ID / Android)');
        }
      } catch (err) {
        console.warn('WebAuthn platform check error:', err);
      }
    }

    // 2. Probe local vendor bridges with 800ms fast timeout
    let activeVendorBridge: string | null = null;
    for (const bridge of VENDOR_BRIDGES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);
        const res = await fetch(bridge.url, { 
          method: 'GET', 
          signal: controller.signal,
          mode: 'cors'
        }).catch(() => null);
        clearTimeout(timeoutId);

        if (res && (res.ok || res.status === 401 || res.status === 404)) {
          activeVendorBridge = bridge.name;
          detectedDevices.push(`${bridge.name} Local Bridge Service`);
          break;
        }
      } catch {
        // Bridge not running locally
      }
    }

    return {
      hasWebAuthn,
      activeVendorBridge,
      detectedDevices,
      recommendedSetup: detectedDevices.length > 0
        ? 'Biometric hardware sensor is detected and ready for authentication.'
        : 'No physical fingerprint scanner detected. Connect a USB scanner (SecuGen, DigitalPersona, Mantra) or enable Windows Hello / Touch ID.'
    };
  },

  /**
   * Captures a fingerprint assertion using WebAuthn or Vendor Bridge.
   */
  captureFingerprint: async (challengeStr: string): Promise<BiometricAssertion> => {
    // 1. Try WebAuthn Platform Biometric Authenticator
    if (window.PublicKeyCredential && navigator.credentials) {
      try {
        const challengeBuffer = new TextEncoder().encode(challengeStr);
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: challengeBuffer,
            timeout: 60000,
            userVerification: 'required'
          }
        }) as PublicKeyCredential | null;

        if (credential) {
          return {
            credential_id: credential.id,
            signature: btoa(String.fromCharCode(...new Uint8Array((credential.response as any).signature || []))),
            device: 'Platform Fingerprint Sensor'
          };
        }
      } catch (err: any) {
        // If user cancelled or rejected, propagate error
        if (err.name === 'NotAllowedError') {
          throw new Error('Biometric verification cancelled or thumbprint not recognized by sensor.');
        }
        console.warn('WebAuthn get error, trying vendor fallback:', err);
      }
    }

    // 2. Vendor SDK Hardware Fallback (probes SecuGen / Mantra if connected)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:11100/rd/capture', {
        method: 'CAPTURE',
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const data = await res.text();
        return {
          credential_id: btoa(data.substring(0, 64)),
          device: 'Mantra MFS100 Optical Scanner'
        };
      }
    } catch {
      // Vendor bridge not responding
    }

    // If neither is connected, throw explicit hardware error
    throw new Error(
      'No compatible fingerprint scanner or biometric bridge detected. Please ensure your USB scanner is connected or Windows Hello/Touch ID is enabled.'
    );
  },

  /**
   * Enrolls a new fingerprint credential on this terminal.
   */
  enrollFingerprint: async (user: { id: string; name: string; displayName: string }, challengeStr: string): Promise<{ credential_id: string; public_key: string; device: string }> => {
    if (window.PublicKeyCredential && navigator.credentials) {
      const challengeBuffer = new TextEncoder().encode(challengeStr);
      const userIdBuffer = new TextEncoder().encode(user.id);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: { name: 'FlowPeople Enterprise HRMS' },
          user: {
            id: userIdBuffer,
            name: user.name,
            displayName: user.displayName
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000
        }
      }) as PublicKeyCredential | null;

      if (credential) {
        return {
          credential_id: credential.id,
          public_key: btoa(String.fromCharCode(...new Uint8Array((credential.response as any).getPublicKey?.() || []))),
          device: 'Platform Biometric Authenticator'
        };
      }
    }

    throw new Error('Biometric hardware enrollment failed or was cancelled by user.');
  }
};

