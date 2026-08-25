"use client";

import {
  Activity,
  BellRing,
  Building2,
  Clock3,
  Radio,
  RefreshCw,
  ServerCog,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { formatDateTime } from "../format";
import {
  displayTelemetryValue,
  getPlatformHealth,
  type PlatformHealth,
} from "../health";

function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function HeartbeatStatus({ status }: { status: PlatformHealth["sync"]["heartbeat"]["status"] }) {
  const styles =
    status === "healthy"
      ? "bg-emerald-50 text-emerald-700"
      : status === "degraded"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${styles}`}>
      {status}
    </span>
  );
}

export function PlatformHealthDashboard() {
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [heartbeatStaleMinutes, setHeartbeatStaleMinutes] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await getPlatformHealth(windowMinutes, heartbeatStaleMinutes));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not load platform health.",
      );
    } finally {
      setLoading(false);
    }
  }, [heartbeatStaleMinutes, windowMinutes]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-brand-700">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Platform health
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Current platform totals and recent service telemetry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-slate-600">
            Metric window
            <Select
              aria-label="Metric window"
              value={windowMinutes}
              onChange={(event) => setWindowMinutes(Number(event.target.value))}
              className="mt-1 w-36"
            >
              <option value="15">15 minutes</option>
              <option value="60">1 hour</option>
              <option value="360">6 hours</option>
              <option value="1440">24 hours</option>
            </Select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Stale heartbeat
            <Select
              aria-label="Stale heartbeat threshold"
              value={heartbeatStaleMinutes}
              onChange={(event) =>
                setHeartbeatStaleMinutes(Number(event.target.value))
              }
              className="mt-1 w-36"
            >
              <option value="2">2 minutes</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="60">1 hour</option>
            </Select>
          </label>
          <Button
            variant="outline"
            size="icon"
            title="Refresh health metrics"
            aria-label="Refresh health metrics"
            isLoading={loading}
            onClick={() => void loadHealth()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-3">
          <Alert variant="error">{error}</Alert>
          <Button variant="outline" size="sm" onClick={() => void loadHealth()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading && !health ? (
        <div className="border-y border-slate-200 py-12 text-center text-sm text-slate-500">
          Loading health metrics...
        </div>
      ) : health ? (
        <>
          <section>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Tenants" value={health.totals.tenants} icon={Building2} />
              <Metric label="Branches" value={health.totals.branches} icon={Store} />
              <Metric label="Active sessions" value={health.totals.activeSessions} icon={Activity} />
            </div>
          </section>

          <section className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Sync and heartbeat</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Device freshness and sync batches observed in this window.
                </p>
              </div>
              <HeartbeatStatus status={health.sync.heartbeat.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Reporting devices"
                value={displayTelemetryValue(
                  health.sync.heartbeat.available,
                  health.sync.heartbeat.reportingDevices,
                )}
                detail={`${health.sync.heartbeat.registeredDevices} registered`}
                icon={Radio}
              />
              <Metric
                label="Stale devices"
                value={displayTelemetryValue(
                  health.sync.heartbeat.available,
                  health.sync.heartbeat.staleDevices,
                )}
                detail={`${health.sync.heartbeat.missingHeartbeatDevices} missing heartbeat`}
                icon={Clock3}
              />
              <Metric
                label="Failed sync batches"
                value={displayTelemetryValue(
                  health.sync.batches.available,
                  health.sync.batches.failedBatches,
                )}
                detail={
                  health.sync.batches.available
                    ? `${health.sync.batches.observedBatches} batches observed`
                    : "No sync batch telemetry in this window"
                }
                icon={ServerCog}
              />
              <Metric
                label="Latest heartbeat"
                value={
                  health.sync.heartbeat.available
                    ? formatDateTime(health.sync.heartbeat.latestHeartbeatAt)
                    : "Unavailable"
                }
                icon={Clock3}
              />
            </div>
          </section>

          <section className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">Delivery and API</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Notification failures"
                value={displayTelemetryValue(
                  health.notifications.delivery.available,
                  health.notifications.delivery.failedDeliveries,
                )}
                detail={
                  health.notifications.delivery.available
                    ? `${health.notifications.delivery.observedDeliveries} deliveries observed`
                    : "No delivery telemetry in this window"
                }
                icon={BellRing}
              />
              <Metric
                label="API error rate"
                value={displayTelemetryValue(
                  health.api.available,
                  health.api.errorRate,
                  (rate) => `${(rate * 100).toFixed(2)}%`,
                )}
                detail={
                  health.api.available
                    ? `${health.api.observedRequests} process requests observed`
                    : "No API response samples in this window"
                }
                icon={Activity}
              />
              <Metric
                label="API server errors"
                value={displayTelemetryValue(
                  health.api.available,
                  health.api.serverErrors,
                )}
                detail="HTTP 5xx responses"
                icon={ServerCog}
              />
              <Metric
                label="Data freshness"
                value={formatDateTime(health.generatedAt)}
                detail={`${health.freshness.windowMinutes}-minute observation window`}
                icon={Clock3}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No platform health data is available.
        </div>
      )}
    </div>
  );
}
