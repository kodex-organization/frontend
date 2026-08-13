import { useState, useEffect } from "react";
import type { InvoiceDetails, SettleInvoicePayload, ApplyDiscountPayload, VoidInvoicePayload } from "../api/invoiceApi";
import { getInvoiceDetails, settleInvoice, applyDiscount, voidInvoice as voidInvoiceApi } from "../api/invoiceApi";

interface TenderInput {
  tenderType: "cash" | "card" | "udhaar" | "bank_transfer" | "mobile_wallet" | "other";
  amount: number;
  paymentReference?: string;
}

export function useInvoiceCheckout(invoiceId: string) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tender state
  const [tenders, setTenders] = useState<TenderInput[]>([]);
  const [settlingState, setSettlingState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [settleError, setSettleError] = useState<string | null>(null);

  // Discount state
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [discountManagerPin, setDiscountManagerPin] = useState("");
  const [discountingState, setDiscountingState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [discountError, setDiscountError] = useState<string | null>(null);

  // Void state
  const [voidReason, setVoidReason] = useState("");
  const [voidManagerPin, setVoidManagerPin] = useState("");
  const [voidingState, setVoidingState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [voidError, setVoidError] = useState<string | null>(null);

  // Load invoice
  useEffect(() => {
    void loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInvoiceDetails(invoiceId);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const addTender = (tender: TenderInput) => {
    setTenders((prev) => [...prev, tender]);
  };

  const removeTender = (index: number) => {
    setTenders((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTender = (index: number, tender: Partial<TenderInput>) => {
    setTenders((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...tender } : t))
    );
  };

  const calculateTotalTenders = () => {
    return tenders.reduce((sum, t) => sum + t.amount, 0);
  };

  const getRemainingBalance = () => {
    if (!invoice) return 0;
    return Math.max(0, invoice.total - calculateTotalTenders());
  };

  const canSettle = () => {
    return invoice && Math.abs(getRemainingBalance()) < 0.01 && tenders.length > 0;
  };

  const performSettle = async (customerCnic?: string, managerPin?: string) => {
    if (!invoice) return false;

    setSettlingState("loading");
    setSettleError(null);

    try {
      const payload: SettleInvoicePayload = {
        tenders,
        customerCnic,
        managerPin,
      };

      await settleInvoice(invoiceId, payload);
      setSettlingState("success");
      await loadInvoice();
      setTenders([]);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to settle invoice";
      setSettleError(errorMessage);
      setSettlingState("error");
      return false;
    }
  };

  const performDiscount = async (amount: number, reason: string, managerPin?: string) => {
    if (!invoice) return false;

    setDiscountingState("loading");
    setDiscountError(null);

    try {
      const payload: ApplyDiscountPayload = {
        discountAmount: amount,
        discountReasonCode: reason,
        managerPin,
      };

      await applyDiscount(invoiceId, payload);
      setDiscountingState("success");
      await loadInvoice();
      setDiscountAmount(0);
      setDiscountReason("");
      setDiscountManagerPin("");
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to apply discount";
      setDiscountError(errorMessage);
      setDiscountingState("error");
      return false;
    }
  };

  const performVoid = async (reason: string, managerPin?: string) => {
    if (!invoice) return false;

    setVoidingState("loading");
    setVoidError(null);

    try {
      const payload: VoidInvoicePayload = {
        reason,
        managerPin,
      };

      await voidInvoiceApi(invoiceId, payload);
      setVoidingState("success");
      await loadInvoice();
      setVoidReason("");
      setVoidManagerPin("");
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to void invoice";
      setVoidError(errorMessage);
      setVoidingState("error");
      return false;
    }
  };

  return {
    // Invoice state
    invoice,
    loading,
    error,
    loadInvoice,

    // Tenders
    tenders,
    addTender,
    removeTender,
    updateTender,
    calculateTotalTenders,
    getRemainingBalance,
    canSettle,

    // Settlement
    settlingState,
    settleError,
    performSettle,

    // Discount
    discountAmount,
    setDiscountAmount,
    discountReason,
    setDiscountReason,
    discountManagerPin,
    setDiscountManagerPin,
    discountingState,
    discountError,
    performDiscount,

    // Void
    voidReason,
    setVoidReason,
    voidManagerPin,
    setVoidManagerPin,
    voidingState,
    voidError,
    performVoid,
  };
}
