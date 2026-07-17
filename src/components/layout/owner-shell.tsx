"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

const navItems = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/catalog", label: "Tables" },
    { href: "/sessions", label: "Sessions" },
    { href: "/billing", label: "Billing" },
    { href: "/udhaar", label: "Udhaar" },
    { href: "/customers", label: "Customers" },
    { href: "/reports", label: "Reports" },
    { href: "/governance", label: "Governance" },
    { href: "/sync-status", label: "Sync Status" },
    ...(user?.roles.includes("OWNER")
      ? [{ href: "/settings/security", label: "Security & Devices" }]
      : []),
    { href: "/settings/staff", label: "Settings" },
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

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}