// src/modules/floor-view/components/FloorCard.tsx
"use client";

import { FloorViewTable } from "../types";

interface FloorCardProps {
  table: FloorViewTable;
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatAmount(
  amount: number | null,
  currency: string | null,
) {
  if (amount == null) return "Unavailable";
  if (!currency) {
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function billingStateLabel(value?: string) {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function FloorCard({ table }: FloorCardProps) {
  const isOccupied = table.status === "occupied";
  const isOvertime = table.session?.isOvertime || false;
  const isPaused = table.session?.isPaused || false;

  let containerStyle =
    "bg-white border-slate-200 hover:border-emerald-500 shadow-sm";
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let badgeText = "Available";

  let statusIcon = (
    <svg
      className="w-5 h-5 text-emerald-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );

  if (isOvertime) {
    containerStyle =
      "bg-white border-rose-200 ring-2 ring-rose-500/20 shadow-md";
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
    badgeText = "Overtime";
    statusIcon = (
      <svg
        className="w-5 h-5 text-rose-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    );
  } else if (isPaused) {
    containerStyle =
      "bg-white border-amber-200 hover:border-amber-400 shadow-sm";
    badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
    badgeText = "Paused";
    statusIcon = (
      <svg
        className="w-5 h-5 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  } else if (isOccupied) {
    containerStyle =
      "bg-white border-slate-200 hover:border-blue-500 shadow-sm ring-1 ring-slate-100";
    badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
    badgeText = "Active";
    statusIcon = (
      <svg
        className="w-5 h-5 text-blue-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    );
  } else if (table.status === "reserved") {
    containerStyle =
      "bg-white border-violet-200 hover:border-violet-400 shadow-sm";
    badgeStyle = "bg-violet-50 text-violet-700 border-violet-200";
    badgeText = "Reserved";
    statusIcon = (
      <svg
        className="h-5 w-5 text-violet-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25m10.5-2.25v2.25M3.75 9h16.5m-15 12h13.5a1.5 1.5 0 001.5-1.5V6.75a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5V19.5a1.5 1.5 0 001.5 1.5Z"
        />
      </svg>
    );
  } else if (table.status === "maintenance") {
    containerStyle =
      "bg-white border-orange-200 hover:border-orange-400 shadow-sm";
    badgeStyle = "bg-orange-50 text-orange-700 border-orange-200";
    badgeText = "Maintenance";
    statusIcon = (
      <svg
        className="h-5 w-5 text-orange-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14.25 6.087-.887-.887a2.25 2.25 0 00-3.182 0L3.75 11.63a2.25 2.25 0 000 3.182l5.438 5.438a2.25 2.25 0 003.182 0l6.43-6.431a2.25 2.25 0 000-3.182l-.887-.887m-3.663-3.663 3.663 3.663m-3.663-3.663 2.121-2.121a2.121 2.121 0 013 3L17.913 9.75"
        />
      </svg>
    );
  } else if (table.status === "inactive") {
    containerStyle = "bg-slate-50 border-slate-300 shadow-sm";
    badgeStyle = "bg-slate-100 text-slate-600 border-slate-300";
    badgeText = "Inactive";
    statusIcon = (
      <svg
        className="h-5 w-5 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18.364 18.364A9 9 0 105.636 5.636m12.728 12.728L5.636 5.636"
        />
      </svg>
    );
  } else if (table.status !== "available") {
    containerStyle = "bg-white border-slate-300 shadow-sm";
    badgeStyle = "bg-slate-100 text-slate-600 border-slate-300";
    badgeText = "Unknown";
    statusIcon = (
      <svg
        className="h-5 w-5 text-slate-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 9.879a3 3 0 114.242 4.242L12 16.243M12 19.5h.008v.008H12V19.5Zm0-15a9 9 0 110 18 9 9 0 010-18Z"
        />
      </svg>
    );
  }

  return (
    <div
      id={`floor-table-${table.tableId}`}
      className={`group border rounded-xl p-5 transition-colors hover:shadow-md flex flex-col justify-between min-h-[210px] ${containerStyle}`}
    >
      <div>
        {/* Card Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            {statusIcon}
            <h3 className="font-semibold text-base text-slate-800 tracking-tight">
              Table {table.tableNumber || "N/A"}
            </h3>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-md font-bold border tracking-wide uppercase text-[10px] ${badgeStyle}`}
          >
            {badgeText}
          </span>
        </div>

        {/* Card Body Metrics */}
        {isOccupied && table.session ? (
          <div className="text-xs space-y-2.5 text-slate-600">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-medium">Customer</span>
              <span className="font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                {table.session.customerName || "Walk-in Client"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
              <div>
                <span className="block text-[10px] uppercase text-slate-400 tracking-wider font-semibold">
                  Started
                </span>
                <span className="font-medium text-slate-700">
                  {table.session.startedAt
                    ? new Date(table.session.startedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase text-slate-400 tracking-wider font-semibold">
                  Expected End
                </span>
                <span
                  className={`font-bold ${isOvertime ? "text-rose-600" : "text-slate-700"}`}
                >
                  {table.session.expectedEndTime
                    ? new Date(
                        table.session.expectedEndTime,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Elapsed
                </span>
                <span className="font-medium text-slate-700">
                  {formatDuration(table.session.durationSeconds)}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Paused
                </span>
                <span className="font-medium text-slate-700">
                  {formatDuration(
                    table.session.pauseDurationSeconds,
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Billing
                </span>
                <span className="font-medium text-slate-700">
                  {billingStateLabel(
                    table.session.billingState,
                  )}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 flex items-center justify-center gap-2 py-5 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mt-2">
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>
              {table.status === "available"
                ? "Ready for allocation"
                : table.status || "Inactive Station"}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      {isOccupied && table.session && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Rate:
            </span>
            <span className="text-xs font-bold text-slate-800">
              {formatAmount(
                table.session.appliedHourlyRate,
                table.currency,
              )}
              <span className="text-[10px] text-slate-400 font-normal">
                /hr
              </span>
            </span>
          </div>

          <div className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Current charge
            </span>
            <span className="text-xs font-bold text-slate-800">
              {formatAmount(
                table.session.estimatedCharge,
                table.currency,
              )}
            </span>
          </div>

          {isOvertime && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Action Required
            </span>
          )}
        </div>
      )}
    </div>
  );
}
