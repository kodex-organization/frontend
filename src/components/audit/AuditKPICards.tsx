"use client";

import React, { useState } from "react";
import type { AuditKPIs, ClockVerificationResult } from "../../types/audit";
import { verifyClientClock } from "../../lib/api/audit";
import { toast } from "@/lib/toast";

interface AuditKPICardsProps {
  kpis: AuditKPIs | null;
  isLoading: boolean;
  onRefresh?: () => void;
}

export function AuditKPICards({ kpis, isLoading, onRefresh }: AuditKPICardsProps) {
  const [verifyingClock, setVerifyingClock] = useState(false);
  const [clockStatus, setClockStatus] = useState<ClockVerificationResult | null>(null);

  const handleVerifyClock = async () => {
    try {
      setVerifyingClock(true);
      const result = await verifyClientClock({
        clientTimestamp: new Date().toISOString(),
        toleranceSeconds: 300,
      });
      setClockStatus(result);
      if (result.isTampered) {
        toast.warning(`Clock skew detected: ${result.diffSeconds}s offset!`);
      } else {
        toast.success(`Clock synchronized with server (${result.diffSeconds}s skew).`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to verify clock sync.");
    } finally {
      setVerifyingClock(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl animate-pulse h-28"
          />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Immutable Logs",
      value: kpis?.totalLogs?.toLocaleString() ?? "0",
      description: "Cryptographically verified events",
      badge: "Append-Only",
      badgeColor: "bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300",
      icon: (
        <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: "Anomalies (Today)",
      value: kpis?.anomaliesToday?.toLocaleString() ?? "0",
      description: "Shift & void pattern alerts",
      badge: Number(kpis?.anomaliesToday ?? 0) > 0 ? "Action Required" : "Normal",
      badgeColor:
        Number(kpis?.anomaliesToday ?? 0) > 0
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
      icon: (
        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      title: "Clock Tamper Alerts",
      value: kpis?.tamperCount?.toLocaleString() ?? "0",
      description: "Authoritative server skew checks",
      badge: Number(kpis?.tamperCount ?? 0) > 0 ? "Critical" : "Synchronized",
      badgeColor:
        Number(kpis?.tamperCount ?? 0) > 0
          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
          : "bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300",
      icon: (
        <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Receipt Reprints",
      value: kpis?.reprintCount?.toLocaleString() ?? "0",
      description: "Logged invoice reprint actions",
      badge: "Monitored",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
      icon: (
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* 4 Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {card.title}
              </span>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/80">{card.icon}</div>
            </div>

            <div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                {card.value}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {card.description}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                  {card.badge}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Clock Sync & Tamper Check Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl gap-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm">
            Server Authoritative Clock Sync is active (drift tolerance: ±5m).
          </span>
          {clockStatus && (
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                clockStatus.isTampered
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
              }`}
            >
              {clockStatus.isTampered
                ? `Skew Detected: ${clockStatus.diffSeconds}s`
                : `Verified (${clockStatus.diffSeconds}s delta)`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleVerifyClock}
            disabled={verifyingClock}
            className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 transition-colors shadow-sm disabled:opacity-50"
          >
            {verifyingClock ? "Verifying..." : "Verify Clock Skew"}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
              title="Refresh Stats"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}