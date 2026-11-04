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
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  QUICK_ACCESS_ITEMS,
  filterQuickAccessByRole,
  groupQuickAccessByCategory,
  searchQuickAccessItems,
} from "../quick-access-config";
import type { QuickAccessItem } from "../types";

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

  return (
    <div
      className={`space-y-6 pb-16 ${
        isUrdu ? "rtl" : "ltr"
      }`}
      dir={isUrdu ? "rtl" : "ltr"}
    >
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
            className={`w-full bg-white border border-slate-200/90 rounded-2xl py-3 text-sm text-slate-900 placeholder-slate-400 shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-slate-400/20 focus:border-slate-400 ${
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
          <Search size={28} className="text-slate-400 mx-auto mb-3" />
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
            className="mt-4 px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-black transition-colors shadow-xs"
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

  const title = isUrdu ? item.titleUrdu : item.title;
  const description = isUrdu ? item.descriptionUrdu : item.description;
  const badge = isUrdu ? item.badgeUrdu : item.badge;
  const ArrowIcon = isUrdu ? ArrowLeft : ArrowRight;

  return (
    <Link
      href={item.href}
      className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
    >
      <div>
        {/* Card Header: Icon + Badge */}
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <IconComponent size={24} className="text-slate-900 shrink-0 stroke-[2]" />

          {badge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200 bg-slate-100 text-slate-800 shadow-2xs">
              {badge}
            </span>
          )}
        </div>

        {/* Card Content */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-black transition-colors tracking-tight line-clamp-1">
          {title}
        </h3>

        <p className="text-xs text-slate-500 leading-relaxed mt-1.5 line-clamp-2">
          {description}
        </p>
      </div>

      {/* Card Footer: Action Link Affordance */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-black transition-colors">
        <span className="text-[11px] font-semibold tracking-wide">
          {isUrdu ? "صفحہ کھولیں" : "Open Operation"}
        </span>
        <ArrowIcon
          size={16}
          className={`text-slate-700 group-hover:text-black transition-transform ${
            isUrdu ? "group-hover:-translate-x-1" : "group-hover:translate-x-1"
          }`}
        />
      </div>
    </Link>
  );
}
