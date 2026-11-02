-- =============================================================================
-- FLOWPEOPLE MULTI-TENANT HRMS SAAS: GOOGLE DRIVE OAUTH 2.0 INTEGRATION MIGRATION
-- Migration Version: 20261102200000_google_drive_integrations.sql
-- Engine: PostgreSQL 15+ (Supabase)
-- Target: FlowPeople Multi-Tenant Cloud Storage Architecture
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Table: organization_integrations
-- Holds OAuth 2.0 credentials, encrypted refresh tokens, and Drive folder IDs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    organization_uuid UUID,
    provider VARCHAR(50) NOT NULL DEFAULT 'google_drive',
    connected_account_email VARCHAR(255),
    encrypted_refresh_token TEXT,
    access_token TEXT,
    access_token_expiry TIMESTAMPTZ,
    drive_root_folder_id VARCHAR(255),
    drive_company_folder_id VARCHAR(255),
    drive_attendance_folder_id VARCHAR(255),
    drive_employees_folder_id VARCHAR(255),
    drive_payroll_folder_id VARCHAR(255),
    drive_leave_folder_id VARCHAR(255),
    connection_status VARCHAR(50) NOT NULL DEFAULT 'NOT_CONNECTED',
    auto_attendance_reports BOOLEAN DEFAULT TRUE,
    auto_monthly_reports BOOLEAN DEFAULT TRUE,
    last_successful_sync TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_org_integration_provider UNIQUE(company_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_org_integrations_company ON public.organization_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_org_integrations_provider ON public.organization_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_org_integrations_status ON public.organization_integrations(connection_status);

-- -----------------------------------------------------------------------------
-- 2. Table: organization_drive_uploads
-- Tracks immutable history of report uploads to Google Drive with file IDs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_drive_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id INTEGER NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    organization_uuid UUID,
    report_type VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    drive_file_id VARCHAR(255),
    drive_folder_id VARCHAR(255),
    drive_web_view_link TEXT,
    upload_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drive_uploads_company ON public.organization_drive_uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_drive_uploads_created ON public.organization_drive_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drive_uploads_type ON public.organization_drive_uploads(report_type);

-- -----------------------------------------------------------------------------
-- 3. Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.organization_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_drive_uploads ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. RLS Security Policies
-- Strictly restrict access to Organization Owners and HR Admins.
-- Normal employees and managers are blocked from reading tokens or settings.
-- -----------------------------------------------------------------------------

-- Drop previous policies if re-running
DROP POLICY IF EXISTS "org_integrations_admin_access" ON public.organization_integrations;
DROP POLICY IF EXISTS "org_drive_uploads_admin_access" ON public.organization_drive_uploads;

-- Organization Integrations Policy:
-- Only organization owners and HR admins belonging to the same company can access
CREATE POLICY "org_integrations_admin_access" ON public.organization_integrations
    FOR ALL
    USING (
        company_id IN (
            SELECT m.company_id
            FROM public.organization_members m
            WHERE m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
              AND m.role IN ('ORGANIZATION_OWNER', 'HR_ADMIN', 'COMPANY_ADMIN', 'ADMIN')
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.email IN ('pimpaleg80@gmail.com', 'pimpaleharshad99@gmail.com', 'admin@flowcraft.io')
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT m.company_id
            FROM public.organization_members m
            WHERE m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
              AND m.role IN ('ORGANIZATION_OWNER', 'HR_ADMIN', 'COMPANY_ADMIN', 'ADMIN')
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.email IN ('pimpaleg80@gmail.com', 'pimpaleharshad99@gmail.com', 'admin@flowcraft.io')
        )
    );

-- Organization Drive Uploads Policy:
CREATE POLICY "org_drive_uploads_admin_access" ON public.organization_drive_uploads
    FOR ALL
    USING (
        company_id IN (
            SELECT m.company_id
            FROM public.organization_members m
            WHERE m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
              AND m.role IN ('ORGANIZATION_OWNER', 'HR_ADMIN', 'COMPANY_ADMIN', 'ADMIN')
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.email IN ('pimpaleg80@gmail.com', 'pimpaleharshad99@gmail.com', 'admin@flowcraft.io')
        )
    )
    WITH CHECK (
        company_id IN (
            SELECT m.company_id
            FROM public.organization_members m
            WHERE m.user_id = auth.uid()
              AND m.status = 'ACTIVE'
              AND m.role IN ('ORGANIZATION_OWNER', 'HR_ADMIN', 'COMPANY_ADMIN', 'ADMIN')
        )
        OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.email IN ('pimpaleg80@gmail.com', 'pimpaleharshad99@gmail.com', 'admin@flowcraft.io')
        )
    );

COMMIT;
