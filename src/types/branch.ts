export interface BranchItem {
  id: string;
  tenantId: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  peakHourMultiplier: number | string | null;
  discountLimitPercent: number | string | null;
  maxUdhaarPerCustomer: number | string | null;
  maxSessionMinutes: number | null;
  operatingHoursStart: string | null;
  operatingHoursEnd: string | null;
  standardTaxPercent: number | string | null;
  concessionTaxPercent: number | string | null;
  taxRegistrationNumber: string | null;
  serviceChargePercent: number | string | null;
  isActive: boolean;
  deletedAt: string | null;
  lastInvoiceNumber: number;
  _count?: {
    tablesCatalog: number;
    sessions: number;
    users: number;
  };
}

export interface CreateBranchPayload {
  name: string;
  address: string;
  phone?: string;
  currency?: string;
  timezone?: string;
  language?: string;
  peakHourMultiplier?: number;
  discountLimitPercent?: number;
  maxUdhaarPerCustomer?: number;
  maxSessionMinutes?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  standardTaxPercent?: number;
  concessionTaxPercent?: number;
  taxRegistrationNumber?: string;
  serviceChargePercent?: number;
  isActive?: boolean;
}

export interface UpdateBranchPayload extends Partial<CreateBranchPayload> {}

export interface UpdateBranchConfigPayload {
  peakHourMultiplier?: number;
  discountLimitPercent?: number;
  maxUdhaarPerCustomer?: number;
  maxSessionMinutes?: number;
  standardTaxPercent?: number;
  concessionTaxPercent?: number;
  taxRegistrationNumber?: string;
  serviceChargePercent?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  language?: string;
  currency?: string;
  timezone?: string;
}

export interface BranchFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface BranchListResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  branches: BranchItem[];
}