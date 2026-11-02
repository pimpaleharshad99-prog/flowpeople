import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, User } from '../services/api';

export interface OrganizationDetails {
  id: number;
  uuid?: string;
  name: string;
  code: string;
  slug?: string;
  brand_name?: string;
  logo_url?: string;
  timezone?: string;
  currency?: string;
  contact_email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  company_size?: string;
  status?: string;
  subscription_plan_id?: string;
  subscription_status?: string;
  max_employees?: number;
  max_admins?: number;
  trial_ends_at?: string;
}

export interface EmployeeCounts {
  organization_id: number;
  organization_uuid?: string;
  organization_name: string;
  organization_code: string;
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  pending_invitations: number;
  max_employees: number;
  capacity_remaining: number;
  plan_id: string;
  subscription_status: string;
}

interface OrganizationContextType {
  organization: OrganizationDetails | null;
  counts: EmployeeCounts | null;
  role: string | null;
  isLoading: boolean;
  refreshOrganization: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ currentUser: User | null; children: React.ReactNode }> = ({
  currentUser,
  children
}) => {
  const [organization, setOrganization] = useState<OrganizationDetails | null>(null);
  const [counts, setCounts] = useState<EmployeeCounts | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchOrganization = useCallback(async () => {
    if (!currentUser || !currentUser.company_id) {
      setOrganization(null);
      return;
    }
    try {
      const data = await api.getCompany();
      setOrganization(data);
    } catch (err) {
      console.error('Failed to load organization details:', err);
    }
  }, [currentUser]);

  const fetchCounts = useCallback(async () => {
    if (!currentUser || !currentUser.company_id) {
      setCounts(null);
      return;
    }
    try {
      const data = await api.getEmployeeCounts();
      setCounts(data);
    } catch (err) {
      console.error('Failed to load employee counts:', err);
    }
  }, [currentUser]);

  const refreshAll = useCallback(async () => {
    if (!currentUser || !currentUser.company_id) {
      setOrganization(null);
      setCounts(null);
      return;
    }
    setIsLoading(true);
    await Promise.all([fetchOrganization(), fetchCounts()]);
    setIsLoading(false);
  }, [currentUser, fetchOrganization, fetchCounts]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        counts,
        role: currentUser?.role || null,
        isLoading,
        refreshOrganization: fetchOrganization,
        refreshCounts: fetchCounts
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

