"use client";

import { useState } from "react";

import { SubscriptionConsole } from "@/features/platform-admin/components/subscription-console";
import { TenantManager } from "@/features/tenancy";

export default function TenantsPage() {
  const [view, setView] = useState<"subscriptions" | "tenants">(
    "subscriptions",
  );
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  const handleSelectTenantForSubscription = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setView("subscriptions");
  };

  return (
    <div className="space-y-6">
      <div
        aria-label="Tenant administration view"
        className="inline-flex rounded-md border border-slate-200 bg-white p-1"
        role="tablist"
      >
        <button
          aria-selected={view === "subscriptions"}
          className={`rounded px-3 py-2 text-sm font-medium ${
            view === "subscriptions"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setView("subscriptions")}
          role="tab"
          type="button"
        >
          Subscriptions
        </button>
        <button
          aria-selected={view === "tenants"}
          className={`rounded px-3 py-2 text-sm font-medium ${
            view === "tenants"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setView("tenants")}
          role="tab"
          type="button"
        >
          Tenant accounts
        </button>
      </div>
      {view === "subscriptions" ? (
        <SubscriptionConsole initialTenantId={selectedTenantId} />
      ) : (
        <TenantManager onSelectTenantForSubscription={handleSelectTenantForSubscription} />
      )}
    </div>
  );
}
