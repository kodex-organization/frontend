"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { SessionClock } from "@/features/sessions/session-clock";
import { sessionApi } from "@/features/sessions/session-api";
import { StartSessionModal } from "@/features/sessions/start-session-modal";
import type { ActiveSession, TableOption } from "@/features/sessions/types";
import { useAuth } from "@/lib/auth/auth-context";

interface SwitchTableState {
  session: ActiveSession;
  tables: TableOption[];
  loading: boolean;
  selectedTableId: string;
  error: string;
  submitting: boolean;
}

export default function SessionsPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [items, setItems] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [switchState, setSwitchState] = useState<SwitchTableState | null>(null);

  const load = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;

    setError("");
    try {
      const [active, paused] = await Promise.all([
        sessionApi.active(),
        sessionApi.paused(),
      ]);
      setItems([...active, ...paused]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void load();
    }
  }, [authLoading, isAuthenticated, load]);

  async function action(id: string, nextAction: "pause" | "resume" | "end") {
    try {
      await sessionApi.action(id, nextAction);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  async function openSwitchTable(session: ActiveSession) {
    setSwitchState({
      session,
      tables: [],
      loading: true,
      selectedTableId: "",
      error: "",
      submitting: false,
    });

    try {
      const tables = await sessionApi.tables();
      const availableTables = tables.filter(
        (table) => table.id !== session.table.id,
      );

      setSwitchState({
        session,
        tables: availableTables,
        loading: false,
        selectedTableId: availableTables[0]?.id ?? "",
        error: "",
        submitting: false,
      });
    } catch (e) {
      setSwitchState({
        session,
        tables: [],
        loading: false,
        selectedTableId: "",
        error: e instanceof Error ? e.message : "Failed to load tables",
        submitting: false,
      });
    }
  }

  async function submitSwitchTable() {
    if (!switchState?.selectedTableId) return;

    setSwitchState((current) =>
      current ? { ...current, submitting: true, error: "" } : current,
    );

    try {
      await sessionApi.switchTable(
        switchState.session.id,
        switchState.selectedTableId,
      );
      setSwitchState(null);
      await load();
    } catch (e) {
      setSwitchState((current) => {
        if (!current) return current;
        return {
          ...current,
          submitting: false,
          error:
            e instanceof ApiError
              ? e.message
              : e instanceof Error
                ? e.message
                : "Could not switch table",
        };
      });
    }
  }

  const noSwitchTables = useMemo(
    () => switchState && !switchState.loading && !switchState.tables.length,
    [switchState],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Active sessions</h1>
          <p className="mt-1 text-slate-500">
            Live billable time and table controls
          </p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          Start session
        </button>
      </div>

      {loading && <p className="mt-10">Loading sessions…</p>}

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
          <button className="ml-3 underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center text-slate-500">
          No active sessions. The floor is quiet.
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {items.map((session) => (
          <article
            key={session.id}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  Table {session.table.tableNumber}
                </p>
                <h2 className="mt-1 font-semibold">
                  {session.customer?.fullName ?? "Walk-in customer"}
                </h2>
              </div>
              <span
                className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${
                  session.status === "paused"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {session.status.toUpperCase()}
              </span>
            </div>

            <div className="my-6">
              <SessionClock session={session} />
            </div>

            <div className="flex flex-wrap gap-2">
              {session.status === "active" ? (
                <button
                  onClick={() => action(session.id, "pause")}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={() => action(session.id, "resume")}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  Resume
                </button>
              )}

              <button
                onClick={() => void openSwitchTable(session)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Switch table
              </button>

              <button
                onClick={() =>
                  confirm("End this session and generate its invoice event?") &&
                  action(session.id, "end")
                }
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                End session
              </button>
            </div>
          </article>
        ))}
      </div>

      <StartSessionModal
        open={modal}
        onClose={() => setModal(false)}
        onStarted={load}
      />

      {switchState && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Switch table</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Move session from table {switchState.session.table.tableNumber}
                </p>
              </div>
              <button onClick={() => setSwitchState(null)}>✕</button>
            </div>

            {switchState.loading ? (
              <p className="mt-5 text-sm text-slate-600">
                Loading available tables…
              </p>
            ) : (
              <>
                <label className="mt-5 block text-sm font-medium">
                  Available tables
                  <select
                    className="mt-1 w-full rounded-lg border p-3"
                    value={switchState.selectedTableId}
                    onChange={(e) =>
                      setSwitchState((current) =>
                        current
                          ? { ...current, selectedTableId: e.target.value }
                          : current,
                      )
                    }
                    disabled={noSwitchTables || switchState.submitting}
                  >
                    <option value="">
                      {noSwitchTables
                        ? "No available tables"
                        : "Select an available table"}
                    </option>
                    {switchState.tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.tableNumber} — PKR {table.defaultHourlyRate}
                        /hr
                      </option>
                    ))}
                  </select>
                </label>

                {noSwitchTables && (
                  <p className="mt-3 text-sm text-slate-600">
                    No available tables to switch to.
                  </p>
                )}
              </>
            )}

            {switchState.error && (
              <p className="mt-3 text-sm text-red-600">{switchState.error}</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSwitchState(null)}
                className="rounded-lg border px-4 py-2 text-sm"
                disabled={switchState.submitting}
              >
                Cancel
              </button>
              <button
                onClick={() => void submitSwitchTable()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                disabled={
                  switchState.loading ||
                  switchState.submitting ||
                  !switchState.selectedTableId
                }
              >
                {switchState.submitting ? "Switching…" : "Switch table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
