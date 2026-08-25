import { platformAdminFetch } from "@/lib/platform-admin/client";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
}

export interface TenantBranch {
  id: string;
  name: string;
}

export interface Tenant {
  id: string;
  name: string;
  status: "active" | "suspended" | "cancelled" | "trial" | "pending";
  createdAt: string;
  subscriptionPlanId?: string;
  subscriptionPlan?: SubscriptionPlan;
  branches: TenantBranch[];
}

export interface OnboardInput {
  name: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  branchName: string;
  subscriptionPlanId?: string;
}

export const TenancyApi = {
  listTenants: () => platformAdminFetch<Tenant[]>("/super-admin/tenants"),

  onboardTenant: (data: OnboardInput) =>
    platformAdminFetch<{ tenant: Tenant; branch: TenantBranch; owner: { id: string; fullName: string; email: string } }>(
      "/super-admin/tenants",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  updateTenantStatus: (id: string, status: "active" | "suspended") =>
    platformAdminFetch<Tenant>(`/super-admin/tenants/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
};
