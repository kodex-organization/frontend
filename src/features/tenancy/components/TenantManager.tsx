"use client";

import { useEffect, useState } from "react";
import { TenancyApi, Tenant, SubscriptionPlan, DataExportJob } from "../tenancy.api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input, FormField } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Plus,
  ShieldAlert,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  CreditCard,
  Download,
  AlertTriangle,
  Building,
  Eye,
} from "lucide-react";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/toast";

interface TenantManagerProps {
  onSelectTenantForSubscription?: (tenantId: string) => void;
}

export function TenantManager({ onSelectTenantForSubscription }: TenantManagerProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State for Onboarding
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Detail Modal
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<Tenant | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Termination Confirm Modal
  const [tenantToTerminate, setTenantToTerminate] = useState<Tenant | null>(null);
  const [terminateLoading, setTerminateLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [timezone, setTimezone] = useState("Asia/Karachi");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tenantsData, plansData] = await Promise.all([
        TenancyApi.listTenants({
          search: search || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }),
        TenancyApi.listSubscriptionPlans().catch(() => []),
      ]);
      setTenants(tenantsData);
      setPlans(plansData);
    } catch (err: any) {
      const msg = err.message || "Failed to retrieve tenants";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadTenants();
  };

  const handleToggleStatus = async (id: string, currentStatus: string, clubName: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await TenancyApi.updateTenantStatus(id, newStatus);
      toast.success(`${clubName} is now ${newStatus}`);
      await loadTenants();
    } catch (err: any) {
      toast.error(err.message || "Failed to update tenant status");
    }
  };

  const handleConfirmTerminate = async () => {
    if (!tenantToTerminate) return;
    try {
      setTerminateLoading(true);
      await TenancyApi.terminateTenant(tenantToTerminate.id);
      toast.success(`"${tenantToTerminate.name}" has been terminated`);
      setTenantToTerminate(null);
      await loadTenants();
    } catch (err: any) {
      toast.error(err.message || "Failed to terminate tenant");
    } finally {
      setTerminateLoading(false);
    }
  };

  const handleTriggerExport = async (id: string, tenantName: string) => {
    try {
      toast.info(`Requesting full data export for ${tenantName}...`);
      const job = await TenancyApi.requestTenantExport(id);
      toast.success(`Export queued (Job: ${job.id.slice(0, 8)}). Ready shortly.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger tenant data export");
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await TenancyApi.getTenant(id);
      setSelectedTenantDetail(detail);
    } catch (err: any) {
      toast.error(err.message || "Could not load tenant details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);
    try {
      await TenancyApi.onboardTenant({
        name,
        branchName,
        subscriptionPlanId: subscriptionPlanId || undefined,
        currency,
        timezone,
        ownerName,
        ownerEmail,
        ownerPassword,
      });
      toast.success(`Club "${name}" onboarded successfully!`);
      setShowModal(false);
      // Reset form
      setName("");
      setBranchName("");
      setSubscriptionPlanId("");
      setOwnerName("");
      setOwnerEmail("");
      setOwnerPassword("");
      await loadTenants();
    } catch (err: any) {
      const msg = err.message || "Failed to onboard new tenant";
      setModalError(msg);
      toast.error(msg);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Management</h1>
          <p className="text-sm text-slate-500">
            Onboard new clubs, manage subscriptions, govern tenant lifecycles, and export club data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadTenants} variant="secondary" className="w-auto px-3">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowModal(true)} className="w-auto px-4 gap-1 bg-brand-600 hover:bg-brand-700 text-white">
            <Plus className="h-4 w-4" /> Onboard Club
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search club or owner name..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" className="w-auto px-4">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-64 bg-slate-100 rounded-xl border border-slate-200/60"></div>
        </div>
      ) : error ? (
        <div className="space-y-4 max-w-xl mx-auto mt-12 text-center">
          <Alert variant="error">
            <p className="font-semibold">Tenant Load Error</p>
            <p className="text-xs mt-1">{error}</p>
          </Alert>
          <Button onClick={loadTenants} className="w-auto px-6 mx-auto">
            Retry Loading
          </Button>
        </div>
      ) : tenants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center bg-white shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-semibold text-slate-900">No tenants found</h3>
          <p className="mt-1 text-sm text-slate-500">
            {search ? "No clubs matched your search criteria." : "Get started by onboarding the first club tenant."}
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowModal(true)} className="w-auto px-4 bg-brand-600 text-white">
              Onboard Club
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
              <tr>
                <th className="px-6 py-4">Club Name</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Subscription Plan</th>
                <th className="px-6 py-4">Owner</th>
                <th className="px-6 py-4">Branches</th>
                <th className="px-6 py-4">Onboarded</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenants.map((t) => {
                const planName = t.currentSubscription?.plan?.name || t.subscriptionPlan?.name || "No Plan";
                const isCancelled = t.status === "cancelled" || t.deletedAt;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div>{t.name}</div>
                      <div className="text-xs font-normal text-slate-400 font-mono">{t.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          t.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.status === "suspended"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {t.status === "active" ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : t.status === "suspended" ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md text-xs">
                        <CreditCard className="h-3.5 w-3.5 text-brand-600" />
                        {planName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800 text-xs">
                        {t.owner?.fullName || "—"}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.owner?.email || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium bg-slate-100 text-slate-700 px-2 py-1 rounded inline-flex items-center gap-1">
                        <Building className="h-3 w-3 text-slate-500" />
                        {t.branches.length} Branch{t.branches.length === 1 ? "" : "es"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          onClick={() => handleViewDetail(t.id)}
                          variant="secondary"
                          className="w-auto px-2.5 py-1 text-xs"
                          title="View Club Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {onSelectTenantForSubscription && (
                          <Button
                            onClick={() => onSelectTenantForSubscription(t.id)}
                            variant="secondary"
                            className="w-auto px-2.5 py-1 text-xs text-brand-700 hover:text-brand-800"
                            title="Manage Subscription"
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Plan
                          </Button>
                        )}
                        <Button
                          onClick={() => handleTriggerExport(t.id, t.name)}
                          variant="secondary"
                          className="w-auto px-2.5 py-1 text-xs"
                          title="Export All Tenant Data"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!isCancelled && (
                          <Button
                            onClick={() => handleToggleStatus(t.id, t.status, t.name)}
                            variant="secondary"
                            className={`w-auto px-2.5 py-1 text-xs ${
                              t.status === "active"
                                ? "hover:bg-amber-50 text-amber-700"
                                : "hover:bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {t.status === "active" ? "Suspend" : "Activate"}
                          </Button>
                        )}
                        {!isCancelled && (
                          <Button
                            onClick={() => setTenantToTerminate(t)}
                            variant="secondary"
                            className="w-auto px-2.5 py-1 text-xs hover:bg-rose-50 text-rose-700"
                            title="Terminate Club"
                          >
                            Terminate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tenant Details Modal */}
      {selectedTenantDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950">{selectedTenantDetail.name}</h3>
                <p className="text-xs text-slate-500 font-mono">ID: {selectedTenantDetail.id}</p>
              </div>
              <button
                onClick={() => setSelectedTenantDetail(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Status</div>
                  <div className="text-sm font-bold text-slate-800 capitalize mt-0.5">
                    {selectedTenantDetail.status}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Active Plan</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedTenantDetail.currentSubscription?.plan?.name || "No Plan"}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Locale & Currency</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedTenantDetail.currency} ({selectedTenantDetail.timezone})
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Registered Owner</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedTenantDetail.owner?.fullName || "—"}
                  </div>
                  <div className="text-xs text-slate-500">{selectedTenantDetail.owner?.email}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Branches & Capacities</h4>
                <div className="space-y-2">
                  {selectedTenantDetail.branches.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{b.name}</div>
                        <div className="text-xs text-slate-500">{b.address || "No address configured"}</div>
                      </div>
                      <div className="text-right text-xs">
                        <span className="font-semibold text-slate-700">{b.tablesCount ?? 0}</span> Tables
                        {b.activeSessionsCount !== undefined && (
                          <span className="ml-2 text-emerald-600 font-medium">
                            ({b.activeSessionsCount} active)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 px-6 py-4 bg-slate-50">
              <Button
                type="button"
                onClick={() => setSelectedTenantDetail(null)}
                variant="secondary"
                className="w-auto px-5"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Dialog Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">Onboard New Club Tenant</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-medium"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {modalError && (
                  <Alert variant="error">
                    <p className="text-xs">{modalError}</p>
                  </Alert>
                )}

                <FormField label="Club / Tenant Name" htmlFor="name">
                  <Input
                    id="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. CueClub Premium"
                  />
                </FormField>

                <FormField label="First Branch Name" htmlFor="branchName">
                  <Input
                    id="branchName"
                    required
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Main Branch"
                  />
                </FormField>

                <FormField label="Subscription Plan" htmlFor="subscriptionPlanId">
                  <Select
                    id="subscriptionPlanId"
                    value={subscriptionPlanId}
                    onChange={(e) => setSubscriptionPlanId(e.target.value)}
                  >
                    <option value="">No Plan Selected</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — Rs. {Number(p.price).toLocaleString()} / {p.billingCycle} (Up to {p.maxBranches} branch{p.maxBranches === 1 ? "" : "es"})
                      </option>
                    ))}
                  </Select>
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Currency" htmlFor="currency">
                    <Input
                      id="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Timezone" htmlFor="timezone">
                    <Input
                      id="timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                    />
                  </FormField>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Owner Account</h4>

                  <div className="space-y-4">
                    <FormField label="Owner Full Name" htmlFor="ownerName">
                      <Input
                        id="ownerName"
                        required
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="e.g. Ali Ahmed"
                      />
                    </FormField>

                    <FormField label="Owner Email" htmlFor="ownerEmail">
                      <Input
                        id="ownerEmail"
                        type="email"
                        required
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@club.com"
                      />
                    </FormField>

                    <FormField label="Owner Password" htmlFor="ownerPassword">
                      <Input
                        id="ownerPassword"
                        type="password"
                        required
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </FormField>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 bg-slate-50">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  variant="secondary"
                  className="w-auto px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={modalLoading}
                  className="w-auto px-5 bg-brand-600 text-white hover:bg-brand-700"
                >
                  Onboard Club
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terminate Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(tenantToTerminate)}
        title="Terminate Club Tenant"
        description={`Are you sure you want to terminate "${tenantToTerminate?.name}"? This will cancel their active subscription, lock club operations, and deactivate the account.`}
        confirmText="Terminate Club"
        cancelText="Keep Active"
        variant="danger"
        isLoading={terminateLoading}
        onConfirm={handleConfirmTerminate}
        onCancel={() => setTenantToTerminate(null)}
      />
    </div>
  );
}
