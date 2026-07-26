"use client";

import type { CashDrawerExecution } from "../types/receipt";

interface Props {
  result: CashDrawerExecution | null;
}

const styles: Record<CashDrawerExecution["status"], string> = {
  opened: "border-green-200 bg-green-50 text-green-800",
  simulated: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-800",
  disabled: "border-gray-200 bg-gray-50 text-gray-700",
  not_requested: "border-blue-200 bg-blue-50 text-blue-800",
};

export default function CashDrawerIndicator({ result }: Props) {
  if (!result) return null;

  return (
    <div
      className={`rounded-xl border p-4 ${styles[result.status]}`}
      role={result.status === "failed" ? "alert" : "status"}
    >
      <p className="font-semibold">
        Cash drawer: {result.status.replace("_", " ")}
      </p>
      <p className="mt-1 text-sm">{result.message}</p>
      {(result.status === "simulated" || result.status === "opened") && (
        <p className="mt-1 text-xs">
          Physically opened: {result.physicallyOpened ? "yes" : "no"}
        </p>
      )}
    </div>
  );
}
