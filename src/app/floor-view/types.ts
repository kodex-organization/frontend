export type FloorTableStatus =
  | "available"
  | "occupied"
  | "maintenance"
  | "reserved"
  | "inactive";

export interface FloorViewSession {
  sessionId: string;
  customerName: string;
  startedAt: string | null;
  expectedEndTime: string | null;
  appliedHourlyRate: number | null;
  durationSeconds: number;
  pauseDurationSeconds: number;
  billableDurationSeconds: number;
  estimatedCharge: number | null;
  billingState:
    | "draft"
    | "open"
    | "paid"
    | "partially_paid"
    | "void"
    | "accruing"
    | "paused";
  isPaused: boolean;
  isOvertime: boolean;
}

export interface FloorViewTable {
  tableId: string;
  tableNumber: string | null;
  status: FloorTableStatus | null;
  currency: string | null;
  session: FloorViewSession | null;
}

export type NotificationStatus =
  | "queued"
  | "pending"
  | "sent"
  | "failed"
  | "read";

export interface Notification {
  id: string;
  branchId: string | null;
  category: string | null;
  payload: string | null;
  status: NotificationStatus | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationReadResult {
  id: string;
  status: "read";
  readAt: string;
}

export interface Stats {
  total: number;
  available: number;
  occupied: number;
  overtime: number;
  paused: number;
}

export function isUnreadNotification(notification: Notification): boolean {
  return notification.status !== "read" && notification.readAt === null;
}

export function notificationMessage(notification: Notification): string {
  if (notification.payload) {
    try {
      const payload: unknown = JSON.parse(notification.payload);
      if (
        typeof payload === "object" &&
        payload !== null &&
        "message" in payload &&
        typeof payload.message === "string" &&
        payload.message.trim()
      ) {
        return payload.message;
      }
    } catch {
      if (notification.payload.trim()) return notification.payload;
    }
  }

  return notification.category === "overtime"
    ? "A table has exceeded its expected end time."
    : "A new notification is available.";
}
