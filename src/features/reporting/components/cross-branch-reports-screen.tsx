"use client";

import { BarChart3, Filter, LoaderCircle, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { getAssignedBranches, type AssignedBranch } from "@/features/tenancy/branch-switching";
import { ApiError } from "@/lib/api/client";
import {
  formatDuration,
  getCrossBranchReport,
  type BranchReportMetrics,
  type CrossBranchReport,
  type CrossBranchReportFilters,
} from "../cross-branch";

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDateRange() {
  const today = new Date();
  return {
    from: localDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: localDateInput(today),
  };
}

function formatMoney(value: number, currency?: string) {
  if (currency) {
    try {
      return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      // Fall through to a neutral number for invalid legacy currency codes.
    }
  }
  return new Intl.NumberFormat("en-PK", {
    maximumFractionDigits: 2,
  }).format(value);
}

interface CrossBranchReportViewProps {
  report: CrossBranchReport;
  branches?: AssignedBranch[];
}

export function CrossBranchReportView({
  report,
  branches = [],
}: CrossBranchReportViewProps) {
  const currencyByBranch = new Map(
    branches.map((branch) => [branch.id, branch.currency ?? undefined]),
  );
  const currencies = Array.from(
    new Set(
      report.branches
        .map((branch) => currencyByBranch.get(branch.branchId))
        .filter((currency): currency is string => Boolean(currency)),
    ),
  );
  const totalsCurrency = currencies.length === 1 ? currencies[0] : undefined;
  const totals = report.totals;
  const metrics: Array<{
    label: string;
    value: string;
    key: keyof BranchReportMetrics;
  }> = [
    { label: "Revenue", value: formatMoney(totals.revenue, totalsCurrency), key: "revenue" },
    { label: "Sessions", value: totals.sessionCount.toLocaleString("en-PK"), key: "sessionCount" },
    { label: "Session duration", value: formatDuration(totals.sessionDurationSeconds), key: "sessionDurationSeconds" },
    { label: "Udhaar issued", value: formatMoney(totals.udhaarIssued, totalsCurrency), key: "udhaarIssued" },
    { label: "Udhaar received", value: formatMoney(totals.udhaarReceived, totalsCurrency), key: "udhaarReceived" },
    { label: "Outstanding udhaar", value: formatMoney(totals.outstandingUdhaar, totalsCurrency), key: "outstandingUdhaar" },
  ];
  const hasActivity = Object.values(totals).some((value) => value !== 0);

  return (
    <div>
      {!hasActivity ? (
        <div className="mb-5 border-l-4 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No activity was recorded for this period and branch selection.
        </div>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="rounded-md border border-slate-200 bg-white px-4 py-3"
          >
            <dt className="text-xs font-medium uppercase text-slate-500">
              {metric.label}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-7">
        <h2 className="text-base font-semibold text-slate-900">
          Branch comparison
        </h2>
        {report.branches.length === 0 ? (
          <div className="mt-3 flex min-h-32 items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500">
            No branches matched this report.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Sessions</th>
                  <th className="px-4 py-3 text-right">Duration</th>
                  <th className="px-4 py-3 text-right">Issued</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.branches.map((branch) => {
                  const currency = currencyByBranch.get(branch.branchId);
                  return (
                    <tr key={branch.branchId}>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-slate-900">
                        {branch.branchName ?? `Branch ${branch.branchId.slice(0, 8)}`}
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatMoney(branch.revenue, currency)}
                      </td>
                      <td className="px-4 py-3 text-right">{branch.sessionCount}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatDuration(branch.sessionDurationSeconds)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatMoney(branch.udhaarIssued, currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {formatMoney(branch.udhaarReceived, currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                        {formatMoney(branch.outstandingUdhaar, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function CrossBranchReportsScreen() {
  const initialDates = useMemo(initialDateRange, []);
  const [from, setFrom] = useState(initialDates.from);
  const [to, setTo] = useState(initialDates.to);
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [report, setReport] = useState<CrossBranchReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<CrossBranchReportFilters>({
    ...initialDates,
    branchIds: [],
  });

  const loadBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const assigned = await getAssignedBranches();
      setBranches(assigned);
      setSelectedBranchIds((current) =>
        current.length > 0
          ? current.filter((id) => assigned.some((branch) => branch.id === id))
          : assigned.map((branch) => branch.id),
      );
      setBranchesError(null);
    } catch (error) {
      setBranchesError(
        error instanceof ApiError
          ? error.message
          : "Branch filters could not be loaded.",
      );
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  const loadReport = useCallback(async (filters: CrossBranchReportFilters) => {
    setReportLoading(true);
    setReportError(null);
    try {
      setReport(await getCrossBranchReport(filters));
    } catch (error) {
      setReportError(
        error instanceof ApiError
          ? error.message
          : "The cross-branch report could not be loaded.",
      );
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches();
    void loadReport(appliedFilters);
  }, [appliedFilters, loadBranches, loadReport]);

  const applyFilters = () => {
    if (!from || !to || from > to) {
      setFilterError("Choose a valid date range.");
      return;
    }
    if (branches.length > 0 && selectedBranchIds.length === 0) {
      setFilterError("Select at least one branch.");
      return;
    }
    setFilterError(null);
    setAppliedFilters({ from, to, branchIds: selectedBranchIds });
  };

  const allBranchesSelected =
    branches.length > 0 && selectedBranchIds.length === branches.length;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Cross-branch reports
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Consolidated performance across your selected branches.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(140px,180px)_minmax(140px,180px)_1fr_auto] lg:items-end">
          <label className="text-sm font-medium text-slate-700">
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium text-slate-700">Branches</legend>
            <div className="mt-1 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-slate-300 px-3 py-2">
              {branchesLoading ? (
                <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Loading
                </span>
              ) : branches.length === 0 ? (
                <span className="text-sm text-slate-500">No branches available</span>
              ) : (
                <>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={allBranchesSelected}
                      onChange={(event) =>
                        setSelectedBranchIds(
                          event.target.checked
                            ? branches.map((branch) => branch.id)
                            : [],
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-brand-600"
                    />
                    All
                  </label>
                  {branches.map((branch) => (
                    <label
                      key={branch.id}
                      className="inline-flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.includes(branch.id)}
                        onChange={(event) =>
                          setSelectedBranchIds((current) =>
                            event.target.checked
                              ? [...current, branch.id]
                              : current.filter((id) => id !== branch.id),
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600"
                      />
                      {branch.name ?? `Branch ${branch.id.slice(0, 8)}`}
                    </label>
                  ))}
                </>
              )}
            </div>
          </fieldset>
          <button
            type="button"
            onClick={applyFilters}
            disabled={reportLoading || branchesLoading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Filter aria-hidden="true" className="h-4 w-4" />
            Apply
          </button>
        </div>
        {filterError ? (
          <p className="mt-2 text-sm text-red-700">{filterError}</p>
        ) : null}
        {branchesError ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-800">
            <span>{branchesError}</span>
            <button
              type="button"
              onClick={() => void loadBranches()}
              className="font-semibold underline"
            >
              Retry branch filters
            </button>
          </div>
        ) : null}
      </div>

      {reportError ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <span>
            {reportError}
            {report ? " The last loaded report remains visible." : ""}
          </span>
          <button
            type="button"
            onClick={() => void loadReport(appliedFilters)}
            className="inline-flex items-center gap-2 font-semibold underline"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : null}

      <div className="relative mt-6" aria-busy={reportLoading}>
        {reportLoading && !report ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
            Loading report
          </div>
        ) : report ? (
          <div className={reportLoading ? "opacity-50" : undefined}>
            <CrossBranchReportView report={report} branches={branches} />
          </div>
        ) : !reportError ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-slate-500">
            <BarChart3 aria-hidden="true" className="h-8 w-8" />
            <p className="mt-2 text-sm">No report data available.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
