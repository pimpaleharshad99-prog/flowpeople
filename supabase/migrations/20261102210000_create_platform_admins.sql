-- ============================================================================
-- FLOWPEOPLE SAAS HRMS: ROOT PLATFORM ADMINS & GATEKEEPER SECURITY
-- Migration: 20261102210000_create_platform_admins.sql
-- Description: Creates public.platform_admins table and updates is_platform_owner()
--              to strictly verify membership against public.platform_admins.
-- ============================================================================

-- 1. Create public.platform_admins table
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index for high-speed UUID lookup
CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policy: Authenticated platform admins can view their own record
DROP POLICY IF EXISTS "Platform admins can view own record" ON public.platform_admins;
CREATE POLICY "Platform admins can view own record"
    ON public.platform_admins
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Update is_platform_owner() function: dynamically verify membership without hardcoded emails
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 6. Permissions (Data API access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;
