"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  ArrowRight,
  GitMerge,
  ShieldAlert,
  Star,
  Tag,
  Phone,
  CreditCard,
  X,
} from "lucide-react";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth/auth-context";
import { customerApi } from "@/features/customers/customer-api";
import type { Customer, CustomerTag } from "@/features/customers/types";
import { fetchBranches } from "@/lib/api/branch";

export default function CustomersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isManagerOrOwner = user?.roles.some((role) =>
    ["OWNER", "MANAGER"].includes(role.toUpperCase()),
  );
  const isCashier = user?.roles.some((role) => role.toUpperCase() === "CASHIER") && !isManagerOrOwner;

  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [selectedFilterTag, setSelectedFilterTag] = useState<string>("all");
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Modals & form state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Customer | null>(null);
  const [mergeSource, setMergeSource] = useState<Customer | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  const deletedCustomerIds = useRef(new Set<string>());

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    cnic: "",
    tag: "",
    branchId: user?.branchId ?? "",
  });

  const loadCustomers = useCallback(async (searchQuery = q) => {
    setLoading(true);
    try {
      const customers = await customerApi.search(searchQuery, 100, true);
      setItems(customers.filter((customer) => !deletedCustomerIds.current.has(customer.id)));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [q]);

  const loadAvailableTags = useCallback(async () => {
    try {
      const tags = await customerApi.availableTags();
      setAvailableTags(tags);
    } catch {
      // Tags fallback
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const result = await fetchBranches({ limit: 100, isActive: true });
      setBranches(
        result.branches.map((branch) => ({
          id: branch.id,
          name: branch.name || "Unnamed branch",
        })),
      );
    } catch (e: any) {
      toast.error(e?.message || "Failed to load branches.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers(q);
    }, 250);
    return () => clearTimeout(timer);
  }, [loadCustomers, q]);

  useEffect(() => {
    void loadAvailableTags();
    void loadBranches();
  }, [loadAvailableTags, loadBranches]);

  const resetForm = () => {
    setForm({
      fullName: "",
      phone: "",
      cnic: "",
      tag: "",
      branchId: user?.branchId ?? "",
    });
    setFormError(null);
    setEditingCustomer(null);
    setCustomerModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setFormError(null);
    if (isCashier && user?.branchId) {
      setForm((prev) => ({ ...prev, branchId: user.branchId }));
    }
    setCustomerModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    if (isCashier && customer.branchId && customer.branchId !== user?.branchId) {
      toast.error("You can only modify customers from your assigned branch.");
      return;
    }
    const currentTag = customer.tagAssignments[0]?.tag.name ?? "";
    setEditingCustomer(customer);
    setFormError(null);
    setForm({
      fullName: customer.fullName ?? "",
      phone: customer.phone ?? "",
      cnic: customer.cnic ?? "",
      tag: currentTag,
      branchId: isCashier ? (user?.branchId ?? customer.branchId ?? "") : (customer.branchId ?? ""),
    });
    setCustomerModalOpen(true);
  };

  const handleSubmitCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const fullName = form.fullName.trim();
      const phone = form.phone.trim();
      const cnic = form.cnic.trim();

      const targetBranchId = isCashier
        ? (user?.branchId || form.branchId || null)
        : (form.branchId || null);

      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, {
          fullName,
          phone,
          cnic: cnic || null,
          branchId: targetBranchId,
        });

        // Tag management
        if (form.tag) {
          const currentTagName = editingCustomer.tagAssignments[0]?.tag.name;
          if (currentTagName !== form.tag) {
            for (const a of editingCustomer.tagAssignments) {
              await customerApi.removeTag(editingCustomer.id, a.tag.id);
            }
            const matchingTag = availableTags.find(
              (t) => t.name?.toLowerCase() === form.tag.toLowerCase(),
            );
            if (matchingTag) {
              await customerApi.addTag(editingCustomer.id, { tagId: matchingTag.id });
            }
          }
        } else if (editingCustomer.tagAssignments.length > 0) {
          for (const a of editingCustomer.tagAssignments) {
            await customerApi.removeTag(editingCustomer.id, a.tag.id);
          }
        }

        toast.success("Customer profile updated successfully.");
      } else {
        const created = await customerApi.create({
          fullName,
          phone,
          cnic: cnic || null,
          branchId: targetBranchId,
        });

        if (form.tag) {
          const matchingTag = availableTags.find(
            (t) => t.name?.toLowerCase() === form.tag.toLowerCase(),
          );
          if (matchingTag) {
            await customerApi.addTag(created.id, { tagId: matchingTag.id });
          }
        }

        toast.success("New customer created successfully.");
      }

      resetForm();
      await loadCustomers();
    } catch (e: any) {
      const message = e?.message || "Operation failed.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || deleteInFlight.current) return;
    const customerId = pendingDelete.id;
    deleteInFlight.current = true;
    setDeleting(true);
    try {
      await customerApi.remove(customerId);
      deletedCustomerIds.current.add(customerId);
      setItems((customers) => customers.filter((customer) => customer.id !== customerId));
      toast.success("Customer deleted successfully.");
      setPendingDelete(null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete customer.");
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  const handlePerformMerge = async () => {
    if (!mergeSource || !mergeTargetId) {
      toast.warning("Please select a target customer to merge into.");
      return;
    }
    setMergeLoading(true);
    try {
      await customerApi.merge(mergeSource.id, { targetCustomerId: mergeTargetId });
      toast.success("Customer records merged successfully.");
      setMergeSource(null);
      setMergeTargetId("");
      await loadCustomers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to merge customers.");
    } finally {
      setMergeLoading(false);
    }
  };

  const handleQuickTagToggle = async (customer: Customer, nextTagName: string) => {
    if (isCashier && customer.branchId && customer.branchId !== user?.branchId) {
      toast.error("You can only modify customers from your assigned branch.");
      return;
    }
    try {
      for (const a of customer.tagAssignments) {
        await customerApi.removeTag(customer.id, a.tag.id);
      }
      if (nextTagName) {
        const matchingTag = availableTags.find(
          (t) => t.name?.toLowerCase() === nextTagName.toLowerCase(),
        );
        if (matchingTag) {
          await customerApi.addTag(customer.id, { tagId: matchingTag.id });
        }
      }
      toast.success("Customer tag updated.");
      await loadCustomers();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update tag.");
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const total = items.length;
    const vip = items.filter((c) =>
      c.tagAssignments.some((a) => a.tag.name?.toLowerCase() === "vip"),
    ).length;
    const blocked = items.filter((c) =>
      c.tagAssignments.some((a) => a.tag.name?.toLowerCase() === "blocked"),
    ).length;
    const regular = total - vip - blocked;
    return { total, vip, blocked, regular };
  }, [items]);

  // Filtered items
  const filteredCustomers = useMemo(() => {
    if (selectedFilterTag === "all") return items;
    if (selectedFilterTag === "vip") {
      return items.filter((c) =>
        c.tagAssignments.some((a) => a.tag.name?.toLowerCase() === "vip"),
      );
    }
    if (selectedFilterTag === "blocked") {
      return items.filter((c) =>
        c.tagAssignments.some((a) => a.tag.name?.toLowerCase() === "blocked"),
      );
    }
    if (selectedFilterTag === "regular") {
      return items.filter(
        (c) =>
          !c.tagAssignments.some((a) =>
            ["vip", "blocked"].includes(a.tag.name?.toLowerCase() ?? ""),
          ),
      );
    }
    return items;
  }, [items, selectedFilterTag]);

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Customer Directory
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              {items.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage player profiles, VIP tiers, contact directories, and visit history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Total Customers</span>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <Star className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">VIP Clients</span>
            <p className="text-xl font-bold text-slate-900">{stats.vip}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Regular Players</span>
            <p className="text-xl font-bold text-slate-900">{stats.regular}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Blocked / Flagged</span>
            <p className="text-xl font-bold text-slate-900">{stats.blocked}</p>
          </div>
        </div>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by full name, phone number, or CNIC..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(["all", "vip", "regular", "blocked"] as const).map((tagKey) => (
            <button
              key={tagKey}
              type="button"
              onClick={() => setSelectedFilterTag(tagKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                selectedFilterTag === tagKey
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tagKey}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Loading customer records...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No customers found</p>
            <p className="text-xs text-slate-400">
              {q ? "No customer matches your search query." : "No customer records registered yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Contact Details</th>
                  <th className="px-5 py-3.5">CNIC</th>
                  <th className="px-5 py-3.5">Branch</th>
                  <th className="px-5 py-3.5">Tag / Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((customer) => {
                  const tagName = customer.tagAssignments[0]?.tag.name?.toLowerCase();
                  const isVip = tagName === "vip";
                  const isBlocked = tagName === "blocked";

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                              isVip
                                ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400/30"
                                : isBlocked
                                ? "bg-rose-100 text-rose-800"
                                : "bg-brand-100 text-brand-800"
                            }`}
                          >
                            {(customer.fullName || "W")[0]}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => router.push(`/customers/${customer.id}`)}
                              className="font-semibold text-slate-900 hover:text-brand-600 text-left transition-colors"
                            >
                              {customer.fullName || "Unnamed Customer"}
                            </button>
                            <span className="block text-[11px] text-slate-400">
                              ID: {customer.id.slice(0, 8)}…
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{customer.phone || "No phone registered"}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          <span>{customer.cnic || "—"}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-slate-700">
                          {customer.branch?.name || "All Branches"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <select
                          value={customer.tagAssignments[0]?.tag.name ?? ""}
                          onChange={(e) => void handleQuickTagToggle(customer, e.target.value)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border outline-none cursor-pointer ${
                            isVip
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : isBlocked
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : tagName
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          <option value="">No Tag</option>
                          {availableTags.map((tag) => (
                            <option key={tag.id} value={tag.name ?? ""}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/customers/${customer.id}`)}
                            title="View History & Udhaar Profile"
                            className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>

                          {(!isCashier || !customer.branchId || customer.branchId === user?.branchId) && (
                            <button
                              type="button"
                              onClick={() => openEditModal(customer)}
                              title="Edit Profile"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {isManagerOrOwner && (
                            <button
                              type="button"
                              onClick={() => {
                                setMergeSource(customer);
                                setMergeTargetId("");
                              }}
                              title="Merge with duplicate account"
                              className="p-1.5 text-slate-500 hover:text-violet-600 hover:bg-violet-50 rounded-md transition-colors"
                            >
                              <GitMerge className="w-4 h-4" />
                            </button>
                          )}

                          {(!isCashier || !customer.branchId || customer.branchId === user?.branchId) && (
                            <button
                              type="button"
                              onClick={() => setPendingDelete(customer)}
                              title="Delete Customer"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      </div>

      {/* Customer Create/Edit Modal */}
      {customerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingCustomer ? "Edit Customer Profile" : "Register New Customer"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingCustomer
                    ? "Update contact information, branch access & tag"
                    : "Choose one branch or make the customer available to all"}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{formError}</div>
                </div>
              )}

              <FormField label="Full Name" htmlFor="cust-name">
                <Input
                  id="cust-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="e.g. Tariq Mahmood"
                  required
                />
              </FormField>

              <FormField label="Phone Number" htmlFor="cust-phone">
                <Input
                  id="cust-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. 03001234567"
                  required
                />
              </FormField>

              <FormField label="CNIC (Optional)" htmlFor="cust-cnic">
                <Input
                  id="cust-cnic"
                  value={form.cnic}
                  onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                  placeholder="e.g. 35201-1234567-1"
                />
              </FormField>

              <FormField label="Branch Access" htmlFor="cust-branch">
                {isCashier ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">
                      {branches.find((b) => b.id === (user?.branchId || form.branchId))?.name || "Assigned Branch"}
                    </span>
                    <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Locked to your branch
                    </span>
                  </div>
                ) : (
                  <select
                    id="cust-branch"
                    value={form.branchId}
                    onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField label="Customer Tier / Tag" htmlFor="cust-tag">
                <select
                  id="cust-tag"
                  value={form.tag}
                  onChange={(e) => setForm({ ...form, tag: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">No Tag (Standard)</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.name ?? ""}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={saving} disabled={saving}>
                  {editingCustomer ? "Save Changes" : "Create Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Merge Modal */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Merge Customer Records</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Combine duplicate profiles and consolidate session and udhaar history
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold uppercase text-slate-400">Source Profile (Will be merged)</span>
                <p className="font-semibold text-slate-900 mt-0.5">
                  {mergeSource.fullName || "Unnamed"} — {mergeSource.phone || "No Phone"}
                </p>
              </div>

              <FormField label="Target Customer Profile (Will receive history)" htmlFor="target-customer">
                <select
                  id="target-customer"
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select Target Customer...</option>
                  {items
                    .filter((c) => c.id !== mergeSource.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName || "Unnamed"} — {c.phone || "No Phone"}
                      </option>
                    ))}
                </select>
              </FormField>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setMergeSource(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handlePerformMerge}
                  isLoading={mergeLoading}
                  disabled={mergeLoading || !mergeTargetId}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  Confirm Merge
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        title="Delete Customer Profile"
        description={`Are you sure you want to delete ${pendingDelete?.fullName || "this customer"}? Their historical invoices and sessions will remain safe as walk-in records.`}
        confirmText="Delete Customer"
        cancelText="Keep Customer"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => { if (!deleteInFlight.current) setPendingDelete(null); }}
      />
    </div>
  );
}
