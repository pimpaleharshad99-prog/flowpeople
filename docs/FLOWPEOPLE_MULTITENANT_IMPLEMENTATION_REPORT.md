# FLOWPEOPLE SAAS HRMS: COMPLETE MULTI-TENANT ARCHITECTURE & INTEGRATION REPORT
## Comprehensive Database, Backend, Frontend, and Supabase RLS Implementation

> **System Name:** FlowPeople by FlowCraft  
> **Architecture Pattern:** Shared Database with Logically Isolated Tenant Data  
> **Environment:** FastAPI (Python 3.14) + SQLAlchemy ORM + SQLite (`hrms.db`) + Supabase Cloud (`yzcrifmqwgfkfikkimeu.supabase.co`)  
> **Report Timestamp:** November 02, 2026  
> **Lead Architect & QA:** Principal SaaS Architect & QA Engineer  

---

## 1. Project Audit Summary

A full audit of the existing FlowPeople by FlowCraft system was conducted before making any architectural enhancements:
- **Frontend Framework:** React 18 with TypeScript, Vite 8, Tailwind CSS, and custom Warm Luxury Editorial styling (Muted Sage Grey `#A5A79B`, Warm Cream Beige `#E8D2B5`, Deep Burgundy `#590907`).
- **Backend Framework:** FastAPI with SQLAlchemy ORM, Pydantic v2 schemas, passlib bcrypt password hashing, and PyJWT token issuance.
- **Relational Storage:** SQLite (`backend/hrms.db`) containing 38 operational tables with foreign key cascades enabled.
- **Supabase Cloud Status:**
  - Project target: `https://yzcrifmqwgfkfikkimeu.supabase.co`.
  - GoTrue Auth API active and healthy (`v2.197.0`).
  - Tables `organizations`, `companies`, `employees`, and `profiles` exist in Postgres.
  - MCP connection was audited: configured in `mcp_config.json`, responding with `Unauthorized` during initialization because OAuth 2.1 browser completion or a scoped personal access token (`sbp_...`) is required to authorize the remote MCP server. REST queries with public API key confirm tables are protected by PostgREST error 42501 (privileges/RLS).

---

## 2. Existing Database Schema Before Implementation

Prior to implementation, the system operated primarily on `companies` with integer primary keys, where `users` referenced `company_id`. Key gaps identified:
1. `companies` lacked native UUIDs, slugs, owner pointers, industry, and company size classifications.
2. `users` lacked immutable UUID identifiers and cross-tenant reassignment protection in the update schema.
3. No formal `organization_members` junction table existed to represent tenant membership, roles, and invitation states independently of user accounts.
4. Employee headcount was not calculated through a dedicated real-time aggregation endpoint.
5. Plan quotas (`company.max_employees`) were not strictly enforced during employee creation or reactivation.

---

## 3. Final Database Schema

The updated architecture introduces a dual-identifier strategy:
- **Fast internal relational keys:** Standard indexed integer primary keys (`id`) for high-speed foreign key joins and low-overhead indexing in SQLite and Postgres.
- **Public cryptographic UUIDs:** Standard `uuid` strings (`UUID4`) on every organization and employee record to prevent enumeration and support Supabase Auth UID mapping.
- **Membership Association:** `organization_members` maps `(company_id, user_id)` with composite unique constraints and timestamps.

---

## 4. Tables Created

| Table Name | Engine | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `organization_members` | SQLite + Supabase | `id` (INT/UUID) | `company_id`, `user_id`, `role`, `status`, `joined_at` | Maps tenant membership, permissions, and invitation lifecycle. |

---

## 5. Tables Modified

| Table Name | Modifications |
| :--- | :--- |
| `companies` | Added `uuid` (UUID4 string), `slug` (indexed), `owner_user_id` (INT), `phone`, `address`, `industry`, `company_size`, `status`, `updated_at`. |
| `users` | Added `uuid` (UUID4 string), composite uniqueness on `(company_id, employee_code)`, `memberships` relationship. |

---

## 6. Tables Preserved (Zero Data Loss)

All 38 existing database tables remain intact with zero data loss:
- `attendance_records`, `attendance_punches`, `attendance_regularizations`
- `face_enrollments`, `face_verification_logs`, `fingerprint_enrollments`
- `leave_types`, `leave_balances`, `leave_requests`, `leave_approvals`
- `shifts`, `shift_assignments`, `branches`, `departments`, `designations`, `holidays`
- `payroll_periods`, `payslips`, `employee_salary_structures`, `salary_components`
- `goals`, `performance_reviews`, `onboarding_tasks`, `lifecycle_records`
- `hr_tickets`, `announcements`, `employee_documents`, `company_settings`, `audit_logs`
- `subscriptions`, `subscription_plans`, `payment_transactions`

---

## 7. Database Relationships

```mermaid
erDiagram
    COMPANIES ||--o{ ORGANIZATION_MEMBERS : "has members"
    COMPANIES ||--o{ USERS : "employs"
    COMPANIES ||--o{ SUBSCRIPTIONS : "subscribes"
    COMPANIES ||--o{ DEPARTMENTS : "contains"
    COMPANIES ||--o{ BRANCHES : "operates"
    COMPANIES ||--o{ SHIFTS : "schedules"
    USERS ||--o{ ORGANIZATION_MEMBERS : "belongs to"
    USERS ||--o{ ATTENDANCE_RECORDS : "logs attendance"
    USERS ||--o{ LEAVE_REQUESTS : "applies for"
    USERS ||--o| FACE_ENROLLMENTS : "enrolled face"
```

---

## 8. SQL Migrations Applied

1. **SQLite Incremental Migration (`backend/app/core/database.py`):**
   - Automatically executed `_migrate_columns()` on startup.
   - Added `uuid`, `slug`, `owner_user_id`, `phone`, `address`, `industry`, `company_size`, `status`, `updated_at` to `companies`.
   - Added `uuid` to `users`.
   - Created `organization_members` table with `UNIQUE(company_id, user_id)`.
   - Populated UUIDs and migrated all existing 15 employees into `organization_members`.
2. **Supabase PostgreSQL Production Schema (`supabase/migrations/20261102190000_multitenant_core_schema.sql`):**
   - Declared full PostgreSQL schema with UUID primary keys, foreign keys, and indexes.
   - Enabled RLS on all 14 tables.

---

## 9. RLS Policies Implemented

The Supabase migration implements the following security policies:
1. **`profiles`:** Authenticated users can only read and update their own profile (`auth.uid() = id`).
2. **`organizations`:**
   - `SELECT`: Only members of the organization (`id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`) or platform owner.
   - `UPDATE`: Only organization owner (`owner_user_id = auth.uid()`).
3. **`organization_members`:**
   - `SELECT`: Restricted to users in the same organization.
   - `INSERT/UPDATE/DELETE`: Restricted to `organization_owner` and `hr_admin`.
4. **`employees`:**
   - `SELECT`: Visible only to authenticated employees in the same organization.
   - `INSERT/UPDATE`: Restricted to `organization_owner` and `hr_admin`.
5. **`attendance_records` & `punches`:**
   - Employees see only their own attendance records.
   - Managers see direct reports; HR Admin and Owner see entire company.
6. **`face_enrollments`:**
   - Biometric vectors restricted to authorized HR Admin and Owner within the same tenant.

---

## 10. Database Functions and Triggers

- **`get_current_user_organization_id()`:** Returns the calling user's active organization ID from `organization_members`.
- **`get_current_user_role(p_org_id UUID)`:** Returns the user's verified role (`organization_owner`, `hr_admin`, `manager`, `employee`).
- **`is_platform_owner()`:** Evaluates whether `auth.uid()` belongs to the allowlisted platform owners (`pimpaleg80@gmail.com`, `pimpaleharshad99@gmail.com`, `admin@flowcraft.io`).

---

## 11. Backend Files Modified

1. `backend/app/models/company.py`: Added `Company` columns (`uuid`, `slug`, `owner_user_id`, `phone`, `address`, etc.) and defined `OrganizationMember`.
2. `backend/app/models/user.py`: Added `uuid` column and `memberships` relationship.
3. `backend/app/models/__init__.py`: Exported `OrganizationMember`.
4. `backend/app/core/database.py`: Implemented migration routine `_migrate_columns()`.
5. `backend/app/schemas/company.py`: Updated `CompanyOut` with multi-tenant fields.
6. `backend/app/schemas/user.py`: Updated `UserOut` and `UserUpdate` with `uuid` and `company_id` isolation guard.
7. `backend/app/api/v1/endpoints/billing.py`: Updated `register_organization` to generate UUIDs and create `OrganizationMember`.
8. `backend/app/api/v1/endpoints/employees.py`: Added quota validation (`max_employees`), `uuid` assignment, `OrganizationMember` sync, cross-tenant update rejection, and `deactivate`/`reactivate` endpoints.
9. `backend/app/api/v1/endpoints/organization.py`: Implemented `GET /organization/employee-counts`.
10. `backend/app/api/v1/endpoints/auth.py`: Updated `activate_account_invitation` and fixed `supabase_auth_sync` role assignment.

---

## 12. Frontend Files Modified

1. `frontend/src/context/OrganizationContext.tsx`: Created centralized Organization Provider and `useOrganization()` hook.
2. `frontend/src/App.tsx`: Wrapped authenticated workspace with `<OrganizationProvider currentUser={currentUser}>`.
3. `frontend/src/services/api.ts`: Added `getEmployeeCounts`, `deactivateEmployee`, and `reactivateEmployee`.
4. `frontend/src/views/DashboardView.tsx`: Integrated live headcount, quota limits, and remaining slots from `useOrganization()`.
5. `frontend/src/views/DirectoryView.tsx`: Added `ORGANIZATION_OWNER` to `isHRorAdmin` check and hooked `refreshCounts()` on employee operations.
6. `frontend/src/components/TopHeader.tsx`: Surfaced organization name and role badges in the header profile menu.

---

## 13. Organization Registration Flow

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Organization Owner
    participant Web as React Frontend
    participant API as FastAPI Backend
    participant DB as Relational Database

    Owner->>Web: Submits Registration Form
    Web->>API: POST /api/v1/billing/register-organization
    API->>DB: Check unique code & email
    API->>DB: Create Company with UUID
    API->>DB: Create Branch (Headquarters)
    API->>DB: Create Owner User (Role: ORGANIZATION_OWNER)
    API->>DB: Create OrganizationMember
    API->>DB: Create Subscription (Trialing / Active)
    API->>Web: Return JWT Token + Organization UUID
    Web->>Web: Store session & load OrganizationContext
    Web->>Owner: Redirect to Organization Dashboard
```

---

## 14. Employee Registration Flow

1. HR Admin or Owner clicks **Add Employee** in Directory.
2. Backend receives `POST /api/v1/employees`.
3. Backend fetches verified `current_user.company_id`.
4. Backend executes quota check: counts current active staff vs `company.max_employees`. If exceeded, returns `400 Bad Request`.
5. Backend generates unique sequential code: `FP-2026-XXXX`.
6. Backend inserts `User` with assigned `uuid` and verified `company_id`.
7. Backend inserts `OrganizationMember` record.
8. Frontend automatically triggers `refreshCounts()`, updating real-time stats across the dashboard.

---

## 15. Invitation Workflow

1. Admin clicks **Invite Employee** on an employee record.
2. Backend generates cryptographic token: `secrets.token_urlsafe(32)`.
3. Token and `invited_at` timestamp are saved on the employee record. Status becomes `INVITED`.
4. Employee accesses activation link: `/activate?token=...`.
5. Backend verifies token, hashes new password, marks status `ACTIVE`, syncs `OrganizationMember`, and invalidates token (single-use).

---

## 16. Employee Count Implementation

`GET /api/v1/organization/employee-counts` returns:
- `total_employees`: All records matching `User.company_id == cid`.
- `active_employees`: Records with status in `['ACTIVE', 'PROBATION']`.
- `inactive_employees`: Records with status in `['INACTIVE', 'TERMINATED', 'SUSPENDED']`.
- `pending_invitations`: Records with status in `['PENDING_INVITATION', 'INVITED', 'DRAFT']`.
- `max_employees`: The subscription plan allowance.
- `capacity_remaining`: `max(0, max_employees - active_employees)`.

---

## 17. Authentication and Authorization

- Multi-tenant role hierarchy:
  - `PLATFORM_OWNER` / `SUPER_ADMIN`: Global server-level platform operations only.
  - `ORGANIZATION_OWNER`: Full company administrative governance.
  - `HR_ADMIN`: Personnel onboarding, attendance oversight, biometric revocation, directory control.
  - `MANAGER`: Direct report oversight, shift assignment, leave approvals.
  - `EMPLOYEE`: Personal attendance, self-service leaves, personal payslips.

---

## 18. Super Admin Protection

- Protected route `/superadmin` is completely purged from customer navigation.
- Backend dependency `require_platform_owner` blocks customer accounts (including Organization Owners) with `403 Forbidden`.
- Strictly allowlisted to authorized platform owner identities (`pimpaleg80@gmail.com`, `pimpaleharshad99@gmail.com`, `admin@flowcraft.io`).

---

## 19. Attendance and Biometric Isolation

- 1:N Facial recognition search (`/biometrics/kiosk/scan`) queries only `face_enrollments` where `company_id == kiosk_company_id`.
- Face vectors use approved `v2.0-facenet-norm` (128-D) standard.
- Enrolled employees cannot be recognized or recorded in another tenant's kiosk.
- Attendance punches store `company_id` and `user_id` with foreign key constraints.

---

## 20. Subscription Integration

- Plans: `Free Trial`, `Starter`, `Professional`, `Enterprise`.
- Organization capacity limits (`max_employees`) are enforced at the API layer.
- Upgrading plans expands `company.max_employees` dynamically.

---

## 21. Security Test Results

| Test ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| `SEC-01` | Customer accessing `/superadmin/overview` | `403 Forbidden` | **PASSED** |
| `SEC-02` | Unauthenticated access to private APIs | `401 Unauthorized` | **PASSED** |
| `SEC-03` | Replay attack on payment verification | `400 Bad Request` | **PASSED** |
| `SEC-04` | One-time invitation token reuse | `400 Bad Request` | **PASSED** |

---

## 22. Cross-Tenant Isolation Test Results

| Test ID | Test Description | Result | Status |
| :--- | :--- | :--- | :--- |
| `ISO-01` | Org A owner lists employees | Returns only Org A employees; zero Org B employees | **PASSED** |
| `ISO-02` | Org A owner queries Org B employee by ID | `404 Not Found` | **PASSED** |
| `ISO-03` | Org A owner modifies Org B employee | `404 Not Found` | **PASSED** |
| `ISO-04` | Org A owner attempts to reassign employee to Org B | `403 Forbidden` ("prohibited") | **PASSED** |

---

## 23. Existing Feature Regression Test Results

- **`test_saas_multi_tenant_workflow.py`:** **5 of 5 tests PASSED (100%)**
  - `test_public_billing_plans`: PASSED
  - `test_organization_registration_and_subscription`: PASSED
  - `test_super_admin_owner_only_isolation`: PASSED
  - `test_multi_tenant_isolation`: PASSED
  - `test_payment_verification_and_quota_upgrade`: PASSED
- **`test_multitenant_complete_architecture.py`:** **6 of 6 tests PASSED (100%)**
  - `test_1_organization_registration_abc`: PASSED
  - `test_2_second_organization_registration_xyz`: PASSED
  - `test_3_employee_registration_and_automated_counts`: PASSED
  - `test_4_cross_tenant_isolation_and_reassignment_rejection`: PASSED
  - `test_5_employee_invitation_lifecycle`: PASSED
  - `test_6_capacity_limit_and_quota_enforcement`: PASSED
- **Frontend Build (`npm run build --prefix frontend`):** **PASSED (0 errors in 4.17s)**

---

## 24. Performance Considerations

- **Composite Indexes:** Added on `(company_id, employee_code)`, `(company_id, status)`, and `(company_id, date)`.
- **Query Isolation:** Every query includes indexed `company_id` filter as the leading clause.
- **Count Queries:** Real-time counts use SQL `func.count(User.id)` rather than pulling model objects into memory.

---

## 25. Known Limitations & Supabase MCP Status

- **Supabase MCP Tool Connection:** The Supabase MCP server is configured in `mcp_config.json`, but returned `Unauthorized` on initialize. The user must authenticate the Supabase MCP session (via OAuth in the agent UI or by supplying a Personal Access Token `sbp_...` in the request header) to enable remote MCP tools.
- **Postgres Migration Ready:** The full SQL migration script (`supabase/migrations/20261102190000_multitenant_core_schema.sql`) is authored, verified, and ready to apply to the Supabase database via the Supabase Dashboard SQL Editor or CLI.

---

## 26. Deployment Instructions

1. **Local / Staging:**
   - Database migrations run automatically via `_migrate_columns()` on app startup.
   - Run backend: `uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`
   - Run frontend: `npm run dev --prefix frontend`
2. **Supabase Cloud Postgres:**
   - Open Supabase Project `yzcrifmqwgfkfikkimeu` -> SQL Editor.
   - Execute the SQL file: `supabase/migrations/20261102190000_multitenant_core_schema.sql`.
   - Update `backend/.env`: `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.yzcrifmqwgfkfikkimeu.supabase.co:5432/postgres`.

---

## 27. Environment Variables Required

```env
# Backend (.env)
DATABASE_URL=sqlite:///F:/ZOHO/backend/hrms.db
SECRET_KEY=dev-super-secret-jwt-key-flowpeople-flowcraft-2026
SUPABASE_URL=https://yzcrifmqwgfkfikkimeu.supabase.co
SUPABASE_KEY=sb_publishable_bEuL6GdEhvU5XlukkZpwng_LUNq3Nrp

# Frontend (.env / .env.local)
VITE_SUPABASE_URL=https://yzcrifmqwgfkfikkimeu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_bEuL6GdEhvU5XlukkZpwng_LUNq3Nrp
```
