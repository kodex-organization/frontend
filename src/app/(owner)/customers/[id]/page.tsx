"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth/auth-context";
import { customerApi } from "@/features/customers/customer-api";
import { Button } from "@/components/ui/button";
import type {
  Customer,
  CustomerVisitHistory,
  CustomerUdhaarHistory,
} from "@/features/customers/types";

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const strings = {
    en: {
      loading: "Loading customer...",
      notFound: "Customer not found.",
      backToCustomers: "← Back to Customers",
      customerProfile: "Customer Profile",
      customerInformation: "Customer Information",
      unnamedCustomer: "Unnamed Customer",
      name: "Name:",
      phone: "Phone:",
      cnic: "CNIC:",
      na: "N/A",
      visitSummary: "Visit Summary",
      totalVisits: "Total Visits",
      totalSpent: "Total Spent",
      favouriteTable: "Favourite Table",
      visitHistory: "Visit History",
      noVisits: "No visits found for this customer.",
      tableLabel: "Table",
      statusLabel: "Status:",
      noStartTime: "No start time",
      invoiceTotal: "Invoice Total",
      udhaar: "Udhaar",
      outstandingBalance: "Outstanding Balance",
      eligibility: "Udhaar eligibility",
      eligible: "This customer may be assigned new udhaar.",
      notEligible: "This customer cannot take new udhaar without Owner override.",
      unableVerify: "Unable to verify udhaar eligibility.",
      cannotTakeUdhaar: "This customer cannot take new udhaar.",
      checking: "Checking eligibility...",
      recheck: "Re-check eligibility",
      noHistory: "No udhaar history found.",
      historyHeading: "Udhaar History",
      historyEntry: "Udhaar Entry",
      failedLoadCustomer: "Failed to load customer.",
      failedDelete: "Failed to delete customer.",
    },
    ur: {
      loading: "صارف لوڈ ہو رہا ہے...",
      notFound: "صارف نہیں ملا۔",
      backToCustomers: "← واپس صارفین پر",
      customerProfile: "صارف کا پروفائل",
      customerInformation: "صارف کی معلومات",
      unnamedCustomer: "بلا نام صارف",
      name: "نام:",
      phone: "فون:",
      cnic: "CNIC:",
      na: "نہیں دستیاب",
      visitSummary: "دورہ کا خلاصہ",
      totalVisits: "کل دورے",
      totalSpent: "کل خرچ",
      favouriteTable: "پسندیدہ میز",
      visitHistory: "دورے کی تاریخ",
      noVisits: "اس صارف کے لئے کوئی دورہ نہیں ملا۔",
      tableLabel: "میز",
      statusLabel: "حالت:",
      noStartTime: "شروع ہونے کا وقت نہیں",
      invoiceTotal: "انوائس کل",
      udhaar: "ادھار",
      outstandingBalance: "بقایا رقم",
      eligibility: "ادھار اہلیت",
      eligible: "اس صارف کو نیا ادھار دیا جا سکتا ہے۔",
      notEligible: "اس صارف کو اوونر اوور رائیڈ کے بغیر نیا ادھار نہیں مل سکتا۔",
      unableVerify: "اہلیت کی تصدیق کرنے سے قاصر۔",
      cannotTakeUdhaar: "یہ صارف نیا ادھار نہیں لے سکتا۔",
      checking: "اہلیت چیک کی جا رہی ہے...",
      recheck: "اہلیت دوبارہ چیک کریں",
      noHistory: "ادھار کی تاریخ نہیں ملی۔",
      historyHeading: "ادھار کی تاریخ",
      historyEntry: "ادھار اندراج",
      failedLoadCustomer: "صارف لوڈ کرنے میں ناکامی۔",
      failedDelete: "صارف حذف کرنے میں ناکام۔",
    },
  };

  const t = strings[user?.language ?? "en"];

  const id = String(params.id);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [visits, setVisits] = useState<CustomerVisitHistory | null>(null);
  const [udhaar, setUdhaar] = useState<CustomerUdhaarHistory | null>(null);
  const [udhaarAllowed, setUdhaarAllowed] = useState<boolean | null>(null);
  const [udhaarStatusMessage, setUdhaarStatusMessage] = useState<string>("");
  const [udhaarLoading, setUdhaarLoading] = useState(false);
  const [udhaarError, setUdhaarError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomer() {
      try {
        setLoading(true);
        setError("");

        const [customerData, visitData, udhaarData] =
          await Promise.all([
            customerApi.get(id),
            customerApi.visits(id),
            customerApi.udhaar(id),
          ]);

        setCustomer(customerData);
        setVisits(visitData);
        setUdhaar(udhaarData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t.failedLoadCustomer,
        );
      } finally {
        setLoading(false);
      }
    }

    async function loadUdhaarEligibility() {
      if (!id) return;
      setUdhaarLoading(true);
      setUdhaarError("");

      try {
        const response = await customerApi.validateUdhaar(id);
        setUdhaarAllowed(response.allowed);
        setUdhaarStatusMessage(
          response.allowed ? t.eligible : t.notEligible,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : t.unableVerify;
        setUdhaarAllowed(false);
        setUdhaarStatusMessage(t.cannotTakeUdhaar);
        setUdhaarError(message);
      } finally {
        setUdhaarLoading(false);
      }
    }

    if (id) {
      void loadCustomer();
      void loadUdhaarEligibility();
    }
  }, [id]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-slate-600">{t.loading}</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-6">
        <button
          onClick={() => router.back()}
          className="mb-4 rounded border px-3 py-2"
        >
          ← {t.backToCustomers}
        </button>

        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          {error}
        </div>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="p-6">
        <p>{t.notFound}</p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="rounded border px-3 py-2 text-sm hover:bg-slate-50"
      >
        {t.backToCustomers}
      </button>

      {/* Customer Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {customer.fullName || t.unnamedCustomer}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {t.customerProfile}
        </p>
      </div>

      {/* Customer Information */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t.customerInformation}
        </h2>

        <div className="mt-4 space-y-3">
          <p>
            <strong>{t.name}</strong>{" "}
            {customer.fullName || t.na}
          </p>

          <p>
            <strong>{t.phone}</strong>{" "}
            {customer.phone || t.na}
          </p>

          <p>
            <strong>{t.cnic}</strong>{" "}
            {customer.cnic || t.na}
          </p>
        </div>
      </section>

      {/* Visit Summary */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t.visitSummary}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              {t.totalVisits}
            </p>

            <p className="mt-1 text-2xl font-bold">
              {visits?.totalVisits ?? 0}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              {t.totalSpent}
            </p>

            <p className="mt-1 text-2xl font-bold">
              Rs.{" "}
              {Number(
                visits?.totalSpent ?? 0,
              ).toLocaleString()}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm text-slate-500">
              {t.favouriteTable}
            </p>

            <p className="mt-1 text-2xl font-bold">
              {visits?.favouriteTable || "N/A"}
            </p>
          </div>
        </div>
      </section>

      {/* Visit History */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t.visitHistory}
        </h2>

        {!visits?.visits?.length ? (
          <p className="mt-4 text-sm text-slate-500">
            {t.noVisits}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {visits.visits.map((visit: any) => (
              <div
                key={visit.id}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {t.tableLabel}{" "}
                      {visit.table?.tableNumber || t.na}
                    </p>

                    <p className="text-sm text-slate-500">
                      {t.statusLabel} {visit.status || t.na}
                    </p>
                  </div>

                  <div className="text-sm text-slate-600">
                    {visit.startedAt
                      ? new Date(
                          visit.startedAt,
                        ).toLocaleString()
                      : t.noStartTime}
                  </div>
                </div>

                {visit.invoices?.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <p className="text-sm font-medium">
                      {t.invoiceTotal}
                    </p>

                    <p className="mt-1 font-semibold">
                      Rs.{" "}
                      {visit.invoices
                        .reduce(
                          (
                            total: number,
                            invoice: any,
                          ) =>
                            total +
                            Number(
                              invoice.total ?? 0,
                            ),
                          0,
                        )
                        .toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Udhaar */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {t.udhaar}
        </h2>

        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            {t.outstandingBalance}
          </p>

          <p className="mt-1 text-2xl font-bold">
            Rs. {Number(udhaar?.outstandingBalance ?? 0).toLocaleString()}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {t.eligibility}
              </p>
              <p className={`mt-1 text-sm font-medium ${udhaarAllowed ? "text-emerald-700" : "text-rose-700"}`}>
                {udhaarStatusMessage || t.checking}
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={async () => {
                setUdhaarError("");
                setUdhaarStatusMessage("");
                setUdhaarAllowed(null);
                setUdhaarLoading(true);
                try {
                  const response = await customerApi.validateUdhaar(id);
                  setUdhaarAllowed(response.allowed);
                  setUdhaarStatusMessage(
                    response.allowed ? t.eligible : t.notEligible,
                  );
                } catch (err) {
                  const message = err instanceof Error ? err.message : t.unableVerify;
                  setUdhaarAllowed(false);
                  setUdhaarStatusMessage(t.cannotTakeUdhaar);
                  setUdhaarError(message);
                } finally {
                  setUdhaarLoading(false);
                }
              }}
              disabled={udhaarLoading}
            >
              {udhaarLoading ? t.checking : t.recheck}
            </Button>
          </div>

          {udhaarError && (
            <p className="mt-2 text-sm text-rose-600">
              {udhaarError}
            </p>
          )}
        </div>

        <h3 className="mt-6 font-semibold text-slate-900">
          {t.historyHeading}
        </h3>

        {!udhaar?.history?.length ? (
          <p className="mt-3 text-sm text-slate-500">
            {t.noHistory}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {udhaar.history.map(
              (entry: any, index: number) => (
                <div
                  key={entry.id ?? index}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {entry.type ||
                          entry.entryType ||
                          t.historyEntry}
                      </p>

                      {entry.createdAt && (
                        <p className="mt-1 text-sm text-slate-500">
                          {new Date(
                            entry.createdAt,
                          ).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <p className="font-semibold">
                      Rs.{" "}
                      {Number(
                        entry.amount ?? 0,
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}