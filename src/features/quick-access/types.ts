import type { UserRole } from "@/lib/auth/session";

export type QuickAccessCategory =
  | "operations"
  | "pos_canteen"
  | "financials"
  | "management"
  | "system";

export type AccentColor =
  | "emerald"
  | "indigo"
  | "amber"
  | "violet"
  | "rose"
  | "cyan"
  | "blue"
  | "slate";

export interface QuickAccessItem {
  id: string;
  title: string;
  titleUrdu: string;
  description: string;
  descriptionUrdu: string;
  href: string;
  iconName: string;
  category: QuickAccessCategory;
  allowedRoles: UserRole[];
  badge?: string;
  badgeUrdu?: string;
  accentColor: AccentColor;
}

export interface QuickAccessCategoryMeta {
  key: QuickAccessCategory;
  title: string;
  titleUrdu: string;
  description: string;
  descriptionUrdu: string;
}

