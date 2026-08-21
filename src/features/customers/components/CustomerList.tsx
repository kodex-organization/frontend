"use client";

import type { Customer } from "../types";

interface CustomerListProps {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  onSelect?: (customer: Customer) => void;
}

function CustomerCard({
  customer,
  onClick,
}: {
  customer: Customer;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
    >
      <div className="text-sm font-semibold text-slate-900">
        {String(customer.id)}
      </div>
    </button>
  );
}

export default function CustomerList({
  customers,
  loading,
  error,
  onSelect,
}: CustomerListProps) {
  // Loading State
  if (loading) {
    return (
      <div className="p-4 text-center">
        Loading customers...
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-600">
        {error}
      </div>
    );
  }

  // Empty State
  if (customers.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No customers found.
      </div>
    );
  }

  // Success State
  return (
    <div className="grid gap-4">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onClick={() => onSelect?.(customer)}
        />
      ))}
    </div>
  );
}