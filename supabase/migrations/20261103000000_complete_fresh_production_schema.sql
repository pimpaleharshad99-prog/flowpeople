-- ============================================================================
-- FLOWPEOPLE SAAS HRMS: COMPLETE PRODUCTION DATABASE ARCHITECTURE & RLS MIGRATION
-- Project: FlowPeople SaaS HRMS (FlowCraft)
-- Version: 20261103000000_complete_fresh_production_schema.sql
-- Description: Production-grade multi-tenant architecture across all 19 modules,
--              foreign keys, constraints, automated triggers, RLS policies, and RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS & PREREQUISITES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- PHASE 3: CLEAN RESET OF APPLICATION-OWNED OBJECTS
-- (Safely drops conflicting application-owned tables, views, and functions;
--  never touches auth.users or internal Supabase schemas)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.companies CASCADE;
DROP VIEW IF EXISTS public.company_members CASCADE;
DROP VIEW IF EXISTS public.attendance_punches CASCADE;
DROP VIEW IF EXISTS public.face_enrollments CASCADE;

DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.platform_admins CASCADE;
DROP TABLE IF EXISTS public.organization_invitations CASCADE;
DROP TABLE IF EXISTS public.organization_settings CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.face_verification_logs CASCADE;
DROP TABLE IF EXISTS public.face_verification_profiles CASCADE;
DROP TABLE IF EXISTS public.recognition_devices CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.leave_requests CASCADE;
DROP TABLE IF EXISTS public.leave_balances CASCADE;
DROP TABLE IF EXISTS public.leave_types CASCADE;
DROP TABLE IF EXISTS public.attendance_logs CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.employee_shift_assignments CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.designations CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP FUNCTION IF EXISTS public.register_company CASCADE;
DROP FUNCTION IF EXISTS public.is_platform_owner CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_organization_id CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role CASCADE;
DROP FUNCTION IF EXISTS public.is_org_admin CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;

-- Automated updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- MODULE 0: PROFILES (Extends auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- MODULE 1: ORGANIZATIONS (Master Multi-Tenant Entity)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    organization_code TEXT UNIQUE NOT NULL,
    legal_name TEXT,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    brand_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    industry TEXT DEFAULT 'Technology',
    company_size TEXT DEFAULT '1-50',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    subscription_plan_id TEXT NOT NULL DEFAULT 'trial',
    subscription_status TEXT NOT NULL DEFAULT 'ACTIVE',
    max_employees INT NOT NULL DEFAULT 50,
    max_admins INT NOT NULL DEFAULT 5,
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIALING', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(organization_code);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_user_id);

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- MODULE 2: ORGANIZATION MEMBERS (Role-Based Membership)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('owner', 'admin', 'hr_manager', 'manager', 'employee', 'organization_owner', 'hr_admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'pending', 'suspended', 'inactive')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON public.organization_members(organization_id, role);

DROP TRIGGER IF EXISTS set_org_members_updated_at ON public.organization_members;
CREATE TRIGGER set_org_members_updated_at
    BEFORE UPDATE ON public.organization_members
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- MODULE 4 & 5: DEPARTMENTS & BRANCHES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'India',
    postal_code TEXT,
    timezone TEXT DEFAULT 'Asia/Kolkata',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    geofence_radius_meters INT DEFAULT 200,
    is_geofence_enforced BOOLEAN DEFAULT FALSE,
    is_headquarters BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(organization_id);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organization_id);

CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_designations_org ON public.designations(organization_id);

-- ----------------------------------------------------------------------------
-- MODULE 3: EMPLOYEES (Detailed HR Personnel Ledger)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    gender TEXT,
    date_of_birth DATE,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type TEXT NOT NULL DEFAULT 'FULL_TIME' CHECK (employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PROBATION', 'INVITED', 'PENDING_INVITATION', 'ON_LEAVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED')),
    reporting_manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    work_location TEXT DEFAULT 'Headquarters',
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_employees_org ON public.employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON public.employees(reporting_manager_id);

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- MODULE 8 & 9: SHIFTS & EMPLOYEE SHIFT ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    work_hours NUMERIC(4,2) DEFAULT 8.0,
    break_duration_mins INT DEFAULT 60,
    grace_period_mins INT DEFAULT 15,
    early_exit_allowance_mins INT DEFAULT 15,
    half_day_threshold_mins INT DEFAULT 240,
    is_default BOOLEAN DEFAULT FALSE,
    color TEXT DEFAULT '#590907',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shifts_org ON public.shifts(organization_id);

CREATE TABLE IF NOT EXISTS public.employee_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_org_emp ON public.employee_shift_assignments(organization_id, employee_id);

-- ----------------------------------------------------------------------------
-- MODULE 6 & 7: ATTENDANCE RECORDS & ATTENDANCE LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    first_check_in TIMESTAMPTZ,
    last_check_out TIMESTAMPTZ,
    total_work_minutes INT DEFAULT 0,
    total_break_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    late_in_minutes INT DEFAULT 0,
    early_out_minutes INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND')),
    is_regularized BOOLEAN DEFAULT FALSE,
    regularization_reason TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_org_date ON public.attendance_records(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee ON public.attendance_records(employee_id);

DROP TRIGGER IF EXISTS set_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER set_attendance_records_updated_at
    BEFORE UPDATE ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    record_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    punch_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    punch_type TEXT NOT NULL CHECK (punch_type IN ('IN', 'OUT')),
    verification_method TEXT NOT NULL DEFAULT 'FACE' CHECK (verification_method IN ('FACE', 'FINGERPRINT', 'QR', 'MANUAL', 'WEB', 'KIOSK')),
    ip_address TEXT,
    device_info TEXT,
    confidence_score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_org_time ON public.attendance_logs(organization_id, punch_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp ON public.attendance_logs(employee_id);

-- Backward compatibility view for legacy attendance_punches
CREATE OR REPLACE VIEW public.attendance_punches WITH (security_invoker = true) AS
    SELECT * FROM public.attendance_logs;

-- ----------------------------------------------------------------------------
-- MODULE 10, 11, 12, 13: LEAVE MANAGEMENT & HOLIDAYS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    annual_quota NUMERIC(4,1) NOT NULL DEFAULT 12.0,
    carry_forward_limit NUMERIC(4,1) DEFAULT 0.0,
    is_paid BOOLEAN DEFAULT TRUE,
    color TEXT DEFAULT '#590907',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_leave_types_org ON public.leave_types(organization_id);

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    annual_quota NUMERIC(4,1) NOT NULL DEFAULT 12.0,
    used_days NUMERIC(4,1) NOT NULL DEFAULT 0.0,
    pending_days NUMERIC(4,1) NOT NULL DEFAULT 0.0,
    remaining_days NUMERIC(4,1) NOT NULL DEFAULT 12.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_emp ON public.leave_balances(organization_id, employee_id);

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    day_count NUMERIC(4,1) NOT NULL,
    is_half_day BOOLEAN DEFAULT FALSE,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    approval_notes TEXT,
    actioned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org_status ON public.leave_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);

DROP TRIGGER IF EXISTS set_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER set_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    description TEXT,
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON public.holidays(organization_id, holiday_date);

-- ----------------------------------------------------------------------------
-- MODULE 14, 15, 16: FACE VERIFICATION, DEVICES & RECOGNITION LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recognition_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    device_name TEXT NOT NULL,
    device_code TEXT NOT NULL,
    device_type TEXT NOT NULL DEFAULT 'KIOSK_TABLET' CHECK (device_type IN ('KIOSK_TABLET', 'CAMERA_TERMINAL', 'MOBILE_SCANNER', 'DESKTOP')),
    api_key_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'REVOKED')),
    last_heartbeat TIMESTAMPTZ,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, device_code)
);

CREATE INDEX IF NOT EXISTS idx_recognition_devices_org ON public.recognition_devices(organization_id);

CREATE TABLE IF NOT EXISTS public.face_verification_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
    embedding JSONB NOT NULL, -- 128-D normalized biometric vector representation
    model_version TEXT NOT NULL DEFAULT 'v2.0-facenet-norm',
    status TEXT NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'VERIFIED', 'REVOKED', 'FAILED')),
    consent_obtained BOOLEAN NOT NULL DEFAULT TRUE,
    consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_org ON public.face_verification_profiles(organization_id);

-- Backward compatibility view for legacy face_enrollments
CREATE OR REPLACE VIEW public.face_enrollments WITH (security_invoker = true) AS
    SELECT * FROM public.face_verification_profiles;

CREATE TABLE IF NOT EXISTS public.face_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    device_id UUID REFERENCES public.recognition_devices(id) ON DELETE SET NULL,
    attempt_type TEXT NOT NULL DEFAULT 'VERIFICATION' CHECK (attempt_type IN ('VERIFICATION', 'ENROLLMENT', 'KIOSK_IDENTIFICATION')),
    status TEXT NOT NULL CHECK (status IN ('MATCH', 'NO_MATCH', 'SPOOF_SUSPECTED', 'ERROR')),
    confidence_score NUMERIC(5,2) NOT NULL,
    liveness_score NUMERIC(5,2),
    failure_reason TEXT,
    device_info TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_logs_org_time ON public.face_verification_logs(organization_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- MODULE 17, 18, 19: NOTIFICATIONS, AUDIT LOGS & ORGANIZATION SETTINGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'INFO' CHECK (type IN ('INFO', 'SUCCESS', 'WARNING', 'ALERT', 'ACTION_REQUIRED')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_time ON public.audit_logs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    work_hours_per_day NUMERIC(4,2) NOT NULL DEFAULT 8.0,
    working_days TEXT NOT NULL DEFAULT 'Monday,Tuesday,Wednesday,Thursday,Friday',
    grace_period_mins INT NOT NULL DEFAULT 15,
    auto_approve_attendance BOOLEAN NOT NULL DEFAULT FALSE,
    enable_face_attendance BOOLEAN NOT NULL DEFAULT TRUE,
    enable_geofence BOOLEAN NOT NULL DEFAULT FALSE,
    require_biometric_consent BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_org_settings_updated_at ON public.organization_settings;
CREATE TRIGGER set_org_settings_updated_at
    BEFORE UPDATE ON public.organization_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- SUPPORTING MODULES: INVITATIONS, PLATFORM ADMINS & SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_org ON public.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.organization_invitations(token);

CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON public.platform_admins(user_id);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'trial',
    tier TEXT NOT NULL DEFAULT 'FREE_TRIAL',
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    status TEXT NOT NULL DEFAULT 'TRIALING',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    description TEXT,
    price_monthly_inr NUMERIC(10,2) DEFAULT 0,
    price_annual_inr NUMERIC(10,2) DEFAULT 0,
    max_employees INT NOT NULL DEFAULT 50,
    max_hr_admins INT NOT NULL DEFAULT 5,
    face_attendance_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed baseline subscription plans
INSERT INTO public.subscription_plans (id, name, tier, description, price_monthly_inr, price_annual_inr, max_employees, max_hr_admins, face_attendance_enabled)
VALUES
    ('trial', 'Free Trial (14 Days)', 'FREE_TRIAL', 'Full feature exploration for up to 50 employees', 0, 0, 50, 5, TRUE),
    ('starter', 'Starter Plan', 'STARTER', 'Growing teams and early operations', 2499, 24990, 100, 10, TRUE),
    ('professional', 'Professional Plan', 'PROFESSIONAL', 'Scale operations with full biometrics & payroll', 7999, 79990, 500, 25, TRUE),
    ('enterprise', 'Enterprise Plan', 'ENTERPRISE', 'Full platform fleet with SLA & dedicated support', 19999, 199990, 10000, 50, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    max_employees = EXCLUDED.max_employees,
    max_hr_admins = EXCLUDED.max_hr_admins;

-- ----------------------------------------------------------------------------
-- SECURITY DEFINER HELPER FUNCTIONS FOR ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

-- Check if caller is a verified platform admin (Root Gatekeeper)
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retrieve the caller's active organization ID from organization_members
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Retrieve the caller's verified role within a specific organization
CREATE OR REPLACE FUNCTION public.get_current_user_role(p_org_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM public.organization_members
  WHERE user_id = auth.uid() AND organization_id = p_org_id AND status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if caller is authorized admin/owner within the organization
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND role IN ('owner', 'admin', 'hr_manager', 'organization_owner', 'hr_admin')
  ) OR public.is_platform_owner();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- ATOMIC REGISTRATION RPC FUNCTION (register_company)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_company(
    p_name TEXT,
    p_slug TEXT,
    p_request_key TEXT,
    p_legal_name TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_clean_slug TEXT := lower(trim(p_slug));
    v_clean_code TEXT;
    v_existing_org RECORD;
    v_new_org RECORD;
    v_new_sub RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to register an organization.' USING ERRCODE = '42501';
    END IF;

    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Organization name must be at least 2 characters.';
    END IF;

    IF v_clean_slug IS NULL OR length(v_clean_slug) < 2 THEN
        RAISE EXCEPTION 'Organization slug must be at least 2 characters.';
    END IF;

    -- Generate organization code from slug
    v_clean_code := upper(regexp_replace(v_clean_slug, '[^a-zA-Z0-9]', '', 'g'));
    IF length(v_clean_code) < 3 THEN
        v_clean_code := 'ORG' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));
    ELSE
        v_clean_code := substring(v_clean_code from 1 for 8);
    END IF;

    -- Idempotent check: check if already created by this user with this slug
    SELECT * INTO v_existing_org
    FROM public.organizations
    WHERE slug = v_clean_slug;

    IF FOUND THEN
        -- If caller is already owner/member, return existing record gracefully
        IF EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = v_existing_org.id AND user_id = v_user_id) THEN
            SELECT * INTO v_new_sub FROM public.subscriptions WHERE organization_id = v_existing_org.id;
            RETURN jsonb_build_object(
                'success', true,
                'organization', row_to_json(v_existing_org),
                'subscription', row_to_json(v_new_sub),
                'requestKey', p_request_key,
                'idempotent', true
            );
        ELSE
            RAISE EXCEPTION 'An organization with slug "%" already exists.', v_clean_slug USING ERRCODE = '23505';
        END IF;
    END IF;

    -- 1. Create Organization
    INSERT INTO public.organizations (
        name,
        slug,
        organization_code,
        legal_name,
        owner_user_id,
        subscription_plan_id,
        subscription_status,
        max_employees,
        max_admins,
        trial_ends_at,
        status
    ) VALUES (
        trim(p_name),
        v_clean_slug,
        v_clean_code,
        coalesce(trim(p_legal_name), trim(p_name)),
        v_user_id,
        'trial',
        'ACTIVE',
        50,
        5,
        now() + INTERVAL '14 days',
        'ACTIVE'
    ) RETURNING * INTO v_new_org;

    -- 2. Create Owner Membership
    INSERT INTO public.organization_members (
        organization_id,
        user_id,
        role,
        status,
        joined_at
    ) VALUES (
        v_new_org.id,
        v_user_id,
        'owner',
        'active',
        now()
    );

    -- 3. Initialize Settings
    INSERT INTO public.organization_settings (
        organization_id,
        work_hours_per_day,
        working_days,
        grace_period_mins,
        enable_face_attendance,
        require_biometric_consent
    ) VALUES (
        v_new_org.id,
        8.0,
        'Monday,Tuesday,Wednesday,Thursday,Friday',
        15,
        TRUE,
        TRUE
    );

    -- 4. Initialize Trial Subscription
    INSERT INTO public.subscriptions (
        organization_id,
        plan_id,
        tier,
        billing_cycle,
        status,
        current_period_start,
        current_period_end,
        trial_ends_at
    ) VALUES (
        v_new_org.id,
        'trial',
        'FREE_TRIAL',
        'MONTHLY',
        'ACTIVE',
        now(),
        now() + INTERVAL '14 days',
        now() + INTERVAL '14 days'
    ) RETURNING * INTO v_new_sub;

    -- 5. Audit Log
    INSERT INTO public.audit_logs (
        organization_id,
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_new_org.id,
        v_user_id,
        'CREATE',
        'Organization',
        v_new_org.id::text,
        'Organization "' || v_new_org.name || '" created via register_company RPC.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization', row_to_json(v_new_org),
        'subscription', row_to_json(v_new_sub),
        'requestKey', p_request_key,
        'idempotent', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) ENABLEMENT & POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS across every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recognition_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_verification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
DROP POLICY IF EXISTS "profiles_self_access" ON public.profiles;
CREATE POLICY "profiles_self_access" ON public.profiles
    FOR ALL TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- 2. ORGANIZATIONS
DROP POLICY IF EXISTS "organizations_select_policy" ON public.organizations;
CREATE POLICY "organizations_select_policy" ON public.organizations
    FOR SELECT TO authenticated
    USING (
        id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND status = 'active')
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "organizations_update_policy" ON public.organizations;
CREATE POLICY "organizations_update_policy" ON public.organizations
    FOR UPDATE TO authenticated
    USING (public.is_org_admin(id))
    WITH CHECK (public.is_org_admin(id));

-- 3. ORGANIZATION MEMBERS
DROP POLICY IF EXISTS "members_select_policy" ON public.organization_members;
CREATE POLICY "members_select_policy" ON public.organization_members
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "members_admin_manage_policy" ON public.organization_members;
CREATE POLICY "members_admin_manage_policy" ON public.organization_members
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 4. BRANCHES & DEPARTMENTS
DROP POLICY IF EXISTS "branches_select_policy" ON public.branches;
CREATE POLICY "branches_select_policy" ON public.branches
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "branches_admin_policy" ON public.branches;
CREATE POLICY "branches_admin_policy" ON public.branches
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "departments_select_policy" ON public.departments;
CREATE POLICY "departments_select_policy" ON public.departments
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "departments_admin_policy" ON public.departments;
CREATE POLICY "departments_admin_policy" ON public.departments
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "designations_select_policy" ON public.designations;
CREATE POLICY "designations_select_policy" ON public.designations
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "designations_admin_policy" ON public.designations;
CREATE POLICY "designations_admin_policy" ON public.designations
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 5. EMPLOYEES
DROP POLICY IF EXISTS "employees_select_policy" ON public.employees;
CREATE POLICY "employees_select_policy" ON public.employees
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "employees_admin_manage_policy" ON public.employees;
CREATE POLICY "employees_admin_manage_policy" ON public.employees
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 6. SHIFTS & ASSIGNMENTS
DROP POLICY IF EXISTS "shifts_select_policy" ON public.shifts;
CREATE POLICY "shifts_select_policy" ON public.shifts
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "shifts_admin_policy" ON public.shifts;
CREATE POLICY "shifts_admin_policy" ON public.shifts
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "shift_assignments_select_policy" ON public.employee_shift_assignments;
CREATE POLICY "shift_assignments_select_policy" ON public.employee_shift_assignments
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "shift_assignments_admin_policy" ON public.employee_shift_assignments;
CREATE POLICY "shift_assignments_admin_policy" ON public.employee_shift_assignments
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 7. ATTENDANCE RECORDS & LOGS
DROP POLICY IF EXISTS "attendance_records_select_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_select_policy" ON public.attendance_records
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
            OR public.is_org_admin(organization_id)
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "attendance_records_admin_manage_policy" ON public.attendance_records;
CREATE POLICY "attendance_records_admin_manage_policy" ON public.attendance_records
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "attendance_logs_insert_policy" ON public.attendance_logs;
CREATE POLICY "attendance_logs_insert_policy" ON public.attendance_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "attendance_logs_select_policy" ON public.attendance_logs;
CREATE POLICY "attendance_logs_select_policy" ON public.attendance_logs
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
            OR public.is_org_admin(organization_id)
            OR public.is_platform_owner()
        )
    );

-- 8. LEAVE MANAGEMENT & HOLIDAYS
DROP POLICY IF EXISTS "leave_types_select_policy" ON public.leave_types;
CREATE POLICY "leave_types_select_policy" ON public.leave_types
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "leave_types_admin_policy" ON public.leave_types;
CREATE POLICY "leave_types_admin_policy" ON public.leave_types
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "leave_balances_select_policy" ON public.leave_balances;
CREATE POLICY "leave_balances_select_policy" ON public.leave_balances
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
            OR public.is_org_admin(organization_id)
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "leave_balances_admin_manage_policy" ON public.leave_balances;
CREATE POLICY "leave_balances_admin_manage_policy" ON public.leave_balances
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "leave_requests_select_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_select_policy" ON public.leave_requests
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
            OR public.is_org_admin(organization_id)
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "leave_requests_employee_insert_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_employee_insert_policy" ON public.leave_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        AND employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
    );

DROP POLICY IF EXISTS "leave_requests_admin_update_policy" ON public.leave_requests;
CREATE POLICY "leave_requests_admin_update_policy" ON public.leave_requests
    FOR UPDATE TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "holidays_select_policy" ON public.holidays;
CREATE POLICY "holidays_select_policy" ON public.holidays
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "holidays_admin_policy" ON public.holidays;
CREATE POLICY "holidays_admin_policy" ON public.holidays
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 9. BIOMETRIC FACE PROFILES & DEVICES
DROP POLICY IF EXISTS "face_profiles_select_policy" ON public.face_verification_profiles;
CREATE POLICY "face_profiles_select_policy" ON public.face_verification_profiles
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = (select auth.uid()))
            OR public.is_org_admin(organization_id)
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "face_profiles_admin_manage_policy" ON public.face_verification_profiles;
CREATE POLICY "face_profiles_admin_manage_policy" ON public.face_verification_profiles
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "devices_admin_policy" ON public.recognition_devices;
CREATE POLICY "devices_admin_policy" ON public.recognition_devices
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "face_logs_select_policy" ON public.face_verification_logs;
CREATE POLICY "face_logs_select_policy" ON public.face_verification_logs
    FOR SELECT TO authenticated
    USING (public.is_org_admin(organization_id));

-- 10. NOTIFICATIONS & AUDIT LOGS
DROP POLICY IF EXISTS "notifications_self_policy" ON public.notifications;
CREATE POLICY "notifications_self_policy" ON public.notifications
    FOR ALL TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

-- 11. ORGANIZATION SETTINGS
DROP POLICY IF EXISTS "org_settings_select_policy" ON public.organization_settings;
CREATE POLICY "org_settings_select_policy" ON public.organization_settings
    FOR SELECT TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "org_settings_admin_update_policy" ON public.organization_settings;
CREATE POLICY "org_settings_admin_update_policy" ON public.organization_settings
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

-- 12. INVITATIONS & PLATFORM ADMINS
DROP POLICY IF EXISTS "invitations_admin_policy" ON public.organization_invitations;
CREATE POLICY "invitations_admin_policy" ON public.organization_invitations
    FOR ALL TO authenticated
    USING (public.is_org_admin(organization_id))
    WITH CHECK (public.is_org_admin(organization_id));

DROP POLICY IF EXISTS "platform_admins_self_select" ON public.platform_admins;
CREATE POLICY "platform_admins_self_select" ON public.platform_admins
    FOR SELECT TO authenticated
    USING ((select auth.uid()) = user_id);

-- 13. SUBSCRIPTIONS & PLANS
DROP POLICY IF EXISTS "subscriptions_select_policy" ON public.subscriptions;
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
    FOR SELECT TO authenticated
    USING (
        organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = (select auth.uid()) AND status = 'active')
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "subscription_plans_read_policy" ON public.subscription_plans;
CREATE POLICY "subscription_plans_read_policy" ON public.subscription_plans
    FOR SELECT TO anon, authenticated
    USING (true);

-- ----------------------------------------------------------------------------
-- PERMISSIONS & API GRANTS
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Allow anon to read subscription plans & organizations for sign-up resolution
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT ON public.organizations TO anon;

