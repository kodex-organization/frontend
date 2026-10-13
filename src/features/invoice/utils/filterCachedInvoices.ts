import type { Invoice, InvoiceListFilters, Paginated } from "../types/invoice";

// Offline version of the server's invoice list filters (search, status, date, branch, page).
export function filterCachedInvoices(
  items: Invoice[],
  filters: InvoiceListFilters,
  activeBranchId: string | null,
): Paginated<Invoice> {
  const { search, status, from, to, branchId, page = 1, pageSize = 25 } = filters;
  const term = search?.trim().toLowerCase();
  const fromMs = from ? Date.parse(from) : null;
  const toMs = to ? Date.parse(to) : null;
  const scopeBranchId = branchId === "all" ? null : branchId || activeBranchId;

  const matches = items
    .filter((invoice) => {
      if (scopeBranchId && (invoice.branch?.id ?? invoice.branchId) !== scopeBranchId) return false;
      if (status && invoice.status !== status) return false;
      if (term && !invoice.invoiceNumber?.toLowerCase().includes(term)) return false;
      const createdMs = Date.parse(invoice.createdAt);
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      return true;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const start = (page - 1) * pageSize;
  return {
    items: matches.slice(start, start + pageSize),
    pagination: {
      page,
      pageSize,
      total: matches.length,
      totalPages: Math.max(1, Math.ceil(matches.length / pageSize)),
    },
  };
}