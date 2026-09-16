"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { createStaff, type CreateStaffInput } from "@/features/auth";
import { useAuth, ApiError } from "@/lib/auth/auth-context";
import { fetchBranches } from "@/lib/api/branch";
import type { BranchItem } from "@/types/branch";

const ALL_ROLES: CreateStaffInput["role"][] = ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"];

// Fix (privilege escalation): a Manager must never be able to mint a new
// Owner account. Only an Owner can assign the OWNER role. Manager still sees
// Manager/Accountant/Cashier. Backend enforces the same rule independently —
// this is defence-in-depth, not the only guard.
function assignableRoles(actingRoles: string[] | undefined): CreateStaffInput["role"][] {
  if (actingRoles?.includes("OWNER")) return ALL_ROLES;
  return ALL_ROLES.filter((role) => role !== "OWNER");
}

const addStaffSchema = z.object({
  fullName: z.string().min(2, "Enter the staff member's full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "PIN must be 4-6 digits")
    .optional()
    .or(z.literal("")),
  branchId: z.string().optional(),
});

type FormState = z.infer<typeof addStaffSchema>;
type FieldErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "CASHIER",
  password: "",
  pin: "",
  branchId: "",
};

export function AddStaffForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => ({ ...initialForm, branchId: user?.branchId ?? "" }));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  const canManageStaff = user?.roles.some((r) => r === "OWNER" || r === "MANAGER");
  const isOwner = Boolean(user?.roles.includes("OWNER"));
  const isCrossBranch = !isOwner && Boolean(form.branchId) && form.branchId !== user?.branchId;
  const roleOptions = assignableRoles(user?.roles);
  const canAssignAnyBranch = user?.roles.some((role) => role === "OWNER" || role === "MANAGER");

  useEffect(() => {
    void fetchBranches({ limit: 100 }).then((result) => setBranches(result.branches));
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const parsed = addStaffSchema.safeParse(form);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        errors[issue.path[0] as keyof FormState] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    if (parsed.data.role === "CASHIER" && !parsed.data.branchId) {
      setFieldErrors({ branchId: "Branch is required for cashiers" });
      return;
    }

    if (!roleOptions.includes(parsed.data.role)) {
      // Defence-in-depth: a Manager should never be able to submit OWNER
      // even if the select were tampered with client-side. Backend rejects
      // this too, but fail fast here with a clear message.
      setFieldErrors({ role: "You are not allowed to assign this role." });
      return;
    }

    if (!user?.branchId && !parsed.data.branchId) {
      setFormError("Could not determine your branch. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const staff = await createStaff({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || undefined,
        role: parsed.data.role,
        ...(parsed.data.branchId ? { branchId: parsed.data.branchId } : {}),
        password: parsed.data.password,
        pin: parsed.data.pin || undefined,
      });
      if (staff.requiresApproval) {
        setSuccessMessage(staff.message || "Staff creation request submitted for Owner approval.");
      } else {
        setSuccessMessage(`${staff.fullName ?? "Staff member"} was added as ${staff.roles?.join(", ") ?? "staff"}.`);
      }
      setForm({ ...initialForm, branchId: user?.branchId ?? "" });
      onSuccess?.();
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!canManageStaff) {
    // Error state: role-gated, not a public page.
    return (
      <Alert variant="error">
        Only an Owner or Manager can add staff accounts.
      </Alert>
    );
  }

  return (
    // Issue 4 fix: autoComplete="off" on the form + autoComplete="new-password"
    // on the password field stop the browser's saved-credentials manager from
    // auto-filling this "create a NEW staff member" form with the currently
    // logged-in Owner/Manager's own saved email + password (which was making
    // it look like the form was showing "my profile" with the wrong role).
    <form
      onSubmit={handleSubmit}
      className="flex max-w-lg flex-col gap-4"
      noValidate
      autoComplete="off"
    >
      {formError && <Alert variant="error">{formError}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input
          id="fullName"
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          placeholder="e.g. Ahtesham Raza"
          autoComplete="off"
        />
      </FormField>

      <FormField label="Email" htmlFor="staffEmail" error={fieldErrors.email}>
        <Input
          id="staffEmail"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="staff@club.com"
          autoComplete="off"
        />
      </FormField>

      <FormField label="Phone (optional)" htmlFor="phone" error={fieldErrors.phone}>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+92 3XX XXXXXXX"
          autoComplete="off"
        />
      </FormField>

      <FormField label="Role" htmlFor="role" error={fieldErrors.role}>
        <Select id="role" value={form.role} onChange={(e) => update("role", e.target.value as FormState["role"])}>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Branch" htmlFor="branchId" error={fieldErrors.branchId}>
        <Select id="branchId" value={form.branchId} onChange={(e) => update("branchId", e.target.value)}>
          {canAssignAnyBranch && <option value="">All Branches</option>}
          {!canAssignAnyBranch && <option value="">Select a branch</option>}
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name ?? "Unnamed branch"}</option>)}
        </Select>
      </FormField>

      <FormField label="Temporary password" htmlFor="password" error={fieldErrors.password}>
        <PasswordInput
          id="password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
      </FormField>

      {form.role === "CASHIER" && (
        <FormField label="PIN (for shift login)" htmlFor="pin" error={fieldErrors.pin}>
          <Input
            id="pin"
            inputMode="numeric"
            maxLength={6}
            value={form.pin}
            onChange={(e) => update("pin", e.target.value.replace(/\D/g, ""))}
            placeholder="4-6 digits"
            autoComplete="off"
          />
        </FormField>
      )}

      {isCrossBranch && (
        <Alert variant="info">
          Creating a staff account for another branch requires explicit Owner approval. Your request will be submitted to the owner for review.
        </Alert>
      )}

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting
          ? "Processing…"
          : isCrossBranch
          ? "Submit for Owner Approval"
          : "Add staff member"}
      </Button>
    </form>
  );
}
