import { z } from "zod";

import { platformAdminFetch } from "@/lib/platform-admin/client";

export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type PaymentStatus =
  | "paid"
  | "unpaid"
  | "pending"
  | "failed"
  | "refunded";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "expired"
  | "suspended"
  | "cancelled";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number | string;
  billingCycle: BillingCycle;
  maxBranches: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SubscriptionPlanInput {
  name: string;
  price: number;
  billingCycle: BillingCycle;
  maxBranches: number;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  gracePeriodEndsAt: string | null;
  suspendedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: SubscriptionPlan;
}

export interface SetTenantSubscriptionInput {
  planId: string;
  billingCycle: BillingCycle;
  status: Exclude<SubscriptionStatus, "suspended" | "cancelled">;
  paymentStatus: PaymentStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextBillingDate: string | null;
  gracePeriodEndsAt: string | null;
}

const tenantIdSchema = z.string().uuid("Enter a valid tenant UUID.");

export function validateTenantId(value: string) {
  return tenantIdSchema.safeParse(value.trim());
}

export function filterSubscriptionPlans(
  plans: SubscriptionPlan[],
  search: string,
  billingCycle: BillingCycle | "all",
) {
  const query = search.trim().toLowerCase();
  return plans.filter(
    (plan) =>
      (billingCycle === "all" || plan.billingCycle === billingCycle) &&
      (!query || plan.name.toLowerCase().includes(query)),
  );
}

export function listSubscriptionPlans() {
  return platformAdminFetch<SubscriptionPlan[]>(
    "/super-admin/subscriptions/plans",
  );
}

export function createSubscriptionPlan(input: SubscriptionPlanInput) {
  return platformAdminFetch<SubscriptionPlan>(
    "/super-admin/subscriptions/plans",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateSubscriptionPlan(
  planId: string,
  input: SubscriptionPlanInput,
) {
  return platformAdminFetch<SubscriptionPlan>(
    `/super-admin/subscriptions/plans/${planId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteSubscriptionPlan(planId: string) {
  return platformAdminFetch<SubscriptionPlan>(
    `/super-admin/subscriptions/plans/${planId}`,
    { method: "DELETE" },
  );
}

export function getTenantSubscription(tenantId: string) {
  return platformAdminFetch<TenantSubscription>(
    `/super-admin/subscriptions/tenants/${tenantId}`,
  );
}

export function setTenantSubscription(
  tenantId: string,
  input: SetTenantSubscriptionInput,
) {
  return platformAdminFetch<TenantSubscription>(
    `/super-admin/subscriptions/tenants/${tenantId}`,
    { method: "PUT", body: JSON.stringify(input) },
  );
}

export function suspendTenantSubscription(
  tenantId: string,
  gracePeriodEndsAt: string | null,
) {
  return platformAdminFetch<TenantSubscription>(
    `/super-admin/subscriptions/tenants/${tenantId}/suspend`,
    {
      method: "POST",
      body: JSON.stringify({ gracePeriodEndsAt }),
    },
  );
}

export function resumeTenantSubscription(tenantId: string) {
  return platformAdminFetch<TenantSubscription>(
    `/super-admin/subscriptions/tenants/${tenantId}/resume`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function cancelTenantSubscription(tenantId: string) {
  return platformAdminFetch<TenantSubscription>(
    `/super-admin/subscriptions/tenants/${tenantId}/cancel`,
    { method: "POST", body: JSON.stringify({}) },
  );
}
