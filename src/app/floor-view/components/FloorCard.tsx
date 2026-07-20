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

  // Modern corporate palette with SVG icons replacing raw emojis
  let containerStyle =
    "bg-white border-slate-200 hover:border-emerald-500 shadow-sm";
  let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let badgeText = "Available";

  // Custom professional SVG configurations
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
      "bg-white border-rose-200 ring-2 ring-rose-500/20 shadow-md animate-pulse";
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
  }

  return (
    <div
      className={`group border rounded-xl p-5 transition-all duration-300 transform hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[210px] ${containerStyle}`}
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
              Rs. {table.session.appliedHourlyRate || 0}
              <span className="text-[10px] text-slate-400 font-normal">
                /hr
              </span>
            </span>
          </div>

          {isOvertime && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-100">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
              Action Required
            </span>
          )}
        </div>
      )}
    </div>
  );
}
