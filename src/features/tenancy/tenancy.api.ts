import { platformAdminFetch } from "@/lib/platform-admin/client";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number | string;
  billingCycle: "monthly" | "quarterly" | "yearly";
  maxBranches: number;
}

export interface TenantBranch {
  id: string;
  name: string;
  isActive: boolean;
  address?: string | null;
  tablesCount?: number;
  activeSessionsCount?: number;
}

export interface TenantOwner {
  id: string;
  fullName: string | null;
  email: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended" | "cancelled" | "trial" | "pending";
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
  subscriptionPlanId?: string | null;
  subscriptionPlan?: SubscriptionPlan | null;
  currentSubscription?: {
    id: string;
    planId: string;
    billingCycle: string;
    status: string;
    paymentStatus: string;
    currentPeriodEnd?: string | null;
    nextBillingDate?: string | null;
    plan?: SubscriptionPlan;
  } | null;
  owner?: TenantOwner | null;
  branches: TenantBranch[];
  counts?: {
    branches: number;
    users: number;
    customers?: number;
  };
}

export interface OnboardInput {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  branchName: string;
  subscriptionPlanId?: string;
  currency?: string;
  timezone?: string;
  defaultLanguage?: string;
}

export interface DataExportJob {
  id: string;
  tenantId: string;
  format: string;
  status: string;
  requestedAt: string;
  expiresAt: string | null;
  downloadAvailable: boolean;
  sizeBytes: string | null;
  failureReason: string | null;
}

export const TenancyApi = {
  listTenants: (query?: { search?: string; status?: string; includeDeleted?: boolean }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set("search", query.search);
    if (query?.status) params.set("status", query.status);
    if (query?.includeDeleted) params.set("includeDeleted", "true");
    const qs = params.toString();
    return platformAdminFetch<Tenant[]>(`/super-admin/tenants${qs ? `?${qs}` : ""}`);
  },

  getTenant: (id: string) =>
    platformAdminFetch<Tenant>(`/super-admin/tenants/${id}`),

  onboardTenant: (data: OnboardInput) =>
    platformAdminFetch<{
      tenant: Tenant;
      branch: TenantBranch;
      owner: { id: string; fullName: string; email: string };
    }>("/super-admin/tenants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTenantStatus: (id: string, status: "active" | "suspended" | "cancelled" | "trial" | "pending", reason?: string) =>
    platformAdminFetch<Tenant>(`/super-admin/tenants/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
    }),

  updateTenantBranchStatus: (tenantId: string, branchId: string, status: 'active' | 'suspended') =>
    platformAdminFetch<{ id: string; tenantId: string; isActive: boolean }>(
      `/super-admin/tenants/${tenantId}/branches/${branchId}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
    ),

  terminateTenant: (id: string) =>
    platformAdminFetch<Tenant>(`/super-admin/tenants/${id}`, {
      method: "DELETE",
    }),

  listSubscriptionPlans: () =>
    platformAdminFetch<SubscriptionPlan[]>("/super-admin/subscriptions/plans"),

  requestTenantExport: (tenantId: string) =>
    platformAdminFetch<DataExportJob>(`/super-admin/tenants/${tenantId}/exports`, {
      method: "POST",
      body: JSON.stringify({ format: "json" }),
    }),

  listTenantExports: (tenantId: string) =>
    platformAdminFetch<{ items: DataExportJob[]; total: number }>(
      `/super-admin/tenants/${tenantId}/exports`
    ),
};

