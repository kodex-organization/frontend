"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Zap,
  MonitorSmartphone,
  Timer,
  Receipt,
  UtensilsCrossed,
  Users,
  BookOpen,
  LineChart,
  ClipboardList,
  LayoutDashboard,
  Scale,
  Armchair,
  Settings,
  BarChart3,
  RefreshCw,
  Settings2,
  Clock,
  ShieldCheck,
  DownloadCloud,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles, type UserRole } from "@/lib/auth/session";
import {
  QUICK_ACCESS_ITEMS,
  filterQuickAccessByRole,
  groupQuickAccessByCategory,
  searchQuickAccessItems,
} from "../quick-access-config";
import type { AccentColor, QuickAccessItem } from "../types";

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  MonitorSmartphone,
  Timer,
  Receipt,
  UtensilsCrossed,
  Users,
  BookOpen,
  LineChart,
  ClipboardList,
  LayoutDashboard,
  Scale,
  Armchair,
  Settings,
  BarChart3,
  RefreshCw,
  Settings2,
  Clock,
  ShieldCheck,
  DownloadCloud,
};

const accentStyles: Record<
  AccentColor,
  {
    iconBox: string;
    badge: string;
    borderHover: string;
    arrow: string;
  }
> = {
  emerald: {
    iconBox:
      "bg-emerald-50 text-emerald-600 border-emerald-200/80 group-hover:bg-emerald-600 group-hover:text-white",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    borderHover: "hover:border-emerald-300",
    arrow: "text-emerald-600",
  },
  indigo: {
    iconBox:
      "bg-indigo-50 text-indigo-600 border-indigo-200/80 group-hover:bg-indigo-600 group-hover:text-white",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    borderHover: "hover:border-indigo-300",
    arrow: "text-indigo-600",
  },
  amber: {
    iconBox:
      "bg-amber-50 text-amber-600 border-amber-200/80 group-hover:bg-amber-600 group-hover:text-white",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    borderHover: "hover:border-amber-300",
    arrow: "text-amber-600",
  },
  violet: {
    iconBox:
      "bg-violet-50 text-violet-600 border-violet-200/80 group-hover:bg-violet-600 group-hover:text-white",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    borderHover: "hover:border-violet-300",
    arrow: "text-violet-600",
  },
  rose: {
    iconBox:
      "bg-rose-50 text-rose-600 border-rose-200/80 group-hover:bg-rose-600 group-hover:text-white",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    borderHover: "hover:border-rose-300",
    arrow: "text-rose-600",
  },
  cyan: {
    iconBox:
      "bg-cyan-50 text-cyan-600 border-cyan-200/80 group-hover:bg-cyan-600 group-hover:text-white",
    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",
    borderHover: "hover:border-cyan-300",
    arrow: "text-cyan-600",
  },
  blue: {
    iconBox:
      "bg-blue-50 text-blue-600 border-blue-200/80 group-hover:bg-blue-600 group-hover:text-white",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    borderHover: "hover:border-blue-300",
    arrow: "text-blue-600",
  },
  slate: {
    iconBox:
      "bg-slate-100 text-slate-700 border-slate-200 group-hover:bg-slate-800 group-hover:text-white",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    borderHover: "hover:border-slate-300",
    arrow: "text-slate-700",
  },
};

function getRoleTitle(roles: UserRole[] = [], lang: "en" | "ur"): string {
  const normalized = roles.map((r) => String(r).toUpperCase());
  if (normalized.includes("OWNER")) {
    return lang === "ur" ? "ایگزیکٹو کنٹرول پینل (اونر)" : "Club Owner Master Console";
  }
  if (normalized.includes("MANAGER")) {
    return lang === "ur" ? "کلب آپریشنز و مینجمنٹ پورٹل" : "Club Operations & Management";
  }
  if (normalized.includes("ACCOUNTANT")) {
    return lang === "ur" ? "اکاؤنٹنٹ مالیاتی اور آڈٹ ہب" : "Finance & Audit Workspace";
  }
  if (normalized.includes("CASHIER")) {
    return lang === "ur" ? "کاؤنٹر کیشیئر فوری آپریشنز" : "Front Desk Cashier Console";
  }
  return lang === "ur" ? "فوری رسائی پینل" : "Quick Access Portal";
}

function getLandingLabel(roles: UserRole[] = [], lang: "en" | "ur"): string {
  const normalized = roles.map((r) => String(r).toUpperCase());
  if (normalized.includes("OWNER") || normalized.includes("MANAGER")) {
    return lang === "ur" ? "ڈیش بورڈ پر جائیں" : "Back to Dashboard";
  }
  if (normalized.includes("ACCOUNTANT")) {
    return lang === "ur" ? "رپورٹس پر جائیں" : "Back to Reports";
  }
  return lang === "ur" ? "فلور ویو پر جائیں" : "Back to Floor View";
}

export function QuickAccessWorkspace() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const lang: "en" | "ur" = user?.language === "ur" ? "ur" : "en";
  const isUrdu = lang === "ur";

  // Strict permission filter: ONLY actions the user is authorized to perform
  const authorizedItems = useMemo(() => {
    return filterQuickAccessByRole(QUICK_ACCESS_ITEMS, user?.roles || []);
  }, [user?.roles]);

  // Search filter
  const displayedItems = useMemo(() => {
    return searchQuickAccessItems(authorizedItems, searchQuery);
  }, [authorizedItems, searchQuery]);

  // Group by category
  const groupedCategories = useMemo(() => {
    return groupQuickAccessByCategory(displayedItems);
  }, [displayedItems]);

  const primaryLandingPath = redirectPathForRoles(user?.roles || []);
  const roleDisplay = getRoleTitle(user?.roles || [], lang);
  const landingLabel = getLandingLabel(user?.roles || [], lang);

  return (
    <div
      className={`space-y-8 pb-16 ${
        isUrdu ? "rtl" : "ltr"
      }`}
      dir={isUrdu ? "rtl" : "ltr"}
    >
      {/* ── Top Hero / Role Header ───────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 p-6 sm:p-8 text-white shadow-xl border border-slate-700/50">
        {/* Decorative background glow */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-semibold text-brand-200">
              <Zap size={14} className="fill-amber-400 text-amber-400" />
              <span>{roleDisplay}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {isUrdu ? "فوری رسائی مرکز (کوئیک ایکسس)" : "Quick Access Hub"}
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
              {isUrdu
                ? "آپ کے مجاز کردار کیلئے تمام ضروری اور روزمرہ کے اہم کام ایک ہی جگہ پر۔ کسی بھی مینو میں ڈھونڈے بغیر براہ راست مطلوبہ صفحے پر جائیں۔"
                : "All essential daily operations authorized for your role in one simplified view. Direct 1-click navigation without searching through menus."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                <CheckCircle2 size={13} className="text-emerald-400" />
                <span>
                  {isUrdu
                    ? `${authorizedItems.length} مجاز شارٹ کٹس دستیاب ہیں`
                    : `${authorizedItems.length} authorized shortcuts available`}
                </span>
              </span>
              {user?.fullName && (
                <span className="text-slate-400">
                  {isUrdu ? `لاگ ان صارف: ${user.fullName}` : `Logged in as: ${user.fullName}`}
                </span>
              )}
            </div>
          </div>

          {/* Quick Return to Primary Workspace */}
          <div className="shrink-0">
            <Link
              href={primaryLandingPath}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs sm:text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Compass size={16} className="text-brand-600" />
              <span>{landingLabel}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search
            size={18}
            className={`absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none ${
              isUrdu ? "right-3.5" : "left-3.5"
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isUrdu
                ? "شارٹ کٹ تلاش کریں (مثلاً بلنگ، فلور ویو، ادھار، کینٹین)..."
                : "Search shortcuts (e.g., Billing, Floor, Udhaar, Canteen)..."
            }
            className={`w-full bg-white border border-slate-200/90 rounded-2xl py-3 text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 ${
              isUrdu ? "pr-10 pl-10" : "pl-10 pr-10"
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={`absolute top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors ${
                isUrdu ? "left-3" : "right-3"
              }`}
              title={isUrdu ? "تلاش ختم کریں" : "Clear search"}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 self-end sm:self-auto">
          <span>
            {isUrdu
              ? `${displayedItems.length} نتائج دکھائے جا رہے ہیں`
              : `Showing ${displayedItems.length} shortcuts`}
          </span>
        </div>
      </div>

      {/* ── Zero Results State ───────────────────────────── */}
      {displayedItems.length === 0 && (
        <div className="text-center py-16 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <Search size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {isUrdu ? "کوئی شارٹ کٹ نہیں ملا" : "No shortcuts found"}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isUrdu
              ? `"${searchQuery}" سے مطابقت رکھنے والا کوئی مجاز شارٹ کٹ نہیں ملا۔ براہ کرم دوسرا لفظ تلاش کریں۔`
              : `No authorized shortcut matched "${searchQuery}". Please try a different search keyword.`}
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-brand-600 transition-colors shadow-xs"
          >
            {isUrdu ? "تمام شارٹ کٹس دکھائیں" : "View all shortcuts"}
          </button>
        </div>
      )}

      {/* ── Grouped Categories Grid ──────────────────────── */}
      {groupedCategories.map((group) => {
        const cat = group.category;
        const catTitle = isUrdu ? cat.titleUrdu : cat.title;
        const catDesc = isUrdu ? cat.descriptionUrdu : cat.description;

        return (
          <section key={cat.key} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {catTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{catDesc}</p>
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                {group.items.length}{" "}
                {isUrdu ? "شارٹ کٹس" : group.items.length === 1 ? "Action" : "Actions"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <QuickAccessCard
                  key={item.id}
                  item={item}
                  isUrdu={isUrdu}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function QuickAccessCard({
  item,
  isUrdu,
}: {
  item: QuickAccessItem;
  isUrdu: boolean;
}) {
  const IconComponent = iconMap[item.iconName] || Zap;
  const styles = accentStyles[item.accentColor] || accentStyles.emerald;

  const title = isUrdu ? item.titleUrdu : item.title;
  const description = isUrdu ? item.descriptionUrdu : item.description;
  const badge = isUrdu ? item.badgeUrdu : item.badge;
  const ArrowIcon = isUrdu ? ArrowLeft : ArrowRight;

  return (
    <Link
      href={item.href}
      className={`group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover ${styles.borderHover} focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2`}
    >
      <div>
        {/* Card Header: Icon + Badge */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-200 shadow-xs ${styles.iconBox}`}
          >
            <IconComponent size={22} />
          </div>

          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border shadow-2xs ${styles.badge}`}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Card Content */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors tracking-tight line-clamp-1">
          {title}
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed mt-1.5 line-clamp-2">
          {description}
        </p>
      </div>

      {/* Card Footer: Action Link Affordance */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-brand-600 transition-colors">
        <span className="text-[11px] font-semibold tracking-wide">
          {isUrdu ? "صفحہ کھولیں" : "Open Operation"}
        </span>
        <div
          className={`flex items-center justify-center w-6 h-6 rounded-lg bg-slate-50 group-hover:bg-brand-50 transition-all transform ${
            isUrdu
              ? "group-hover:-translate-x-1"
              : "group-hover:translate-x-1"
          }`}
        >
          <ArrowIcon size={14} className={styles.arrow} />
        </div>
      </div>
    </Link>
  );
}

