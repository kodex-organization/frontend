import { apiFetch } from "@/lib/api/client";

import type {
  FloorViewTable,
  Notification,
  NotificationReadResult,
} from "./types";

interface RequestOptions {
  signal?: AbortSignal;
}

export function fetchFloorView(options: RequestOptions = {}) {
  return apiFetch<FloorViewTable[]>("/floor-view", {
    signal: options.signal,
  });
}

export function fetchNotifications(options: RequestOptions = {}) {
  return apiFetch<Notification[]>("/notifications", {
    signal: options.signal,
  });
}

export function markNotificationAsRead(
  id: string,
  options: RequestOptions = {},
) {
  return apiFetch<NotificationReadResult>(
    `/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "PATCH",
      signal: options.signal,
    },
  );
}
