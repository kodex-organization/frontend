"use client";

import { useState } from "react";
import { receiptService } from "../services/receiptService";

export const usePrintReceipt = () => {
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const print = async (id: string) => {
    try {
      setPrinting(true);
      setError(null);
      const result = await receiptService.printReceipt(id);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Print failed");
      throw err;
    } finally {
      setPrinting(false);
    }
  };

  return { print, printing, error };
};