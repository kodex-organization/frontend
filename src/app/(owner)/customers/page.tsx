
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ArrowRight, Edit, Trash2 } from "lucide-react";

import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

import { useAuth } from "@/lib/auth/auth-context";
import { customerApi } from "@/features/customers/customer-api";
import type {
  Customer,
  CustomerTag,
} from "@/features/customers/types";

export default function CustomersPage() {
  const router = useRouter();
  const { user } = useAuth();

  const strings = {
    en: {
      title: "Customers",
      description: "Create and find customer records by name, phone, or CNIC.",
      newCustomer: "New Customer",
      editCustomer: "Edit Customer",
      createHelp: "Add a new customer record.",
      editHelp: "Update this customer's information.",
      saveCustomer: "Save Customer",
      updateCustomer: "Update Customer",
      cancel: "Cancel",
      fullName: "Full name",
      phone: "Phone",
      cnic: "CNIC (optional)",
      customerTag: "Customer Tag (optional)",
      noTag: "No Tag",
      enterFullName: "Enter full name",
      enterPhoneNumber: "Enter phone number",
      enterCnic: "Enter CNIC",
      deleteConfirmation: "Are you sure you want to delete",
      onlyManagersCanMerge: "Only Owners and Managers can merge customers.",
      customersMerged: "Customers merged successfully.",
      failedMerge: "Failed to merge customers.",
      checking: "Checking...",
      searchTitle: "Find Customer",
      searchHelp: "Search by name, phone number, or CNIC.",
      searchPlaceholder: "Search by phone, name, or CNIC",
      noCustomersFound: "No customers found",
      noCustomerMatches: "No customer matches your search.",
      noCustomersCreated: "No customers have been created yet.",
      customerProfile: "Customer Profile",
      unnamedCustomer: "Unnamed customer",
      noPhone: "No phone number",
      customerTagNone: "No tag",
      edit: "Edit customer",
      delete: "Delete customer",
      viewDetails: "View customer details",
      merge: "Merge",
      mergeTitle: "Merge Customer",
      mergeDescription: "Combine duplicate customer records and preserve history.",
      sourceCustomer: "Source customer",
      targetCustomer: "Merge target customer",
      selectTargetCustomer: "Select target customer",
      confirmMerge: "Confirm Merge",
      recheckEligibility: "Re-check eligibility",
      mergeError: "Select a target customer before merging.",
      successCreated: "Customer created successfully.",
      successUpdated: "Customer updated successfully.",
      successDeleted: "Customer deleted successfully.",
      successTagUpdated: "Customer tag updated.",
      successTagRemoved: "Customer tag removed.",
      failedLoad: "Failed to load customers.",
      failedCreate: "Could not create customer.",
      failedUpdate: "Could not update customer.",
      failedDelete: "Failed to delete customer.",
      failedTag: "Failed to update customer tag.",
      blockedCustomer: "Blocked",
      requestCancellation: "Request Cancellation",
      back: "Back",
      searching: "Searching customers...",
    },
    ur: {
      title: "صارفین",
      description: "نام، فون، یا CNIC کے ذریعے صارف کا ریکارڈ بنائیں اور تلاش کریں۔",
      newCustomer: "نیا صارف",
      editCustomer: "صارف میں ترمیم کریں",
      createHelp: "نیا صارف کا ریکارڈ شامل کریں۔",
      editHelp: "اس صارف کی معلومات کو اپ ڈیٹ کریں۔",
      saveCustomer: "صارف محفوظ کریں",
      updateCustomer: "صارف اپ ڈیٹ کریں",
      cancel: "منسوخ کریں",
      fullName: "پورا نام",
      phone: "فون",
      cnic: "CNIC (اختیاری)",
      customerTag: "صارف کا ٹیگ (اختیاری)",
      noTag: "کوئی ٹیگ نہیں",
      enterFullName: "پورا نام درج کریں",
      enterPhoneNumber: "فون نمبر درج کریں",
      enterCnic: "CNIC درج کریں",
      deleteConfirmation: "کیا آپ واقعی حذف کرنا چاہتے ہیں",
      onlyManagersCanMerge: "صرف اوونرز اور مینیجرز صارفین کو مرج کر سکتے ہیں۔",
      customersMerged: "صارفین کامیابی کے ساتھ مرج ہو گئے۔",
      failedMerge: "صارفین کو مرج کرنے میں ناکامی۔",
      checking: "چیک ہو رہا ہے...",
      searchTitle: "صارف تلاش کریں",
      searchHelp: "نام، فون نمبر، یا CNIC سے تلاش کریں۔",
      searchPlaceholder: "فون، نام، یا CNIC سے تلاش کریں",
      noCustomersFound: "کوئی صارف نہیں ملا",
      noCustomerMatches: "آپ کی تلاش سے کوئی صارف مطابقت نہیں رکھتا۔",
      noCustomersCreated: "اب تک کوئی صارف نہیں بنایا گیا۔",
      customerProfile: "صارف کا پروفائل",
      unnamedCustomer: "بلا نام صارف",
      noPhone: "کوئی فون نہیں",
      customerTagNone: "کوئی ٹیگ نہیں",
      edit: "صارف میں ترمیم کریں",
      delete: "صارف حذف کریں",
      viewDetails: "تفصیلات دیکھیں",
      merge: "مرج کریں",
      mergeTitle: "صارف کو مرج کریں",
      mergeDescription: "مقلد صارف کے ریکارڈز کو ضم کریں اور تاریخ کو محفوظ کریں۔",
      sourceCustomer: "سورس صارف",
      targetCustomer: "مرج ٹارگٹ صارف",
      selectTargetCustomer: "ٹارگٹ صارف منتخب کریں",
      confirmMerge: "مرج کی تصدیق کریں",
      recheckEligibility: "اہلیت دوبارہ چیک کریں",
      mergeError: "مرج سے پہلے ٹارگٹ صارف منتخب کریں۔",
      successCreated: "صارف کامیابی سے بنایا گیا۔",
      successUpdated: "صارف کامیابی سے اپ ڈیٹ ہوا۔",
      successDeleted: "صارف کامیابی سے حذف ہوا۔",
      successTagUpdated: "صارف کا ٹیگ اپ ڈیٹ ہوا۔",
      successTagRemoved: "صارف کا ٹیگ ہٹا دیا گیا۔",
      failedLoad: "صارفین لوڈ کرنے میں ناکامی۔",
      failedCreate: "صارف بنانے میں ناکام۔",
      failedUpdate: "صارف اپ ڈیٹ کرنے میں ناکام۔",
      failedDelete: "صارف حذف کرنے میں ناکام۔",
      failedTag: "صارف کا ٹیگ اپ ڈیٹ کرنے میں ناکام۔",
      blockedCustomer: "بلاک شدہ",
      requestCancellation: "منسوخی کی درخواست",
      back: "واپس",
      searching: "صارف تلاش کیا جا رہا ہے...",
    },
  };

  const t = strings[user?.language ?? "en"];

  const [items, setItems] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [availableTags, setAvailableTags] = useState<CustomerTag[]>([]);
  const [mergeSource, setMergeSource] = useState<Customer | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState("");

  const isManager = user?.roles.some((role) =>
    ["OWNER", "MANAGER"].includes(role),
  );

  const tagOptions = useMemo(
    () => availableTags,
    [availableTags],
  );

  type TagName = string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tagLoading, setTagLoading] = useState<string | null>(null);

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    cnic: "",
    tag: "",
  });

  const loadCustomers = useCallback(async (searchQuery = q, brief = true) => {
    setLoading(true);
    setError("");

    try {
      const customers = await customerApi.search(searchQuery, 20, brief);
      setItems(customers);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t.failedLoad,
      );
    } finally {
      setLoading(false);
    }
  }, [q, t]);

  const loadAvailableTags = useCallback(async () => {
    try {
      const tags = await customerApi.availableTags();
      setAvailableTags(tags);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t.failedLoad,
      );
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCustomers(q, true);
    }, 250);

    return () => clearTimeout(timer);
  }, [loadCustomers, q]);

  useEffect(() => {
  void loadAvailableTags();
}, [loadAvailableTags]);

  function resetForm() {
    setForm({
      fullName: "",
      phone: "",
      cnic: "",
      tag: "",
    });

    setEditingCustomer(null);
  }

  function startEdit(customer: Customer) {
    const currentTag =
      customer.tagAssignments[0]?.tag.name ?? "";

    setEditingCustomer(customer);

    setForm({
      fullName: customer.fullName ?? "",
      phone: customer.phone ?? "",
      cnic: customer.cnic ?? "",
      tag: currentTag,
    });

    setSuccess("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      `${t.deleteConfirmation} ${
        customer.fullName ?? t.unnamedCustomer
      }?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(customer.id);
    setError("");
    setSuccess("");

    try {
      await customerApi.remove(customer.id);

      // Immediately remove customer from UI.
      setItems((current) =>
        current.filter(
          (item) => item.id !== customer.id,
        ),
      );

      if (editingCustomer?.id === customer.id) {
        resetForm();
      }

      setSuccess(
        t.successDeleted,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t.failedDelete,
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleTagChange(
  customer: Customer,
  tagName: TagName | "",
) {
  setTagLoading(customer.id);
  setError("");
  setSuccess("");

  try {
    for (const assignment of customer.tagAssignments) {
      await customerApi.removeTag(
        customer.id,
        assignment.tag.id,
      );
    }

    if (!tagName) {
      setSuccess(t.successTagRemoved);
      await loadCustomers();
      return;
    }

    const selectedTag = availableTags.find(
      (tag) =>
        tag.name?.toLowerCase() === tagName.toLowerCase(),
    );

    if (!selectedTag) {
      throw new Error(
        `Customer tag "${tagName}" not found.`,
      );
    }

    await customerApi.addTag(customer.id, {
      tagId: selectedTag.id,
    });

    setSuccess(t.successTagUpdated);
    await loadCustomers();
  } catch (e) {
    setError(
      e instanceof Error
        ? e.message
        : t.failedTag,
    );
  } finally {
    setTagLoading(null);
  }
}

  function handleMerge(customer: Customer) {
    if (!isManager) {
      setMergeError(t.onlyManagersCanMerge);
      return;
    }

    setMergeSource(customer);
    setMergeTargetId("");
    setMergeError("");
  }

  async function performMerge() {
    if (!mergeSource || !mergeTargetId) {
      setMergeError(t.mergeError);
      return;
    }

    setMergeLoading(true);
    setMergeError("");
    setSuccess("");

    try {
      await customerApi.merge(mergeSource.id, {
        targetCustomerId: mergeTargetId,
      });

      setSuccess(t.customersMerged);
      setMergeSource(null);
      setMergeTargetId("");
      await loadCustomers();
    } catch (e) {
      setMergeError(
        e instanceof Error
          ? e.message
          : t.failedMerge,
      );
    } finally {
      setMergeLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fullName = form.fullName.trim();
      const phone = form.phone.trim();
      const cnic = form.cnic.trim();

      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, {
          fullName,
          phone,
          cnic: cnic || null,
        });

        setSuccess(t.successUpdated);
      }  else {
  const createdCustomer = await customerApi.create({
    fullName,
    phone,
    cnic: cnic || null,
  });

  if (form.tag) {
    const selectedTag = availableTags.find(
      (tag) => tag.name === form.tag,
    );

    if (!selectedTag) {
      throw new Error(
        `Customer tag "${form.tag}" not found.`,
      );
    }

    await customerApi.addTag(createdCustomer.id, {
      tagId: selectedTag.id,
    });
  }

  setSuccess(t.successCreated);
}

      resetForm();

      await loadCustomers();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : editingCustomer
            ? t.failedUpdate
            : t.failedCreate,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t.title}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {t.description}
        </p>
      </div>

      {/* Messages */}
      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      {error && (
        <ErrorState
          message={error}
          onRetry={() => void loadCustomers()}
        />
      )}

      {/* Create / Edit */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {editingCustomer
                ? t.editCustomer
                : t.newCustomer}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {editingCustomer ? t.editHelp : t.createHelp}
            </p>
          </div>

          {editingCustomer && (
            <Button
              type="button"
              onClick={resetForm}
            >
              {t.cancel}
            </Button>
          )}
        </div>

        <form
          onSubmit={submit}
          className="mt-5 space-y-4"
        >
          <FormField
            label={t.fullName}
            htmlFor="customer-full-name"
          >
            <Input
              id="customer-full-name"
              value={form.fullName}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  fullName: e.target.value,
                }))
              }
              placeholder={t.enterFullName}
              required
            />
          </FormField>

          <FormField
            label={t.phone}
            htmlFor="customer-phone"
          >
            <Input
              id="customer-phone"
              value={form.phone}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  phone: e.target.value,
                }))
              }
              placeholder={t.enterPhoneNumber}
              required
            />
          </FormField>

          <FormField
            label={t.cnic}
            htmlFor="customer-cnic"
          >
            <Input
              id="customer-cnic"
              value={form.cnic}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  cnic: e.target.value,
                }))
              }
              placeholder="12345-1234567-1"
            />
          </FormField>

          {/* Customer Tag */}
          <FormField
            label={t.customerTag}
            htmlFor="customer-tag"
          >
            <select
              id="customer-tag"
              value={form.tag}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  tag: e.target.value,
                }))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">{t.noTag}</option>
              {tagOptions.map((tag) => (
                <option
                  key={tag.id || tag.name}
                  value={tag.name ?? ""}
                >
                  {tag.name}
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex gap-3">
            <Button
              type="submit"
              isLoading={saving}
              disabled={saving}
            >
              {editingCustomer
                ? t.updateCustomer
                : t.saveCustomer}
            </Button>

            {editingCustomer && (
              <Button
                type="button"
                onClick={resetForm}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Search */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t.searchTitle}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {t.searchHelp}
          </p>
        </div>

        <div className="mt-4">
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              void loadCustomers(e.target.value, true);
            }}
            placeholder={t.searchPlaceholder}
            aria-label="Search customers"
          />
        </div>

        {!error && loading && (
          <div className="py-8">
            <Loading message="Searching customers..." />
          </div>
        )}

        {!error &&
          !loading &&
          items.length === 0 && (
            <div className="py-8">
              <EmptyState
                title={t.noCustomersFound}
                description={
                  q.trim()
                    ? t.noCustomerMatches
                    : t.noCustomersCreated
                }
              />
            </div>
          )}

        {!error &&
          !loading &&
          items.length > 0 && (
            <div className="mt-6 space-y-3">
              {items.map((customer) => {
                const isBlocked =
                  customer.tagAssignments.some(
                    (assignment) =>
                      assignment.tag.name?.toLowerCase() ===
                      "blocked",
                  );

                return (
                  <div
                    key={customer.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      isBlocked
                        ? "border-red-200 bg-red-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Customer information */}
                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          window.location.href =
                            `/customers/${customer.id}`;
                        }}
                      >
                        <h3 className="font-semibold text-slate-900">
                          {customer.fullName || t.unnamedCustomer}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          {customer.phone || t.noPhone}
                        </p>

                        {customer.cnic && (
                          <p className="mt-1 text-sm text-slate-500">
                            CNIC: {customer.cnic}
                          </p>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-2">
                        {customer.tagAssignments.map(
                          (assignment) => (
                            <span
                              key={assignment.id}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                assignment.tag.name?.toLowerCase() ===
                                "blocked"
                                  ? "bg-red-100 text-red-700"
                                  : assignment.tag.name?.toLowerCase() ===
                                      "vip"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {assignment.tag.name ||
                                "Tag"}
                            </span>
                          ),
                        )}

                        {!customer.tagAssignments.length && (
                          <span className="text-xs text-slate-400">
                            {t.customerTagNone}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          startEdit(customer)
                        }
                        aria-label="Edit customer"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        disabled={
                          deletingId === customer.id
                        }
                        onClick={() =>
                          void handleDelete(customer)
                        }
                        aria-label="Delete customer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          router.push(
                            `/customers/${customer.id}`,
                          )
                        }
                        aria-label="View customer details"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>

                      {isManager && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            handleMerge(customer)
                          }
                        >
                          {t.merge}
                        </Button>
                      )}

                      {/* Tag selector */}
                      <select
                        value={
                          customer.tagAssignments[0]
                            ?.tag.name ?? ""
                        }
                        disabled={
                          tagLoading === customer.id
                        }
                        onChange={(e) =>
                          void handleTagChange(
                            customer,
                            e.target.value as
                              | TagName
                              | "",
                          )
                        }
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">
                          {t.noTag}
                        </option>
                        {tagOptions.map((tag) => (
                          <option
                            key={tag.id || tag.name}
                            value={tag.name ?? ""}
                          >
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </section>

      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {t.mergeTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t.mergeDescription}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMergeSource(null)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"
                aria-label="Close merge dialog"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  {t.sourceCustomer}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {mergeSource.fullName || t.unnamedCustomer} — {mergeSource.phone || t.noPhone}
                </p>
              </div>

              <div>
                <FormField
                  label={t.targetCustomer}
                  htmlFor="merge-target"
                >
                  <select
                    id="merge-target"
                    value={mergeTargetId}
                    onChange={(e) => setMergeTargetId(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
                  >
                    <option value="">{t.selectTargetCustomer}</option>
                    {items
                      .filter((customer) => customer.id !== mergeSource.id)
                      .map((customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.fullName || t.unnamedCustomer} — {customer.phone || t.noPhone}
                        </option>
                      ))}
                  </select>
                </FormField>
              </div>

              {mergeError && (
                <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                  {mergeError}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="button"
                  isLoading={mergeLoading}
                  onClick={performMerge}
                >
                  {t.confirmMerge}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMergeSource(null)}
                >
                  {t.cancel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
