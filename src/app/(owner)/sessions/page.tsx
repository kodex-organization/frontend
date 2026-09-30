"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { SessionClock } from "@/features/sessions/session-clock";
import { sessionApi } from "@/features/sessions/session-api";
import { StartSessionModal } from "@/features/sessions/start-session-modal";
import type { ActiveSession, TableOption } from "@/features/sessions/types";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/lib/toast";

interface SwitchTableState {
  session: ActiveSession;
  tables: TableOption[];
  loading: boolean;
  selectedTableId: string;
  error: string;
  submitting: boolean;
}

function formatTableRate(table: TableOption) {
  const rawAmount =
    (table as any).hourlyRate ??
    (table as any).rate ??
    (table as any).currentRate ??
    table.defaultHourlyRate;

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount)) return "Rate unavailable";
  if (!table.currency) return `${amount.toFixed(2)}/hr`;

  try {
    return `${new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: table.currency,
      maximumFractionDigits: 2,
    }).format(amount)}/hr`;
  } catch {
    return `${table.currency} ${amount.toFixed(2)}/hr`;
  }
}

export default function SessionsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const isOnline = useOnlineStatus();
  const [items, setItems] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingEndSessionId, setPendingEndSessionId] = useState<string | null>(null);
  const selectedBranchId = user?.branchId ?? "";

  const strings = {
    en: {
      title: "Active sessions",
      description: "Live billable time and table controls",
      startSession: "Start session",
      loadingSessions: "Loading sessions…",
      failedLoad: "Failed to load sessions.",
      offlineMessage:
        "Offline Mode active. Actions are saved locally and will synchronize when connection returns.",
      noActiveSessions: "No active sessions. The floor is quiet.",
      walkInCustomer: "Walk-in customer",
      pause: "Pause",
      resume: "Resume",
      switchTable: "Switch table",
      endSession: "End session",
      confirmEndSession: "End this session and generate its invoice?",
      switchTableHeading: "Switch table",
      switchTableDescription: "Move session from table",
      loadingAvailableTables: "Loading available tables…",
      availableTables: "Available tables",
      selectAvailableTable: "Select an available table",
      noAvailableTables: "No available tables",
      noTablesToSwitchTo: "No available tables to switch to.",
      cancel: "Cancel",
      retry: "Retry",
      switching: "Switching…",
      actionFailed: "Could not update the session. Try again.",
    },
    ur: {
      title: "فعال سیشنز",
      description: "زندہ بل ایبل وقت اور ٹیبل کنٹرولز",
      startSession: "سیشن شروع کریں",
      reconnectStartSession: "سیشن شروع کرنے کے لیے دوبارہ کنیکٹ کریں",
      loadingSessions: "سیشنز لوڈ ہو رہے ہیں…",
      failedLoad: "سیشنز لوڈ کرنے میں ناکامی۔",
      offlineMessage:
        "آپ آف لائن ہیں۔ کنکشن واپس آنے تک سیشن کنٹرولز غیر فعال ہیں۔",
      noActiveSessions: "کوئی فعال سیشن نہیں۔ فلور خاموش ہے۔",
      walkInCustomer: "آنے والا کسٹمر",
      pause: "وقفہ",
      resume: "دوبارہ شروع کریں",
      switchTable: "ٹیبل تبدیل کریں",
      endSession: "سیشن ختم کریں",
      confirmEndSession: "کیا آپ واقعی یہ سیشن ختم کر کے انوائس بنانا چاہتے ہیں؟",
      switchTableHeading: "ٹیبل تبدیل کریں",
      switchTableDescription: "سیشن کو میز سے منتقل کریں",
      loadingAvailableTables: "دستیاب ٹیبلز لوڈ ہو رہے ہیں…",
      availableTables: "دستیاب ٹیبلز",
      selectAvailableTable: "دستیاب ٹیبل منتخب کریں",
      noAvailableTables: "کوئی دستیاب ٹیبل نہیں",
      noTablesToSwitchTo: "بدلنے کے لیے کوئی دستیاب ٹیبل نہیں۔",
      cancel: "منسوخ کریں",
      retry: "دوبارہ کوشش کریں",
      switching: "منتقل کیا جا رہا ہے…",
      actionFailed: "سیشن کو اپ ڈیٹ نہیں کیا جا سکا۔ دوبارہ کوشش کریں۔",
    },
  };

  const t = strings[user?.language ?? "en"];
  const [modal, setModal] = useState(false);
  const [switchState, setSwitchState] = useState<SwitchTableState | null>(null);

  const load = useCallback(async () => {
    if (authLoading || !isAuthenticated) return;

    setError("");
    try {
      const effectiveBranchId = selectedBranchId;
      const [active, paused] = await Promise.all([
        sessionApi.active(effectiveBranchId),
        sessionApi.paused(effectiveBranchId),
      ]);
      setItems([...active, ...paused]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failedLoad);
    } finally {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, selectedBranchId, t.failedLoad]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void load();
    }
  }, [authLoading, isAuthenticated, load]);

  async function action(id: string, nextAction: "pause" | "resume" | "end") {
    const previousItems = [...items];
    const nowIso = new Date().toISOString();

    // 1. Optimistic Update (Immediate UI response: 0ms lag)
    setItems((current) => {
      if (nextAction === "end") {
        return current.filter((session) => session.id !== id);
      }
      return current.map((session) => {
        if (session.id !== id) return session;
        if (nextAction === "pause") {
          return {
            ...session,
            status: "paused",
            pausedAt: nowIso,
          };
        }
        return {
          ...session,
          status: "active",
          pausedAt: null as any,
        };
      });
    });

    try {
      // 2. Dispatch network request in the background
      const result = await sessionApi.action(id, nextAction);

      if (!isOnline || (result && "offlineQueued" in result)) {
        toast.info("Saved offline. Action queued for sync.");
        return;
      }

      // 3. Reconcile with server payload in-place without triggering 2 blocking GET queries
      if (result && typeof result === "object" && "id" in result) {
        setItems((current) =>
          current.map((s) => (s.id === id ? { ...s, ...(result as ActiveSession) } : s))
        );
      } else {
        // Silently sync server state in background without locking UI
        void load();
      }
    } catch (e) {
      // 4. Rollback to pristine state if the request fails
      setItems(previousItems);
      const msg = e instanceof Error ? e.message : t.actionFailed;
      setError(msg);
      toast.error(msg);
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
      const tables = await sessionApi.tables(selectedBranchId || undefined);
      const availableTables = tables.filter(
        (table) => table.id !== session.table.id
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
        error: e instanceof Error ? e.message : t.failedLoad,
        submitting: false,
      });
    }
  }

  async function submitSwitchTable() {
    if (!switchState?.selectedTableId) return;

    setSwitchState((current) =>
      current ? { ...current, submitting: true, error: "" } : current
    );

    try {
      await sessionApi.switchTable(
        switchState.session.id,
        switchState.selectedTableId
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
              : t.failedLoad,
        };
      });
    }
  }

  const noSwitchTables = useMemo(
    () => switchState && !switchState.loading && !switchState.tables.length,
    [switchState]
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="mt-1 text-slate-500">{t.description}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {t.startSession}
        </button>
      </div>

      {loading && <p className="mt-10">{t.loadingSessions}</p>}

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
          <button className="ml-3 underline cursor-pointer" onClick={load}>
            {t.retry}
          </button>
        </div>
      )}

      {!isOnline && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t.offlineMessage}
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center text-slate-500">
          {t.noActiveSessions}
        </div>
      )}

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {items.map((session) => (
          <article
            key={session.id}
            className="rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-brand-700">
                  Table {session.table.tableNumber}
                </p>
                <h2 className="mt-1 font-semibold">
                  {session.customer?.fullName ?? t.walkInCustomer}
                </h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                {session.branch?.name && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    {session.branch.name}
                  </span>
                )}
                <span
                  className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${
                    session.status === "paused"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-brand-100 text-brand-800"
                  }`}
                >
                  {session.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="my-6">
              <SessionClock session={session} />
            </div>

            <div className="flex flex-wrap gap-2">
              {session.status === "active" ? (
                <button
                  onClick={() => action(session.id, "pause")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.pause}
                </button>
              ) : (
                <button
                  onClick={() => action(session.id, "resume")}
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t.resume}
                </button>
              )}

              <button
                onClick={() => void openSwitchTable(session)}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.switchTable}
              </button>

              <button
                onClick={() => setPendingEndSessionId(session.id)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t.endSession}
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

      <ConfirmModal
        isOpen={Boolean(pendingEndSessionId)}
        title="End session"
        description={t.confirmEndSession}
        confirmText="End session"
        cancelText="Keep session"
        variant="warning"
        onConfirm={() => {
          if (pendingEndSessionId) {
            void action(pendingEndSessionId, "end");
          }
          setPendingEndSessionId(null);
        }}
        onCancel={() => setPendingEndSessionId(null)}
      />

      {switchState && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {t.switchTableHeading}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t.switchTableDescription} {switchState.session.table.tableNumber}
                </p>
              </div>
              <button
                onClick={() => setSwitchState(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {switchState.loading ? (
              <p className="mt-5 text-sm text-slate-600">
                {t.loadingAvailableTables}
              </p>
            ) : (
              <>
                <label className="mt-5 block text-sm font-medium">
                  {t.availableTables}
                  <select
                    className="mt-1 w-full rounded-lg border p-3 bg-white"
                    value={switchState.selectedTableId}
                    onChange={(e) =>
                      setSwitchState((current) =>
                        current
                          ? { ...current, selectedTableId: e.target.value }
                          : current
                      )
                    }
                    disabled={noSwitchTables || switchState.submitting}
                  >
                    <option value="">
                      {noSwitchTables
                        ? t.noAvailableTables
                        : t.selectAvailableTable}
                    </option>
                    {switchState.tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        Table {table.tableNumber} — {formatTableRate(table)}
                      </option>
                    ))}
                  </select>
                </label>

                {noSwitchTables && (
                  <p className="mt-3 text-sm text-slate-600">
                    {t.noTablesToSwitchTo}
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
                className="rounded-lg border px-4 py-2 text-sm cursor-pointer"
                disabled={switchState.submitting}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => void submitSwitchTable()}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
                disabled={
                  switchState.loading ||
                  switchState.submitting ||
                  !isOnline ||
                  !switchState.selectedTableId
                }
              >
                {switchState.submitting ? t.switching : t.switchTable}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}