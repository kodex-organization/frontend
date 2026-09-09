export interface CustomerTag {
  id: string;
  name: string | null;
}

export interface CustomerTagAssignment {
  id: string;
  assignedAt: string | null;
  tag: CustomerTag;
}

export interface Customer {
  id: string;
  branchId: string | null;
  branch?: {
    id: string;
    name: string | null;
  } | null;
  fullName: string | null;
  phone: string | null;
  cnic: string | null;
  createdAt?: string | null;
  tagAssignments: CustomerTagAssignment[];
}

export interface CustomerSession {
  id: string;
  tableId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  status: string | null;
}

export interface CustomerInvoice {
  id: string;
  invoiceNumber: string | null;
  total: number | string | null;
  status: string | null;
  createdAt: string;
}

export interface CustomerProfile extends Customer {
  sessions: CustomerSession[];
  invoices: CustomerInvoice[];
}

export interface CustomerVisitHistory {
  totalVisits: number;
  totalSpent: number;
  favouriteTable: string | null;
  visits: Array<Record<string, unknown>>;
}

export interface CustomerUdhaarHistory {
  outstandingBalance: number | string | null;
  history: Array<Record<string, unknown>>;
}

export interface CustomerCreateInput {
  branchId?: string | null;
  fullName: string;
  phone: string;
  cnic?: string | null;
  tagId?: string | null;
}

export interface CustomerUpdateInput {
  branchId?: string | null;
  fullName?: string;
  phone?: string;
  cnic?: string | null;
}

export interface CustomerTagInput {
  tagId: string;
}

export interface CustomerMergeInput {
  targetCustomerId: string;
}
