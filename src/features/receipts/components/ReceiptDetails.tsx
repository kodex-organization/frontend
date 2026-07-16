"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useReceipt } from "../hooks/useReceipt";
import { usePrintReceipt } from "../hooks/usePrintReceipt";

import ReceiptPreview from "./ReceiptPreview";
import PrintConfirmModal from "./PrintConfirmModal";
import CashDrawerIndicator from "./CashDrawerIndicator";

interface Props {
  receiptId: string;
}

export default function ReceiptDetails({ receiptId }: Props) {
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [lastPaymentMethod, setLastPaymentMethod] = useState("unknown");

  const { receipt, loading, error, refresh } = useReceipt(receiptId);
  const { print, printing, error: printError } = usePrintReceipt();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">
        Loading receipt...
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="p-6 text-red-600">
        {error || "Receipt not found"}
      </div>
    );
  }

  const isReprint = !!receipt.printedAt;

  const handleConfirmPrint = async () => {
    try {
      const result = await print(receipt.id);
      setLastPaymentMethod(result.paymentMethod ?? "unknown");
      setDrawerOpened(result.paymentMethod === "cash");
      setShowModal(false);
      await refresh();
    } catch {
      // error is already captured in usePrintReceipt's error state
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="mb-5 flex items-center gap-2 font-medium text-gray-600 transition hover:text-green-700"
        >
          <span className="text-xl">←</span>
          Back
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Receipt Details
            </h1>
            <p className="mt-1 text-gray-500">Receipt #{receipt.id}</p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white transition hover:bg-green-700"
          >
            {isReprint ? "Reprint Receipt" : "Print Receipt"}
          </button>
        </div>
      </div>

      {printError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600">
          {printError}
        </div>
      )}

      <div className="mb-6">
        <ReceiptPreview receipt={receipt} />
      </div>

      <CashDrawerIndicator
        paymentMethod={lastPaymentMethod}
        drawerOpened={drawerOpened}
      />

      {showModal && (
        <PrintConfirmModal
          isReprint={isReprint}
          loading={printing}
          onConfirm={handleConfirmPrint}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}