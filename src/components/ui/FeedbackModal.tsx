"use client";

import { CheckCircle2, AlertTriangle, CircleX } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  type?: "success" | "warning" | "error";
  title: string;
  message: string;
  transactionRef?: string;
  onClose: () => void;
}

const theme = {
  success: {
    icon: CheckCircle2,
    card: "border-emerald-200 bg-emerald-50",
    iconClass: "text-emerald-600 bg-emerald-100",
    titleClass: "text-emerald-900",
  },
  warning: {
    icon: AlertTriangle,
    card: "border-amber-200 bg-amber-50",
    iconClass: "text-amber-600 bg-amber-100",
    titleClass: "text-amber-900",
  },
  error: {
    icon: CircleX,
    card: "border-rose-200 bg-rose-50",
    iconClass: "text-rose-600 bg-rose-100",
    titleClass: "text-rose-900",
  },
};

export function FeedbackModal({
  isOpen,
  type = "success",
  title,
  message,
  transactionRef,
  onClose,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  const config = theme[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${config.card}`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.iconClass}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-semibold ${config.titleClass}`}>{title}</h3>
            <p className="mt-2 text-sm text-slate-700">{message}</p>
            {transactionRef ? (
              <p className="mt-3 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                Ref: {transactionRef}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
