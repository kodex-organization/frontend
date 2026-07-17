"use client";

import { useEffect, useState } from "react";
import { Invoice } from "../types/invoice";
import { invoiceService } from "../services/invoiceService";

export const useInvoices = (date?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      let data = await invoiceService.getInvoices();

      if (date) {
        data = data.filter((invoice) => {
          const invoiceDate = new Date(
            invoice.createdAt
          ).toDateString();

          const selectedDate = new Date(
            date
          ).toDateString();

          return invoiceDate === selectedDate;
        });
      }

      setInvoices(data);
    } catch (err: any) {
      console.error("Invoice Fetch Error:", err);

      if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Response:", err.response.data);

        setError(
          err.response.data?.message ||
            `Request failed (${err.response.status})`
        );
      } else if (err.request) {
        console.error("No response received:", err.request);

        setError(
          "Unable to connect to the backend server."
        );
      } else {
        console.error(err.message);

        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [date]);

  return {
    invoices,
    loading,
    error,
    refresh: fetchInvoices,
  };
};