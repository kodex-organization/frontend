// src/modules/floor-view/components/OvertimeAlert.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FloorViewTable } from "../types";

interface OvertimeAlertProps {
  tables: FloorViewTable[];
  onDismiss?: (sessionId: string) => void;
  onEndSession?: (sessionId: string) => void;
}

export function OvertimeAlert({ tables, onDismiss, onEndSession }: OvertimeAlertProps) {
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
          className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm flex flex-wrap justify-between items-center gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-700 font-semibold">
                Table {table.tableNumber ?? "N/A"} is overtime!
              </p>
              <p className="text-sm text-red-600">
                Customer: <span className="font-semibold">{table.session?.customerName || "Walk-in"}</span> • Expected end:{" "}
                {table.session?.expectedEndTime
                  ? new Date(table.session.expectedEndTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "N/A"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEndSession && table.session?.sessionId && (
              <button
                type="button"
                onClick={() => onEndSession(table.session!.sessionId)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm"
              >
                End Session
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const sessionId = table.session?.sessionId;
                if (!sessionId) return;
                setDismissed((prev) => new Set(prev).add(sessionId));
                onDismiss?.(sessionId);
              }}
              className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1.5 hover:bg-red-100 rounded-md transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
