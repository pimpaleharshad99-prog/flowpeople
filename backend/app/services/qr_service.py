import hmac
import hashlib
import time
import secrets
from typing import Dict, Any, Tuple, Optional, Set
from app.core.config import settings

SECRET_KEY = getattr(settings, "SECRET_KEY", "flowpeople-enterprise-biometrics-secure-key-2026")
QR_TOKEN_VALIDITY_SECONDS = 60 # Maximum validity window for rotating QR tokens

# Set of consumed nonces to prevent replay attacks: (nonce, timestamp)
CONSUMED_NONCES: Dict[str, float] = {}

def cleanup_expired_nonces():
    now = time.time()
    expired = [nonce for nonce, ts in CONSUMED_NONCES.items() if now - ts > QR_TOKEN_VALIDITY_SECONDS * 2]
    for nonce in expired:
        CONSUMED_NONCES.pop(nonce, None)

def generate_kiosk_qr_payload(company_id: int, kiosk_id: str = "KIOSK-MAIN-01") -> Dict[str, Any]:
    """
    Generates a secure, time-bound, cryptographically signed QR token.
    Token format: FPQR:{version}:{company_id}:{kiosk_id}:{timestamp}:{nonce}:{signature}
    """
    cleanup_expired_nonces()
    timestamp = int(time.time())
    nonce = secrets.token_hex(8)
    version = "1"

    data_to_sign = f"{version}:{company_id}:{kiosk_id}:{timestamp}:{nonce}"
    signature = hmac.new(
        SECRET_KEY.encode(),
        data_to_sign.encode(),
        hashlib.sha256
    ).hexdigest()

    qr_token = f"FPQR:{data_to_sign}:{signature}"

    return {
        "qr_token": qr_token,
        "kiosk_id": kiosk_id,
        "company_id": company_id,
        "timestamp": timestamp,
        "expires_in_seconds": QR_TOKEN_VALIDITY_SECONDS,
        "refresh_interval_seconds": 15
    }

def verify_kiosk_qr_payload(qr_token: str, company_id: int) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifies token validity, cryptographic HMAC signature, anti-replay freshness, and company isolation.
    Returns: (is_valid, kiosk_id, error_message)
    """
    cleanup_expired_nonces()

    if not qr_token or not qr_token.startswith("FPQR:"):
        return False, None, "Invalid QR code format. Not a recognized FlowPeople attendance token."

    parts = qr_token.split(":")
    if len(parts) != 7:
        return False, None, "Malformed QR code token."

    _, version, token_company_id, kiosk_id, token_timestamp_str, nonce, signature = parts

    # 1. Company check
    try:
        if int(token_company_id) != company_id:
            return False, None, "QR code belongs to a different organization."
    except ValueError:
        return False, None, "Invalid organization ID in token."

    # 2. Freshness and Expiry Check
    try:
        token_time = int(token_timestamp_str)
    except ValueError:
        return False, None, "Invalid timestamp in token."

    current_time = int(time.time())
    age = current_time - token_time

    if age < -5:
        return False, None, "QR code clock skew error (future timestamp)."

    if age > QR_TOKEN_VALIDITY_SECONDS:
        return False, None, f"QR code has expired ({age}s old). Please scan the current rotating code."

    # 3. Anti-Replay: Check if nonce was already consumed
    if nonce in CONSUMED_NONCES:
        return False, None, "QR code already used (replay attack detected). Please scan a fresh code."

    # 4. Cryptographic HMAC Signature Verification
    data_to_sign = f"{version}:{token_company_id}:{kiosk_id}:{token_timestamp_str}:{nonce}"
    expected_signature = hmac.new(
        SECRET_KEY.encode(),
        data_to_sign.encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature):
        return False, None, "QR code cryptographic signature verification failed."

    # Mark nonce as consumed
    CONSUMED_NONCES[nonce] = current_time

    return True, kiosk_id, None

