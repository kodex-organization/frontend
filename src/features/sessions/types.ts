export interface Customer { id: string; fullName: string; phone: string; cnic: string | null }
export interface TableOption { id: string; tableNumber: string; defaultHourlyRate: string }
export interface SessionPause { id: string; pausedAt: string; resumedAt: string | null }
export interface ActiveSession { id: string; status: "active" | "paused" | "ended"; startedAt: string; endedAt: string | null; appliedHourlyRate: string; table: TableOption; customer: Customer | null; pauses: SessionPause[] }
export interface ApiResponse<T> { success: boolean; data: T; error: { message: string } | null }
