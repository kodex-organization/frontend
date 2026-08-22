import { FormEvent, useEffect, useState } from "react";
import { udhaarService } from "../services/udhaarService";
import type { ThresholdSettings } from "../types";
import { formatAmount } from "../utils/format";

interface ThresholdSettingsProps {
  isOwner: boolean;
}

export function ThresholdSettings({
  isOwner,
}: ThresholdSettingsProps) {
  const [settings, setSettings] =
    useState<ThresholdSettings | null>(null);
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    if (!isOwner) return;
    setLoading(true);
    setError("");

    try {
      const current = await udhaarService.getThresholds();
      setSettings(current);
      setLimit(
        current.individualLimit != null
          ? String(current.individualLimit)
          : "",
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load threshold settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isOwner]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    const parsed = Number(limit);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Enter a non-negative alert threshold.");
      return;
    }

    setSaving(true);

    try {
      const updated = await udhaarService.updateThresholds({
        individualLimit: parsed,
      });
      setSettings(updated);
      setNotice(
        `Alert threshold updated to ${formatAmount(parsed)}.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save threshold settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isOwner) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-bold text-slate-900">
          Udhaar alert threshold
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Notify when a customer&apos;s outstanding balance exceeds
          this limit.
        </p>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">
          Loading threshold settings...
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="block flex-1 text-xs font-semibold text-slate-600">
            Individual limit
            <input
              type="number"
              min="0"
              step="0.01"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              placeholder="e.g. 1000"
              className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saving ? "Saving..." : "Save threshold"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          {notice}
        </p>
      )}

      {settings?.individualLimit != null && (
        <p className="mt-3 text-xs text-slate-500">
          Current limit:{" "}
          <span className="font-semibold text-slate-700">
            {formatAmount(settings.individualLimit)}
          </span>{" "}
          — owners are notified in-app when a customer goes over.
        </p>
      )}
    </section>
  );
}
