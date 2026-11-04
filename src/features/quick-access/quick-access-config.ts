import type { UserRole } from "@/lib/auth/session";
import type {
  QuickAccessCategory,
  QuickAccessCategoryMeta,
  QuickAccessItem,
} from "./types";

export const QUICK_ACCESS_CATEGORIES: Record<QuickAccessCategory, QuickAccessCategoryMeta> = {
  operations: {
    key: "operations",
    title: "Floor & Table Operations",
    titleUrdu: "فلور اور ٹیبل آپریشنز",
    description: "Live tables, game clocks, and customer counter operations",
    descriptionUrdu: "میزوں کی موجودہ حالت اور لائیو کاؤنٹر سرگرمیاں",
  },
  pos_canteen: {
    key: "pos_canteen",
    title: "Point of Sale & Canteen",
    titleUrdu: "بلنگ اور کینٹین پی او ایس",
    description: "Invoicing, payment collection, and food orders",
    descriptionUrdu: "بلنگ، کیش وصولی اور کینٹین کی فروخت",
  },
  financials: {
    key: "financials",
    title: "Accounts, Khata & Auditing",
    titleUrdu: "کھاتہ، مالیات اور آڈٹ",
    description: "Udhaar recovery, financial reports, and activity logs",
    descriptionUrdu: "ادھار وصولی، مالیاتی گوشوارے اور آڈٹ لاگز",
  },
  management: {
    key: "management",
    title: "Club Management & Staff",
    titleUrdu: "کلب مینجمنٹ اور اسٹاف",
    description: "Executive dashboards, pricing configuration, and team access",
    descriptionUrdu: "ڈیش بورڈ، ریٹ لسٹ اور ملازمین کے اکاؤنٹس",
  },
  system: {
    key: "system",
    title: "System, Security & Sync",
    titleUrdu: "سسٹم، سیکیورٹی اور سنک",
    description: "Multi-branch setups, terminal security, and offline health",
    descriptionUrdu: "برانچ کنٹرولز، ڈیوائس سیکیورٹی اور آف لائن تصدیق",
  },
};

export const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  // ── Operations ──────────────────────────────────────────────
  {
    id: "floor-view",
    title: "Live Floor View",
    titleUrdu: "لائیو فلور ویو",
    description: "Real-time snooker table status, occupied tables, and active match timers",
    descriptionUrdu: "میزوں کی موجودہ صورتحال، لائیو میچز اور اوور ٹائم الرٹس کا جائزہ",
    href: "/floor-view",
    iconName: "MonitorSmartphone",
    category: "operations",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
    badge: "Live Status",
    badgeUrdu: "لائیو",
  },
  {
    id: "sessions",
    title: "Table Sessions & Timers",
    titleUrdu: "سیشنز اور ٹائمرز",
    description: "Start new match clocks, pause, switch tables, or stop gameplay",
    descriptionUrdu: "نئے میچ کا ٹائمر شروع کریں، روکیں یا ٹیبل تبدیل کریں",
    href: "/sessions",
    iconName: "Timer",
    category: "operations",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
    badge: "Counter",
    badgeUrdu: "کاؤنٹر",
  },
  {
    id: "customers",
    title: "Customer Directory",
    titleUrdu: "صارفین اور ممبرز",
    description: "Lookup player phone numbers, membership history, and register new players",
    descriptionUrdu: "کھلاڑیوں کا رابطہ نمبر، ممبرشپ اور نئی رجسٹریشن تلاش کریں",
    href: "/customers",
    iconName: "Users",
    category: "operations",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },

  // ── POS & Canteen ───────────────────────────────────────────
  {
    id: "billing",
    title: "Billing & POS Checkout",
    titleUrdu: "بلنگ اور کیش کاؤنٹر",
    description: "Generate invoices, calculate table time charges, and print receipts",
    descriptionUrdu: "میچ کا حتمی بل بنائیں، کیش وصول کریں اور رسید جاری کریں",
    href: "/billing",
    iconName: "Receipt",
    category: "pos_canteen",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"],
    badge: "POS",
    badgeUrdu: "پی او ایس",
  },
  {
    id: "canteen",
    title: "Canteen & Concessions POS",
    titleUrdu: "کینٹین اور مشروبات",
    description: "Quick food & drink orders charged directly to table bills or cash",
    descriptionUrdu: "چائے، کولڈ ڈرنکس اور اسنیکس کا آرڈر براہ راست ٹیبل بل میں شامل کریں",
    href: "/canteen",
    iconName: "UtensilsCrossed",
    category: "pos_canteen",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
    badge: "Quick Sale",
    badgeUrdu: "فوری فروخت",
  },

  // ── Financials & Khata ──────────────────────────────────────
  {
    id: "udhaar",
    title: "Udhaar & Khata Ledger",
    titleUrdu: "ادھار کھاتہ لیجر",
    description: "Track customer credit balances, collect due payments, and check aging",
    descriptionUrdu: "صارفین کے واجب الادا ادھار کی وصولی اور کھاتہ سمری چیک کریں",
    href: "/udhaar",
    iconName: "BookOpen",
    category: "financials",
    allowedRoles: ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"],
    badge: "Khata",
    badgeUrdu: "کھاتہ",
  },
  {
    id: "reporting",
    title: "Operational & Sales Reports",
    titleUrdu: "آپریشنل و سیلز رپورٹس",
    description: "Shift financial summaries, itemized sales, and revenue breakdown",
    descriptionUrdu: "شفٹ کی آمدنی، کیش سمری اور سیشنز کی تفصیلی رپورٹ",
    href: "/reporting",
    iconName: "LineChart",
    category: "financials",
    allowedRoles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    badge: "Reports",
    badgeUrdu: "رپورٹس",
  },
  {
    id: "audit",
    title: "Audit Logs & Security Scan",
    titleUrdu: "آڈٹ لاگز اور سیکیورٹی",
    description: "Track discount logs, rate overrides, cashier activities, and anomaly alerts",
    descriptionUrdu: "اسٹاف کی تبدیلیاں، ڈسکاؤنٹس اور سیکیورٹی لاگز کا معائنہ کریں",
    href: "/audit",
    iconName: "ClipboardList",
    category: "financials",
    allowedRoles: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },

  // ── Management & Staff ──────────────────────────────────────
  {
    id: "dashboard",
    title: "Operations Dashboard",
    titleUrdu: "ڈیش بورڈ جائزہ",
    description: "Daily club revenue summary, table occupancy rate, and peak analytics",
    descriptionUrdu: "روزانہ کی کل آمدنی، رش کا تناسب اور آپریشنل سمری",
    href: "/dashboard",
    iconName: "LayoutDashboard",
    category: "management",
    allowedRoles: ["OWNER", "MANAGER"],
    badge: "Management",
    badgeUrdu: "مینجمنٹ",
  },
  {
    id: "governance",
    title: "Approvals & Governance",
    titleUrdu: "منظوری اور گورننس",
    description: "Submit or approve session cancellations, rate overrides, and shift handovers",
    descriptionUrdu: "سیشن منسوخی کی درخواست، ریٹ ڈسکاؤنٹ اور شفٹ ہینڈ اوور کی تصدیق",
    href: "/governance",
    iconName: "Scale",
    category: "management",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER"],
  },
  {
    id: "catalog",
    title: "Tables & Rate Plans",
    titleUrdu: "ٹیبلز اور فی گھنٹہ ریٹس",
    description: "Configure snooker tables, modify hourly rates, and standard pricing rules",
    descriptionUrdu: "سنوکر ٹیبلز شامل کریں اور فی گھنٹہ کھیلنے کے نرخ مقرر کریں",
    href: "/catalog",
    iconName: "Armchair",
    category: "management",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    id: "staff-settings",
    title: "Staff Accounts & PINs",
    titleUrdu: "اسٹاف اور کاؤنٹر پن",
    description: "Manage cashier login PINs, staff roles, and counter permissions",
    descriptionUrdu: "کاؤنٹر کیشیئر کے لاگ ان پن اور کردار و اجازتیں تبدیل کریں",
    href: "/settings/staff",
    iconName: "Settings",
    category: "management",
    allowedRoles: ["OWNER", "MANAGER"],
  },
  {
    id: "cross-branch-reports",
    title: "Cross-Branch Analytics",
    titleUrdu: "کراس برانچ تجزیات",
    description: "Consolidated multi-club revenue comparisons and comparative branch metrics",
    descriptionUrdu: "تمام برانچز کی مجموعی آمدنی اور تقابلی جائزہ رپورٹس",
    href: "/reports",
    iconName: "BarChart3",
    category: "management",
    allowedRoles: ["OWNER"],
    badge: "Owner Only",
    badgeUrdu: "مالک کیلئے",
  },

  // ── System & Security ───────────────────────────────────────
  {
    id: "sync-status",
    title: "Offline Sync Status",
    titleUrdu: "آف لائن سنک اسٹیٹس",
    description: "Verify local database queue, offline sales, and cloud sync status",
    descriptionUrdu: "مقامی ڈیٹا بیس کی حالت اور کلاؤڈ سنک کی تصدیق کریں",
    href: "/sync-status",
    iconName: "RefreshCw",
    category: "system",
    allowedRoles: ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"],
    badge: "Sync",
    badgeUrdu: "سنک",
  },
  {
    id: "branch-controls",
    title: "Branch Locations & Setup",
    titleUrdu: "برانچ سیٹ اپ اور کنٹرول",
    description: "Manage club branches, opening hours, local taxes, and branch profiles",
    descriptionUrdu: "نئی برانچ شامل کریں اور اوقات کار و ٹیکس رولز منظم کریں",
    href: "/branches",
    iconName: "Settings2",
    category: "system",
    allowedRoles: ["OWNER"],
    badge: "Owner Only",
    badgeUrdu: "مالک کیلئے",
  },
  {
    id: "peak-hours",
    title: "Peak Hours & Multipliers",
    titleUrdu: "پیک اوقات اور اضافی ریٹس",
    description: "Automate peak pricing windows, evening rush, and weekend surcharges",
    descriptionUrdu: "رش کے اوقات اور ویک اینڈ کے خصوصی ریٹس لاگو کریں",
    href: "/settings/peak-hours",
    iconName: "Clock",
    category: "system",
    allowedRoles: ["OWNER"],
    badge: "Owner Only",
    badgeUrdu: "مالک کیلئے",
  },
  {
    id: "security-settings",
    title: "Device & Terminal Security",
    titleUrdu: "ڈیوائس اور ٹرمینل سیکیورٹی",
    description: "Authorize counter POS hardware, trusted devices, and active device sessions",
    descriptionUrdu: "کاؤنٹر پی او ایس کمپیوٹرز اور مجاز لاگ ان ڈیوائسز کا نظم کریں",
    href: "/settings/security",
    iconName: "ShieldCheck",
    category: "system",
    allowedRoles: ["OWNER"],
    badge: "Owner Only",
    badgeUrdu: "مالک کیلئے",
  },
  {
    id: "data-export",
    title: "Data Export & Backup",
    titleUrdu: "ڈیٹا بیک اپ اور ایکسپورٹ",
    description: "Download complete customer records, financial ledgers, and raw reports",
    descriptionUrdu: "کھاتہ جات اور کسٹمرز کا محفوظ بیک اپ فائل میں حاصل کریں",
    href: "/settings/data-export",
    iconName: "DownloadCloud",
    category: "system",
    allowedRoles: ["OWNER"],
    badge: "Owner Only",
    badgeUrdu: "مالک کیلئے",
  },
];

/**
 * Filter quick access items strictly by user roles.
 * Never displays unauthorized items.
 */
export function filterQuickAccessByRole(
  items: QuickAccessItem[],
  userRoles: UserRole[] = []
): QuickAccessItem[] {
  if (!userRoles || userRoles.length === 0) return [];
  const normalizedRoles = userRoles.map((r) => String(r).toUpperCase() as UserRole);

  return items.filter((item) =>
    item.allowedRoles.some((role) => normalizedRoles.includes(role))
  );
}

/**
 * Group authorized items by their categories, omitting categories with 0 items.
 */
export function groupQuickAccessByCategory(
  items: QuickAccessItem[]
): { category: QuickAccessCategoryMeta; items: QuickAccessItem[] }[] {
  const categoryOrder: QuickAccessCategory[] = [
    "operations",
    "pos_canteen",
    "financials",
    "management",
    "system",
  ];

  return categoryOrder
    .map((catKey) => {
      const catMeta = QUICK_ACCESS_CATEGORIES[catKey];
      const catItems = items.filter((item) => item.category === catKey);
      return {
        category: catMeta,
        items: catItems,
      };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * Filter items by search query across English and Urdu titles/descriptions.
 */
export function searchQuickAccessItems(
  items: QuickAccessItem[],
  query: string
): QuickAccessItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;

  return items.filter((item) => {
    return (
      item.title.toLowerCase().includes(q) ||
      item.titleUrdu.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.descriptionUrdu.toLowerCase().includes(q) ||
      (item.badge && item.badge.toLowerCase().includes(q)) ||
      (item.badgeUrdu && item.badgeUrdu.toLowerCase().includes(q))
    );
  });
}
