"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api/client";
import { reScopeOfflineData } from "@/lib/sync/offline-db";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useNotifications } from "@/features/notifications/context";
import { BranchSelector } from "@/features/tenancy/components/branch-selector";
import { TenantAnnouncementCenter } from "@/features/announcements/components/tenant-announcement-center";
import {
  ASSIGNED_BRANCHES_CHANGED_EVENT,
  completeBranchSwitch,
  getAssignedBranches,
  type AssignedBranch,
} from "@/features/tenancy/branch-switching";

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout, updateUserLanguage, replaceSession } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, markAllLoading, markAllError, resetForBranch } = useNotifications();
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const [switchingBranch, setSwitchingBranch] = useState(false);

  useEffect(() => {
    if (!user) {
      setBranches([]);
      return;
    }

    let active = true;
    const loadBranches = () => {
      void getAssignedBranches()
        .then((assignedBranches) => {
          if (active) setBranches(assignedBranches);
        })
        .catch((error) => {
          if (!active) return;
          setBranches([]);
          toast.error(
            error instanceof ApiError
              ? error.message
              : "Could not load assigned branches.",
          );
        });
    };

    loadBranches();
    window.addEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, loadBranches);

    return () => {
      active = false;
      window.removeEventListener(ASSIGNED_BRANCHES_CHANGED_EVENT, loadBranches);
    };
  }, [user?.branchId, user?.id]);

  const handleBranchSwitch = useCallback(
    async (branchId: string) => {
      if (!user || branchId === user.branchId || switchingBranch) return;

      setSwitchingBranch(true);
      try {
        const completion = await completeBranchSwitch(user, branchId, {
          replaceSession,
          reScopeOfflineData,
          refreshBranchState: resetForBranch,
          navigate: (path) => router.replace(path),
        });

        setBranches((current) =>
          current.map((branch) => ({
            ...branch,
            isSelected: branch.id === completion.session.user.branchId,
          })),
        );
        router.refresh();
        toast.success(
          `Switched to ${
            branches.find((branch) => branch.id === branchId)?.name ?? "branch"
          }.`,
        );

        if (completion.maintenanceErrors.length > 0) {
          toast.warning(
            "Branch changed, but some local data could not be refreshed.",
          );
        }
      } catch (error) {
        toast.error(
          error instanceof ApiError
            ? error.message
            : "Could not switch branches. Please try again.",
        );
      } finally {
        setSwitchingBranch(false);
      }
    },
    [branches, replaceSession, resetForBranch, router, switchingBranch, user],
  );

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
      branches: "Branches",
      peakHours: "Peak Hours",
      supportAccess: "Support Access",
      dataExport: "Data Export",
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
      branches: "Branches",
      peakHours: "Peak Hours",
      supportAccess: "Support Access",
      dataExport: "Data Export",
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
      ? [
          { href: "/udhaar", label: stringsForLanguage.udhaar },
        ]
      : []),
    ...(user?.roles.includes("OWNER")
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
      ? [
          { href: "/settings/branches", label: stringsForLanguage.branches },
          { href: "/settings/peak-hours", label: stringsForLanguage.peakHours },
          { href: "/settings/support-access", label: stringsForLanguage.supportAccess },
          { href: "/settings/data-export", label: stringsForLanguage.dataExport },
          { href: "/settings/security", label: stringsForLanguage.security },
        ]
      : []),
    ...(hasBackOfficeAccess
      ? [{ href: "/settings/staff", label: stringsForLanguage.settings }]
      : []),
    { href: "/notifications", label: "Notifications" },
  ];
    
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6">
          <p className="text-sm font-semibold text-brand-700">
            CueCloud
          </p>
          {user && branches.length > 1 ? (
            <div className="mt-3">
              <BranchSelector
                branches={branches}
                activeBranchId={user.branchId}
                switching={switchingBranch}
                onSwitch={(branchId) => void handleBranchSwitch(branchId)}
              />
            </div>
          ) : null}
        </div>

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

      <main className="min-w-0 flex-1 p-8">
        <TenantAnnouncementCenter />
        <header className="mb-6 flex min-h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} markAllLoading={markAllLoading} markAllError={markAllError} />
        </header>
        <div key={user?.branchId}>{children}</div>
      </main>
    </div>
  );
}
