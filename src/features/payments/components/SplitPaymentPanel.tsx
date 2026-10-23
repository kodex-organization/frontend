"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/lib/connectivity/offline-navigation";
import { toast } from "react-toastify";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";
import { apiFetch } from "@/lib/api/client";
import { isAppOffline } from "@/lib/connectivity/online-status";
import { isNetworkFailure } from "@/lib/sync/offline-reference-cache";
import { recordSplitPaymentOffline } from "../split-payment-offline";
import { customerFormUrl } from "@/features/customers/customer-redirect";

export default function SplitPaymentPanel({
  invoiceId,
  standardTotal,
  cardTotal,
  onSuccess,
  isCustomerBlocked = false,
  hasCustomer,
  currency,
  concessionTaxPercent = 5,
  linkedCustomerId = null,
  returnTo,
}: {
  invoiceId: string;
  standardTotal: number;
  cardTotal: number;
  onSuccess: () => void;
  isCustomerBlocked?: boolean;
  hasCustomer: boolean;
  currency: string;
  concessionTaxPercent?: number;
  linkedCustomerId?: string | null;
  returnTo?: string;
}) {
  const router = useRouter();
  const [cash, setCash] = useState<string>("0");
  const [card, setCard] = useState<string>("0");
  const [wallet, setWallet] = useState<string>("0");
  const [udhaar, setUdhaar] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cashVal = parseFloat(cash) || 0;
  const cardVal = parseFloat(card) || 0;
  const walletVal = parseFloat(wallet) || 0;
  // A customer added through the redirect counts as linked (sent with the payment)
  const hasLinkedCustomer = hasCustomer || Boolean(linkedCustomerId);
  const canUseUdhaar = hasLinkedCustomer && !isCustomerBlocked;
  const udhaarVal = canUseUdhaar ? parseFloat(udhaar) || 0 : 0;

  // --- DYNAMIC TAX CONCESSION TARGET ---
  // If 100% of the entered money is on Card (and all other tenders are 0), target is cardTotal (5% tax)
  const is100PercentCard = cardVal > 0 && cashVal === 0 && walletVal === 0 && udhaarVal === 0;
  const targetTotal = is100PercentCard ? cardTotal : standardTotal;

  const currentSum = cashVal + cardVal + walletVal + udhaarVal;
  const remaining = Number((targetTotal - currentSum).toFixed(2));
  const isValid = Math.abs(remaining) <= 0.01 && currentSum > 0;

  const handleSubmit = async () => {
    if (!isValid) return;

    if (udhaarVal > 0 && !canUseUdhaar) {
      toast.error(
        isCustomerBlocked
          ? "Blocked customers cannot receive credit (udhaar)."
          : "A customer must be linked to the invoice to use Udhaar.",
      );
      return;
    }

    const tenders: Array<{ tenderType: string; amount: number }> = [];
    if (cashVal > 0) tenders.push({ tenderType: "cash", amount: cashVal });
    if (cardVal > 0) tenders.push({ tenderType: "card", amount: cardVal });
    if (walletVal > 0) tenders.push({ tenderType: "mobile_wallet", amount: walletVal });
    if (udhaarVal > 0) tenders.push({ tenderType: "udhaar", amount: udhaarVal });

    // Offline / server unreachable: save the split on this device and sync it later.
    const saveOffline = async () => {
      try {
        await recordSplitPaymentOffline(invoiceId, tenders as any, hasCustomer ? null : linkedCustomerId);
        toast.success("Payment saved on this device. It will sync when the connection returns.");
        onSuccess();
      } catch (offlineError: any) {
        toast.error(offlineError?.message || "Payment could not be saved offline.");
      }
    };

    try {
      setIsSubmitting(true);

      if (isAppOffline()) {
        await saveOffline();
        return;
      }

      await apiFetch(`/billing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
        method: "POST",
        body: JSON.stringify({
          tenders,
          ...(!hasCustomer && linkedCustomerId ? { customerId: linkedCustomerId } : {}),
        }),
      });

      toast.success("Payment settled successfully!");
      onSuccess();
    } catch (err: any) {
      if (isNetworkFailure(err)) {
        await saveOffline();
      } else {
        toast.error(err.message || "Payment settlement failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Multi-tender split</h3>
          <p className="text-xs text-slate-500">
            Allocate parts of the invoice across cash, card, wallet, and udhaar.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-400 font-semibold uppercase">Target Total</span>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(targetTotal, currency)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold text-slate-700">Cash</label>
          <input
            type="number"
            step="any"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">
            Card {is100PercentCard && <span className="text-emerald-600 font-bold">{concessionTaxPercent > 0 ? `(${concessionTaxPercent}% Concession)` : "(No tax)"}</span>}
          </label>
          <input
            type="number"
            step="any"
            value={card}
            onChange={(e) => setCard(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700">Mobile wallet</label>
          <input
            type="number"
            step="any"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Udhaar</span>
            {isCustomerBlocked && (
              <span className="text-[11px] text-rose-600 font-bold">Blocked - Credit Restricted</span>
            )}
            {!hasLinkedCustomer && (
              <span className="text-[11px] text-slate-500 font-bold">Customer required</span>
            )}
            {!hasCustomer && linkedCustomerId && (
              <span className="text-[11px] text-emerald-600 font-bold">Customer linked</span>
            )}
          </label>
          <input
            type="number"
            step="any"
            disabled={!canUseUdhaar}
            value={canUseUdhaar ? udhaar : "0"}
            onChange={(e) => {
              if (!canUseUdhaar) return;
              setUdhaar(e.target.value);
            }}
            placeholder={
              isCustomerBlocked
                ? "Blocked from credit"
                : hasLinkedCustomer
                  ? "0"
                  : "Customer required"
            }
            className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none ${
              !canUseUdhaar
                ? "bg-rose-50/60 border-rose-200 text-rose-400 cursor-not-allowed"
                : "border-slate-300 focus:border-emerald-600"
            }`}
          />
          {!canUseUdhaar && (
            <p className="mt-1 text-[11px] text-rose-600 font-medium">
              {isCustomerBlocked
                ? "This customer is marked as blocked and cannot receive credit."
                : "Walk-in invoices need a linked customer before Udhaar can be used."}
            </p>
          )}
          {!hasLinkedCustomer && !isCustomerBlocked && (
            <button
              type="button"
              onClick={() => navigateTo(router, customerFormUrl(returnTo ?? `/billing/${invoiceId}`))}
              className="mt-2 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
            >
              Add customer details for Udhaar
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-500">Remaining to allocate</p>
          <p className={`text-base font-bold ${remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            {formatCurrency(remaining, currency)}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "Processing..." : "Submit split payment"}
        </button>
      </div>
    </div>
  );
}