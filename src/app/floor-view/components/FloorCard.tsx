// src/modules/floor-view/components/FloorCard.tsx
"use client";

import { FloorViewTable } from "../types";

interface FloorCardProps {
  table: FloorViewTable;
}

export function FloorCard({ table }: FloorCardProps) {
  const isOccupied = table.status === "occupied";
  const isOvertime = table.session?.isOvertime || false;
  const isPaused = table.session?.isPaused || false;

  let cardStyle = "bg-green-100 border-green-500";
  let badgeStyle = "bg-green-500";
  let badgeText = "Available";
  let statusIcon = "";

  if (isOvertime) {
    cardStyle = "bg-red-100 border-red-500 animate-pulse";
    badgeStyle = "bg-red-500";
    badgeText = " Overtime";
    statusIcon = "";
  } else if (isPaused) {
    cardStyle = "bg-yellow-100 border-yellow-500";
    badgeStyle = "bg-yellow-500";
    badgeText = "⏸ Paused";
    statusIcon = "⏸️";
  } else if (isOccupied) {
    cardStyle = "bg-blue-100 border-blue-500";
    badgeStyle = "bg-blue-500";
    badgeText = "Active";
    statusIcon = "";
  }

  return (
    <div
      className={`border-l-4 p-4 rounded-lg shadow-md transition-all hover:shadow-lg hover:scale-[1.02] ${cardStyle}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
          {statusIcon} {table.tableNumber || "Unknown"}
        </h3>
        <span
          className={`text-xs px-2 py-1 rounded-full text-white font-medium ${badgeStyle}`}
        >
          {badgeText}
        </span>
      </div>

      {isOccupied && table.session && (
        <div className="text-sm space-y-1 text-gray-700">
          <div className="flex justify-between border-b border-gray-200 pb-1">
            <span className="text-gray-600">Customer:</span>
            <span className="font-medium">
              {table.session.customerName || "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Started:</span>
            <span>
              {table.session.startedAt
                ? new Date(table.session.startedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Expected End:</span>
            <span className={isOvertime ? "text-red-600 font-bold" : ""}>
              {table.session.expectedEndTime
                ? new Date(table.session.expectedEndTime).toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1">
            <span className="text-gray-600">Rate:</span>
            <span className="font-medium">
              Rs. {table.session.appliedHourlyRate || 0}/hr
            </span>
          </div>
          {isOvertime && (
            <div className="mt-2 text-red-600 font-semibold text-xs bg-red-50 p-1.5 rounded text-center animate-pulse">
              Session is overtime! Action required.
            </div>
          )}
        </div>
      )}

      {!isOccupied && (
        <div className="text-sm text-gray-500 mt-2">
          {table.status === "available"
            ? " Ready for new session"
            : table.status || "Unavailable"}
        </div>
      )}
    </div>
  );
}
