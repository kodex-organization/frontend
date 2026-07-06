// src/app/(owner)/catalog/page.tsx
"use client";

import { useEffect, useState } from "react";
import { SnookerTable, CreateTableInput } from
  "@/features/catalog/types/catalog.types";
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
} from "@/services/catalog.service";

export default function CatalogPage() {
  // ── state ───────────────────────────────────
  const [tables, setTables]         = useState<SnookerTable[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [editingTable, setEditingTable] = useState<SnookerTable | null>(null);
  const [tableNumber, setTableNumber]   = useState("");
  const [hourlyRate, setHourlyRate]     = useState("");
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);

  // ── fetch tables on load ─────────────────────
  useEffect(() => {
    fetchTables();
  }, []);

  async function fetchTables() {
    try {
      setLoading(true);
      setError(null);
      const data = await getTables();
      setTables(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── open form ────────────────────────────────
  function handleOpenAdd() {
    setEditingTable(null);
    setTableNumber("");
    setHourlyRate("");
    setFormError(null);
    setShowForm(true);
  }

  function handleOpenEdit(table: SnookerTable) {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setHourlyRate(String(table.hourlyRate));
    setFormError(null);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingTable(null);
    setTableNumber("");
    setHourlyRate("");
    setFormError(null);
  }

  // ── save (add or edit) ────────────────────────
  async function handleSave() {
    setFormError(null);

    if (!tableNumber.trim()) {
      setFormError("Table number is required");
      return;
    }
    if (!hourlyRate || Number(hourlyRate) <= 0) {
      setFormError("Enter a valid hourly rate");
      return;
    }

    const input: CreateTableInput = {
      tableNumber: tableNumber.trim(),
      hourlyRate: Number(hourlyRate),
    };

    try {
      setSaving(true);
      if (editingTable) {
        const updated = await updateTable(editingTable.id, input);
        setTables((prev) =>
          prev.map((t) => (t.id === editingTable.id ? updated : t))
        );
      } else {
        const newTable = await createTable(input);
        setTables((prev) => [...prev, newTable]);
      }
      handleCloseForm();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── delete ────────────────────────────────────
  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this table?")) return;
    try {
      await deleteTable(id);
      setTables((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  // ── status color ──────────────────────────────
  const statusColor: Record<string, string> = {
    AVAILABLE:   "bg-green-100 text-green-700",
    OCCUPIED:    "bg-red-100 text-red-700",
    MAINTENANCE: "bg-yellow-100 text-yellow-700",
  };

  // ── render ────────────────────────────────────
  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Tables & Rates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage snooker tables and their hourly rates.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="rounded-md bg-green-700 px-4 py-2
                     text-sm font-medium text-white hover:bg-green-800"
        >
          + Add Table
        </button>
      </div>

      {/* loading */}
      {loading && (
        <p className="text-sm text-slate-400">Loading tables...</p>
      )}

      {/* error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200
                        p-4 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* empty */}
      {!loading && !error && tables.length === 0 && (
        <div className="flex flex-col items-center justify-center
                        rounded-lg border-2 border-dashed
                        border-slate-200 py-16">
          <p className="text-slate-400 text-sm">No tables added yet</p>
          <p className="text-slate-300 text-xs mt-1">
            Click + Add Table to get started
          </p>
        </div>
      )}

      {/* tables list */}
      {!loading && tables.length > 0 && (
        <div className="rounded-xl border border-slate-200
                        bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs
                             font-medium text-slate-500 uppercase">
                <th className="px-4 py-3 border-b">Table No.</th>
                <th className="px-4 py-3 border-b">Hourly Rate</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <tr key={table.id}
                    className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    Table #{table.tableNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Rs. {table.hourlyRate}/hr
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full
                                     text-xs font-medium
                                     ${statusColor[table.status]}`}>
                      {table.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit(table)}
                        className="rounded border border-blue-200
                                   px-3 py-1 text-xs text-blue-600
                                   hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(table.id)}
                        className="rounded border border-red-200
                                   px-3 py-1 text-xs text-red-500
                                   hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex
                        items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl
                          w-full max-w-md p-6">

            {/* modal header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingTable ? "Edit Table" : "Add New Table"}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* form error */}
            {formError && (
              <div className="mb-4 rounded-md bg-red-50
                              border border-red-200 p-3
                              text-sm text-red-600">
                {formError}
              </div>
            )}

            {/* inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium
                                  text-slate-700 mb-1">
                  Table Number
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 1, 2, VIP-1"
                  className="w-full rounded-lg border border-slate-300
                             px-3 py-2 text-sm focus:outline-none
                             focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium
                                  text-slate-700 mb-1">
                  Hourly Rate (Rs.)
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 200"
                  min={1}
                  className="w-full rounded-lg border border-slate-300
                             px-3 py-2 text-sm focus:outline-none
                             focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCloseForm}
                className="rounded-lg border border-slate-300
                           px-4 py-2 text-sm text-slate-600
                           hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green-700 px-4 py-2
                           text-sm text-white hover:bg-green-800
                           disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingTable ? "Save Changes" : "Add Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}