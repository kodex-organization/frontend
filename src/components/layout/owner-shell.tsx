"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const { user, logout, updateUserLanguage } = useAuth();

  const canManageGovernance = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );
  const canRequestCancellation = user?.roles.includes("CASHIER");
  const hasCustomerAccess = user?.roles.some(
    (role) =>
      role === "OWNER" ||
      role === "MANAGER" ||
      role === "CASHIER",
  );
  const hasBackOfficeAccess = user?.roles.some(
    (role) =>
      role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT",
  );
  const hasReportsAccess = user?.roles.some(
  (role) =>
    role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT" || role === "CASHIER",
  );
  const canOperateFloor = user?.roles.some(
    (role) =>
      role === "OWNER" || role === "MANAGER" || role === "CASHIER",
  );
  const canManageCatalog = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );

  const [language, setLanguage] = useState<"en" | "ur">(
    user?.language ?? "en",
  );

  useEffect(() => {
    if (user?.language) {
      setLanguage(user.language);
    }
  }, [user?.language]);

  const handleLanguageChange = async (next: "en" | "ur") => {
    try {
      await updateUserLanguage(next);
      setLanguage(next);
    } catch {
      // Best-effort only; keep UI responsive.
    }
  };

  const strings = {
    en: {
      dashboard: "Dashboard",
      floorView: "Floor View",
      sessions: "Sessions",
      tables: "Tables",
      billing: "Billing",
      udhaar: "Udhaar",
      reports: "Reports",
      customers: "Customers",
      governance: "Governance",
      requestCancellation: "Request Cancellation",
      syncStatus: "Sync Status",
      security: "Security & Devices",
      settings: "Settings",
      language: "Language",
      logout: "Log out",
    },
    ur: {
      dashboard: "ڈیش بورڈ",
      floorView: "فلور ویو",
      sessions: "سیشنز",
      tables: "میزیں",
      billing: "بلنگ",
      udhaar: "ادھار",
      reports: "رپورٹس",
      customers: "صارفین",
      governance: "گورننس",
      requestCancellation: "منسوخی کی درخواست",
      syncStatus: "سنک اسٹیٹس",
      security: "سیکیورٹی اور ڈیوائسز",
      settings: "سیٹنگز",
      language: "زبان",
      logout: "لاگ آؤٹ",
    },
  };

  const stringsForLanguage = strings[language];

  const navItems = [
    ...(hasBackOfficeAccess
      ? [{ href: "/dashboard", label: stringsForLanguage.dashboard }]
      : []),
    ...(canOperateFloor
      ? [
          { href: "/floor-view", label: stringsForLanguage.floorView },
          { href: "/sessions", label: stringsForLanguage.sessions },
        ]
      : []),
    ...(canManageCatalog
      ? [{ href: "/catalog", label: stringsForLanguage.tables }]
      : []),
    { href: "/billing", label: stringsForLanguage.billing },
    ...(hasBackOfficeAccess
  ? [{ href: "/udhaar", label: stringsForLanguage.udhaar }]
  : []),
...(hasReportsAccess
  ? [{ href: "/reports", label: stringsForLanguage.reports }]
  : []),
    ...(hasCustomerAccess
      ? [{ href: "/customers", label: stringsForLanguage.customers }]
      : []),
    ...(canManageGovernance || canRequestCancellation
      ? [
          {
            href: "/governance",
            label: canManageGovernance
              ? stringsForLanguage.governance
              : stringsForLanguage.requestCancellation,
          },
        ]
      : []),
    { href: "/sync-status", label: stringsForLanguage.syncStatus },
    ...(user?.roles.includes("OWNER")
      ? [{ href: "/settings/security", label: stringsForLanguage.security }]
      : []),
    ...(hasBackOfficeAccess
      ? [{ href: "/settings/staff", label: stringsForLanguage.settings }]
      : []),
  ];
    
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
        <p className="mb-6 text-sm font-semibold text-brand-700">
          CueCloud
        </p>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 pt-3">
          {user && (
            <div className="mb-4 px-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.fullName ?? user.email}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user.roles.join(", ")}
              </p>
            </div>
          )}

          <div className="mb-4 px-1 text-sm text-slate-600">
            <label
              htmlFor="user-language"
              className="block font-medium text-slate-800"
            >
              {stringsForLanguage.language}
            </label>
            <select
              id="user-language"
              value={language}
              onChange={(e) =>
                handleLanguageChange(e.target.value as "en" | "ur")
              }
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="ur">Urdu</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
          >
            {stringsForLanguage.logout}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
