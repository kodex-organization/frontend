"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useInvoice } from "../hooks/useInvoice";

import StatusBadge from "./StatusBadge";
import InvoiceItems from "./InvoiceItems";
import InvoicePayments from "./InvoicePayments";
import PaymentSection from "./PaymentSection";
import VoidInvoiceModal from "./VoidInvoiceModal";
import TransactionHistory from "./TransactionHistory";
import RecordPaymentModal from "./RecordPaymentModal";

interface Props {
  invoiceId: string;
}

export default function InvoiceDetails({
  invoiceId,
}: Props) {
  const router = useRouter();

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const {
    invoice,
    loading,
    error,
  } = useInvoice(invoiceId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading invoice...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-6 text-red-600">
        {error || "Invoice not found"}
      </div>
    );
  }

  const paidAmount = invoice.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );

  const total = Number(invoice.total);

  const balance =
    invoice.status === "void"
      ? 0
      : total - paidAmount;

  const isVoided = invoice.status === "void";

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* HEADER */}

      <div className="mb-8">

        <button
          onClick={() => router.push("/billing")}
          className="mb-5 flex items-center gap-2 font-medium text-gray-600 hover:text-green-700"
        >
          <span className="text-xl">←</span>
          Back to Billing
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

          <div>

            <h1 className="text-3xl font-bold text-gray-800">
              Invoice Details
            </h1>

            <p className="mt-1 text-gray-500">
              Invoice #{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
            </p>

          </div>

          {!isVoided && (

            <button
              onClick={() => setShowVoidModal(true)}
              className="rounded-xl border border-red-400 px-5 py-2.5 font-medium text-red-600 hover:bg-red-50"
            >
              Void Invoice
            </button>

          )}

        </div>

      </div>

      {/* STATUS */}

      <div className="mb-6 flex items-center justify-between rounded-2xl border border-green-100 bg-white p-6 shadow-sm">

        <div>

          <p className="mb-2 text-sm text-gray-500">
            Payment Status
          </p>

          <StatusBadge
            status={invoice.status}
          />

        </div>

        <div className="text-right">

          <p className="text-sm text-gray-500">
            Invoice State
          </p>

          <p className="mt-1 font-semibold text-gray-700 capitalize">
            {invoice.status}
          </p>

        </div>

      </div>

      {/* VOID WARNING */}

      {isVoided && (

        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">

          <p className="font-semibold text-red-700">
            This invoice has been voided.
          </p>

          <p className="mt-1 text-sm text-red-600">
            Payments cannot be recorded and this invoice cannot be modified.
          </p>

        </div>

      )}

      {/* INFO */}

      <div className="mb-6 grid gap-6 md:grid-cols-2">

        <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-xl font-semibold text-gray-800">
            Branch Information
          </h2>

          <div className="space-y-3">

            <p>
              <span className="text-gray-500">
                Branch ID:
              </span>{" "}
              <strong>{invoice.branchId}</strong>
            </p>

            <p>
              <span className="text-gray-500">
                Invoice Number:
              </span>{" "}
              <strong>
                {invoice.invoiceNumber ?? "-"}
              </strong>
            </p>

            <p>
              <span className="text-gray-500">
                Session ID:
              </span>{" "}
              <strong>
                {invoice.sessionId ?? "-"}
              </strong>
            </p>

          </div>

        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-6 shadow-sm">

          <h2 className="mb-5 text-xl font-semibold text-gray-800">
            Invoice Summary
          </h2>

          <div className="space-y-3">

            <p>
              <span className="text-gray-500">
                Created:
              </span>{" "}
              <strong>
                {new Date(invoice.createdAt).toLocaleDateString()}
              </strong>
            </p>

            <p>
              <span className="text-gray-500">
                Total:
              </span>{" "}
              <strong>
                Rs. {total.toLocaleString()}
              </strong>
            </p>

            <p>
              <span className="text-gray-500">
                Paid:
              </span>{" "}
              <strong className="text-green-600">
                Rs. {paidAmount.toLocaleString()}
              </strong>
            </p>

            <p>
              <span className="text-gray-500">
                Balance:
              </span>{" "}
              <strong className="text-red-500">
                Rs. {balance.toLocaleString()}
              </strong>
            </p>

          </div>

        </div>

      </div>

      <InvoiceItems items={invoice.items} />

      <InvoicePayments payments={invoice.payments} />

      {!isVoided && (

        <PaymentSection
          total={total}
          paid={paidAmount}
          onPayment={() => setShowPaymentModal(true)}
        />

      )}

      <TransactionHistory
        payments={invoice.payments}
      />

      {showPaymentModal && (

        <RecordPaymentModal
          invoiceId={invoice.id}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => window.location.reload()}
        />

      )}

      {showVoidModal && (

        <VoidInvoiceModal
          invoiceId={invoice.id}
          onClose={() => setShowVoidModal(false)}
          onSuccess={() => window.location.reload()}
        />

      )}

    </div>
  );
}