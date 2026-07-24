import type { InvoiceStatus } from "../types/invoice";

const styles: Record<InvoiceStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-amber-100 text-amber-800",
  partially_paid: "bg-blue-100 text-blue-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-red-100 text-red-800",
};

const labels: Record<InvoiceStatus, string> = {
  draft: "Draft",
  open: "Open",
  partially_paid: "Partially paid",
  paid: "Paid",
  void: "Voided",
};

export default function StatusBadge({
  status,
}: {
  status: InvoiceStatus | null;
}) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        Unknown
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
