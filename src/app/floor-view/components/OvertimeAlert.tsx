// src/modules/floor-view/components/OvertimeAlert.tsx
"use client";

import { useState } from "react";
import { FloorViewTable } from "../types";

interface OvertimeAlertProps {
  tables: FloorViewTable[];
  onDismiss?: (tableId: string) => void;
}

export function OvertimeAlert({ tables, onDismiss }: OvertimeAlertProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const overtimeTables = tables.filter(
    (t) => t.session?.isOvertime && !dismissed.has(t.tableId),
  );

  if (overtimeTables.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {overtimeTables.map((table) => (
        <div
          key={table.tableId}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex justify-between items-center animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-700 font-semibold">
                Table {table.tableNumber} is overtime!
              </p>
              <p className="text-sm text-red-600">
                Customer: {table.session?.customerName} • Expected end:{" "}
                {table.session?.expectedEndTime
                  ? new Date(table.session.expectedEndTime).toLocaleTimeString()
                  : "N/A"}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setDismissed((prev) => new Set(prev).add(table.tableId));
              onDismiss?.(table.tableId);
            }}
            className="text-red-500 hover:text-red-700 text-sm font-medium px-3 py-1 hover:bg-red-100 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
