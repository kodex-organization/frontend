"use client";

import { useEffect, useState } from "react";
import { Invoice } from "../types/invoice";
import { invoiceService } from "../services/invoiceService";

export const useInvoice = (id: string) => {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        throw new Error("Invoice ID is missing");
      }

      const data = await invoiceService.getInvoice(id);

      setInvoice(data);

    } catch (err) {

      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong"
      );

    } finally {

      setLoading(false);

    }
  };


  useEffect(() => {

    fetchInvoice();

  }, [id]);


  return {
    invoice,
    loading,
    error,
    refresh: fetchInvoice,
  };
};