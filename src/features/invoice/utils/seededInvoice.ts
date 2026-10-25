import type { Invoice } from "../types/invoice";

const SEED_TTL_MS = 5000;
const seeded = new Map<string, { invoice: Invoice; at: number }>();

export function seedInvoice(invoice: Invoice) {
  seeded.set(invoice.id, { invoice, at: Date.now() });
}

// Short-lived so later refreshes (after a payment) always hit the server.
export function takeSeededInvoice(id: string): Invoice | null {
  const entry = seeded.get(id);
  if (!entry) return null;
  if (Date.now() - entry.at > SEED_TTL_MS) {
    seeded.delete(id);
    return null;
  }
  return entry.invoice;
}