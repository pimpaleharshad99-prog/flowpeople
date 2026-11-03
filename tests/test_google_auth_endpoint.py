import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_google_auth_missing_credentials():
    """Validates 400 Bad Request if neither credential nor code is provided."""
    res = client.post("/api/v1/auth/google", json={})
    assert res.status_code == 400
    assert "Missing Google OAuth credential" in res.json()["detail"]

def test_google_auth_successful_id_token_login():
    """Validates successful login and JWT generation when Google ID token is verified."""
    mock_google_info = {
        "email": "google_test_user@flowcraft.io",
        "email_verified": True,
        "name": "Google Test User",
        "given_name": "Google",
        "family_name": "Tester",
        "picture": "https://lh3.googleusercontent.com/test_avatar.png",
        "sub": "12345678901234567890",
        "aud": settings.GOOGLE_CLIENT_ID
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_google_info

    with patch("httpx.Client.get", return_value=mock_resp):
        res = client.post("/api/v1/auth/google", json={
            "credential": "valid_mock_google_jwt_credential"
        })
        assert res.status_code == 200
        data = res.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "google_test_user@flowcraft.io"
        assert data["user"]["first_name"] == "Google"

def test_google_auth_authorization_code_flow():
    """Validates successful code exchange and token issuance."""
    mock_tokens = {
        "access_token": "mock_access_token_12345",
        "expires_in": 3600
    }
    mock_userinfo = {
        "email": "google_code_user@flowcraft.io",
        "email_verified": True,
        "name": "Code User",
        "given_name": "Code",
        "family_name": "User",
        "sub": "9876543210"
    }

    mock_resp_userinfo = MagicMock()
    mock_resp_userinfo.status_code = 200
    mock_resp_userinfo.json.return_value = mock_userinfo

    with patch("app.services.google_drive.exchange_code_for_tokens", return_value=mock_tokens):
        with patch("httpx.Client.get", return_value=mock_resp_userinfo):
            res = client.post("/api/v1/auth/google", json={
                "code": "mock_google_authorization_code_xyz"
            })
            assert res.status_code == 200
            data = res.json()
            assert "access_token" in data
            assert data["user"]["email"] == "google_code_user@flowcraft.io"

def test_google_auth_invalid_credential_rejected():
    """Validates 400 Bad Request when Google rejects the credential."""
    mock_fail_resp = MagicMock()
    mock_fail_resp.status_code = 400
    mock_fail_resp.text = "Invalid Value"

    with patch("httpx.Client.get", return_value=mock_fail_resp):
        res = client.post("/api/v1/auth/google", json={
            "credential": "invalid_credential_string"
        })
        assert res.status_code == 400
        assert "verification failed" in res.json()["detail"].lower()
