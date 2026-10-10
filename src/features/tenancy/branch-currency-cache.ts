const CACHE_KEY_PREFIX = "cuecloud:branch-currency:";

export function cacheBranchCurrency(branchId: string, currency: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CACHE_KEY_PREFIX}${branchId}`, currency);
  } catch (error) {
    console.error("Failed to cache branch currency:", error);
  }
}

export function getCachedBranchCurrency(branchId: string | null | undefined) {
  if (!branchId || typeof window === "undefined") return "PKR";
  try {
    return window.localStorage.getItem(`${CACHE_KEY_PREFIX}${branchId}`) || "PKR";
  } catch (error) {
    console.error("Failed to read cached branch currency:", error);
    return "PKR";
  }
}
