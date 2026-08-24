export type PlatformAdminRouteDecision =
  | { status: "loading" }
  | { status: "allow" }
  | { status: "redirect"; destination: string };

export function getPlatformAdminRouteDecision(
  isLoading: boolean,
  isAuthenticated: boolean,
  pathname: string,
): PlatformAdminRouteDecision {
  if (isLoading) return { status: "loading" };
  if (isAuthenticated) return { status: "allow" };
  const next = pathname.startsWith("/") ? pathname : "/tenants";
  return {
    status: "redirect",
    destination: `/super-admin/login?next=${encodeURIComponent(next)}`,
  };
}
