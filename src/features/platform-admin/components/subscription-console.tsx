"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatMoney, toDateInput } from "../format";
import {
  cancelTenantSubscription,
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  extendTenantTrial,
  filterSubscriptionPlans,
  getSubscriptionMetrics,
  getTenantSubscription,
  listSubscriptionPlans,
  moveTenantToGracePeriod,
  resumeTenantSubscription,
  setTenantSubscription,
  suspendTenantSubscription,
  updateSubscriptionPlan,
  updateTenantPaymentStatus,
  validateTenantId,
  type BillingCycle,
  type PaymentStatus,
  type SubscriptionMetrics,
  type SubscriptionPlan,
  type SubscriptionPlanInput,
  type TenantSubscription,
} from "../subscriptions";
import { TenancyApi, Tenant } from "@/features/tenancy";

const emptyPlan: SubscriptionPlanInput = {
  name: "",
  price: 0,
  billingCycle: "monthly",
  maxBranches: 1,
};

interface SubscriptionFormState {
  planId: string;
  billingCycle: BillingCycle;
  status: "active" | "trialing" | "past_due" | "expired";
  paymentStatus: PaymentStatus;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  gracePeriodEndsAt: string;
}

const emptySubscriptionForm: SubscriptionFormState = {
  planId: "",
  billingCycle: "monthly" as BillingCycle,
  status: "active",
  paymentStatus: "pending" as PaymentStatus,
  trialEndsAt: "",
  currentPeriodStart: "",
  currentPeriodEnd: "",
  nextBillingDate: "",
  gracePeriodEndsAt: "",
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function isDatePast(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T23:59:59");
  return d < new Date();
}

function subscriptionFormFromCurrent(
  subscription: TenantSubscription | null
): SubscriptionFormState {
  if (!subscription) return { ...emptySubscriptionForm };

  const periodEndPast = isDatePast(subscription.currentPeriodEnd);
  const gracePast = isDatePast(subscription.gracePeriodEndsAt);

  let manageableStatus: SubscriptionFormState["status"] = "active";

  // If status is trialing but there is no trial end date, normalize to active
  if (subscription.status === "trialing") {
    if (!subscription.trialEndsAt) {
      manageableStatus = "active";
    } else {
      manageableStatus = isDatePast(subscription.trialEndsAt) ? "expired" : "trialing";
    }
  } else if (!periodEndPast && subscription.currentPeriodEnd) {
    manageableStatus = "active";
  } else if (periodEndPast) {
    const hasActiveGrace = subscription.gracePeriodEndsAt && !gracePast;
    manageableStatus = hasActiveGrace ? "past_due" : "expired";
  } else {
    manageableStatus = (subscription.status as any) || "active";
  }

  return {
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    status: manageableStatus,
    paymentStatus: subscription.paymentStatus,
    trialEndsAt: toDateInput(subscription.trialEndsAt),
    currentPeriodStart: toDateInput(subscription.currentPeriodStart),
    currentPeriodEnd: toDateInput(subscription.currentPeriodEnd),
    nextBillingDate: toDateInput(subscription.nextBillingDate),
    gracePeriodEndsAt: toDateInput(subscription.gracePeriodEndsAt),
  };
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const positive = normalized === "active" || normalized === "paid";
  const warning =
    normalized === "trialing" ||
    normalized === "pending" ||
    normalized === "past_due" ||
    normalized === "trial";
  const danger =
    normalized === "expired" ||
    normalized === "failed" ||
    normalized === "suspended" ||
    normalized === "cancelled" ||
    normalized === "unpaid";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
        positive
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : warning
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : danger
          ? "bg-rose-50 text-rose-700 border border-rose-200"
          : "bg-slate-100 text-slate-700 border border-slate-200"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export interface SubscriptionConsoleProps {
  initialTenantId?: string | null;
}

export function SubscriptionConsole({
  initialTenantId,
}: SubscriptionConsoleProps = {}) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<BillingCycle | "all">("all");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<SubscriptionPlanInput>(emptyPlan);
  const [planSaving, setPlanSaving] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<SubscriptionMetrics | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantInput, setTenantInput] = useState(initialTenantId || "");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    initialTenantId || null
  );
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>(
    emptySubscriptionForm
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionFeedback, setSubscriptionFeedback] = useState<string | null>(
    null
  );
  const [pendingPlanDelete, setPendingPlanDelete] = useState<SubscriptionPlan | null>(
    null
  );
  const [planDeleting, setPlanDeleting] = useState(false);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState<
    "suspend" | "resume" | "cancel" | null
  >(null);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const [plansData, tenantsData, fetchedMetrics] = await Promise.all([
        listSubscriptionPlans(),
        TenancyApi.listTenants().catch(() => []),
        getSubscriptionMetrics().catch(() => null),
      ]);
      setPlans(plansData);
      setTenants(tenantsData);
      if (fetchedMetrics) setMetrics(fetchedMetrics);
    } catch (error) {
      setPlansError(errorMessage(error, "Could not load subscription plans."));
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const filteredPlans = useMemo(
    () => filterSubscriptionPlans(plans, search, cycleFilter),
    [cycleFilter, plans, search]
  );

  const resetPlanForm = () => {
    setEditingPlanId(null);
    setPlanForm({ ...emptyPlan });
    setPlanFeedback(null);
  };

  const editPlan = (plan: SubscriptionPlan) => {
    setEditingPlanId(plan.id);
    setPlanForm({
      name: plan.name,
      price: Number(plan.price),
      billingCycle: plan.billingCycle,
      maxBranches: plan.maxBranches,
    });
    setPlanFeedback(null);
  };

  const savePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setPlanFeedback(null);
    if (!planForm.name.trim() || planForm.price < 0 || planForm.maxBranches < 1) {
      setPlanFeedback("Enter a name, non-negative price, and at least one branch.");
      return;
    }
    setPlanSaving(true);
    try {
      if (editingPlanId) {
        await updateSubscriptionPlan(editingPlanId, {
          ...planForm,
          name: planForm.name.trim(),
        });
      } else {
        await createSubscriptionPlan({
          ...planForm,
          name: planForm.name.trim(),
        });
      }
      resetPlanForm();
      await loadPlans();
    } catch (error) {
      setPlanFeedback(errorMessage(error, "Could not save the plan."));
    } finally {
      setPlanSaving(false);
    }
  };

  const removePlan = async (plan: SubscriptionPlan) => {
    setPendingPlanDelete(plan);
  };

  const handleConfirmDeletePlan = async () => {
    if (!pendingPlanDelete) return;
    setPlanDeleting(true);
    setPlansError(null);
    setPlanFeedback(null);
    try {
      await deleteSubscriptionPlan(pendingPlanDelete.id);
      if (editingPlanId === pendingPlanDelete.id) {
        resetPlanForm();
      }
      setPendingPlanDelete(null);
      await loadPlans();
    } catch (error) {
      setPlansError(errorMessage(error, "Could not delete the plan."));
      setPendingPlanDelete(null);
    } finally {
      setPlanDeleting(false);
    }
  };

  const loadTenantSubscriptionById = async (targetId: string) => {
    const parsed = validateTenantId(targetId);
    if (!parsed.success) {
      setSubscriptionError(parsed.error.issues[0]?.message ?? "Invalid tenant ID.");
      return;
    }
    const tenantId = parsed.data;
    setTenantInput(tenantId);
    setSubscriptionLoading(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    setSelectedTenantId(tenantId);
    try {
      const current = await getTenantSubscription(tenantId);
      setSubscription(current);
      setSubscriptionForm(subscriptionFormFromCurrent(current));

      void TenancyApi.listTenants().then(setTenants).catch(() => {});
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSubscription(null);
        setSubscriptionForm({ ...emptySubscriptionForm });
        setSubscriptionFeedback(
          "No current subscription was found. Select a plan to create one."
        );
      } else {
        setSubscriptionError(
          errorMessage(error, "Could not load the tenant subscription.")
        );
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const loadTenantSubscription = () => loadTenantSubscriptionById(tenantInput);

  useEffect(() => {
    if (initialTenantId) {
      void loadTenantSubscriptionById(initialTenantId);
    }
  }, [initialTenantId]);

  const saveSubscription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTenantId || !subscriptionForm.planId) {
      setSubscriptionError("Load a tenant and select a plan first.");
      return;
    }
    if (
      subscriptionForm.currentPeriodStart &&
      subscriptionForm.currentPeriodEnd &&
      subscriptionForm.currentPeriodStart > subscriptionForm.currentPeriodEnd
    ) {
      setSubscriptionError("Current period end must be on or after its start.");
      return;
    }

    // Auto-normalize: If Trial ends is empty, status cannot remain trialing
    const resolvedStatus =
      !subscriptionForm.trialEndsAt && subscriptionForm.status === "trialing"
        ? "active"
        : subscriptionForm.status;

    setSubscriptionSaving(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    try {
      const updated = await setTenantSubscription(selectedTenantId, {
        ...subscriptionForm,
        status: resolvedStatus,
        trialEndsAt: subscriptionForm.trialEndsAt || null,
        currentPeriodStart: subscriptionForm.currentPeriodStart || null,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd || null,
        nextBillingDate: subscriptionForm.nextBillingDate || null,
        gracePeriodEndsAt: subscriptionForm.gracePeriodEndsAt || null,
      });

      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));
      setSubscriptionFeedback("Tenant subscription updated successfully.");
      await loadPlans();
      void TenancyApi.listTenants().then(setTenants).catch(() => {});
    } catch (error) {
      setSubscriptionError(errorMessage(error, "Could not update the subscription."));
    } finally {
      setSubscriptionSaving(false);
    }
  };

  const transitionSubscription = async (
    action: "suspend" | "resume" | "cancel"
  ) => {
    setPendingSubscriptionAction(action);
  };

  const handleExtendTrial = async () => {
    if (!selectedTenantId) return;
    setActionLoading(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    try {
      const baseDate = subscription?.trialEndsAt
        ? new Date(subscription.trialEndsAt)
        : new Date();
      const newTrialEndsAt = new Date(
        baseDate.getTime() + 14 * 24 * 60 * 60 * 1000
      ).toISOString();
      const updated = await extendTenantTrial(selectedTenantId, newTrialEndsAt);
      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));
      setSubscriptionFeedback("Trial extended by 14 days.");
      await loadPlans();
      void TenancyApi.listTenants().then(setTenants).catch(() => {});
    } catch (error) {
      setSubscriptionError(errorMessage(error, "Could not extend trial."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePaymentStatus = async (status: PaymentStatus) => {
    if (!selectedTenantId) return;
    setActionLoading(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    try {
      const updated = await updateTenantPaymentStatus(selectedTenantId, status);
      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));
      setSubscriptionFeedback(`Payment status marked as ${status}.`);
      await loadPlans();
    } catch (error) {
      setSubscriptionError(errorMessage(error, "Could not update payment status."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMoveToGracePeriod = async () => {
    if (!selectedTenantId) return;
    setActionLoading(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    try {
      const updated = await moveTenantToGracePeriod(selectedTenantId, 7);
      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));

      const periodEnded = isDatePast(updated.currentPeriodEnd);
      setSubscriptionFeedback(
        periodEnded
          ? "Subscription moved to 7-day grace period (Past Due)."
          : "Grace period scheduled for 7 days. Status remains Active until the current period ends."
      );

      await loadPlans();
    } catch (error) {
      setSubscriptionError(errorMessage(error, "Could not move to grace period."));
    } finally {
      setActionLoading(false);
    }
  };

  const isPeriodLapsed = isDatePast(subscriptionForm.currentPeriodEnd);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-brand-700">Platform billing</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Subscription management
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Maintain plans and control the current billing state for an individual tenant.
        </p>
      </header>

      {/* Live Billing Aggregates */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Expiring in 7 Days
            </span>
            <CalendarClock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metrics ? metrics.expiringInNext7Days : "—"}
          </div>
          <p className="mt-1 text-xs text-slate-400">Live count from DB</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              In Grace Period
            </span>
            <Clock className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metrics ? metrics.inGracePeriod : "—"}
          </div>
          <p className="mt-1 text-xs text-slate-400">Overdue tenants with active grace</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500">
              Recent Failed Payments
            </span>
            <XCircle className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metrics ? metrics.recentFailedPayments : "—"}
          </div>
          <p className="mt-1 text-xs text-slate-400">Status marked as failed</p>
        </div>
      </section>

      {/* Plans Section */}
      <section className="border-t border-slate-200 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
            <p className="mt-1 text-sm text-slate-500">
              Active plans available for tenant assignments.
            </p>
          </div>
          <div className="flex w-full max-w-xl gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                aria-label="Filter plans"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter plans"
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Filter by billing cycle"
              value={cycleFilter}
              onChange={(event) =>
                setCycleFilter(event.target.value as BillingCycle | "all")
              }
              className="w-40"
            >
              <option value="all">All cycles</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
        </div>

        {plansError ? (
          <div className="mt-4 flex items-center gap-3">
            <Alert variant="error">{plansError}</Alert>
            <Button variant="outline" size="sm" onClick={() => void loadPlans()}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid content-start gap-3 md:grid-cols-2">
            {plansLoading ? (
              <p className="text-sm text-slate-500">Loading plans...</p>
            ) : filteredPlans.length === 0 ? (
              <div className="border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No plans match the current filters.
              </div>
            ) : (
              filteredPlans.map((plan) => (
                <article
                  key={plan.id}
                  className="rounded-md border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatMoney(plan.price)}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        per {plan.billingCycle} | {plan.maxBranches} branches
                      </p>
                      <div className="mt-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        <span>{plan.tenantsCount ?? 0}</span> active tenant
                        {plan.tenantsCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${plan.name}`}
                        title="Edit plan"
                        onClick={() => editPlan(plan)}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${plan.name}`}
                        title={
                          (plan.tenantsCount ?? 0) > 0
                            ? `Cannot delete: assigned to ${plan.tenantsCount} active tenant(s)`
                            : `Delete ${plan.name}`
                        }
                        onClick={() => void removePlan(plan)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>

          <form onSubmit={savePlan} className="border-l border-slate-200 pl-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editingPlanId ? "Edit plan" : "New plan"}
              </h3>
              {editingPlanId ? (
                <Button type="button" variant="ghost" size="sm" onClick={resetPlanForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-4">
              {planFeedback ? <Alert variant="error">{planFeedback}</Alert> : null}
              <FormField label="Plan name" htmlFor="plan-name">
                <Input
                  id="plan-name"
                  value={planForm.name}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Price (PKR)" htmlFor="plan-price">
                  <Input
                    id="plan-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={planForm.price}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        price: Number(event.target.value),
                      }))
                    }
                  />
                </FormField>
                <FormField label="Max branches" htmlFor="plan-branches">
                  <Input
                    id="plan-branches"
                    type="number"
                    min="1"
                    value={planForm.maxBranches}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        maxBranches: Number(event.target.value),
                      }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Billing cycle" htmlFor="plan-cycle">
                <Select
                  id="plan-cycle"
                  value={planForm.billingCycle}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      billingCycle: event.target.value as BillingCycle,
                    }))
                  }
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              </FormField>
              <Button type="submit" isLoading={planSaving} className="w-full">
                {editingPlanId ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingPlanId ? "Save plan" : "Create plan"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      {/* Tenant Subscription Section */}
      <section className="border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenant subscription</h2>
          <p className="mt-1 text-sm text-slate-500">
            Look up a tenant by UUID to view or change its current subscription.
          </p>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row max-w-3xl gap-3">
          <div className="flex-1">
            <Select
              aria-label="Select Tenant"
              value={selectedTenantId || ""}
              onChange={(e) => {
                if (e.target.value) {
                  void loadTenantSubscriptionById(e.target.value);
                }
              }}
            >
              <option value="">-- Select an Onboarded Club Tenant --</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="Tenant ID"
              value={tenantInput}
              onChange={(event) => setTenantInput(event.target.value)}
              placeholder="Or enter UUID"
              className="w-48"
            />
            <Button
              type="button"
              variant="outline"
              isLoading={subscriptionLoading}
              onClick={() => void loadTenantSubscription()}
            >
              <Search className="h-4 w-4" /> Load
            </Button>
          </div>
        </div>

        {subscriptionError ? (
          <div className="mt-4">
            <Alert variant="error">{subscriptionError}</Alert>
          </div>
        ) : null}
        {subscriptionFeedback ? (
          <div className="mt-4">
            <Alert>{subscriptionFeedback}</Alert>
          </div>
        ) : null}

        {selectedTenantId && !subscriptionLoading ? (
          <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
            <form onSubmit={saveSubscription} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <FormField label="Plan" htmlFor="tenant-plan">
                  <Select
                    id="tenant-plan"
                    value={subscriptionForm.planId}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        planId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label="Billing cycle" htmlFor="tenant-cycle">
                  <Select
                    id="tenant-cycle"
                    value={subscriptionForm.billingCycle}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        billingCycle: event.target.value as BillingCycle,
                      }))
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </FormField>

                <FormField label="Subscription status" htmlFor="tenant-status">
                  <Select
                    id="tenant-status"
                    value={subscriptionForm.status}
                    onChange={(event) => {
                      const nextStatus = event.target.value as SubscriptionFormState["status"];
                      setSubscriptionForm((current) => ({
                        ...current,
                        status: nextStatus,
                        // If changing from trialing to active, clear trialEndsAt
                        trialEndsAt:
                          nextStatus === "active" && current.status === "trialing"
                            ? ""
                            : current.trialEndsAt,
                      }));
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="past_due">Past due</option>
                    <option value="expired">Expired</option>
                  </Select>
                </FormField>

                <FormField label="Payment status" htmlFor="tenant-payment">
                  <Select
                    id="tenant-payment"
                    value={subscriptionForm.paymentStatus}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        paymentStatus: event.target.value as PaymentStatus,
                      }))
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </Select>
                </FormField>

                <FormField
                  label="Current period start"
                  htmlFor="subscription-currentPeriodStart"
                >
                  <Input
                    id="subscription-currentPeriodStart"
                    type="date"
                    value={subscriptionForm.currentPeriodStart}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        currentPeriodStart: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField
                  label="Current period end"
                  htmlFor="subscription-currentPeriodEnd"
                >
                  <Input
                    id="subscription-currentPeriodEnd"
                    type="date"
                    value={subscriptionForm.currentPeriodEnd}
                    onChange={(event) => {
                      const newEndDate = event.target.value;
                      setSubscriptionForm((current) => {
                        let nextStatus = current.status;
                        if (newEndDate) {
                          const isPast = isDatePast(newEndDate);
                          if (isPast) {
                            const graceValid =
                              current.gracePeriodEndsAt &&
                              !isDatePast(current.gracePeriodEndsAt);
                            nextStatus = graceValid ? "past_due" : "expired";
                          } else if (
                            current.status === "expired" ||
                            current.status === "past_due"
                          ) {
                            nextStatus = "active";
                          }
                        }
                        return {
                          ...current,
                          currentPeriodEnd: newEndDate,
                          status: nextStatus,
                        };
                      });
                    }}
                  />
                </FormField>

                <FormField
                  label="Next billing date"
                  htmlFor="subscription-nextBillingDate"
                >
                  <Input
                    id="subscription-nextBillingDate"
                    type="date"
                    value={subscriptionForm.nextBillingDate}
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        nextBillingDate: event.target.value,
                      }))
                    }
                  />
                </FormField>

                <FormField
                  label="Grace period ends"
                  htmlFor="subscription-gracePeriodEndsAt"
                >
                  <Input
                    id="subscription-gracePeriodEndsAt"
                    type="date"
                    value={subscriptionForm.gracePeriodEndsAt}
                    onChange={(event) => {
                      const newGrace = event.target.value;
                      setSubscriptionForm((current) => {
                        let nextStatus = current.status;
                        const periodEnded = isDatePast(current.currentPeriodEnd);

                        if (!periodEnded && current.currentPeriodEnd) {
                          nextStatus = "active";
                        } else if (periodEnded) {
                          const graceValid = newGrace && !isDatePast(newGrace);
                          nextStatus = graceValid ? "past_due" : "expired";
                        }

                        return {
                          ...current,
                          gracePeriodEndsAt: newGrace,
                          status: nextStatus,
                        };
                      });
                    }}
                  />
                </FormField>

                {/* Trial ends with automatic status switch when cleared */}
                <FormField label="Trial ends" htmlFor="subscription-trialEndsAt">
                  <Input
                    id="subscription-trialEndsAt"
                    type="date"
                    value={subscriptionForm.trialEndsAt}
                    onChange={(event) => {
                      const newTrialEnds = event.target.value;
                      setSubscriptionForm((current) => {
                        let nextStatus = current.status;
                        if (!newTrialEnds && current.status === "trialing") {
                          // Clear date -> switch to active automatically
                          nextStatus = "active";
                        } else if (
                          newTrialEnds &&
                          !isDatePast(newTrialEnds) &&
                          current.status === "active"
                        ) {
                          // Future trial date added -> switch to trialing
                          nextStatus = "trialing";
                        }
                        return {
                          ...current,
                          trialEndsAt: newTrialEnds,
                          status: nextStatus,
                        };
                      });
                    }}
                  />
                </FormField>
              </div>

              {isPeriodLapsed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    Current period ended on{" "}
                    <strong>{subscriptionForm.currentPeriodEnd}</strong>. Status
                    automatically adjusted to{" "}
                    <strong>{subscriptionForm.status.replaceAll("_", " ")}</strong>.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={subscriptionSaving}>
                  <CreditCard className="h-4 w-4" /> Save subscription
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={subscriptionSaving || actionLoading}
                  onClick={() => void handleExtendTrial()}
                >
                  Extend Trial (+14d)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={subscriptionSaving || actionLoading}
                  onClick={() => void handleUpdatePaymentStatus("paid")}
                >
                  Mark Paid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={subscriptionSaving || actionLoading}
                  onClick={() => void handleUpdatePaymentStatus("failed")}
                >
                  Mark Failed
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={subscriptionSaving || actionLoading}
                  onClick={() => void handleMoveToGracePeriod()}
                >
                  Move to Grace Period
                </Button>
                {subscription &&
                subscription.status !== "suspended" &&
                subscription.status !== "cancelled" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={subscriptionSaving || actionLoading}
                    onClick={() => void transitionSubscription("suspend")}
                  >
                    <PauseCircle className="h-4 w-4" /> Suspend
                  </Button>
                ) : null}
                {subscription?.status === "suspended" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={subscriptionSaving || actionLoading}
                    onClick={() => void transitionSubscription("resume")}
                  >
                    <PlayCircle className="h-4 w-4" /> Resume
                  </Button>
                ) : null}
                {subscription && subscription.status !== "cancelled" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={subscriptionSaving || actionLoading}
                    onClick={() => void transitionSubscription("cancel")}
                  >
                    <XCircle className="h-4 w-4" /> Cancel subscription
                  </Button>
                ) : null}
              </div>
            </form>

            <aside className="border-l border-slate-200 pl-6">
              <h3 className="font-semibold text-slate-900">Current state</h3>
              {subscription ? (
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-500">Plan</dt>
                    <dd className="mt-1 font-medium text-slate-900">
                      {subscription.plan.name}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge value={subscription.status} />
                    <StatusBadge value={subscription.paymentStatus} />
                  </div>
                  <div>
                    <dt className="text-slate-500">Current period</dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(subscription.currentPeriodStart)} to{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Next billing</dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(subscription.nextBillingDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Grace period</dt>
                    <dd className="mt-1 text-slate-800">
                      {formatDate(subscription.gracePeriodEndsAt)}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <CalendarClock className="h-4 w-4" /> Tenant {selectedTenantId}
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No current subscription.
                </p>
              )}
            </aside>
          </div>
        ) : null}
      </section>

      {/* Delete Plan Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingPlanDelete)}
        title={
          pendingPlanDelete && (pendingPlanDelete.tenantsCount ?? 0) > 0
            ? "Cannot delete plan"
            : "Delete plan"
        }
        description={
          pendingPlanDelete
            ? (pendingPlanDelete.tenantsCount ?? 0) > 0
              ? `Plan "${pendingPlanDelete.name}" is currently assigned to ${pendingPlanDelete.tenantsCount} active tenant(s). You must reassign these tenants to another plan before deleting this plan.`
              : `Are you sure you want to delete "${pendingPlanDelete.name}"? This will archive the plan so it cannot be assigned to new tenants.`
            : ""
        }
        confirmText={
          pendingPlanDelete && (pendingPlanDelete.tenantsCount ?? 0) > 0
            ? "Understood"
            : "Delete plan"
        }
        cancelText="Cancel"
        variant={
          pendingPlanDelete && (pendingPlanDelete.tenantsCount ?? 0) > 0
            ? "warning"
            : "danger"
        }
        isLoading={planDeleting}
        onConfirm={() => {
          if (pendingPlanDelete && (pendingPlanDelete.tenantsCount ?? 0) > 0) {
            setPendingPlanDelete(null);
          } else {
            void handleConfirmDeletePlan();
          }
        }}
        onCancel={() => setPendingPlanDelete(null)}
      />

      {/* Subscription Action Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingSubscriptionAction)}
        title={
          pendingSubscriptionAction === "suspend"
            ? "Suspend subscription"
            : pendingSubscriptionAction === "resume"
            ? "Resume subscription"
            : "Cancel subscription"
        }
        description={
          pendingSubscriptionAction === "cancel"
            ? "Are you sure you want to cancel this tenant subscription? The tenant will lose access to subscription benefits."
            : pendingSubscriptionAction === "suspend"
            ? "Are you sure you want to suspend this tenant subscription? The tenant will be blocked from accessing services until resumed."
            : "Resume this tenant subscription and restore active access?"
        }
        confirmText={
          pendingSubscriptionAction === "cancel"
            ? "Cancel subscription"
            : pendingSubscriptionAction === "suspend"
            ? "Suspend"
            : "Resume"
        }
        cancelText="Close"
        variant={
          pendingSubscriptionAction === "resume" ? "primary" : "danger"
        }
        isLoading={actionLoading}
        onConfirm={async () => {
          if (!selectedTenantId || !pendingSubscriptionAction) return;
          setActionLoading(true);
          setSubscriptionError(null);
          setSubscriptionFeedback(null);
          try {
            let updated: TenantSubscription;
            if (pendingSubscriptionAction === "suspend") {
              updated = await suspendTenantSubscription(
                selectedTenantId,
                subscriptionForm.gracePeriodEndsAt || null
              );
            } else if (pendingSubscriptionAction === "resume") {
              updated = await resumeTenantSubscription(selectedTenantId);
            } else {
              updated = await cancelTenantSubscription(selectedTenantId);
            }
            setSubscription(updated);
            setSubscriptionForm(subscriptionFormFromCurrent(updated));
            setSubscriptionFeedback(
              `Subscription ${
                pendingSubscriptionAction === "suspend"
                  ? "suspended"
                  : pendingSubscriptionAction === "resume"
                  ? "resumed"
                  : "cancelled"
              } successfully.`
            );
            await loadPlans();
            setPendingSubscriptionAction(null);
          } catch (error) {
            setSubscriptionError(
              errorMessage(
                error,
                `Could not ${pendingSubscriptionAction} subscription.`
              )
            );
            setPendingSubscriptionAction(null);
          } finally {
            setActionLoading(false);
          }
        }}
        onCancel={() => setPendingSubscriptionAction(null)}
      />
    </div>
  );
}