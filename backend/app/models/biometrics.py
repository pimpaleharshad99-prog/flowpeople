from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class BiometricEnrollmentStatus(str, enum.Enum):
    NOT_ENROLLED = "NOT_ENROLLED"
    NOT_REGISTERED = "NOT_REGISTERED" # Backward compatibility
    CONSENT_REQUIRED = "CONSENT_REQUIRED"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    PENDING = "PENDING"
    ENROLLED = "ENROLLED"
    VERIFIED = "VERIFIED" # Backward compatibility
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    REVOKED = "REVOKED"
    DISABLED = "DISABLED"

class BiometricAttemptType(str, enum.Enum):
    ENROLLMENT = "ENROLLMENT"
    CHECK_IN = "CHECK_IN"
    CHECK_OUT = "CHECK_OUT"
    VERIFY = "VERIFY"

class BiometricVerificationStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SPOOF_DETECTED = "SPOOF_DETECTED"
    FALLBACK_USED = "FALLBACK_USED"

class FaceEnrollment(Base):
    __tablename__ = "face_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    consent_given = Column(Boolean, default=True, nullable=False)
    consent_timestamp = Column(DateTime(timezone=True), default=utcnow)
    face_template = Column(Text, nullable=False) # Encrypted / hashed biometric vector
    template_version = Column(String(50), default="v1.0-facenet-512")
    status = Column(String(50), default=BiometricEnrollmentStatus.VERIFIED.value, nullable=False)
    quality_score = Column(Float, default=0.95)
    liveness_verified = Column(Boolean, default=True)
    enrolled_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoked_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", foreign_keys=[user_id], back_populates="face_enrollment")
    revoked_by = relationship("User", foreign_keys=[revoked_by_id])

class FaceVerificationLog(Base):
    __tablename__ = "face_verification_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    attempt_type = Column(String(50), default=BiometricAttemptType.CHECK_IN.value, nullable=False)
    status = Column(String(50), default=BiometricVerificationStatus.SUCCESS.value, nullable=False)
    confidence_score = Column(Float, default=0.0)
    liveness_score = Column(Float, default=0.0)
    failure_reason = Column(String(255), nullable=True)
    ip_address = Column(String(100), nullable=True)
    device_info = Column(String(255), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="face_logs")

class FingerprintEnrollment(Base):
    __tablename__ = "fingerprint_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    credential_id = Column(String(255), nullable=False) # WebAuthn credential ID or scanner template hash
    public_key = Column(Text, nullable=True) # WebAuthn public key or scanner public descriptor
    device_name = Column(String(100), default="Platform Biometric / USB Scanner")
    counter = Column(Integer, default=0)
    status = Column(String(50), default="VERIFIED", nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", foreign_keys=[user_id])

