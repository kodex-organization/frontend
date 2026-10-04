"use client";

import { Clock3, LoaderCircle, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { ApiError } from "@/lib/api/client";
import { isNetworkFailure, loadWithOfflineSnapshot } from "@/lib/sync/offline-reference-cache";
import { OfflineSnapshotNotice } from "@/components/sync/offline-snapshot-notice";
import { useAuth } from "@/lib/auth/auth-context";
import { getAssignedBranches, type AssignedBranch } from "../branch-switching";
import {
  createPeakHourRule,
  emptyPeakHourRuleDraft,
  getPeakHourRules,
  peakHourRuleInput,
  peakHourRuleToDraft,
  updatePeakHourRule,
  validatePeakHourRuleDraft,
  type PeakHourRule,
  type PeakHourRuleDraft,
  type PeakHourValidationErrors,
} from "../peak-hours";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function weekdayLabels(days: number[]) {
  return WEEKDAYS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(", ");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function PeakHourSettingsScreen() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<AssignedBranch[]>([]);
  const selectedBranchId = user?.branchId ?? "";
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [rules, setRules] = useState<PeakHourRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [draft, setDraft] = useState<PeakHourRuleDraft>(emptyPeakHourRuleDraft);
  const [validationErrors, setValidationErrors] =
    useState<PeakHourValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const loadBranches = useCallback(async () => {
    setBranchesLoading(true);
    try {
      const { data: assigned } = await loadWithOfflineSnapshot(
        `assigned-branches:${user?.id ?? ""}`,
        () => getAssignedBranches(),
      );
      setBranches(assigned);
      setBranchesError(null);
    } catch (error) {
      setBranchesError(
        isNetworkFailure(error)
          ? "You are offline. Branch details will appear after the first online visit."
          : errorMessage(error, "Could not load branches."),
      );
    } finally {
      setBranchesLoading(false);
    }
  }, [user?.branchId]);

  const loadRules = useCallback(async (branchId: string) => {
    if (!branchId) {
      setRules([]);
      return;
    }
    setRulesLoading(true);
    setRulesError(null);
    try {
      const { data, savedAt } = await loadWithOfflineSnapshot(
        `peak-rules:${branchId}`,
        () => getPeakHourRules(branchId),
      );
      setRules(data);
      setSnapshotAt(savedAt);
    } catch (error) {
      setRulesError(
        isNetworkFailure(error)
          ? "You are offline and no saved peak-hour rules exist on this device yet. Open this page once while online."
          : errorMessage(error, "Could not load peak-hour rules."),
      );
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    setEditingRuleId(null);
    setDraft(emptyPeakHourRuleDraft());
    setValidationErrors({});
    setFormError(null);
    void loadRules(selectedBranchId);
  }, [loadRules, selectedBranchId]);

  const updateDraft = <Key extends keyof PeakHourRuleDraft>(
    key: Key,
    value: PeakHourRuleDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidationErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setDraft(emptyPeakHourRuleDraft());
    setValidationErrors({});
    setFormError(null);
  };

  const startEdit = (rule: PeakHourRule) => {
    setEditingRuleId(rule.id);
    setDraft(peakHourRuleToDraft(rule));
    setValidationErrors({});
    setFormError(null);
  };

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBranchId || saving) return;

    const errors = validatePeakHourRuleDraft(draft);
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const input = peakHourRuleInput(draft);
      if (editingRuleId) {
        await updatePeakHourRule(selectedBranchId, editingRuleId, input);
        toast.success("Peak-hour rule updated.");
      } else {
        await createPeakHourRule(selectedBranchId, input);
        toast.success("Peak-hour rule created.");
      }
      cancelEdit();
      await loadRules(selectedBranchId);
    } catch (error) {
      setFormError(errorMessage(error, "Could not save the peak-hour rule."));
    } finally {
      setSaving(false);
    }
  };

  const toggleRule = async (rule: PeakHourRule) => {
    if (togglingRuleId) return;
    setTogglingRuleId(rule.id);
    setRulesError(null);
    try {
      const input = peakHourRuleInput({
        ...peakHourRuleToDraft(rule),
        isEnabled: !rule.isEnabled,
      });
      await updatePeakHourRule(selectedBranchId, rule.id, input);
      await loadRules(selectedBranchId);
      toast.success(`Peak-hour rule ${rule.isEnabled ? "disabled" : "enabled"}.`);
    } catch (error) {
      setRulesError(errorMessage(error, "Could not update the rule status."));
    } finally {
      setTogglingRuleId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Peak hours</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure branch-local rate multipliers.
          </p>
        </div>
        <p className="text-sm text-slate-500">Active branch: {selectedBranch?.name ?? "See header"}</p>
      </div>

      {selectedBranch ? (
        <p className="mt-2 text-xs text-slate-500">
          Timezone: {selectedBranch.timezone ?? "Not configured"}
        </p>
      ) : null}

      {snapshotAt ? <div className="mt-5"><OfflineSnapshotNotice savedAt={snapshotAt} /></div> : null}

      {branchesError ? (
        <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {branchesError}
          <button
            type="button"
            onClick={() => void loadBranches()}
            className="ml-3 font-semibold underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <section aria-labelledby="peak-rule-list-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="peak-rule-list-heading" className="text-base font-semibold text-slate-900">
              Rules
            </h2>
            <button
              type="button"
              onClick={() => void loadRules(selectedBranchId)}
              disabled={rulesLoading || !selectedBranchId}
              title="Refresh peak-hour rules"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 ${rulesLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {rulesError ? (
            <div role="alert" className="mt-3 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900">
              {rulesError}
            </div>
          ) : null}

          <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
            {rulesLoading && rules.length === 0 ? (
              <div className="flex min-h-44 items-center justify-center gap-2 text-sm text-slate-500">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading rules
              </div>
            ) : rules.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center text-center text-slate-500">
                <Clock3 aria-hidden="true" className="h-7 w-7" />
                <p className="mt-2 text-sm">No peak-hour rules configured.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {rules.map((rule) => (
                  <li key={rule.id} className="px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {rule.startTime} - {rule.endTime}
                          </p>
                          <span className="rounded px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
                            {rule.multiplier}x
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {weekdayLabels(rule.daysOfWeek)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rule.effectiveFrom ?? "No start date"} - {rule.effectiveTo ?? "No end date"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="checkbox"
                            checked={rule.isEnabled}
                            disabled={togglingRuleId !== null}
                            onChange={() => void toggleRule(rule)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600"
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          title="Edit peak-hour rule"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          <span className="sr-only">Edit rule</span>
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="peak-rule-form-heading" className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="peak-rule-form-heading" className="text-base font-semibold text-slate-900">
              {editingRuleId ? "Edit rule" : "New rule"}
            </h2>
            {editingRuleId ? (
              <button
                type="button"
                onClick={cancelEdit}
                title="Cancel editing"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only">Cancel editing</span>
              </button>
            ) : (
              <Plus aria-hidden="true" className="h-5 w-5 text-brand-600" />
            )}
          </div>

          <form onSubmit={saveRule} className="mt-5 space-y-4" noValidate>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Days</legend>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7 xl:grid-cols-4 2xl:grid-cols-7">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="flex h-9 items-center justify-center gap-1 rounded-md border border-slate-300 text-xs font-medium text-slate-700 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700">
                    <input
                      type="checkbox"
                      checked={draft.daysOfWeek.includes(day.value)}
                      onChange={(event) =>
                        updateDraft(
                          "daysOfWeek",
                          event.target.checked
                            ? [...draft.daysOfWeek, day.value]
                            : draft.daysOfWeek.filter((value) => value !== day.value),
                        )
                      }
                      className="sr-only"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              {validationErrors.daysOfWeek ? (
                <p className="mt-1 text-xs text-red-700">{validationErrors.daysOfWeek}</p>
              ) : null}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700">
                Start time
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) => updateDraft("startTime", event.target.value)}
                  className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                {validationErrors.startTime ? (
                  <span className="mt-1 block text-xs text-red-700">{validationErrors.startTime}</span>
                ) : null}
              </label>
              <label className="text-sm font-medium text-slate-700">
                End time
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) => updateDraft("endTime", event.target.value)}
                  className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                {validationErrors.endTime ? (
                  <span className="mt-1 block text-xs text-red-700">{validationErrors.endTime}</span>
                ) : null}
              </label>
            </div>

            <label className="block text-sm font-medium text-slate-700">
              Rate multiplier
              <input
                type="number"
                min="1"
                max="5"
                step="0.05"
                value={draft.multiplier}
                onChange={(event) => updateDraft("multiplier", event.target.value)}
                className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              {validationErrors.multiplier ? (
                <span className="mt-1 block text-xs text-red-700">{validationErrors.multiplier}</span>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-slate-700">
                Effective from
                <input
                  type="date"
                  value={draft.effectiveFrom}
                  max={draft.effectiveTo || undefined}
                  onChange={(event) => updateDraft("effectiveFrom", event.target.value)}
                  className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                {validationErrors.effectiveFrom ? (
                  <span className="mt-1 block text-xs text-red-700">{validationErrors.effectiveFrom}</span>
                ) : null}
              </label>
              <label className="text-sm font-medium text-slate-700">
                Effective to
                <input
                  type="date"
                  value={draft.effectiveTo}
                  min={draft.effectiveFrom || undefined}
                  onChange={(event) => updateDraft("effectiveTo", event.target.value)}
                  className="mt-1 block h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                {validationErrors.effectiveTo ? (
                  <span className="mt-1 block text-xs text-red-700">{validationErrors.effectiveTo}</span>
                ) : null}
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draft.isEnabled}
                onChange={(event) => updateDraft("isEnabled", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Enabled
            </label>

            {formError ? (
              <div role="alert" className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-900">
                {formError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving || !selectedBranchId}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="h-4 w-4" />
              )}
              {editingRuleId ? "Save changes" : "Create rule"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}