import { platformAdminFetch } from "@/lib/platform-admin/client";

export interface PlatformHealth {
  generatedAt: string;
  freshness: {
    windowFrom: string;
    windowTo: string;
    windowMinutes: number;
    heartbeatStaleMinutes: number;
  };
  totals: {
    tenants: number;
    branches: number;
    activeSessions: number;
  };
  sync: {
    heartbeat: {
      available: boolean;
      status: "healthy" | "degraded" | "unavailable";
      registeredDevices: number;
      reportingDevices: number;
      healthyDevices: number | null;
      staleDevices: number | null;
      missingHeartbeatDevices: number;
      latestHeartbeatAt: string | null;
    };
    batches: {
      available: boolean;
      observedBatches: number;
      failedBatches: number | null;
    };
  };
  notifications: {
    delivery: {
      available: boolean;
      observedDeliveries: number;
      failedDeliveries: number | null;
    };
  };
  api: {
    available: boolean;
    scope: "process";
    observedRequests: number;
    serverErrors: number | null;
    errorRate: number | null;
    telemetryStartedAt: string;
    latestSampleAt: string | null;
  };
}

export function displayTelemetryValue(
  available: boolean,
  value: number | null,
  formatter: (value: number) => string = String,
) {
  return available && value !== null ? formatter(value) : "Unavailable";
}

export function getPlatformHealth(
  windowMinutes: number,
  heartbeatStaleMinutes: number,
) {
  const query = new URLSearchParams({
    windowMinutes: String(windowMinutes),
    heartbeatStaleMinutes: String(heartbeatStaleMinutes),
  });
  return platformAdminFetch<PlatformHealth>(
    `/super-admin/health?${query.toString()}`,
  );
}
