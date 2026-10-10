"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  CreditCard,
  Calendar,
  DollarSign,
  Trophy,
  History,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
} from "lucide-react";

import { customerApi } from "@/features/customers/customer-api";
import { useBranchCurrency } from "@/features/tenancy/useBranchCurrency";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";
import { toast } from "@/lib/toast";
import type {
  CustomerProfile,
  CustomerVisitHistory,
  CustomerUdhaarHistory,
} from "@/features/customers/types";

export default function CustomerDetailsPage() {
  const currency = useBranchCurrency();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params.id);

  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [visits, setVisits] = useState<CustomerVisitHistory | null>(null);
  const [udhaar, setUdhaar] = useState<CustomerUdhaarHistory | null>(null);
  const [udhaarAllowed, setUdhaarAllowed] = useState<boolean | null>(null);
  const [udhaarLoading, setUdhaarLoading] = useState(false);
  // Allows deep-linking straight to a tab, e.g. from the dashboard's
  // "View ledger" action (`?tab=udhaar`), instead of always opening on
  // "visits".
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"visits" | "invoices" | "udhaar">(
    initialTab === "udhaar" || initialTab === "invoices" ? initialTab : "visits",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [customerData, visitData, udhaarData] = await Promise.all([
          customerApi.get(id),
          customerApi.visits(id),
          customerApi.udhaar(id),
        ]);

        setCustomer(customerData);
        setVisits(visitData);
        setUdhaar(udhaarData);
      } catch (err: any) {
        toast.error(err?.message || "Failed to load customer profile.");
      } finally {
        setLoading(false);
      }
    }

    async function checkEligibility() {
      try {
        setUdhaarLoading(true);
        const res = await customerApi.validateUdhaar(id);
        setUdhaarAllowed(res.allowed);
      } catch {
        setUdhaarAllowed(false);
      } finally {
        setUdhaarLoading(false);
      }
    }

    if (id) {
      void loadData();
      void checkEligibility();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading customer profile...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200">
          <p className="font-semibold">Customer record not found</p>
          <p className="text-xs text-amber-600 mt-1">The requested profile may have been deleted or merged.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/customers")}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Customer Directory</span>
        </button>
      </div>
    );
  }

  const tagName = customer.tagAssignments[0]?.tag.name?.toLowerCase();
  const isVip = tagName === "vip";
  const isBlocked = tagName === "blocked";
  const balance = Number(udhaar?.outstandingBalance ?? 0);
  // Reached via the dashboard's "View ledger" link (?tab=udhaar) rather than
  // browsing the customer directory, so "back" should return there instead.
  const cameFromDashboard = initialTab === "udhaar";

  return (
    <div className="p-6 bg-slate-50 min-h-screen text-slate-800 space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => router.push(cameFromDashboard ? "/dashboard" : "/customers")}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{cameFromDashboard ? "Back to Dashboard" : "Back to Directory"}</span>
        </button>

        {balance > 0 && (
          <button
            type="button"
            onClick={() => router.push("/udhaar")}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <span>Settle Debt ({formatCurrency(balance, currency)})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Customer Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold uppercase shadow-sm ${
              isVip
                ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400/40"
                : isBlocked
                ? "bg-rose-100 text-rose-800"
                : "bg-brand-600 text-white"
            }`}
          >
            {(customer.fullName || "W")[0]}
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-950">
                {customer.fullName || "Unnamed Customer"}
              </h1>
              {tagName && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                    isVip
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : isBlocked
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}
                >
                  {customer.tagAssignments[0]?.tag.name}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-500 font-medium">
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {customer.phone || "No phone registered"}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                CNIC: {customer.cnic || "Not registered"}
              </span>
            </div>
          </div>
        </div>

        {/* Credit Eligibility Badge */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-3">
          {udhaarLoading ? (
            <span className="text-slate-400">Verifying credit status...</span>
          ) : udhaarAllowed ? (
            <>
              <CheckCircle className="w-5 h-5 text-brand-600 shrink-0" />
              <div>
                <p className="font-bold text-brand-700">Credit Eligible</p>
                <p className="text-[11px] text-slate-500">Allowed to open Udhaar balances</p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <p className="font-bold text-rose-700">Credit Restricted</p>
                <p className="text-[11px] text-slate-500">Requires Owner override for Udhaar</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Total Play Visits</span>
            <p className="text-xl font-bold text-slate-900">{visits?.totalVisits ?? 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Total Lifetime Spend</span>
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(Number(visits?.totalSpent ?? 0), currency)}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Favourite Table</span>
            <p className="text-xl font-bold text-slate-900">
              {visits?.favouriteTable ? `Table ${visits.favouriteTable}` : "None"}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${balance > 0 ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-600"}`}>
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-400">Outstanding Udhaar</span>
            <p className={`text-xl font-bold ${balance > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {formatCurrency(balance, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 px-6 pt-3 gap-6 text-sm font-semibold text-slate-600 bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab("visits")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "visits"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            <span>Visit & Play History ({visits?.visits?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "invoices"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Invoices & Billing ({customer.invoices?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("udhaar")}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "udhaar"
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Udhaar Credit Ledger ({udhaar?.history?.length ?? 0})</span>
          </button>
        </div>

        <div className="p-6">
          {/* Tab 1: Visit History */}
          {activeTab === "visits" && (
            <div className="space-y-4">
              {!visits?.visits?.length ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No recorded sessions for this customer yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {visits.visits.map((session: any) => (
                    <div
                      key={session.id}
                      className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            Table {session.table?.tableNumber ?? "N/A"} Session
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {session.startedAt
                              ? new Date(session.startedAt).toLocaleString([], {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "No timestamp"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {session.status}
                        </span>
                        {session.invoices?.length > 0 && (
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(
                              session.invoices.reduce(
                                (s: number, inv: any) => s + Number(inv.total ?? 0),
                                0,
                              ),
                              currency,
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Invoices */}
          {activeTab === "invoices" && (
            <div className="space-y-4">
              {!customer.invoices?.length ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No billing invoices issued for this customer yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {customer.invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="py-4 flex justify-between items-center gap-4"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">
                          Invoice #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(invoice.createdAt).toLocaleString([], {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase">
                          {invoice.status}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(Number(invoice.total ?? 0), currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Udhaar Ledger */}
          {activeTab === "udhaar" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 font-medium">
                    Net Outstanding Balance
                    {customer?.branch?.name ? ` · ${customer.branch.name}` : ""}
                  </span>
                  <p className="text-2xl font-bold text-slate-950 mt-0.5">
                    {formatCurrency(balance, currency)}
                  </p>
                </div>
                {balance > 0 && (
                  <button
                    type="button"
                    onClick={() => router.push("/udhaar")}
                    className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
                  >
                    Go to Udhaar Console
                  </button>
                )}
              </div>

              {!udhaar?.history?.length ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  No debt or settlement ledger entries recorded.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {udhaar.history.map((entry: any, idx: number) => {
                    const isPayment =
                      entry.entryType === "credit" ||
                      entry.type?.toLowerCase().includes("payment") ||
                      entry.type?.toLowerCase().includes("settlement");

                    return (
                      <div
                        key={entry.id || idx}
                        className="py-4 flex justify-between items-center gap-4"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">
                            {entry.type || entry.entryType || "Ledger Transaction"}
                          </p>
                          {entry.createdAt && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(entry.createdAt).toLocaleString([], {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </p>
                          )}
                        </div>

                        <span
                          className={`text-sm font-bold ${
                            isPayment ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isPayment ? "-" : "+"} {formatCurrency(Number(entry.amount ?? 0), currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}