import { supabase } from '../lib/supabase';

export interface RegisterCompanyParams {
  name: string;
  slug?: string;
  requestKey: string;
  legalName?: string;
}

export interface RegisterCompanyResult {
  success: boolean;
  data: any;
  organization: {
    id?: string | number;
    name: string;
    slug: string;
    legal_name?: string;
    [key: string]: any;
  };
  subscription?: any;
  requestKey: string;
}

export interface SupabaseRpcError extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * Generates a clean, valid URL-safe slug from an organization name.
 * Format: lowercase alphanumeric with single hyphens, no leading/trailing hyphens.
 * E.g. "Acme Technologies Pvt Ltd" -> "acme-technologies-pvt-ltd"
 */
export function generateCompanySlug(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const cleaned = name
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return cleaned || `org-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Generates a fresh unique idempotency request key for a registration attempt.
 * Must be reused if retrying the same registration attempt.
 */
export function generateRegistrationKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
}

/**
 * Validates company slug format:
 * - 2 to 64 characters
 * - lowercase alphanumeric characters and single hyphens
 * - cannot start or end with a hyphen
 */
export function validateCompanySlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return { valid: false, error: 'Organization slug is required.' };
  }
  const trimmed = slug.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Organization slug must be at least 2 characters.' };
  }
  if (trimmed.length > 64) {
    return { valid: false, error: 'Organization slug must not exceed 64 characters.' };
  }
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slugRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Organization slug must contain only lowercase letters, numbers, and single hyphens (no spaces or special characters).'
    };
  }
  return { valid: true };
}

/**
 * Formats real Supabase error object with error code, message, details, and hint.
 * Preserves the actual Postgres/PostgREST error instead of generic "Internal error".
 */
export function formatSupabaseError(error: any): string {
  if (!error) return 'An unexpected database error occurred.';
  if (typeof error === 'string') return error;

  const code = error.code ? `[${error.code}] ` : '';
  const message = error.message || error.msg || error.error_description || 'Database request failed';
  const details = error.details ? ` - Details: ${error.details}` : '';
  const hint = error.hint ? ` (Hint: ${error.hint})` : '';

  return `${code}${message}${details}${hint}`;
}

/**
 * Registers an organization in Supabase via public.register_company RPC.
 *
 * Requirements enforced:
 * 1. Uses the active authenticated Supabase session.
 * 2. Calls supabase.rpc("register_company", { p_name, p_slug, p_request_key, p_legal_name }).
 * 3. Does NOT directly insert into companies, company_members, or user_profiles.
 * 4. Surface real Supabase error code/message in development.
 * 5. Handles returned organization and subscription payloads.
 */
export async function registerCompanyWithSupabase(
  params: RegisterCompanyParams
): Promise<RegisterCompanyResult> {
  // 1. Validate inputs
  const cleanName = params.name ? params.name.trim() : '';
  if (!cleanName) {
    const err: SupabaseRpcError = new Error('[VALIDATION_ERROR] Organization name is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const slug = params.slug ? params.slug.trim().toLowerCase() : generateCompanySlug(cleanName);
  const slugValidation = validateCompanySlug(slug);
  if (!slugValidation.valid) {
    const err: SupabaseRpcError = new Error(`[VALIDATION_ERROR] ${slugValidation.error}`);
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const requestKey = params.requestKey ? params.requestKey.trim() : '';
  if (!requestKey) {
    const err: SupabaseRpcError = new Error('[VALIDATION_ERROR] Idempotency request key (p_request_key) is required.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const legalName = params.legalName && params.legalName.trim() ? params.legalName.trim() : cleanName;

  // 2. Verify authenticated Supabase session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    const formatted = formatSupabaseError(sessionError);
    const err: SupabaseRpcError = new Error(`Authentication session error: ${formatted}`);
    err.code = sessionError.code || 'AUTH_SESSION_ERROR';
    throw err;
  }

  const session = sessionData?.session;
  if (!session || !session.access_token) {
    const err: SupabaseRpcError = new Error(
      '[42501] Permission denied: An authenticated Supabase session is required to register an organization. Please sign in or create an account.'
    );
    err.code = '42501';
    throw err;
  }

  // 3. Call public.register_company(p_name, p_slug, p_request_key, p_legal_name)
  const rpcParams = {
    p_name: cleanName,
    p_slug: slug,
    p_request_key: requestKey,
    p_legal_name: legalName
  };

  const { data, error } = await supabase.rpc('register_company', rpcParams);

  if (error) {
    const formatted = formatSupabaseError(error);
    const rpcErr: SupabaseRpcError = new Error(formatted);
    rpcErr.code = error.code || 'RPC_ERROR';
    rpcErr.details = error.details;
    rpcErr.hint = error.hint;
    throw rpcErr;
  }

  // 4. Normalize and handle returned organization & subscription data
  const orgPayload = data?.organization || data?.company || (data && typeof data === 'object' && ('id' in data || 'slug' in data) ? data : {
    name: cleanName,
    slug: slug,
    legal_name: legalName
  });

  const subPayload = data?.subscription || (data && typeof data === 'object' && 'subscription_plan' in data ? data.subscription_plan : null);

  return {
    success: true,
    data,
    organization: orgPayload,
    subscription: subPayload,
    requestKey
  };
}
