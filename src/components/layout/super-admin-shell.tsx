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
  { href: "/audit", label: "Audit Log", icon: FileSearch },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = usePlatformAdminAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-7 flex items-center gap-2 px-2 text-brand-700">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          <p className="text-sm font-semibold">CueCloud Platform</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Platform administration">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
                pathname === item.href
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <item.icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-slate-200 pt-4">
          <div className="min-w-0 px-2">
            <p className="truncate text-sm font-medium text-slate-900">
              {admin?.fullName ?? "Platform administrator"}
            </p>
            <p className="truncate text-xs text-slate-500">{admin?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-3 flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <ImpersonationBanner />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
