// @ts-nocheck
// Required because this file runs in the webworker environment while the app uses the DOM lib.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";
import {
  CACHE_NAMES,
  DONOR_PATHS,
  EIGHT_DAYS_IN_SECONDS,
  WARM_PAGES,
  buildOfflinePageResponse,
} from "./sw-offline";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * All backend/API requests use this prefix.
 * See src/lib/api/client.ts -> getApiBaseUrl().
 */
/**
 * Derived the same way as src/lib/api/client.ts -> getApiBaseUrl().
 * Both files must agree on this path; if NEXT_PUBLIC_API_URL changes,
 * both update automatically since this reads the same env var.
 */
const getApiProxyPrefix = () => {
  const configuredPath = new URL(process.env.NEXT_PUBLIC_API_URL!).pathname.replace(/\/$/, "");
  return configuredPath && configuredPath !== "/" ? configuredPath : "/api/backend";
};

const API_PROXY_PREFIX = getApiProxyPrefix();

/**
 * Runs only when a page could not be loaded from the network or the saved copy.
 * 1) /billing/<id> etc.: serve the saved placeholder page with the real id swapped in
 *    (the page loads its data from the device, so any id works).
 * 2) Otherwise show the app's own "/~offline" page instead of the browser error.
 * Everything is wrapped so that a problem here can never break normal browsing.
 */
const offlinePagePlugin = {
  async handlerDidError({ request }) {
    return buildOfflinePageResponse(new URL(request.url).pathname, {
      matchDonor: async (path) => (await caches.open(CACHE_NAMES.donors)).match(path),
      matchOfflinePage: () => serwist.matchPrecache("/~offline"),
    });
  },
};

const pageExpiration = () =>
  new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: EIGHT_DAYS_IN_SECONDS });

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [

// Rule 1 (checked first): Never intercept API/sync calls in the service worker.
// This traffic is handled by offline-db.ts and sync-manager.ts.
// NetworkOnly sends requests directly to the network without caching,
// allowing the existing queue system to handle failures and save them to IndexedDB.
    {
      matcher: ({ url }) => url.pathname.startsWith(API_PROXY_PREFIX),
      handler: new NetworkOnly(),
    },
    // Rule 2: page loads. Same "network first" behaviour as before (online is unchanged),
    // but the saved copies live in their own cache that holds 200 pages for 8 days
    // instead of Serwist's shared cache of 32 entries for 24 hours.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: CACHE_NAMES.pages,
        plugins: [pageExpiration(), offlinePagePlugin],
      }),
    },
    // Rule 3: in-app navigation data (RSC). Same idea: network first, bigger and longer cache.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.headers.get("RSC") === "1" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: CACHE_NAMES.rsc,
        plugins: [pageExpiration()],
      }),
    },
    // Rule 4: everything else (JS, CSS, images, fonts) keeps Serwist's default strategies.
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        // If a page is unavailable offline and was never cached,
        //  show our custom "~offline" page instead of Chrome's default error page.
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

/**
 * When a new service worker takes over (online), save the main screens and one
 * placeholder page per record route, so they can be opened later without internet.
 * Failures are ignored: this is a best-effort head start, never a requirement.
 */
async function savePageForOffline(cacheName: string, path: string) {
  try {
    const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
    if (response.ok && response.status === 200 && !response.redirected) {
      const cache = await caches.open(cacheName);
      await cache.put(path, response);
    }
  } catch {
    // offline or server error: skip this page
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (!self.navigator.onLine) return;
      await Promise.all([
        ...WARM_PAGES.map((path) => savePageForOffline(CACHE_NAMES.pages, path)),
        ...DONOR_PATHS.map((path) => savePageForOffline(CACHE_NAMES.donors, path)),
      ]);
    })(),
  );
});