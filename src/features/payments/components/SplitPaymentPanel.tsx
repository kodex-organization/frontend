"use client";

import { useState } from "react";
import { toast } from "react-toastify";

export default function SplitPaymentPanel({
  invoiceId,
  standardTotal,
  cardTotal,
  onSuccess,
}: {
  invoiceId: string;
  standardTotal: number;
  cardTotal: number;
  onSuccess: () => void;
}) {
  const [cash, setCash] = useState<string>("0");
  const [card, setCard] = useState<string>("0");
  const [wallet, setWallet] = useState<string>("0");
  const [udhaar, setUdhaar] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cashVal = parseFloat(cash) || 0;
  const cardVal = parseFloat(card) || 0;
  const walletVal = parseFloat(wallet) || 0;
  const udhaarVal = parseFloat(udhaar) || 0;

  // --- DYNAMIC TAX CONCESSION TARGET ---
  // If 100% of the entered money is on Card (and all other tenders are 0), target is cardTotal (5% tax)
  const is100PercentCard = cardVal > 0 && cashVal === 0 && walletVal === 0 && udhaarVal === 0;
  const targetTotal = is100PercentCard ? cardTotal : standardTotal;

  const currentSum = cashVal + cardVal + walletVal + udhaarVal;
  const remaining = Number((targetTotal - currentSum).toFixed(2));
  const isValid = Math.abs(remaining) <= 0.01 && currentSum > 0;

  const handleSubmit = async () => {
    if (!isValid) return;

    const tenders = [];
    if (cashVal > 0) tenders.push({ tenderType: "cash", amount: cashVal });
    if (cardVal > 0) tenders.push({ tenderType: "card", amount: cardVal });
    if (walletVal > 0) tenders.push({ tenderType: "mobile_wallet", amount: walletVal });
    if (udhaarVal > 0) tenders.push({ tenderType: "udhaar", amount: udhaarVal });

    try {
      setIsSubmitting(true);

      // Extract bearer token
      let token = null;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const val = localStorage.getItem(localStorage.key(i) || "");
          if (val?.includes("eyJ")) {
            const m = val.match(/eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*/);
            if (m) {
              token = m[0];
              break;
            }
          }
        }
      } catch {}

      const rawBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
      const res = await fetch(`${rawBase}/api/v1/billing/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ tenders }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to settle invoice.");
      }

      toast.success("Payment settled successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Payment settlement failed.");
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
          <p className="text-lg font-bold text-slate-900">PKR {targetTotal}</p>
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
            Card {is100PercentCard && <span className="text-emerald-600 font-bold">(5% Concession)</span>}
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
          <label className="block text-xs font-semibold text-slate-700">Udhaar</label>
          <input
            type="number"
            step="any"
            value={udhaar}
            onChange={(e) => setUdhaar(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-500">Remaining to allocate</p>
          <p className={`text-base font-bold ${remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
            PKR {remaining}
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