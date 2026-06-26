export type TenantId = string;
export type BranchId = string;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiHealth {
  status: string;
  service: string;
  environment: string;
}
