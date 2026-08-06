"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useNotifications } from "@/features/notifications/context";

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, markAllLoading, markAllError } = useNotifications();

  const canManageGovernance = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );
  const canRequestCancellation = user?.roles.includes("CASHIER");
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

  const navItems = [
    ...(hasBackOfficeAccess
      ? [{ href: "/dashboard", label: "Dashboard" }]
      : []),
    ...(canOperateFloor
      ? [
          { href: "/floor-view", label: "Floor View" },
          { href: "/sessions", label: "Sessions" },
        ]
      : []),
    ...(canManageCatalog
      ? [{ href: "/catalog", label: "Tables" }]
      : []),
    { href: "/billing", label: "Billing" },
    ...(hasBackOfficeAccess
      ? [
        { href: "/udhaar", label: "Udhaar" },
        { href: "/customers", label: "Customers" },
        { href: "/reports", label: "Reports" },
      ]
      : []),
    ...(canManageGovernance || canRequestCancellation
      ? [
          {
            href: "/governance",
            label: canManageGovernance
              ? "Governance"
              : "Request Cancellation",
          },
        ]
      : []),
    { href: "/sync-status", label: "Sync Status" },
    ...(user?.roles.includes("OWNER")
      ? [{ href: "/settings/security", label: "Security & Devices" }]
      : []),
    ...(hasBackOfficeAccess
      ? [{ href: "/settings/staff", label: "Settings" }]
      : []),
    { href: "/notifications", label: "Notifications" },
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
            <div className="mb-2 px-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.fullName ?? user.email}
              </p>
              <p className="truncate text-xs text-slate-500">
                {user.roles.join(", ")}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-md px-3 py-2 text-left text-sm
                       text-slate-600 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1">
        <header className="flex h-16 items-center justify-end border-b border-slate-200 bg-white px-6">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} markAllLoading={markAllLoading} markAllError={markAllError} />
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
