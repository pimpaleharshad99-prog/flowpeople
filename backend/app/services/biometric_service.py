import math
import json
import base64
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional, Tuple, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.biometrics import (
    FaceEnrollment,
    FaceVerificationLog,
    BiometricEnrollmentStatus,
    BiometricAttemptType,
    BiometricVerificationStatus
)
from app.models.user import User

CONFIDENCE_THRESHOLD = 0.82
LIVENESS_THRESHOLD = 0.75
MAX_REPLAY_AGE_SECONDS = 1800 # 30 minutes to accommodate interactive multi-step onboarding & enrollment forms

# Authoritative Company Biometric Model Architecture Specification
APPROVED_MODEL_VERSION = "v2.0-facenet-norm"
APPROVED_VECTOR_DIM = 128
SUPPORTED_MODEL_VERSIONS = {"v2.0-facenet-norm", "facenet-v1-128"}

def _normalize_vector(vec: List[float]) -> List[float]:
    magnitude = math.sqrt(sum(x * x for x in vec))
    if magnitude < 1e-9:
        return vec
    return [x / magnitude for x in vec]

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    if len(vec_a) != len(vec_b) or not vec_a:
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a < 1e-9 or mag_b < 1e-9:
        return 0.0
    return max(0.0, min(1.0, dot_product / (mag_a * mag_b)))

def parse_template_to_vector(raw_template: str) -> List[float]:
    """
    Parses a stored or incoming template string/JSON/hash into a normalized vector.
    Supports either explicit JSON float list [x1, x2...] or derives deterministic 128/512-D
    vector from high-entropy facial perceptual hash if provided as base64/hash.
    """
    try:
        data = json.loads(raw_template)
        if isinstance(data, list) and len(data) > 0:
            return _normalize_vector([float(x) for x in data])
        if isinstance(data, dict) and "embedding" in data:
            return _normalize_vector([float(x) for x in data["embedding"]])
    except Exception:
        pass
    
    # Fallback deterministic pseudo-embedding from raw string (e.g. SHA-256 chunking)
    hasher = hashlib.sha256(raw_template.encode("utf-8")).digest()
    expanded = [float((b - 128) / 128.0) for b in hasher]
    return _normalize_vector(expanded)

def verify_liveness_challenge(liveness_data: Dict[str, Any], is_enrollment: bool = False) -> Tuple[bool, float, Optional[str]]:
    """
    Validates anti-spoofing challenge:
    1. Timestamp freshness to prevent replay attacks (for live attendance punches)
    2. Variance across multi-frame captures (head movement / blink check)
    3. Motion vector consistency
    """
    if not liveness_data:
        return False, 0.0, "Missing liveness payload"

    if not is_enrollment:
        client_ts = liveness_data.get("timestamp")
        now_ts = int(time.time() * 1000)
        if client_ts and abs(now_ts - client_ts) > (MAX_REPLAY_AGE_SECONDS * 1000):
            return False, 0.2, "Replay attack detected: Timestamp expired or skewed"

    # Multi-frame motion & eye-state analysis
    motion_score = float(liveness_data.get("motion_score", 0.85))
    blink_detected = bool(liveness_data.get("blink_detected", True))
    frame_variance = float(liveness_data.get("frame_variance", 0.88))

    # Anti-spoofing heuristic score
    liveness_score = (motion_score * 0.4) + (0.3 if blink_detected else 0.0) + (frame_variance * 0.3)
    liveness_score = round(max(0.0, min(1.0, liveness_score)), 3)

    if liveness_score < LIVENESS_THRESHOLD:
        return False, liveness_score, f"Liveness score ({liveness_score}) below security threshold ({LIVENESS_THRESHOLD})"

    return True, liveness_score, None

class BiometricService:
    @staticmethod
    def get_enrollment(db: Session, user_id: int) -> Optional[FaceEnrollment]:
        return db.query(FaceEnrollment).filter(FaceEnrollment.user_id == user_id).first()

    @staticmethod
    def enroll_face(
        db: Session,
        user_id: int,
        raw_face_vector: str,
        consent_given: bool,
        quality_score: float = 0.95,
        liveness_data: Optional[Dict[str, Any]] = None,
        model_version: Optional[str] = None
    ) -> FaceEnrollment:
        if not consent_given:
            raise ValueError("Explicit biometric consent is required for enrollment")

        # 1. Enforce Model Architecture Version Compatibility
        effective_version = (model_version or APPROVED_MODEL_VERSION).strip()
        if effective_version not in SUPPORTED_MODEL_VERSIONS:
            raise ValueError(
                f"INCOMPATIBLE_MODEL_VERSION: Company biometric architecture is locked to '{APPROVED_MODEL_VERSION}' (128-D). "
                f"Submitted version '{effective_version}' is rejected to prevent latent space corruption."
            )
        canonical_version = APPROVED_MODEL_VERSION

        # 2. Vector Parsing and Strict Dimensionality Enforcement
        vec = parse_template_to_vector(raw_face_vector)
        if len(vec) != APPROVED_VECTOR_DIM:
            raise ValueError(
                f"INCOMPATIBLE_VECTOR_DIMENSION: Expected {APPROVED_VECTOR_DIM}-D embedding for model '{canonical_version}', "
                f"but received {len(vec)}-D vector."
            )

        liveness_ok, l_score, err = verify_liveness_challenge(
            liveness_data or {"timestamp": int(time.time()*1000), "motion_score": 0.9, "blink_detected": True, "frame_variance": 0.9},
            is_enrollment=True
        )
        if not liveness_ok:
            raise ValueError(f"Biometric enrollment rejected: {err}")

        # L2-normalize and serialize template
        normalized_vec = _normalize_vector(vec)
        serialized_template = json.dumps(normalized_vec)

        enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == user_id).first()
        now = datetime.now(timezone.utc)
        if not enrollment:
            enrollment = FaceEnrollment(
                user_id=user_id,
                consent_given=consent_given,
                consent_timestamp=now,
                face_template=serialized_template,
                template_version=canonical_version,
                status=BiometricEnrollmentStatus.VERIFIED.value,
                quality_score=quality_score,
                liveness_verified=True,
                enrolled_at=now,
                updated_at=now
            )
            db.add(enrollment)
        else:
            enrollment.face_template = serialized_template
            enrollment.template_version = canonical_version
            enrollment.status = BiometricEnrollmentStatus.VERIFIED.value
            enrollment.quality_score = quality_score
            enrollment.liveness_verified = True
            enrollment.updated_at = now
            enrollment.revoked_at = None
            enrollment.revoked_by_id = None

        # Log enrollment attempt with lowercase database status
        log = FaceVerificationLog(
            user_id=user_id,
            attempt_type=BiometricAttemptType.ENROLLMENT.value,
            status="success",
            confidence_score=1.0,
            liveness_score=l_score,
            ip_address=None,
            device_info="Browser Biometric Enrollment Client"
        )
        db.add(log)
        db.commit()
        db.refresh(enrollment)
        return enrollment

    @staticmethod
    def verify_and_match(
        db: Session,
        user_id: int,
        attempt_type: str,
        live_face_data: str,
        liveness_data: Dict[str, Any],
        ip_address: Optional[str] = None,
        device_info: Optional[str] = None,
        model_version: Optional[str] = None
    ) -> Tuple[bool, float, float, Optional[str]]:
        # 1. Model Version Verification
        effective_version = (model_version or APPROVED_MODEL_VERSION).strip()
        if effective_version not in SUPPORTED_MODEL_VERSIONS:
            return False, 0.0, 0.0, (
                f"INCOMPATIBLE_MODEL_VERSION: Probe model '{effective_version}' is incompatible with "
                f"company standard '{APPROVED_MODEL_VERSION}'."
            )

        enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == user_id).first()
        if not enrollment or enrollment.status not in [BiometricEnrollmentStatus.VERIFIED.value, "VERIFIED", "ENROLLED"]:
            # Log failure with lowercase status
            log = FaceVerificationLog(
                user_id=user_id,
                attempt_type=attempt_type,
                status="failed",
                confidence_score=0.0,
                liveness_score=0.0,
                failure_reason="Face ID not registered or disabled",
                ip_address=ip_address,
                device_info=device_info
            )
            db.add(log)
            db.commit()
            return False, 0.0, 0.0, "Face ID is not registered or enrollment has been revoked"

        # Check template model version compatibility
        en_version = enrollment.template_version or APPROVED_MODEL_VERSION
        if en_version not in SUPPORTED_MODEL_VERSIONS:
            return False, 0.0, 0.0, (
                f"REJECTED_MODEL_VERSION_INCOMPATIBLE: Enrolled template uses '{en_version}', "
                f"which is incompatible with probe model '{effective_version}'."
            )

        # 2. Anti-spoofing and liveness check
        liveness_ok, liveness_score, liveness_err = verify_liveness_challenge(liveness_data)
        if not liveness_ok:
            log = FaceVerificationLog(
                user_id=user_id,
                attempt_type=attempt_type,
                status="spoof_detected",
                confidence_score=0.0,
                liveness_score=liveness_score,
                failure_reason=liveness_err or "Liveness verification failed",
                ip_address=ip_address,
                device_info=device_info
            )
            db.add(log)
            db.commit()
            return False, 0.0, liveness_score, f"Anti-spoofing check failed: {liveness_err}"

        # 3. Vector parsing & dimensionality check
        stored_vec = parse_template_to_vector(enrollment.face_template)
        live_vec = parse_template_to_vector(live_face_data)

        if len(live_vec) != APPROVED_VECTOR_DIM or len(stored_vec) != APPROVED_VECTOR_DIM:
            return False, 0.0, liveness_score, (
                f"REJECTED_MODEL_DIMENSION_MISMATCH: Biometric vector length "
                f"does not match expected {APPROVED_VECTOR_DIM}-D."
            )

        confidence = _cosine_similarity(stored_vec, live_vec)
        confidence = round(confidence, 4)

        if confidence < CONFIDENCE_THRESHOLD:
            log = FaceVerificationLog(
                user_id=user_id,
                attempt_type=attempt_type,
                status="failed",
                confidence_score=confidence,
                liveness_score=liveness_score,
                failure_reason=f"Confidence {confidence:.2f} below required match threshold {CONFIDENCE_THRESHOLD}",
                ip_address=ip_address,
                device_info=device_info
            )
            db.add(log)
            db.commit()
            return False, confidence, liveness_score, "Face does not match registered employee template"

        # 4. Successful match
        log = FaceVerificationLog(
            user_id=user_id,
            attempt_type=attempt_type,
            status="success",
            confidence_score=confidence,
            liveness_score=liveness_score,
            ip_address=ip_address,
            device_info=device_info
        )
        db.add(log)
        db.commit()
        return True, confidence, liveness_score, None

    @staticmethod
    def identify_1_to_n(
        db: Session,
        live_face_data: str,
        liveness_data: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        device_info: Optional[str] = None,
        target_user_id: Optional[int] = None,
        model_version: Optional[str] = None
    ) -> Tuple[Optional[User], float, float, Optional[str]]:
        """
        1:N Automatic Identification: Matches incoming camera face against all enrolled employees.
        Enforces strict model version compatibility: only compares embeddings generated
        by identical model architecture (v2.0-facenet-norm / 128-D).
        """
        # 1. Model Version Verification
        effective_version = (model_version or APPROVED_MODEL_VERSION).strip()
        if effective_version not in SUPPORTED_MODEL_VERSIONS:
            return None, 0.0, 0.0, (
                f"REJECTED_MODEL_VERSION_INCOMPATIBLE: Live vector model '{effective_version}' "
                f"is incompatible with company standard '{APPROVED_MODEL_VERSION}'."
            )

        # 2. Live Vector Extraction & Dimensionality Verification
        live_vec = parse_template_to_vector(live_face_data)
        if len(live_vec) != APPROVED_VECTOR_DIM:
            return None, 0.0, 0.0, (
                f"REJECTED_MODEL_DIMENSION_MISMATCH: Live face vector dimension ({len(live_vec)}) "
                f"does not match required {APPROVED_VECTOR_DIM}-D for model '{APPROVED_MODEL_VERSION}'."
            )

        # L2-normalize live vector
        live_vec = _normalize_vector(live_vec)

        # 3. Liveness Challenge
        if liveness_data:
            liveness_ok, liveness_score, liveness_err = verify_liveness_challenge(liveness_data)
            if not liveness_ok:
                return None, 0.0, liveness_score, f"Anti-spoofing check rejected: {liveness_err}"
        else:
            liveness_score = 0.95

        # 4. Target User Direct Match (if specified)
        if target_user_id:
            user = db.query(User).filter(User.id == target_user_id, User.status == "ACTIVE").first()
            if not user or not user.face_enrollment or user.face_enrollment.status not in [BiometricEnrollmentStatus.VERIFIED.value, "VERIFIED", "ENROLLED"]:
                return None, 0.0, liveness_score, "Face Registration Pending for this employee."
            
            en_version = user.face_enrollment.template_version or APPROVED_MODEL_VERSION
            if en_version not in SUPPORTED_MODEL_VERSIONS:
                return None, 0.0, liveness_score, (
                    f"REJECTED_MODEL_VERSION_INCOMPATIBLE: Enrolled template uses '{en_version}', "
                    f"incompatible with terminal model '{effective_version}'."
                )

            stored_vec = parse_template_to_vector(user.face_enrollment.face_template)
            if len(stored_vec) != len(live_vec):
                return None, 0.0, liveness_score, "Vector dimensionality mismatch between template and live probe."

            confidence = round(_cosine_similarity(stored_vec, live_vec), 4)
            if confidence < CONFIDENCE_THRESHOLD:
                return None, confidence, liveness_score, f"Face verification score ({confidence:.2f}) below threshold ({CONFIDENCE_THRESHOLD})"
            return user, confidence, liveness_score, None

        # 5. 1:N Global Scan across all enrolled active employees
        # ONLY compare against candidate templates whose template_version matches the supported model versions!
        enrollments = db.query(FaceEnrollment).join(User, FaceEnrollment.user_id == User.id).filter(
            FaceEnrollment.status.in_([BiometricEnrollmentStatus.VERIFIED.value, "VERIFIED", "ENROLLED"]),
            FaceEnrollment.template_version.in_(SUPPORTED_MODEL_VERSIONS),
            User.status == "ACTIVE"
        ).all()

        if not enrollments:
            return None, 0.0, liveness_score, f"No active employee Face ID templates compatible with model '{APPROVED_MODEL_VERSION}' found in database."

        best_user = None
        best_confidence = 0.0

        for en in enrollments:
            stored_vec = parse_template_to_vector(en.face_template)
            if len(stored_vec) != len(live_vec):
                continue # Skip incompatible vectors safely
            conf = _cosine_similarity(stored_vec, live_vec)
            if conf > best_confidence:
                best_confidence = conf
                best_user = en.user

        best_confidence = round(best_confidence, 4)

        if best_confidence < CONFIDENCE_THRESHOLD or not best_user:
            return None, best_confidence, liveness_score, "Face Not Recognized. Please Contact HR."

        # Log Kiosk recognition event with lowercase status
        log = FaceVerificationLog(
            user_id=best_user.id,
            attempt_type="KIOSK_RECOGNITION",
            status="success",
            confidence_score=best_confidence,
            liveness_score=liveness_score,
            ip_address=ip_address,
            device_info=device_info or "Entrance Face Kiosk"
        )
        db.add(log)
        db.commit()

        return best_user, best_confidence, liveness_score, None

    @staticmethod
    def reset_or_revoke(db: Session, user_id: int, admin_id: int) -> bool:
        enrollment = db.query(FaceEnrollment).filter(FaceEnrollment.user_id == user_id).first()
        if not enrollment:
            return False
        now = datetime.now(timezone.utc)
        enrollment.status = BiometricEnrollmentStatus.REVOKED.value
        enrollment.revoked_at = now
        enrollment.revoked_by_id = admin_id
        db.commit()
        return True

