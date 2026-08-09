"use client";

import { useState } from "react";

type CreateCustomerInput = {
  fullName: string;
  phone: string;
  cnic?: string;
};

interface CustomerFormProps {
  onSubmit: (
    data: CreateCustomerInput,
  ) => Promise<void>;
}

export default function CustomerForm({
  onSubmit,
}: CustomerFormProps) {

  const [form, setForm] = useState<CreateCustomerInput>({
    fullName: "",
    phone: "",
    cnic: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  function updateField(
    key: keyof CreateCustomerInput,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }


  async function handleSubmit(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      await onSubmit(form);

      setForm({
        fullName: "",
        phone: "",
        cnic: "",
      });

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create customer",
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border p-4"
    >

      <input
        value={form.fullName}
        onChange={(e) =>
          updateField(
            "fullName",
            e.target.value,
          )
        }
        placeholder="Customer name"
        className="w-full rounded border px-3 py-2"
        required
      />


      <input
        value={form.phone}
        onChange={(e) =>
          updateField(
            "phone",
            e.target.value,
          )
        }
        placeholder="Phone number"
        className="w-full rounded border px-3 py-2"
        required
      />


      <input
        value={form.cnic ?? ""}
        onChange={(e) =>
          updateField(
            "cnic",
            e.target.value,
          )
        }
        placeholder="CNIC (optional)"
        className="w-full rounded border px-3 py-2"
      />


      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}


      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading
          ? "Saving..."
          : "Create Customer"}
      </button>

    </form>
  );
}