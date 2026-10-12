export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A placeholder id. Every real id is also 36 characters, so swapping is length-safe. */
export const DONOR_ID = "00000000-0000-0000-0000-000000000000";

export const DYNAMIC_ROUTE_PREFIXES = ["/billing/", "/customers/", "/receipts/", "/invoices/"];

/** Main screens saved on the device so they open without internet (SRS 3.13). */
export const WARM_PAGES = [
  "/login",
  "/floor-view",
  "/sessions",
  "/billing",
  "/canteen",
  "/catalog",
  "/customers",
  "/udhaar",
  "/dashboard",
  "/notifications",
  "/sync-status",
  "/reporting",
  "/reports",
  "/audit",
  "/governance",
  "/branches",
  "/settings/staff",
  "/settings/peak-hours",
  "/settings/security",
  "/settings/data-export",
  "/settings/support-access",
];

export function donorPathFor(prefix: string): string {
  return `${prefix}${DONOR_ID}`;
}

export const DONOR_PATHS = DYNAMIC_ROUTE_PREFIXES.map(donorPathFor);

/** "/billing/<uuid>" -> { prefix: "/billing/", id: "<uuid>" }, anything else -> null. */
export function matchDynamicRoute(pathname: string): { prefix: string; id: string } | null {
  for (const prefix of DYNAMIC_ROUTE_PREFIXES) {
    if (!pathname.startsWith(prefix)) continue;
    const id = pathname.slice(prefix.length).replace(/\/$/, "");
    if (UUID_PATTERN.test(id) && id !== DONOR_ID) return { prefix, id };
  }
  return null;
}

/** Replaces the placeholder id inside a saved page with the real id. */
export function swapRouteId(body: string, id: string): string {
  if (!UUID_PATTERN.test(id)) return body;
  return body.split(DONOR_ID).join(id);
}

export const CACHE_NAMES = {
  pages: "cc-pages",
  donors: "cc-donors",
  rsc: "cc-rsc",
} as const;

/** SRS 2.5: the app must stay usable for at least seven days without internet. */
export const EIGHT_DAYS_IN_SECONDS = 8 * 24 * 60 * 60;

/**
 * Decides what to show when a page cannot be loaded from the network or the
 * saved copy: the placeholder page with the real record id swapped in, or the
 * app's own offline page. Never throws, so it can never break browsing.
 */
export async function buildOfflinePageResponse(
  pathname: string,
  deps: {
    matchDonor: (donorPath: string) => Promise<{ text(): Promise<string> } | undefined>;
    matchOfflinePage: () => Promise<Response | undefined>;
  },
): Promise<Response | undefined> {
  try {
    const route = matchDynamicRoute(pathname);
    if (route) {
      const donor = await deps.matchDonor(donorPathFor(route.prefix));
      if (donor) {
        const html = await donor.text();
        return new Response(swapRouteId(html, route.id), {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }
    }
  } catch {
    // fall through to the offline page
  }
  try {
    return await deps.matchOfflinePage();
  } catch {
    return undefined;
  }
}