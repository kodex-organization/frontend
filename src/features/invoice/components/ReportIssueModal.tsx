"use client";

import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { useOnlineStatus } from "@/lib/connectivity/online-status";

const ISSUE_TYPES = [
  { value: "wrong_amount", label: "Wrong amount" },
  { value: "wrong_item", label: "Wrong item / quantity" },
  { value: "wrong_payment", label: "Wrong payment / tender" },
  { value: "duplicate_transaction", label: "Duplicate transaction" },
  { value: "wrong_customer", label: "Wrong customer / udhaar" },
  { value: "other", label: "Other" },
];

const OFFLINE_REPORTS_KEY = "cuecloud_offline_invoice_issue_reports";

type OfflineReport = {
  invoiceId: string;
  issueType: string;
  description: string;
};

function readOfflineReports(): OfflineReport[] {
  try {
    const raw = localStorage.getItem(OFFLINE_REPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineReports(reports: OfflineReport[]) {
  localStorage.setItem(OFFLINE_REPORTS_KEY, JSON.stringify(reports));
}

export async function flushOfflineInvoiceIssueReports() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const reports = readOfflineReports();
  if (reports.length === 0) return;

  const remaining: OfflineReport[] = [];
  for (const report of reports) {
    try {
      await apiFetch(`/billing/invoices/${encodeURIComponent(report.invoiceId)}/report-issue`, {
        method: "POST",
        body: JSON.stringify({
          issueType: report.issueType,
          description: report.description,
        }),
      });
    } catch {
      remaining.push(report);
    }
  }
  writeOfflineReports(remaining);
}

export default function ReportIssueModal({
  invoiceId,
  invoiceNumber,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  invoiceNumber: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isOnline = useOnlineStatus();
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void flushOfflineInvoiceIssueReports();
    const handleOnline = () => void flushOfflineInvoiceIssueReports();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  async function submitReport() {
    if (!issueType) {
      setError("Select the type of issue.");
      return;
    }
    if (description.trim().length < 10) {
      setError("Describe the issue in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (!isOnline) {
        const reports = readOfflineReports();
        reports.push({
          invoiceId,
          issueType,
          description: description.trim(),
        });
        writeOfflineReports(reports);
        onSuccess();
        return;
      }

      await apiFetch(`/billing/invoices/${encodeURIComponent(invoiceId)}/report-issue`, {
        method: "POST",
        body: JSON.stringify({ issueType, description: description.trim() }),
      });

      // Refresh owner-side alert/audit views if they are open
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cuecloud:anomaly-invalidated"));
        window.dispatchEvent(new CustomEvent("cuecloud:audit-invalidated"));
      }
      onSuccess();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The issue could not be reported.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-issue-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 id="report-issue-title" className="text-lg font-semibold text-slate-950">
            Report issue on {invoiceNumber ?? "this invoice"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The owner will be notified and can review this in the Audit alerts.
          </p>
        </div>

        <div className="space-y-4 px-6 py-5">
          {!isOnline && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              You are offline. This report will be saved on this device and sent when the connection returns.
            </p>
          )}

          {error && (
            <p
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Issue type
            <select
              value={issueType}
              onChange={(event) => setIssueType(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            >
              <option value="">Select an issue type...</option>
              {ISSUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            What went wrong?
            <textarea
              rows={4}
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submitReport()}
            disabled={submitting}
            className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : isOnline ? "Send to owner" : "Save report"}
          </button>
        </div>
      </div>
    </div>
  );
}