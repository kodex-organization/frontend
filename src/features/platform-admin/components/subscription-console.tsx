"use client";

import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDate, formatMoney, toDateInput } from "../format";
import {
  cancelTenantSubscription,
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  filterSubscriptionPlans,
  getTenantSubscription,
  listSubscriptionPlans,
  resumeTenantSubscription,
  setTenantSubscription,
  suspendTenantSubscription,
  updateSubscriptionPlan,
  validateTenantId,
  type BillingCycle,
  type PaymentStatus,
  type SubscriptionPlan,
  type SubscriptionPlanInput,
  type TenantSubscription,
} from "../subscriptions";

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

function subscriptionFormFromCurrent(subscription: TenantSubscription | null) {
  if (!subscription) return { ...emptySubscriptionForm };
  const manageableStatus = ["active", "trialing", "past_due", "expired"].includes(
    subscription.status,
  )
    ? (subscription.status as "active" | "trialing" | "past_due" | "expired")
    : "active";
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
  const positive = value === "active" || value === "paid";
  const warning =
    value === "trialing" || value === "pending" || value === "past_due";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        positive
          ? "bg-emerald-50 text-emerald-700"
          : warning
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-700"
      }`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

export function SubscriptionConsole() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cycleFilter, setCycleFilter] = useState<BillingCycle | "all">("all");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<SubscriptionPlanInput>(emptyPlan);
  const [planSaving, setPlanSaving] = useState(false);
  const [planFeedback, setPlanFeedback] = useState<string | null>(null);

  const [tenantInput, setTenantInput] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState(
    emptySubscriptionForm,
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [subscriptionFeedback, setSubscriptionFeedback] = useState<string | null>(
    null,
  );

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      setPlans(await listSubscriptionPlans());
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
    [cycleFilter, plans, search],
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
    if (!window.confirm(`Archive the ${plan.name} subscription plan?`)) return;
    try {
      await deleteSubscriptionPlan(plan.id);
      await loadPlans();
    } catch (error) {
      setPlansError(errorMessage(error, "Could not archive the plan."));
    }
  };

  const loadTenantSubscription = async () => {
    const parsed = validateTenantId(tenantInput);
    if (!parsed.success) {
      setSubscriptionError(parsed.error.issues[0]?.message ?? "Invalid tenant ID.");
      return;
    }
    const tenantId = parsed.data;
    setSubscriptionLoading(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    setSelectedTenantId(tenantId);
    try {
      const current = await getTenantSubscription(tenantId);
      setSubscription(current);
      setSubscriptionForm(subscriptionFormFromCurrent(current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setSubscription(null);
        setSubscriptionForm({ ...emptySubscriptionForm });
        setSubscriptionFeedback(
          "No current subscription was found. Select a plan to create one.",
        );
      } else {
        setSubscriptionError(
          errorMessage(error, "Could not load the tenant subscription."),
        );
      }
    } finally {
      setSubscriptionLoading(false);
    }
  };

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
    setSubscriptionSaving(true);
    setSubscriptionError(null);
    setSubscriptionFeedback(null);
    try {
      const updated = await setTenantSubscription(selectedTenantId, {
        ...subscriptionForm,
        trialEndsAt: subscriptionForm.trialEndsAt || null,
        currentPeriodStart: subscriptionForm.currentPeriodStart || null,
        currentPeriodEnd: subscriptionForm.currentPeriodEnd || null,
        nextBillingDate: subscriptionForm.nextBillingDate || null,
        gracePeriodEndsAt: subscriptionForm.gracePeriodEndsAt || null,
      });
      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));
      setSubscriptionFeedback("Tenant subscription updated.");
    } catch (error) {
      setSubscriptionError(errorMessage(error, "Could not update the subscription."));
    } finally {
      setSubscriptionSaving(false);
    }
  };

  const transitionSubscription = async (
    action: "suspend" | "resume" | "cancel",
  ) => {
    if (!selectedTenantId || !subscription) return;
    const prompt =
      action === "suspend"
        ? "Suspend this tenant subscription?"
        : action === "resume"
          ? "Resume this tenant subscription?"
          : "Cancel this tenant subscription? This removes the next billing date.";
    if (!window.confirm(prompt)) return;

    setSubscriptionSaving(true);
    setSubscriptionError(null);
    try {
      const updated =
        action === "suspend"
          ? await suspendTenantSubscription(
              selectedTenantId,
              subscriptionForm.gracePeriodEndsAt || null,
            )
          : action === "resume"
            ? await resumeTenantSubscription(selectedTenantId)
            : await cancelTenantSubscription(selectedTenantId);
      setSubscription(updated);
      setSubscriptionForm(subscriptionFormFromCurrent(updated));
      setSubscriptionFeedback(`Subscription ${action} action completed.`);
    } catch (error) {
      setSubscriptionError(errorMessage(error, `Could not ${action} subscription.`));
    } finally {
      setSubscriptionSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium text-brand-700">Platform billing</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          Subscription management
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Maintain plans and control the current billing state for an individual
          tenant.
        </p>
      </header>

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
                <article key={plan.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {formatMoney(plan.price)}
                      </p>
                      <p className="text-xs capitalize text-slate-500">
                        per {plan.billingCycle} | {plan.maxBranches} branches
                      </p>
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
                        aria-label={`Archive ${plan.name}`}
                        title="Archive plan"
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
                    setPlanForm((current) => ({ ...current, name: event.target.value }))
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
                {editingPlanId ? <CheckCircle2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editingPlanId ? "Save plan" : "Create plan"}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tenant subscription</h2>
          <p className="mt-1 text-sm text-slate-500">
            Look up a tenant by UUID to view or change its current subscription.
          </p>
        </div>
        <div className="mt-4 flex max-w-2xl gap-3">
          <Input
            aria-label="Tenant ID"
            value={tenantInput}
            onChange={(event) => setTenantInput(event.target.value)}
            placeholder="Tenant UUID"
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

        {subscriptionError ? <div className="mt-4"><Alert variant="error">{subscriptionError}</Alert></div> : null}
        {subscriptionFeedback ? <div className="mt-4"><Alert>{subscriptionFeedback}</Alert></div> : null}

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
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
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
                    onChange={(event) =>
                      setSubscriptionForm((current) => ({
                        ...current,
                        status: event.target.value as typeof current.status,
                      }))
                    }
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
                {[
                  ["Current period start", "currentPeriodStart"],
                  ["Current period end", "currentPeriodEnd"],
                  ["Next billing date", "nextBillingDate"],
                  ["Grace period ends", "gracePeriodEndsAt"],
                  ["Trial ends", "trialEndsAt"],
                ].map(([label, key]) => (
                  <FormField key={key} label={label} htmlFor={`subscription-${key}`}>
                    <Input
                      id={`subscription-${key}`}
                      type="date"
                      value={subscriptionForm[key as keyof typeof subscriptionForm]}
                      onChange={(event) =>
                        setSubscriptionForm((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={subscriptionSaving}>
                  <CreditCard className="h-4 w-4" /> Save subscription
                </Button>
                {subscription && subscription.status !== "suspended" && subscription.status !== "cancelled" ? (
                  <Button type="button" variant="outline" disabled={subscriptionSaving} onClick={() => void transitionSubscription("suspend")}>
                    <PauseCircle className="h-4 w-4" /> Suspend
                  </Button>
                ) : null}
                {subscription?.status === "suspended" ? (
                  <Button type="button" variant="outline" disabled={subscriptionSaving} onClick={() => void transitionSubscription("resume")}>
                    <PlayCircle className="h-4 w-4" /> Resume
                  </Button>
                ) : null}
                {subscription && subscription.status !== "cancelled" ? (
                  <Button type="button" variant="ghost" disabled={subscriptionSaving} onClick={() => void transitionSubscription("cancel")}>
                    <XCircle className="h-4 w-4" /> Cancel subscription
                  </Button>
                ) : null}
              </div>
            </form>

            <aside className="border-l border-slate-200 pl-6">
              <h3 className="font-semibold text-slate-900">Current state</h3>
              {subscription ? (
                <dl className="mt-4 space-y-4 text-sm">
                  <div><dt className="text-slate-500">Plan</dt><dd className="mt-1 font-medium text-slate-900">{subscription.plan.name}</dd></div>
                  <div className="flex gap-2"><StatusBadge value={subscription.status} /><StatusBadge value={subscription.paymentStatus} /></div>
                  <div><dt className="text-slate-500">Current period</dt><dd className="mt-1 text-slate-800">{formatDate(subscription.currentPeriodStart)} to {formatDate(subscription.currentPeriodEnd)}</dd></div>
                  <div><dt className="text-slate-500">Next billing</dt><dd className="mt-1 text-slate-800">{formatDate(subscription.nextBillingDate)}</dd></div>
                  <div><dt className="text-slate-500">Grace period</dt><dd className="mt-1 text-slate-800">{formatDate(subscription.gracePeriodEndsAt)}</dd></div>
                  <div className="flex items-center gap-2 text-xs text-slate-500"><CalendarClock className="h-4 w-4" /> Tenant {selectedTenantId}</div>
                </dl>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No current subscription.</p>
              )}
            </aside>
          </div>
        ) : null}
      </section>
    </div>
  );
}
