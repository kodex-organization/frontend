import { offlineDB, getActiveOfflineBranchId } from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import type { Invoice, InvoicePayment, TenderType } from "@/features/invoice/types/invoice";

export type SplitTender = { tenderType: TenderType; amount: number };

/** The sync queue stores wallet payments as "online"; the server maps both to mobile_wallet. */
function queueMethod(tenderType: TenderType): "cash" | "card" | "udhaar" | "online" {
  if (tenderType === "card") return "card";
  if (tenderType === "udhaar") return "udhaar";
  if (tenderType === "mobile_wallet") return "online";
  return "cash";
}
export async function recordSplitPaymentOffline(invoiceId: string, tenders: SplitTender[]) {
  if (tenders.length === 0) throw new Error("Add at least one tender value to continue.");

  const cachedInvoice = await offlineDB.cachedInvoices.get(invoiceId);
  if (!cachedInvoice?.data) {
    throw new Error("This invoice is not saved on this device yet. Open it once while online.");
  }
  const invoice = cachedInvoice.data as Invoice;

  const usesUdhaar = tenders.some((tender) => tender.tenderType === "udhaar");
  const customerId = invoice.customerId ?? invoice.customer?.id ?? null;
  if (usesUdhaar && !customerId) {
    throw new Error("A customer must be linked to the invoice to use Udhaar.");
  }
  if (usesUdhaar && invoice.customer?.isBlocked) {
    throw new Error("Blocked customers cannot receive credit (udhaar).");
  }

  const accessContext = tokenStorage.getAccessContext();
  const branchId =
    accessContext?.branchId || invoice.branchId || getActiveOfflineBranchId() || "default";
  const createdAt = new Date().toISOString();
  const settledNow = tenders.reduce((sum, tender) => sum + Number(tender.amount), 0);

  const rows = tenders.map((tender) => ({
    paymentId: crypto.randomUUID(),
    tender,
  }));

  await offlineDB.transaction("rw", offlineDB.pendingQueue, offlineDB.cachedInvoices, async () => {
    await offlineDB.pendingQueue.bulkAdd(
      rows.map(({ paymentId, tender }) => ({
        branchId,
        entity: "payment" as const,
        entityId: paymentId,
        action: "create" as const,
        payload: {
          id: paymentId,
          branchId,
          invoiceId,
          customerId: customerId,
          amount: String(tender.amount),
          paymentMethod: queueMethod(tender.tenderType),
          reference: null,
          receivedById: accessContext?.userId ?? null,
          createdAt,
        },
        status: "pending" as const,
        idempotencyKey: crypto.randomUUID(),
        originTimestamp: createdAt,
        retryCount: 0,
        lastError: null,
      })),
    );

    // The split screen only allows a submit when the tenders settle the whole invoice.
    const newPaid = Number(invoice.paidAmount ?? 0) + settledNow;
    const savedPayments: InvoicePayment[] = rows.map(({ paymentId, tender }) => ({
      id: paymentId,
      payerLabel: null,
      tenderType: tender.tenderType,
      amount: Number(tender.amount),
      paymentReference: null,
      customerId: tender.tenderType === "udhaar" ? customerId : null,
      createdAt,
    }));
    await offlineDB.cachedInvoices.put({
      ...cachedInvoice,
      data: {
        ...invoice,
        paidAmount: newPaid,
        remainingAmount: 0,
        status: "paid" as const,
        payments: [...(invoice.payments ?? []), ...savedPayments],
      },
    });
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cuecloud:offline-queue-changed"));
    for (const { paymentId } of rows) {
      window.dispatchEvent(
        new CustomEvent("cuecloud:payment-recorded", { detail: { invoiceId, paymentId } }),
      );
    }
  }

  return { invoiceId, paymentIds: rows.map((row) => row.paymentId), amount: settledNow };
}