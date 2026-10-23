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

// API prefix, must match getApiBaseUrl() in src/lib/api/client.ts.
const getApiProxyPrefix = () => {
  const configuredPath = new URL(process.env.NEXT_PUBLIC_API_URL!).pathname.replace(/\/$/, "");
  return configuredPath && configuredPath !== "/" ? configuredPath : "/api/backend";
};

const API_PROXY_PREFIX = getApiProxyPrefix();

// Offline fallback: reuse the saved placeholder page for record routes, else show "/~offline".
const offlinePagePlugin = {
  async handlerDidError({ request }) {
    return buildOfflinePageResponse(new URL(request.url).pathname, {
      matchDonor: async (path) => (await caches.open(CACHE_NAMES.donors)).match(path),
      matchOfflinePage: () => serwist.matchPrecache("/~offline"),
    });
  },
};

// Save pages without the query string so /customers?new=1&... works offline.
const ignoreSearchPlugin = {
  async cacheKeyWillBeUsed({ request }) {
    const url = new URL(request.url);
    url.search = "";
    return url.href;
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

// API and sync calls bypass the service worker; offline-db and sync-manager handle failures.
    {
      matcher: ({ url }) => url.pathname.startsWith(API_PROXY_PREFIX),
      handler: new NetworkOnly(),
    },
    // Page loads: network first, saved in a dedicated cache (200 pages, 8 days).
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.mode === "navigate" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        networkTimeoutSeconds: 3,
        cacheName: CACHE_NAMES.pages,
        plugins: [ignoreSearchPlugin, pageExpiration(), offlinePagePlugin],
      }),
    },
    // Rule 3: in-app navigation data (RSC). Same idea: network first, bigger and longer cache.
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin && request.headers.get("RSC") === "1" && !url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        networkTimeoutSeconds: 3,
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
        // Show the custom "~offline" page when an uncached page is unavailable.
        url: "/~offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

// On activation, pre-cache the main screens and record-route placeholders (best effort).
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