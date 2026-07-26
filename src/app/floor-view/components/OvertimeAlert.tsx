// src/modules/floor-view/components/OvertimeAlert.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FloorViewTable } from "../types";

interface OvertimeAlertProps {
  tables: FloorViewTable[];
  onDismiss?: (sessionId: string) => void;
}

export function OvertimeAlert({ tables, onDismiss }: OvertimeAlertProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const activeOvertimeSessionIds = useMemo(
    () =>
      new Set(
        tables.flatMap((table) =>
          table.session?.isOvertime ? [table.session.sessionId] : [],
        ),
      ),
    [tables],
  );

  useEffect(() => {
    setDismissed(
      (current) =>
        new Set(
          [...current].filter((sessionId) =>
            activeOvertimeSessionIds.has(sessionId),
          ),
        ),
    );
  }, [activeOvertimeSessionIds]);

  const overtimeTables = tables.filter(
    (table) =>
      table.session?.isOvertime &&
      !dismissed.has(table.session.sessionId),
  );

  if (overtimeTables.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {overtimeTables.map((table) => (
        <div
          key={table.session?.sessionId ?? table.tableId}
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex justify-between items-center"
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
              const sessionId = table.session?.sessionId;
              if (!sessionId) return;
              setDismissed((prev) => new Set(prev).add(sessionId));
              onDismiss?.(sessionId);
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
