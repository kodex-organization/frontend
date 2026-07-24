"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { useReceipt } from "../hooks/useReceipt";
import { usePrintReceipt } from "../hooks/usePrintReceipt";
import type { PrintReceiptResult } from "../types/receipt";
import CashDrawerIndicator from "./CashDrawerIndicator";
import PrintConfirmModal from "./PrintConfirmModal";
import ReceiptPreview from "./ReceiptPreview";

interface Props {
  receiptId: string;
}

export default function ReceiptDetails({ receiptId }: Props) {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<PrintReceiptResult | null>(null);

  const {
    receipt,
    loading,
    error,
    refresh,
    replaceReceipt,
  } = useReceipt(receiptId);
  const { print, printing, error: printError } = usePrintReceipt();

  if (loading) {
    return (
      <div
        className="mx-auto min-h-screen max-w-5xl space-y-4 bg-gray-50 p-6"
        aria-label="Loading receipt details"
      >
        <div className="h-24 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p>{error || "Receipt not found"}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={!isOnline}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const hasUnresolvedPrint =
    receipt.lastPrintStatus === "printing";
  const isReprint =
    receipt.printCount > 0 || hasUnresolvedPrint;

  const handleConfirmPrint = async (reprintReason: string | null) => {
    if (!isOnline) return;

    try {
      const result = await print(
        receipt.id,
        reprintReason ?? undefined,
      );
      setLastResult(result);
      replaceReceipt(result.receipt);
      setShowModal(false);
    } catch {
      // The hook exposes the server's safe printer error for the UI below.
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 font-medium text-gray-600 transition hover:text-green-700"
        >
          Back
        </button>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Receipt Details
            </h1>
            <p className="mt-1 text-gray-500">Receipt #{receipt.id}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/billing/${receipt.invoice.id}`}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              Open invoice
            </Link>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              disabled={!isOnline || printing}
              title={
                isOnline
                  ? undefined
                  : "Reconnect to print or reprint this receipt"
              }
              className="rounded-xl bg-green-600 px-5 py-2.5 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {printing
                ? "Printing..."
                : hasUnresolvedPrint
                  ? "Resolve / Reprint"
                  : isReprint
                  ? "Reprint Receipt"
                  : "Print Receipt"}
            </button>
          </div>
        </div>
      </div>

      {!isOnline && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Printing and reprinting are disabled offline. The receipt remains
          available to review if it has already loaded.
        </div>
      )}

      {printError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {printError}
        </div>
      )}

      {hasUnresolvedPrint && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-semibold">
            A previous print request has no finalized result.
          </p>
          <p className="mt-1 text-sm">
            The server will reject a second request while its reservation is
            active. After the reservation expires, another output requires an
            audited reprint reason because the earlier physical result is
            unknown.
          </p>
        </div>
      )}

      {lastResult && (
        <div
          role="status"
          className={`mb-6 rounded-xl border p-4 ${
            lastResult.print.physicallyPrinted
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <p className="font-semibold">
            {lastResult.print.physicallyPrinted
              ? `Receipt copy ${lastResult.print.printSequence} printed.`
              : `Receipt copy ${lastResult.print.printSequence} was simulated.`}
          </p>
          <p className="mt-1 text-sm">
            Mode: {lastResult.print.mode}. Physical print:{" "}
            {lastResult.print.physicallyPrinted ? "yes" : "no"}.
          </p>
          {lastResult.print.artifactName && (
            <p className="mt-1 text-sm">
              Server artifact: {lastResult.print.artifactName}
            </p>
          )}
        </div>
      )}

      <div className="mb-6">
        <ReceiptPreview receipt={receipt} />
      </div>

      <CashDrawerIndicator result={lastResult?.cashDrawer ?? null} />

      {showModal && (
        <PrintConfirmModal
          isReprint={isReprint}
          hasUnresolvedPrint={hasUnresolvedPrint}
          isOnline={isOnline}
          loading={printing}
          onConfirm={handleConfirmPrint}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
