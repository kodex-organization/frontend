"use client";

import { useState } from "react";
import { submitSplitPayment, type SplitPaymentRequest } from "../api/splitPayment";

export function useSplitPayment(invoiceId: string, totalAmount: number) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "empty">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (
    tenders: SplitPaymentRequest["tenders"],
    options?: {
      customerId?: string;
      customerCnic?: string;
      managerPin?: string;
    }
  ) => {
    setStatus("loading");
    setMessage(null);

    if (!tenders || tenders.length === 0) {
      setStatus("empty");
      setMessage("Add at least one tender value to continue.");
      return;
    }

    try {
      await submitSplitPayment({
        invoiceId,
        totalAmount,
        tenders,
        customerId: options?.customerId,
        customerCnic: options?.customerCnic,
        managerPin: options?.managerPin,
      } as any);
      setStatus("success");
      setMessage("Split payment submitted successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit split payment.");
      throw error;
    }
  };

  return { status, message, submit };
}