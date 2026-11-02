# FLOWPEOPLE HRMS SAAS: GOOGLE DRIVE OAUTH 2.0 INTEGRATION GUIDE
## Production Setup, Google Cloud Configuration, and Security Manual

> **Product:** FlowPeople by FlowCraft  
> **Module:** Cloud Integrations → Google Drive Enterprise Storage  
> **Protocol:** Google OAuth 2.0 Web Server Authorization Flow (`access_type=offline`)  
> **API Version:** Google Drive REST API v3  
> **Security:** AES-128-CBC + HMAC-SHA256 (Fernet) Encryption, JWT CSRF State Tokens, Organization-level RLS  
> **Detected Redirect URI (Local Dev):** `http://127.0.0.1:8000/api/integrations/google-drive/callback`  
> **Detected Frontend Base:** `http://localhost:5173`  

---

## 1. Overview and Architecture

FlowPeople connects directly to an organization's Google Drive to archive official workforce records:
- **Daily Attendance Rosters** (PDF with vector header and summary KPIs)
- **Daily Attendance Matrices** (CSV with full clock in/out timestamps)
- **Monthly Attendance Summaries** (CSV for period close audits)
- **Leave Requests & Approvals** (CSV)
- **Payroll Summaries & Payslips** (CSV)

### Key Architectural Invariants
1. **Google Drive is ONLY used as a document archive.** Supabase PostgreSQL remains the primary system of record.
2. **HR Admin Never Inputs Secrets:** No Google passwords, Client Secrets, or Service Account JSON keys are handled by customers.
3. **One-Click Authorization:** The HR Admin clicks **Connect Google Drive** -> authorizes via Google's official consent screen -> redirected back.
4. **Resilience & Independence:** Live attendance punches (Face ID, kiosk, terminal) never depend on Google Drive. If Google Drive is down or token expires, check-in operations succeed 100% without blocking.

---

## 2. Google Cloud Console Setup (Step-by-Step)

Follow these steps to obtain the official OAuth 2.0 credentials for FlowPeople:

### Step 2.1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar -> **New Project**.
3. Set **Project Name:** `FlowPeople-HRMS` (or your company name).
4. Click **Create** and select the newly created project.

### Step 2.2: Enable Google Drive API
1. In the left navigation, go to **APIs & Services** → **Library**.
2. In the search box, type `Google Drive API`.
3. Select **Google Drive API** and click **Enable**.

### Step 2.3: Configure OAuth Consent Screen
1. In the left navigation, go to **APIs & Services** → **OAuth consent screen**.
2. Select **User Type:**
   - Choose **Internal** if only employees within your Google Workspace domain will connect.
   - Choose **External** if multiple tenant organizations with separate Google Workspace/Gmail accounts will connect (standard for multi-tenant SaaS).
3. Click **Create**.
4. Fill in the App Information:
   - **App Name:** `FlowPeople by FlowCraft`
   - **User Support Email:** Your support or admin email (e.g. `support@flowcraft.io`).
   - **App Logo:** Upload the FlowPeople logo (optional for testing).
   - **Developer Contact Information:** Your developer email.
5. Click **Save and Continue**.
6. **Scopes Section:**
   Click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/drive.file` *(Per-file Drive access created by FlowPeople)*
   - `https://www.googleapis.com/auth/userinfo.email` *(Displays connected account email in HR dashboard)*
7. Click **Update** → **Save and Continue**.
8. **Test Users (External Mode in Testing):**
   - Add the Google account emails of company administrators who will test the connection.
   - Click **Save and Continue**.

### Step 2.4: Create OAuth 2.0 Client Credentials
1. In the left navigation, go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Select **Application type:** `Web application`.
4. Set **Name:** `FlowPeople Web Server`.
5. **Authorized JavaScript origins:**
   - Local Development:
     - `http://localhost:5173`
     - `http://127.0.0.1:5173`
     - `http://127.0.0.1:8000`
   - Production:
     - `https://app.flowpeople.io` (or your production domain)
6. **Authorized redirect URIs (EXACT MATCH REQUIRED):**
   - Local Development:
     - `http://127.0.0.1:8000/api/integrations/google-drive/callback`
     - `http://localhost:8000/api/integrations/google-drive/callback`
   - Production:
     - `https://api.flowpeople.io/api/integrations/google-drive/callback`
7. Click **Create**.
8. A modal will appear with:
   - **Client ID** (e.g., `1234567890-abcdefg.apps.googleusercontent.com`)
   - **Client Secret** (e.g., `GOCSPX-xxxxxxxxxxxxxxxxx`)
9. Copy both values.

---

## 3. Environment Variables Configuration

Open `backend/.env` and paste your Google credentials:

```env
# Google Drive OAuth 2.0 Integration Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/integrations/google-drive/callback
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email
GOOGLE_OAUTH_ENABLED=true
FRONTEND_URL=http://localhost:5173
```

Restart your backend server to load the new credentials:
```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

---

## 4. Automatic Dedicated Folder Structure

When an organization connects their Google Drive, FlowPeople automatically builds the following isolated hierarchy inside the user's Drive:

```
Google Drive/
└── FlowPeople/
    └── [Company Name]/
        ├── Attendance/
        │   └── 2026/
        │       └── November/
        │           ├── Attendance_Report_2026-11-02.pdf
        │           └── Attendance_Roster_2026-11-02.csv
        ├── Employees/
        │   └── Employee_Reports/
        ├── Payroll/
        │   └── Payslips/
        │       └── Payroll_Summary_Report_2026-11-02.csv
        └── Leave/
            └── Leave_Reports/
                └── Leave_Summary_Report_2026-11-02.csv
```

- Folder IDs are stored in the `organization_integrations` table.
- Folder names use real organization titles.
- The system checks for existing folder names before creating new ones to prevent duplicate folders on reconnection.

---

## 5. Security & Multi-Tenant Protection

1. **Token Encryption:**
   - Refresh tokens are encrypted using **Fernet (AES-128-CBC + HMAC-SHA256)** with a cryptographic key derived from `SECRET_KEY`.
   - Raw tokens are never stored in plaintext and never returned to the frontend.
2. **CSRF State Verification:**
   - Every `/connect` request issues a signed JWT state token containing `company_id`, `user_id`, `role`, and a 15-minute expiry.
   - The `/callback` handler verifies the signature; any tampered or forged state is rejected immediately.
3. **Role-Based Access Control (RBAC):**
   - Access to Google Drive settings, connection buttons, and upload controls is strictly restricted to `ORGANIZATION_OWNER`, `HR_ADMIN`, `COMPANY_ADMIN`, and `ADMIN`.
   - Normal `EMPLOYEE` and `MANAGER` roles receive `403 Forbidden`.
4. **Row Level Security (RLS):**
   - Supabase PostgreSQL migration `supabase/migrations/20261102200000_google_drive_integrations.sql` applies RLS policies guaranteeing tenant isolation.

---

## 6. How HR Admins Connect Google Drive

1. Log into FlowPeople as Organization Owner or HR Admin.
2. Navigate to **Company Structure** (`Organization`) → click **Cloud & Google Drive Integrations** tab (or via **HR Admin Portal** → **Google Drive Cloud Backup**).
3. The integration card displays current status.
4. Click **Connect Google Drive**.
5. You are redirected to Google's official OAuth consent page.
6. Select your company's Google account and click **Allow**.
7. Google redirects to the FlowPeople backend callback, which securely exchanges the code for tokens, initializes your company's folders, and returns you to FlowPeople.
8. The card immediately updates to:
   - Status: **Google Drive Connected** (Green pulse badge)
   - Connected Email: `admin@yourcompany.com`
   - Folder Path: `FlowPeople/[Your Company]`
9. Toggle automation preferences (Daily Attendance Reports, Monthly Summaries) or click **Upload to Drive** for on-demand sync.

---

## 7. How to Disconnect

1. In **Settings → Cloud & Google Drive Integrations**, click **Disconnect**.
2. Confirm the prompt.
3. The backend revokes authorization with Google (`https://oauth2.googleapis.com/revoke`), deletes the encrypted refresh and access tokens, and resets status to `NOT_CONNECTED`.
4. **Existing files in Google Drive remain untouched.** Upload history is preserved.
5. The organization can reconnect at any time.

---

## 8. Verification & Test Commands

Run the automated test suite covering all 12 OAuth, encryption, background task, and isolation scenarios:

```powershell
$env:PYTHONPATH="F:\ZOHO\backend"
.\backend\.venv\Scripts\python.exe -m pytest tests/test_google_drive_integration.py -v
```

Expected result:
```
tests/test_google_drive_integration.py::test_1_unauthorized_employee_access_blocked PASSED
tests/test_google_drive_integration.py::test_2_unauthorized_manager_access_blocked PASSED
tests/test_google_drive_integration.py::test_3_hr_admin_access_allowed_and_unconfigured_graceful_state PASSED
tests/test_google_drive_integration.py::test_4_fernet_token_encryption_and_decryption PASSED
tests/test_google_drive_integration.py::test_5_oauth_state_tamper_validation PASSED
tests/test_google_drive_integration.py::test_6_oauth_connect_generation PASSED
tests/test_google_drive_integration.py::test_7_oauth_callback_handling PASSED
tests/test_google_drive_integration.py::test_8_update_integration_settings PASSED
tests/test_google_drive_integration.py::test_9_report_upload_to_google_drive PASSED
tests/test_google_drive_integration.py::test_10_cross_tenant_isolation PASSED
tests/test_google_drive_integration.py::test_11_disconnect_google_drive PASSED
tests/test_google_drive_integration.py::test_12_attendance_independent_of_google_drive PASSED
======================= 12 passed in 4.47s =======================
```

---

## 9. Troubleshooting & FAQ

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| **Status shows "Configuration Unavailable"** | `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is blank in `backend/.env`. | Fill in the client ID and secret in `backend/.env` and restart the backend server. |
| **Google Error: `redirect_uri_mismatch`** | The redirect URI in Google Cloud Console does not match `GOOGLE_REDIRECT_URI`. | In Google Cloud Console → Credentials → Web Client, add `http://127.0.0.1:8000/api/integrations/google-drive/callback` to **Authorized redirect URIs**. |
| **Status shows "Reauthorization Required"** | User revoked access from their Google Account settings, or refresh token expired. | Click **Connect Google Drive** again to re-authorize. |
| **Uploads show "Sync Failed"** | Organization Google Drive has exceeded storage quota or network timed out. | Check the Google Drive storage quota or verify internet connectivity. Use on-demand upload to retry. |
| **"Access Denied" on Settings** | Logged in as standard Employee or Manager. | Only Organization Owners and HR Admins can view or manage cloud storage integrations. |
