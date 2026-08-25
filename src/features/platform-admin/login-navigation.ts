export function getSafePlatformAdminDestination(next: string | null) {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    next !== "/super-admin/login"
  ) {
    return next;
  }
  return "/tenants";
}
