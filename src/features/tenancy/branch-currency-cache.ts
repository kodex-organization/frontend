const CACHE_KEY_PREFIX = "cuecloud:branch-currency:";
const NAME_CACHE_KEY_PREFIX = "cuecloud:branch-name:";

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

export function cacheBranchName(branchId: string, name: string | null | undefined) {
  if (typeof window === "undefined" || !name?.trim()) return;
  try {
    window.localStorage.setItem(`${NAME_CACHE_KEY_PREFIX}${branchId}`, name.trim());
  } catch (error) {
    console.error("Failed to cache branch name:", error);
  }
}

export function getCachedBranchName(branchId: string | null | undefined) {
  if (!branchId || typeof window === "undefined") return "Current branch";
  try {
    return window.localStorage.getItem(`${NAME_CACHE_KEY_PREFIX}${branchId}`) || "Current branch";
  } catch (error) {
    console.error("Failed to read cached branch name:", error);
    return "Current branch";
  }
}
