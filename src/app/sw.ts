// @ts-nocheck
// Required because this file runs in the webworker environment while the app uses the DOM lib.

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

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
    // Rule 2: All other requests (pages, JS, CSS, images) use Serwist's default Next.js caching strategies.
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