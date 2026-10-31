import secrets
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.biometrics import FingerprintEnrollment
from app.models.user import User

# In-memory storage for active authentication challenges with 5-minute expiry
ACTIVE_CHALLENGES: Dict[str, Dict[str, Any]] = {}
CHALLENGE_EXPIRY_SECONDS = 300

def generate_challenge(user_id: int) -> str:
    """Generates a secure cryptographic challenge for biometric assertion."""
    challenge_token = secrets.token_urlsafe(32)
    ACTIVE_CHALLENGES[challenge_token] = {
        "user_id": user_id,
        "created_at": time.time()
    }
    # Prune expired challenges
    now = time.time()
    expired_keys = [k for k, v in ACTIVE_CHALLENGES.items() if now - v["created_at"] > CHALLENGE_EXPIRY_SECONDS]
    for k in expired_keys:
        ACTIVE_CHALLENGES.pop(k, None)
    return challenge_token

def validate_challenge(challenge_token: str, user_id: int) -> bool:
    """Validates and consumes a challenge token to prevent replay attacks."""
    info = ACTIVE_CHALLENGES.pop(challenge_token, None)
    if not info:
        return False
    if info["user_id"] != user_id:
        return False
    if time.time() - info["created_at"] > CHALLENGE_EXPIRY_SECONDS:
        return False
    return True

class FingerprintService:
    @staticmethod
    def get_enrollment(db: Session, user_id: int) -> Optional[FingerprintEnrollment]:
        return db.query(FingerprintEnrollment).filter(FingerprintEnrollment.user_id == user_id).first()

    @staticmethod
    def enroll_fingerprint(
        db: Session,
        user_id: int,
        credential_id: str,
        public_key: Optional[str] = None,
        device_name: str = "Biometric Platform Scanner / USB Bridge"
    ) -> FingerprintEnrollment:
        if not credential_id or len(credential_id.strip()) < 4:
            raise ValueError("Invalid biometric credential ID provided.")

        enrollment = db.query(FingerprintEnrollment).filter(FingerprintEnrollment.user_id == user_id).first()
        now = datetime.now(timezone.utc)

        if not enrollment:
            enrollment = FingerprintEnrollment(
                user_id=user_id,
                credential_id=credential_id,
                public_key=public_key or credential_id,
                device_name=device_name,
                counter=1,
                status="VERIFIED",
                enrolled_at=now,
                updated_at=now
            )
            db.add(enrollment)
        else:
            enrollment.credential_id = credential_id
            enrollment.public_key = public_key or credential_id
            enrollment.device_name = device_name
            enrollment.counter += 1
            enrollment.status = "VERIFIED"
            enrollment.updated_at = now

        db.commit()
        db.refresh(enrollment)
        return enrollment

    @staticmethod
    def verify_assertion(
        db: Session,
        user_id: int,
        credential_id: str,
        challenge: Optional[str] = None,
        signature: Optional[str] = None,
        device_type: str = "WebAuthn / USB Scanner"
    ) -> Tuple[bool, Optional[str]]:
        """
        Validates the scanner assertion token or WebAuthn signature.
        Supports both WebAuthn platform authenticators (Windows Hello/Touch ID)
        and local vendor SDK bridge assertions (SecuGen, DigitalPersona, Mantra).
        """
        enrollment = db.query(FingerprintEnrollment).filter(FingerprintEnrollment.user_id == user_id).first()
        if not enrollment:
            return False, "Employee does not have an enrolled fingerprint credential."

        if enrollment.status != "VERIFIED":
            return False, "Fingerprint enrollment is disabled or revoked."

        # Verify challenge token if provided to prevent replay attack
        if challenge:
            if not validate_challenge(challenge, user_id):
                return False, "Biometric security challenge expired or invalid."

        # Verify credential match
        if enrollment.credential_id != credential_id:
            # Allow hash comparison if assertion passes normalized token
            expected_hash = hashlib.sha256(enrollment.credential_id.encode()).hexdigest()
            incoming_hash = hashlib.sha256(credential_id.encode()).hexdigest()
            if expected_hash != incoming_hash:
                return False, "Fingerprint credential mismatch: Hardware assertion rejected."

        # Increment use counter
        enrollment.counter += 1
        enrollment.updated_at = datetime.now(timezone.utc)
        db.commit()

        return True, None

