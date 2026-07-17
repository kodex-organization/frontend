"use client";

import { useEffect, useState, useCallback } from "react";
import { Receipt } from "../types/receipt";
import { receiptService } from "../services/receiptService";

export const useReceipt = (id: string) => {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReceipt = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (!id) throw new Error("Receipt ID is missing");
      const data = await receiptService.getReceipt(id);
      setReceipt(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  return { receipt, loading, error, refresh: fetchReceipt };
};