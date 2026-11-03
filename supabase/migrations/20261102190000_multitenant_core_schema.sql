-- ============================================================================
-- FLOWPEOPLE SAAS HRMS: PRODUCTION MULTI-TENANT ARCHITECTURE & RLS MIGRATION
-- Project: FlowPeople SaaS HRMS (FlowCraft)
-- Date: 2026-11-02
-- Description: Core multi-tenant isolated schema, foreign keys, unique constraints,
--              organization-aware functions, automated triggers, and Row Level Security.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (Extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. ORGANIZATIONS (Multi-Tenant Master Table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    organization_code TEXT UNIQUE NOT NULL,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
    brand_name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    logo_url TEXT,
    industry TEXT,
    company_size TEXT,
    subscription_id UUID,
    subscription_plan_id TEXT NOT NULL DEFAULT 'trial',
    subscription_status TEXT NOT NULL DEFAULT 'TRIALING',
    max_employees INT NOT NULL DEFAULT 10,
    max_admins INT NOT NULL DEFAULT 1,
    trial_ends_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for lookup and slug routing
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_code ON public.organizations(organization_code);
CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_user_id);

-- ============================================================================
-- 3. ORGANIZATION MEMBERS (Role-Based Membership & Tenant Mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('organization_owner', 'hr_admin', 'manager', 'employee')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'pending', 'suspended', 'inactive')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- ============================================================================
-- 4. DEPARTMENTS & DESIGNATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_departments_org ON public.departments(organization_id);

CREATE TABLE IF NOT EXISTS public.designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_designations_org ON public.designations(organization_id);

-- ============================================================================
-- 5. EMPLOYEES (Detailed HR Personnel Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_code TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    designation_id UUID REFERENCES public.designations(id) ON DELETE SET NULL,
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type TEXT NOT NULL DEFAULT 'FULL_TIME',
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
CREATE INDEX IF NOT EXISTS idx_employees_code ON public.employees(organization_id, employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(organization_id, status);

-- ============================================================================
-- 6. SHIFTS & ROSTERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    work_hours NUMERIC(4,2) DEFAULT 8.0,
    grace_period_mins INT DEFAULT 15,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shifts_org ON public.shifts(organization_id);

-- ============================================================================
-- 7. ATTENDANCE & BIOMETRIC VERIFICATION
-- ============================================================================
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
    status TEXT NOT NULL DEFAULT 'PRESENT',
    is_regularized BOOLEAN DEFAULT FALSE,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_org_date ON public.attendance_records(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee ON public.attendance_records(employee_id);

CREATE TABLE IF NOT EXISTS public.attendance_punches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    record_id UUID REFERENCES public.attendance_records(id) ON DELETE CASCADE,
    punch_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    punch_type TEXT NOT NULL CHECK (punch_type IN ('IN', 'OUT')),
    verification_method TEXT NOT NULL DEFAULT 'FACE' CHECK (verification_method IN ('FACE', 'FINGERPRINT', 'QR', 'MANUAL', 'WEB')),
    ip_address TEXT,
    device_info TEXT,
    confidence_score NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_punches_org ON public.attendance_punches(organization_id, punch_time);
CREATE INDEX IF NOT EXISTS idx_attendance_punches_employee ON public.attendance_punches(employee_id);

-- Facial Biometric Vector Enrollments (128-D normalized vectors)
CREATE TABLE IF NOT EXISTS public.face_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,
    embedding JSONB NOT NULL, -- Array of 128 normalized float vectors
    model_version TEXT NOT NULL DEFAULT 'v2.0-facenet-norm',
    status TEXT NOT NULL DEFAULT 'ENROLLED',
    consent_obtained BOOLEAN NOT NULL DEFAULT TRUE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_face_enrollments_org ON public.face_enrollments(organization_id);

-- ============================================================================
-- 8. LEAVE MANAGEMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    annual_quota NUMERIC(4,1) NOT NULL DEFAULT 12.0,
    color TEXT DEFAULT '#590907',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(organization_id, code)
);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_org ON public.leave_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);

-- ============================================================================
-- 9. INVITATIONS & ONBOARDING
-- ============================================================================
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

-- ============================================================================
-- 10. SUBSCRIPTIONS & TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'trial',
    tier TEXT NOT NULL DEFAULT 'FREE_TRIAL',
    billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
    status TEXT NOT NULL DEFAULT 'TRIALING',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    provider TEXT NOT NULL DEFAULT 'RAZORPAY',
    transaction_reference TEXT UNIQUE NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. SECURITY DEFINER HELPER FUNCTIONS FOR ROW LEVEL SECURITY
-- ============================================================================

-- Retrieve the caller's active organization ID from organization_members
CREATE OR REPLACE FUNCTION public.get_current_user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active'
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

-- Check if current authenticated user is an allowlisted platform owner
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email IN ('pimpaleg80@gmail.com', 'pimpaleharshad99@gmail.com', 'admin@flowcraft.io')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all organization-owned tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view and edit own profile" ON public.profiles;
CREATE POLICY "Users can view and edit own profile"
    ON public.profiles
    FOR ALL
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- ORGANIZATIONS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view own organization" ON public.organizations;
CREATE POLICY "Members can view own organization"
    ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND status = 'active')
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
CREATE POLICY "Owners can update own organization"
    ON public.organizations
    FOR UPDATE
    TO authenticated
    USING (
        (owner_user_id = auth.uid() OR public.get_current_user_role(id) = 'organization_owner')
        OR public.is_platform_owner()
    )
    WITH CHECK (
        (owner_user_id = auth.uid() OR public.get_current_user_role(id) = 'organization_owner')
        OR public.is_platform_owner()
    );

-- ----------------------------------------------------------------------------
-- ORGANIZATION MEMBERS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view peer members in same org" ON public.organization_members;
CREATE POLICY "Members can view peer members in same org"
    ON public.organization_members
    FOR SELECT
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "Owners and HR Admins can manage members" ON public.organization_members;
CREATE POLICY "Owners and HR Admins can manage members"
    ON public.organization_members
    FOR ALL
    TO authenticated
    USING (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    )
    WITH CHECK (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    );

-- ----------------------------------------------------------------------------
-- EMPLOYEES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own and directory in org" ON public.employees;
CREATE POLICY "Employees can view own and directory in org"
    ON public.employees
    FOR SELECT
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "Owners and HR can insert employees" ON public.employees;
CREATE POLICY "Owners and HR can insert employees"
    ON public.employees
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "Owners and HR can update employees" ON public.employees;
CREATE POLICY "Owners and HR can update employees"
    ON public.employees
    FOR UPDATE
    TO authenticated
    USING (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    )
    WITH CHECK (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    );

-- ----------------------------------------------------------------------------
-- ATTENDANCE & BIOMETRICS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Attendance records view policy" ON public.attendance_records;
CREATE POLICY "Attendance records view policy"
    ON public.attendance_records
    FOR SELECT
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
            OR public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin', 'manager')
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "Attendance punches insert policy" ON public.attendance_punches;
CREATE POLICY "Attendance punches insert policy"
    ON public.attendance_punches
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        OR public.is_platform_owner()
    );

DROP POLICY IF EXISTS "Face templates strictly isolated to HR and Owners" ON public.face_enrollments;
CREATE POLICY "Face templates strictly isolated to HR and Owners"
    ON public.face_enrollments
    FOR SELECT
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
            OR employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
            OR public.is_platform_owner()
        )
    );

-- ----------------------------------------------------------------------------
-- LEAVE REQUESTS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Leave requests view policy" ON public.leave_requests;
CREATE POLICY "Leave requests view policy"
    ON public.leave_requests
    FOR SELECT
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
            OR public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin', 'manager')
            OR public.is_platform_owner()
        )
    );

DROP POLICY IF EXISTS "Employees can apply for leaves in own org" ON public.leave_requests;
CREATE POLICY "Employees can apply for leaves in own org"
    ON public.leave_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        AND employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Managers and HR can approve/reject leaves" ON public.leave_requests;
CREATE POLICY "Managers and HR can approve/reject leaves"
    ON public.leave_requests
    FOR UPDATE
    TO authenticated
    USING (
        organization_id = public.get_current_user_organization_id()
        AND (
            public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin', 'manager')
            OR public.is_platform_owner()
        )
    )
    WITH CHECK (
        organization_id = public.get_current_user_organization_id()
        AND (
            public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin', 'manager')
            OR public.is_platform_owner()
        )
    );

-- ----------------------------------------------------------------------------
-- INVITATIONS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Owners and HR can manage invitations" ON public.organization_invitations;
CREATE POLICY "Owners and HR can manage invitations"
    ON public.organization_invitations
    FOR ALL
    TO authenticated
    USING (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    )
    WITH CHECK (
        public.get_current_user_role(organization_id) IN ('organization_owner', 'hr_admin')
        OR public.is_platform_owner()
    );

-- ----------------------------------------------------------------------------
-- PERMISSIONS GRANTS (Data API exposure)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.organizations, public.subscriptions TO anon;

