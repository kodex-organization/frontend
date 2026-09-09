"use client";

import {
  Activity,
  CreditCard,
  FileSearch,
  LogOut,
  Megaphone,
  ScanFace,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePlatformAdminAuth } from "@/lib/platform-admin/auth-context";
import { ImpersonationBanner } from "@/features/platform-admin/components/impersonation-banner";

const navItems = [
  { href: "/tenants", label: "Subscriptions", icon: CreditCard },
  { href: "/platform-health", label: "Platform Health", icon: Activity },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/releases", label: "Releases", icon: Rocket },
  { href: "/impersonation", label: "Impersonation", icon: ScanFace },
  { href: "/super-admin/audit", label: "Audit Log", icon: FileSearch },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = usePlatformAdminAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      <aside className="relative flex w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white p-4 shadow-sm z-10">
        <div className="mb-5 flex items-center gap-2.5 px-2 pb-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Platform Admin</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Super Console</p>
          </div>
        </div>

        <nav
          className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto pr-1"
          aria-label="Platform administration"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-brand-600" />
                )}
                <Icon
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-3 space-y-3">
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
              PA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">
                {admin?.fullName ?? "Super Admin"}
              </p>
              <p className="truncate text-[10px] text-slate-500">{admin?.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="custom-scrollbar flex-1 flex flex-col min-w-0 overflow-y-auto">
        <ImpersonationBanner />
        <main className="p-6 sm:p-8 max-w-7xl w-full mx-auto pb-24">{children}</main>
      </div>
    </div>
  );
}
