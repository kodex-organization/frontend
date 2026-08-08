import { useCallback, useEffect, useState } from "react";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../services/customer.service";

import type { Customer } from "../types";

type CreateCustomerInput = Omit<Customer, "id">;
type UpdateCustomerInput = Partial<CreateCustomerInput>;

export function useCustomers(search = "") {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getCustomers(search);

      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load customers",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);


  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

async function addCustomer(
  input: CreateCustomerInput,
) {
  try {
    setError(null);

    const customer = await createCustomer(input);

    setCustomers((prev) => [
      customer,
      ...prev,
    ]);

    return customer;

  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to create customer";

    setError(message);
    throw err;
  }
}


  async function editCustomer(
    id: string,
    input: UpdateCustomerInput,
  ) {
    const updated = await updateCustomer(
      id,
      input,
    );

    setCustomers((prev) =>
      prev.map((item) =>
        item.id === id
          ? updated
          : item,
      ),
    );

    return updated;
  }


  async function removeCustomer(id: string) {
    await deleteCustomer(id);

    setCustomers((prev) =>
      prev.filter(
        (item) => item.id !== id,
      ),
    );
  }


  return {
    customers,
    loading,
    error,
    empty: !loading && customers.length === 0,
    refetch: fetchCustomers,
    addCustomer,
    editCustomer,
    removeCustomer,
  };
}