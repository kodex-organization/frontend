"use client";

import { useEffect, useState } from "react";
import {
  TenancyApi,
  Tenant,
  SubscriptionPlan,
  DataExportJob,
  SupportNote,
  TenantLifecycleEvent,
} from "../tenancy.api";
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
  MessageSquare,
  History,
} from "lucide-react";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/toast";

interface TenantManagerProps {
  onSelectTenantForSubscription?: (tenantId: string) => void;
}

const lifecycleLabel = (event: TenantLifecycleEvent) => {
  switch (event.actionType) {
    case "tenant_terminated":
      return "Terminated";
    case "tenant_restored":
      return "Restored";
    case "tenant_reactivated":
      return "Reactivated";
    case "tenant_status_updated":
      return event.newStatus ? `Status changed to ${event.newStatus}` : "Status changed";
    case "tenant_termination_override":
      return "Termination override";
    case "tenant_suspension_override":
      return "Suspension override";
    default:
      return event.actionType;
  }
};

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
  const [supportNotes, setSupportNotes] = useState<SupportNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Termination Confirm Modal
  const [tenantToTerminate, setTenantToTerminate] = useState<Tenant | null>(null);
  const [terminateLoading, setTerminateLoading] = useState(false);

  // Restore Confirm Modal (undo termination)
  const [tenantToRestore, setTenantToRestore] = useState<Tenant | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Tracks which tenant's export/download is currently in progress, so the
  // row's Download button can show a busy state.
  const [exportingTenantId, setExportingTenantId] = useState<string | null>(null);

  // Force Override Modal State
  const [overrideModal, setOverrideModal] = useState<{
    open: boolean;
    type: "suspend" | "terminate";
    tenantId: string;
    clubName: string;
    message: string;
  }>({
    open: false,
    type: "suspend",
    tenantId: "",
    clubName: "",
    message: "",
  });
  const [forceReason, setForceReason] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [subscriptionPlanId, setSubscriptionPlanId] = useState("");
  const [onboardStatus, setOnboardStatus] = useState<"active" | "trial">("trial");
  const [trialDays, setTrialDays] = useState(14);
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
      const msg = err.message || "";
      if (
        msg.includes("active session") ||
        msg.includes("outstanding balance") ||
        msg.includes("Force override")
      ) {
        setOverrideModal({
          open: true,
          type: "suspend",
          tenantId: id,
          clubName,
          message: msg,
        });
        setForceReason("");
      } else {
        toast.error(msg || "Failed to update tenant status");
      }
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
      const msg = err.message || "";
      if (
        msg.includes("active session") ||
        msg.includes("outstanding balance") ||
        msg.includes("Force override")
      ) {
        const tId = tenantToTerminate.id;
        const tName = tenantToTerminate.name;
        setTenantToTerminate(null);
        setOverrideModal({
          open: true,
          type: "terminate",
          tenantId: tId,
          clubName: tName,
          message: msg,
        });
        setForceReason("");
      } else {
        toast.error(msg || "Failed to terminate tenant");
      }
    } finally {
      setTerminateLoading(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!tenantToRestore) return;
    try {
      setRestoreLoading(true);
      await TenancyApi.restoreTenant(tenantToRestore.id);
      toast.success(`"${tenantToRestore.name}" has been restored and set to Suspended`);
      setTenantToRestore(null);
      await loadTenants();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore tenant");
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forceReason.trim()) {
      toast.error("A justification reason is required to force override.");
      return;
    }
    setOverrideLoading(true);
    try {
      if (overrideModal.type === "suspend") {
        await TenancyApi.updateTenantStatus(
          overrideModal.tenantId,
          "suspended",
          undefined,
          true,
          forceReason.trim(),
        );
        toast.success(`${overrideModal.clubName} has been suspended via force override.`);
      } else {
        await TenancyApi.terminateTenant(
          overrideModal.tenantId,
          true,
          forceReason.trim(),
        );
        toast.success(`${overrideModal.clubName} has been terminated via force override.`);
      }
      setOverrideModal({ open: false, type: "suspend", tenantId: "", clubName: "", message: "" });
      setForceReason("");
      await loadTenants();
    } catch (err: any) {
      toast.error(err.message || "Force override failed");
    } finally {
      setOverrideLoading(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const triggerBrowserDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleTriggerExport = async (id: string, tenantName: string) => {
    setExportingTenantId(id);
    try {
      toast.info(`Requesting full data export for ${tenantName}...`);
      const job = await TenancyApi.requestTenantExport(id);

      // The export is built by a background worker, so poll for it to
      // finish instead of only showing a "queued" toast and stopping there.
      let finished = job;
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (finished.status === "completed" || finished.status === "failed" || finished.status === "expired") {
          break;
        }
        await sleep(3000);
        const page = await TenancyApi.listTenantExports(id);
        finished = page.items.find((item) => item.id === job.id) ?? finished;
      }

      if (finished.status === "completed") {
        const artifact = await TenancyApi.downloadTenantExport(id, finished.id);
        triggerBrowserDownload(artifact.blob, artifact.fileName);
        toast.success(`Downloaded export for ${tenantName}.`);
      } else if (finished.status === "failed") {
        toast.error(finished.failureReason || `Export for ${tenantName} failed to generate.`);
      } else {
        toast.info(`Export for ${tenantName} is still processing. Check back shortly.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger tenant data export");
    } finally {
      setExportingTenantId(null);
    }
  };

  const loadSupportNotes = async (tenantId: string) => {
    setNotesLoading(true);
    try {
      const notes = await TenancyApi.listSupportNotes(tenantId);
      setSupportNotes(notes);
    } catch {
      setSupportNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddSupportNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantDetail || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const note = await TenancyApi.createSupportNote(selectedTenantDetail.id, newNote.trim());
      setSupportNotes((prev) => [note, ...prev]);
      setNewNote("");
      toast.success("Support note recorded.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add support note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await TenancyApi.getTenant(id);
      setSelectedTenantDetail(detail);
      void loadSupportNotes(id);
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
        status: onboardStatus,
        trialDays: Number(trialDays),
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
      setOnboardStatus("trial");
      setTrialDays(14);
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
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
            <option value="pending">Pending</option>
            <option value="terminated">Terminated</option>
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
                {statusFilter === "terminated" && (
                  <th className="px-6 py-4">Termination Reason</th>
                )}
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
                const isTerminated = Boolean(t.deletedAt);
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
                        {isTerminated ? "terminated" : t.status}
                      </span>
                    </td>
                    {statusFilter === "terminated" && (
                      <td className="px-6 py-4 max-w-[240px]">
                        {t.terminationInfo ? (
                          <div className="space-y-0.5">
                            <div
                              className="truncate text-xs text-slate-700"
                              title={t.terminationInfo.reason ?? undefined}
                            >
                              {t.terminationInfo.reason || "No reason recorded"}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {new Date(t.terminationInfo.terminatedAt).toLocaleDateString()}
                              {t.terminationInfo.forced ? " · Force override" : ""}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
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
                          isLoading={exportingTenantId === t.id}
                          disabled={exportingTenantId !== null && exportingTenantId !== t.id}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {!isTerminated && (
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
                        {!isTerminated && (
                          <Button
                            onClick={() => setTenantToTerminate(t)}
                            variant="secondary"
                            className="w-auto px-2.5 py-1 text-xs hover:bg-rose-50 text-rose-700"
                            title="Terminate Club"
                          >
                            Terminate
                          </Button>
                        )}
                        {isTerminated && (
                          <Button
                            onClick={() => setTenantToRestore(t)}
                            variant="secondary"
                            className="w-auto px-2.5 py-1 text-xs hover:bg-emerald-50 text-emerald-700"
                            title="Restore Terminated Club"
                          >
                            Restore
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
                    {selectedTenantDetail.deletedAt ? "terminated" : selectedTenantDetail.status}
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

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-500" />
                  Lifecycle History
                </h4>
                {(selectedTenantDetail.lifecycleEvents ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No lifecycle events recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {(selectedTenantDetail.lifecycleEvents ?? []).map((event) => (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg border border-slate-200 bg-white text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-800">
                            {lifecycleLabel(event)}
                            {event.forced && (
                              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                Force override
                              </span>
                            )}
                          </span>
                          <span className="text-slate-400">
                            {new Date(event.occurredAt).toLocaleString()}
                          </span>
                        </div>
                        {event.reason && (
                          <p className="mt-1.5 whitespace-pre-wrap text-slate-700">
                            <span className="font-medium text-slate-500">Reason: </span>
                            {event.reason}
                          </p>
                        )}
                        {event.forced &&
                          (event.openSessionsCount !== null || event.udhaarCustomerCount !== null) && (
                            <p className="mt-1 text-slate-500">
                              Open at the time: {event.openSessionsCount ?? 0} session(s),{" "}
                              {event.udhaarCustomerCount ?? 0} customer(s) with outstanding balance
                            </p>
                          )}
                        <p className="mt-1 text-slate-400">
                          By {event.performedBy?.fullName || event.performedBy?.email || "Platform Admin"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support Notes Section (§3.15) */}
              <div className="border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                    Internal Support Notes
                  </h4>
                  <span className="text-xs text-slate-400">SRS §3.15</span>
                </div>

                {/* Create Support Note Form */}
                <form onSubmit={handleAddSupportNote} className="space-y-2 mb-4">
                  <textarea
                    rows={2}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add an internal support note regarding this club..."
                    className="w-full text-xs rounded-lg border border-slate-200 p-2.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={addingNote || !newNote.trim()}
                      isLoading={addingNote}
                      size="sm"
                      className="text-xs px-3 bg-brand-600 hover:bg-brand-700 text-white"
                    >
                      Post Note
                    </Button>
                  </div>
                </form>

                {/* Notes List */}
                <div className="space-y-2">
                  {notesLoading ? (
                    <p className="text-xs text-slate-400">Loading support notes...</p>
                  ) : supportNotes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No support notes recorded yet.</p>
                  ) : (
                    supportNotes.map((n) => (
                      <div key={n.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700">
                            {n.superAdmin?.fullName || n.superAdmin?.email || "Platform Admin"}
                          </span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))
                  )}
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
                  <FormField label="Initial Status" htmlFor="onboardStatus">
                    <Select
                      id="onboardStatus"
                      value={onboardStatus}
                      onChange={(e) => setOnboardStatus(e.target.value as "active" | "trial")}
                    >
                      <option value="trial">Trial Period</option>
                      <option value="active">Active Immediately</option>
                    </Select>
                  </FormField>

                  <FormField label="Trial Duration (Days)" htmlFor="trialDays">
                    <Input
                      id="trialDays"
                      type="number"
                      min={1}
                      max={90}
                      value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value))}
                    />
                  </FormField>
                </div>

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

      {/* Restore Confirmation Modal (undo termination) */}
      <ConfirmModal
        isOpen={Boolean(tenantToRestore)}
        title="Restore Terminated Club"
        description={`Restore "${tenantToRestore?.name}"? The account and all its historical data will become accessible again, set to Suspended status. You will need to reactivate it separately once billing is sorted out.`}
        confirmText="Restore Club"
        cancelText="Cancel"
        variant="primary"
        isLoading={restoreLoading}
        onConfirm={handleConfirmRestore}
        onCancel={() => setTenantToRestore(null)}
      />

      {/* Force Override Modal (§3.15) */}
      {overrideModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-red-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-red-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-950">
                  Force Override Guard (§3.15)
                </h3>
              </div>
              <button
                onClick={() => setOverrideModal({ ...overrideModal, open: false })}
                className="text-slate-400 hover:text-slate-600 text-2xl font-medium"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmOverride} className="p-6 space-y-4">
              <div className="p-3 bg-red-50 rounded-lg text-xs text-red-800 border border-red-200">
                {overrideModal.message}
              </div>

              <p className="text-xs text-slate-600">
                To proceed with {overrideModal.type === "suspend" ? "suspending" : "terminating"}{" "}
                <span className="font-semibold text-slate-900">{overrideModal.clubName}</span> despite active sessions or outstanding customer balance, a mandatory justification reason must be recorded in the immutable platform audit log.
              </p>

              <FormField label="Override Justification (Required)" htmlFor="forceReason">
                <textarea
                  id="forceReason"
                  required
                  rows={3}
                  value={forceReason}
                  onChange={(e) => setForceReason(e.target.value)}
                  placeholder="State the business or compliance justification for this override..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </FormField>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={() => setOverrideModal({ ...overrideModal, open: false })}
                  variant="secondary"
                  size="sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={overrideLoading}
                  disabled={!forceReason.trim() || overrideLoading}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Force {overrideModal.type === "suspend" ? "Suspension" : "Termination"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}