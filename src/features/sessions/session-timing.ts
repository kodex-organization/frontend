// frontend/src/features/sessions/session-timing.ts
"use client";

import { useEffect, useState } from "react";

let serverTimeOffsetMs = 0;

/**
 * Calibrate client clock against server Date header to prevent
 * clock-skew jitter (e.g. price jumping 92 -> 90 -> 91 upon pause/resume).
 */
export function updateServerTimeOffset(serverDateHeader: string | number | Date | null | undefined) {
  if (!serverDateHeader) return;
  const serverMs =
    typeof serverDateHeader === "number"
      ? serverDateHeader
      : new Date(serverDateHeader).getTime();
  if (!Number.isNaN(serverMs)) {
    serverTimeOffsetMs = serverMs - Date.now();
  }
}

export function getServerNowMs(): number {
  return Date.now() + serverTimeOffsetMs;
}

export interface SessionTimingInput {
  startedAt?: string | Date | null;
  status?: string | null;
  pauses?: Array<{ pausedAt?: string | Date | null; resumedAt?: string | Date | null }> | null;
  pausedAt?: string | Date | null;
  appliedHourlyRate?: number | string | null;
  isPaused?: boolean;
  billingState?: string | null;
}

export interface SessionTimingResult {
  billableSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
  isPaused: boolean;
  charge: number;
  formattedDuration: string;       // e.g. "00:17:48"
  formattedActiveDuration: string; // e.g. "17m" or "1h 17m"
  formattedPauseDuration: string;  // e.g. "4m" or "1h 4m"
}

export function computeSessionTiming(
  session: SessionTimingInput | null | undefined,
  nowMs: number = getServerNowMs(),
): SessionTimingResult {
  if (!session || !session.startedAt) {
    return {
      billableSeconds: 0,
      pauseSeconds: 0,
      totalSeconds: 0,
      isPaused: false,
      charge: 0,
      formattedDuration: "00:00:00",
      formattedActiveDuration: "0m",
      formattedPauseDuration: "0m",
    };
  }

  const startedAtMs = new Date(session.startedAt).getTime();
  if (Number.isNaN(startedAtMs)) {
    return {
      billableSeconds: 0,
      pauseSeconds: 0,
      totalSeconds: 0,
      isPaused: false,
      charge: 0,
      formattedDuration: "00:00:00",
      formattedActiveDuration: "0m",
      formattedPauseDuration: "0m",
    };
  }

  const isPaused = Boolean(
    session.isPaused ||
      session.status?.toLowerCase() === "paused" ||
      session.billingState === "paused",
  );

  const pauses = Array.isArray(session.pauses) ? session.pauses : [];

  let completedPauseMs = 0;
  // Locate open pause record (last pause with no resumedAt)
  const openPauseRecord = [...pauses].reverse().find((p) => !p.resumedAt && p.pausedAt);

  for (const p of pauses) {
    if (!p.pausedAt) continue;
    const pStart = new Date(p.pausedAt).getTime();
    if (Number.isNaN(pStart)) continue;

    if (p.resumedAt) {
      const pEnd = new Date(p.resumedAt).getTime();
      if (!Number.isNaN(pEnd) && pEnd >= pStart) {
        completedPauseMs += pEnd - pStart;
      }
    }
  }

  let billableMs: number;
  let totalPauseMs: number;

  if (isPaused) {
    // When paused, playing time MUST STOP completely and freeze.
    // Determine when this pause started:
    let pauseStartMs: number | null = null;
    if (openPauseRecord?.pausedAt) {
      const parsed = new Date(openPauseRecord.pausedAt).getTime();
      if (!Number.isNaN(parsed)) pauseStartMs = parsed;
    }
    if (pauseStartMs === null && session.pausedAt) {
      const parsed = new Date(session.pausedAt).getTime();
      if (!Number.isNaN(parsed)) pauseStartMs = parsed;
    }

    // If no pause start recorded, freeze at current nowMs
    const freezeAtMs = pauseStartMs !== null && !Number.isNaN(pauseStartMs)
      ? pauseStartMs
      : nowMs;

    // Active billable time is frozen between startedAt and the moment of pause,
    // deducting all previous completed pauses:
    billableMs = Math.max(0, freezeAtMs - startedAtMs - completedPauseMs);

    // Pause duration counter (how long the session has been on pause):
    totalPauseMs = completedPauseMs + Math.max(0, nowMs - freezeAtMs);
  } else {
    // Active session: billable time ticks with nowMs
    billableMs = Math.max(0, nowMs - startedAtMs - completedPauseMs);
    totalPauseMs = completedPauseMs;
  }

  const billableSeconds = Math.max(0, Math.floor(billableMs / 1000));
  const pauseSeconds = Math.max(0, Math.floor(totalPauseMs / 1000));
  const totalSeconds = billableSeconds + pauseSeconds;

  const rate = Number(session.appliedHourlyRate) || 0;
  const charge = Number(((rate * billableSeconds) / 3600).toFixed(2));

  const hours = Math.floor(billableSeconds / 3600);
  const minutes = Math.floor((billableSeconds % 3600) / 60);
  const secs = billableSeconds % 60;

  const formattedDuration = [hours, minutes, secs]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");

  const formattedActiveDuration =
    hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const pauseHours = Math.floor(pauseSeconds / 3600);
  const pauseMinutes = Math.floor((pauseSeconds % 3600) / 60);
  const formattedPauseDuration =
    pauseHours > 0 ? `${pauseHours}h ${pauseMinutes}m` : `${pauseMinutes}m`;

  return {
    billableSeconds,
    pauseSeconds,
    totalSeconds,
    isPaused,
    charge,
    formattedDuration,
    formattedActiveDuration,
    formattedPauseDuration,
  };
}

/**
 * Live hook that triggers every second.
 * When active: advances billable time and charge.
 * When paused: keeps active billable time and charge strictly frozen,
 * and updates pause duration timer.
 */
export function useSessionTiming(session: SessionTimingInput | null | undefined): SessionTimingResult {
  const [now, setNow] = useState<number>(getServerNowMs());

  useEffect(() => {
    // Immediate sync
    setNow(getServerNowMs());
    const intervalId = window.setInterval(() => {
      setNow(getServerNowMs());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [session?.startedAt, session?.isPaused, session?.status]);

  return computeSessionTiming(session, now);
}
