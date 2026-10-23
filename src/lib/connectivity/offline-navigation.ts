import { getConnectionStatus } from "./online-status";

type AppRouter = { push: (url: string) => void; replace: (url: string) => void };

let hardNavigating = false;

// Anything not confirmed online (offline or still checking) must not rely on client navigation.
export function isNavigationOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine || getConnectionStatus() !== "online";
}

// Full page load with a thin progress bar; repeated clicks are ignored until it finishes.
export function hardNavigate(url: string) {
  if (hardNavigating) return;
  hardNavigating = true;

  const bar = document.createElement("div");
  bar.style.cssText =
    "position:fixed;top:0;left:0;height:3px;width:0;background:#4f46e5;z-index:2147483647;transition:width 6s ease-out";
  document.body.appendChild(bar);
  requestAnimationFrame(() => {
    bar.style.width = "90%";
  });

  // If the page did not unload, allow another try.
  window.setTimeout(() => {
    hardNavigating = false;
    bar.remove();
  }, 8000);

  window.location.assign(url);
}

// Offline: full load from the saved pages. Online: normal client navigation.
export function navigateTo(router: AppRouter, url: string) {
  if (isNavigationOffline()) hardNavigate(url);
  else router.push(url);
}

// Offline: only clean the address bar, so the open dialog is not reloaded away.
export function cleanUrl(router: AppRouter, url: string) {
  if (isNavigationOffline()) window.history.replaceState(window.history.state, "", url);
  else router.replace(url);
}