import { apiFetch } from "../../../lib/api/client";
import type { Customer } from "../types";

// Local aliases for upstream types that may not be exported yet.
// Use permissive shapes so callers can pass partial data until
// the shared types are updated to export these interfaces.
export type CreateCustomerInput = Partial<Customer> & Record<string, any>;
export type UpdateCustomerInput = Partial<Customer> & Record<string, any>;

// Local aliases: upstream types currently don't export these types
type CustomerVisit = unknown;
type CustomerUdhaar = unknown;


export async function getCustomers(
  query?: string,
  limit = 20,
): Promise<Customer[]> {
  const params = new URLSearchParams();

  if (query) {
    params.append("q", query);
  }

  params.append("limit", String(limit));

  return apiFetch(`/customers?${params.toString()}`);
}


export async function getCustomer(
  id: string,
): Promise<Customer> {
  return apiFetch(`/customers/${id}`);
}


export async function createCustomer(
  data: CreateCustomerInput,
): Promise<Customer> {
  return apiFetch("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}


export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput,
): Promise<Customer> {
  return apiFetch(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}


export async function deleteCustomer(
  id: string,
): Promise<void> {
  await apiFetch<void>(`/customers/${id}`, {
    method: "DELETE",
  });
}


export async function getCustomerVisits(
  id: string,
): Promise<CustomerVisit[]> {
  return apiFetch(`/customers/${id}/visits`);
}


export async function getCustomerUdhaar(
  id: string,
): Promise<CustomerUdhaar[]> {
  return apiFetch(`/customers/${id}/udhaar`);
}
