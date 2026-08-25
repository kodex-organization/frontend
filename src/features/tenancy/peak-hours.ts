import { apiFetch } from "@/lib/api/client";

export interface PeakHourRule {
  id: string;
  branchId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  multiplier: number;
  isEnabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface PeakHourRuleDraft {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  multiplier: string;
  isEnabled: boolean;
  effectiveFrom: string;
  effectiveTo: string;
}

export interface PeakHourRuleInput {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  multiplier: number;
  isEnabled: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export type PeakHourValidationErrors = Partial<
  Record<keyof PeakHourRuleDraft, string>
>;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function emptyPeakHourRuleDraft(): PeakHourRuleDraft {
  return {
    daysOfWeek: [],
    startTime: "17:00",
    endTime: "21:00",
    multiplier: "1.5",
    isEnabled: true,
    effectiveFrom: "",
    effectiveTo: "",
  };
}

export function peakHourRuleToDraft(rule: PeakHourRule): PeakHourRuleDraft {
  return {
    daysOfWeek: [...rule.daysOfWeek],
    startTime: rule.startTime,
    endTime: rule.endTime,
    multiplier: String(rule.multiplier),
    isEnabled: rule.isEnabled,
    effectiveFrom: rule.effectiveFrom ?? "",
    effectiveTo: rule.effectiveTo ?? "",
  };
}

export function validatePeakHourRuleDraft(
  draft: PeakHourRuleDraft,
): PeakHourValidationErrors {
  const errors: PeakHourValidationErrors = {};
  if (
    draft.daysOfWeek.length === 0 ||
    new Set(draft.daysOfWeek).size !== draft.daysOfWeek.length ||
    draft.daysOfWeek.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    )
  ) {
    errors.daysOfWeek = "Select at least one valid day.";
  }

  if (!TIME_PATTERN.test(draft.startTime)) {
    errors.startTime = "Enter a valid start time.";
  }
  if (!TIME_PATTERN.test(draft.endTime)) {
    errors.endTime = "Enter a valid end time.";
  } else if (draft.startTime === draft.endTime) {
    errors.endTime = "Start and end times must differ.";
  }

  const multiplier = Number(draft.multiplier);
  if (
    draft.multiplier.trim() === "" ||
    !Number.isFinite(multiplier) ||
    multiplier < 1 ||
    multiplier > 5 ||
    !/^\d+(?:\.\d{1,2})?$/.test(draft.multiplier)
  ) {
    errors.multiplier = "Multiplier must be between 1.00 and 5.00.";
  }

  if (draft.effectiveFrom && !isValidDate(draft.effectiveFrom)) {
    errors.effectiveFrom = "Enter a valid effective date.";
  }
  if (draft.effectiveTo && !isValidDate(draft.effectiveTo)) {
    errors.effectiveTo = "Enter a valid end date.";
  } else if (
    draft.effectiveFrom &&
    draft.effectiveTo &&
    draft.effectiveTo < draft.effectiveFrom
  ) {
    errors.effectiveTo = "End date must be on or after the start date.";
  }

  return errors;
}

export function peakHourRuleInput(
  draft: PeakHourRuleDraft,
): PeakHourRuleInput {
  const errors = validatePeakHourRuleDraft(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error("Peak-hour rule is invalid");
  }

  return {
    daysOfWeek: [...draft.daysOfWeek].sort((left, right) => left - right),
    startTime: draft.startTime,
    endTime: draft.endTime,
    multiplier: Number(draft.multiplier),
    isEnabled: draft.isEnabled,
    effectiveFrom: draft.effectiveFrom || null,
    effectiveTo: draft.effectiveTo || null,
  };
}

export function getPeakHourRules(branchId: string) {
  return apiFetch<PeakHourRule[]>(
    `/tenancy/branches/${encodeURIComponent(branchId)}/peak-hour-rules`,
  );
}

export function createPeakHourRule(
  branchId: string,
  input: PeakHourRuleInput,
) {
  return apiFetch<PeakHourRule>(
    `/tenancy/branches/${encodeURIComponent(branchId)}/peak-hour-rules`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updatePeakHourRule(
  branchId: string,
  ruleId: string,
  input: PeakHourRuleInput,
) {
  return apiFetch<PeakHourRule>(
    `/tenancy/branches/${encodeURIComponent(
      branchId,
    )}/peak-hour-rules/${encodeURIComponent(ruleId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}
