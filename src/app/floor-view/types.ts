// src/modules/floor-view/types.ts

export interface FloorViewSession {
  sessionId: string;
  customerName: string;
  startedAt: string | null;
  expectedEndTime: string | null;
  appliedHourlyRate: number | null;
  isPaused: boolean;
  isOvertime: boolean;
}

export interface FloorViewTable {
  tableId: string;
  tableNumber: string | null;
  status: string | null;
  session: FloorViewSession | null;
}

export interface FloorViewResponse {
  success: boolean;
  data: FloorViewTable[];
  error: string | null;
}
// src/modules/floor-view/types.ts

export interface FloorViewSession {
  sessionId: string;
  customerName: string;
  startedAt: string | null;
  expectedEndTime: string | null;
  appliedHourlyRate: number | null;
  isPaused: boolean;
  isOvertime: boolean;
}

export interface FloorViewTable {
  tableId: string;
  tableNumber: string | null;
  status: string | null;
  session: FloorViewSession | null;
}

export interface FloorViewResponse {
  success: boolean;
  data: FloorViewTable[];
  error: string | null;
}

export interface Notification {
  id: string;
  category: string;
  payload: string;
  status: string;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  error: string | null;
}

export interface Stats {
  total: number;
  available: number;
  occupied: number;
  overtime: number;
  paused: number;
}
