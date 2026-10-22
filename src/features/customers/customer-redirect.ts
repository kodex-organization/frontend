// Sends the user to the new customer form and brings them back with ?customerId=
export function customerFormUrl(returnTo: string) {
  return `/customers?new=1&returnTo=${encodeURIComponent(returnTo)}`;
}

// Only in-app paths are allowed so the redirect cannot leave the site
export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function withCustomerId(returnTo: string, customerId: string) {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}customerId=${encodeURIComponent(customerId)}`;
}