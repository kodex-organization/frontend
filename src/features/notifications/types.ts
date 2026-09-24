export type NotificationStatus = "queued" | "pending" | "sent" | "failed" | "read";
export type NotificationChannel = "in_app" | "push" | "sms" | string;
export type { DeliveryLog, NotificationCategory, NotificationPreference } from "./api";

export interface Notification {
  id: string;
  branchId?: string | null;
  category: string | null;
  channel?: NotificationChannel | null;
  payload: string | null;
  status: NotificationStatus | null;
  createdAt: string;
  readAt: string | null;
}

export function isUnread(notification: Notification) {
  return notification.status !== "read" && notification.readAt === null;
}

export function notificationPayload(notification: Notification): Record<string, unknown> {
  if (!notification.payload) return {};
  try {
    const parsed: unknown = JSON.parse(notification.payload);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function notificationMessage(notification: Notification) {
  const payload = notificationPayload(notification);
  if (notification.category === "announcement") {
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    if (title && body) return `${title}: ${body}`;
    if (title) return title;
    if (body) return body;
  }
  return typeof payload.message === "string" && payload.message.trim()
    ? payload.message
    : notification.category === "overtime"
      ? "A session has exceeded its expected end time."
      : notification.category === "manager_takeover"
        ? "A manager takeover requires your attention."
        : "A new notification is available.";
}

export function notificationHref(notification: Notification) {
  const payload = notificationPayload(notification);
  if (typeof payload.sessionId === "string") return `/sessions?sessionId=${encodeURIComponent(payload.sessionId)}`;
  if (typeof payload.invoiceId === "string") return `/billing/${encodeURIComponent(payload.invoiceId)}`;
  if (typeof payload.customerId === "string") return `/customers?customerId=${encodeURIComponent(payload.customerId)}`;
  if (typeof payload.reportId === "string") return `/reports?reportId=${encodeURIComponent(payload.reportId)}`;
  return null;
}