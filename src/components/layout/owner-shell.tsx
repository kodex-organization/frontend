"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MonitorSmartphone,
  Timer,
  Armchair,
  Receipt,
  BookOpen,
  LineChart,
  BarChart3,
  Settings2,
  Clock,
  LifeBuoy,
  DownloadCloud,
  ClipboardList,
  Users,
  Scale,
  XOctagon,
  RefreshCw,
  ShieldCheck,
  Settings,
  LogOut,
  Bell,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles } from "@/lib/auth/session";
import { useConnectionStatus } from '@/lib/connectivity/online-status';
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useNotifications } from "@/features/notifications/context";
import { TenantAnnouncementCenter } from "@/features/announcements/components/tenant-announcement-center";
import { GlobalBranchSelector } from "@/features/tenancy/components/global-branch-selector";

const CueLogo = ({ size = 26, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    className={className}
  >
    <path d="M 18.72 5.28 A 9.5 9.5 0 1 0 18.72 18.72" />
    <path d="M 15.18 8.82 A 4.5 4.5 0 1 0 15.18 15.18" />
  </svg>
);

interface NavGroup {
  title?: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[];
}

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const connectionStatus = useConnectionStatus();
  const pathname = usePathname();
  const { user, logout, updateUserLanguage } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    markAllLoading,
    markAllError,
  } = useNotifications();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branchSwitching, setBranchSwitching] = useState(false);

  const canManageGovernance = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );
  const canRequestCancellation = user?.roles.includes("CASHIER");
  const isOwnerOrManager = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );
  const hasCustomerAccess = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER" || role === "CASHIER",
  );
  const hasBackOfficeAccess = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT",
  );
  const hasReportsAccess = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER" || role === "ACCOUNTANT",
  );
  const canOperateFloor = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER" || role === "CASHIER",
  );
  const canManageCatalog = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER",
  );

  const [language, setLanguage] = useState<"en" | "ur">(user?.language ?? "en");

  useEffect(() => {
    if (user?.language) {
      setLanguage(user.language);
    }
  }, [user?.language]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleLanguageChange = async (next: "en" | "ur") => {
    try {
      await updateUserLanguage(next);
      setLanguage(next);
    } catch {
      // Best-effort only
    }
  };

  const strings = {
    en: {
      operations: "Operations",
      management: "Management",
      analytics: "Analytics & Logs",
      configuration: "System",
      dashboard: "Dashboard",
      floorView: "Floor View",
      sessions: "Sessions",
      tables: "Catalog & Tables",
      branchSetup: "Branch Setup",
      billing: "Billing & POS",
      udhaar: "Udhaar Ledger",
      operationalReports: "Operational Reports",
      crossBranchReports: "Cross-Branch Analytics",
      branchControls: "Branch Controls",
      peakHours: "Peak Hours",
      supportAccess: "Support Access",
      dataExport: "Data Export",
      audit: "Audit Logs",
      customers: "Customer Directory",
      governance: "Governance",
      requestCancellation: "Request Cancellation",
      syncStatus: "Sync Status",
      security: "Security & Devices",
      settings: "Staff & Settings",
      language: "Language",
      logout: "Log out",
      notifications: "Notifications",
    },
    ur: {
      operations: "آپریشنز",
      management: "مینجمنٹ",
      analytics: "تجزیات اور لاگز",
      configuration: "سسٹم",
      dashboard: "ڈیش بورڈ",
      floorView: "فلور ویو",
      sessions: "سیشنز",
      tables: "کیٹلاگ اور میزیں",
      branchSetup: "برانچز",
      billing: "بلنگ اور پی او ایس",
      udhaar: "ادھار لیجر",
      operationalReports: "آپریشنل رپورٹس",
      crossBranchReports: "کراس برانچ تجزیات",
      branchControls: "برانچ کنٹرولز",
      peakHours: "پیک اوقات",
      supportAccess: "سپورٹ رسائی",
      dataExport: "ڈیٹا ایکسپورٹ",
      audit: "آڈٹ لاگز",
      customers: "صارفین کی فہرست",
      governance: "گورننس",
      requestCancellation: "منسوخی کی درخواست",
      syncStatus: "سنک اسٹیٹس",
      security: "سیکیورٹی اور ڈیوائسز",
      settings: "اسٹاف اور سیٹنگز",
      language: "زبان",
      logout: "لاگ آؤٹ",
      notifications: "اطلاعات",
    },
  };

  const t = strings[language];

  // Grouped Navigation
  const navGroups: NavGroup[] = [
    {
      title: t.operations,
      items: [
        ...(canOperateFloor
          ? [
              { href: "/floor-view", label: t.floorView, icon: MonitorSmartphone },
              { href: "/sessions", label: t.sessions, icon: Timer },
            ]
          : []),
        { href: "/billing", label: t.billing, icon: Receipt },
        ...(canManageCatalog
          ? [{ href: "/catalog", label: t.tables, icon: Armchair }]
          : []),
      ],
    },
    {
      title: t.management,
      items: [
        ...(isOwnerOrManager
          ? [{ href: "/dashboard", label: t.dashboard, icon: LayoutDashboard }]
          : []),
        ...(hasCustomerAccess
          ? [{ href: "/customers", label: t.customers, icon: Users }]
          : []),
        ...(hasBackOfficeAccess
          ? [{ href: "/udhaar", label: t.udhaar, icon: BookOpen }]
          : []),
      ],
    },
    {
      title: t.analytics,
      items: [
        ...(hasReportsAccess
          ? [{ href: "/reporting", label: t.operationalReports, icon: LineChart }]
          : []),
        ...(user?.roles.includes("OWNER")
          ? [{ href: "/reports", label: t.crossBranchReports, icon: BarChart3 }]
          : []),
        ...(hasBackOfficeAccess
          ? [{ href: "/audit", label: t.audit, icon: ClipboardList }]
          : []),
        ...(canManageGovernance || canRequestCancellation
          ? [
              {
                href: "/governance",
                label: canManageGovernance ? t.governance : t.requestCancellation,
                icon: canManageGovernance ? Scale : XOctagon,
              },
            ]
          : []),
      ],
    },
    {
      title: t.configuration,
      items: [
        { href: "/sync-status", label: t.syncStatus, icon: RefreshCw },
        ...(user?.roles.includes("OWNER")
          ? [
              { href: "/branches", label: t.branchControls, icon: Settings2 },
              { href: "/settings/peak-hours", label: t.peakHours, icon: Clock },
              { href: "/settings/security", label: t.security, icon: ShieldCheck },
              { href: "/settings/data-export", label: t.dataExport, icon: DownloadCloud },
              { href: "/settings/support-access", label: t.supportAccess, icon: LifeBuoy },
            ]
          : []),
        ...(isOwnerOrManager
          ? [{ href: "/settings/staff", label: t.settings, icon: Settings }]
          : []),
        { href: "/notifications", label: t.notifications, icon: Bell },
      ],
    },
  ].filter((group) => group.items.length > 0);

  const initials = (user?.fullName || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans print:h-auto print:overflow-visible print:bg-white">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden transition-opacity print:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/80 bg-white shadow-sm lg:static transition-all duration-300 ease-in-out print:hidden ${
          isCollapsed ? "w-[78px] p-3" : "w-64 p-4"
        } ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Logo Header */}
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
          <Link
            href={isOwnerOrManager ? "/dashboard" : redirectPathForRoles(user?.roles || [])}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform shrink-0">
              <CueLogo size={22} />
            </div>
            {!isCollapsed && (
              <div>
                <span className="text-lg font-extrabold tracking-tight text-slate-900">
                  Cue<span className="text-brand-600">Cloud</span>
                </span>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest -mt-1">
                  POS & Club Suite
                </span>
              </div>
            )}
          </Link>

          <div className="flex items-center">
            {/* Collapse Toggle Button (Desktop) */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {!isCollapsed && group.title && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center rounded-xl py-2 font-semibold transition-all duration-150 ${
                      isCollapsed
                        ? "justify-center w-11 h-11 mx-auto"
                        : "px-3 w-full"
                    } ${
                      isActive
                        ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-100"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                    }`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {/* Active Indicator Bar */}
                    {isActive && (
                      <span
                        className={`absolute rounded-full bg-brand-600 transition-all ${
                          isCollapsed
                            ? "left-1 top-2.5 bottom-2.5 w-1"
                            : "left-1 top-2 bottom-2 w-1"
                        }`}
                      />
                    )}

                    <div
                      className={`flex items-center gap-3 ${
                        isCollapsed ? "justify-center" : ""
                      }`}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? "text-brand-600"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate text-xs font-medium tracking-tight">
                          {item.label}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile & Language Footer */}
        <div className="mt-auto border-t border-slate-100 pt-3 space-y-3">
          {user && (
            <div
              className={`flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100 ${
                isCollapsed ? "justify-center" : ""
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {user.fullName ?? user.email}
                  </p>
                  <p className="truncate text-[10px] font-medium text-slate-500 capitalize">
                    {user.roles.join(", ").toLowerCase()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Language Selector */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Globe size={13} className="text-slate-400" />
                {t.language}
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                    language === "en"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("ur")}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                    language === "ur"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  UR
                </button>
              </div>
            </div>
          ) : null}

          {/* Logout Button */}
          <button
            type="button"
            onClick={() => logout()}
            className={`group flex items-center rounded-xl py-2 font-medium text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 ${
              isCollapsed ? "justify-center w-11 h-11 mx-auto" : "px-3 w-full gap-2.5 text-xs"
            }`}
            title={isCollapsed ? t.logout : undefined}
          >
            <LogOut size={16} className="shrink-0 group-hover:text-rose-600 transition-colors" />
            {!isCollapsed && <span>{t.logout}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="custom-scrollbar flex-1 flex flex-col min-w-0 overflow-y-auto print:overflow-visible print:h-auto print:bg-white">
        <div className="print:hidden">
          <TenantAnnouncementCenter />
        </div>

        {/* Global Sticky Top Header */}
        <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-2 shadow-sm backdrop-blur-md sm:px-6 print:hidden">
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-xs font-semibold text-slate-600">
                {connectionStatus === 'online' ? 'CueCloud POS Connected' : connectionStatus === 'checking' ? 'CueCloud POS Checking...' : 'CueCloud POS Offline'}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <GlobalBranchSelector onSwitching={setBranchSwitching} />
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              markAllLoading={markAllLoading}
              markAllError={markAllError}
            />
          </div>
        </header>

        {/* Page Body */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-24 print:p-0 print:pb-0 print:m-0 print:max-w-none" key={`${user?.id}:${user?.branchId}`}>
          {branchSwitching && <p role="status" className="mb-4 text-center text-slate-500">Switching active branch...</p>}
          <fieldset disabled={branchSwitching} className={`min-w-0 ${branchSwitching ? "pointer-events-none opacity-50" : ""}`}>
            {children}
          </fieldset>
        </div>
      </main>
    </div>
  );
}
