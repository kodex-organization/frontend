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

function assignableRoles(actingRoles: string[] | undefined): CreateStaffInput["role"][] {
  const roles = (actingRoles ?? []).map((r) => r.toUpperCase());
  if (roles.includes("OWNER")) return ALL_ROLES;
  // Managers can only create operational counter staff
  return ["CASHIER"];
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

  const isOwner = Boolean(user?.roles.some((r) => r.toUpperCase() === "OWNER"));
  const isManager = Boolean(user?.roles.some((r) => r.toUpperCase() === "MANAGER"));
  const canManageStaff = isOwner || isManager;

  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    role: isOwner ? "CASHIER" : "CASHIER",
    branchId: isOwner ? "" : (user?.branchId ?? ""),
  }));

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);

  const roleOptions = assignableRoles(user?.roles);

  useEffect(() => {
    void fetchBranches({ limit: 100 }).then((result) => setBranches(result.branches));
  }, []);

  // Keep non-owner locked to their current branch and role
  useEffect(() => {
    if (!isOwner) {
      setForm((prev) => ({
        ...prev,
        role: "CASHIER",
        branchId: user?.branchId ?? prev.branchId,
      }));
    }
  }, [isOwner, user?.branchId]);

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

    // Enforce branch and role constraints
    const targetRole = isOwner ? parsed.data.role : "CASHIER";
    const targetBranchId = isOwner ? parsed.data.branchId : (user?.branchId || parsed.data.branchId);

    if (targetRole === "CASHIER" && !targetBranchId) {
      setFieldErrors({ branchId: "Branch is required for cashiers" });
      return;
    }

    if (!isOwner && parsed.data.role !== "CASHIER") {
      setFieldErrors({ role: "Managers can only onboard Cashiers." });
      return;
    }

    if (!user?.branchId && !targetBranchId) {
      setFormError("Could not determine branch. Please sign in again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const staff = await createStaff({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone || undefined,
        role: targetRole,
        ...(targetBranchId ? { branchId: targetBranchId } : {}),
        password: parsed.data.password,
        pin: parsed.data.pin || undefined,
      });

      if (staff.requiresApproval) {
        setSuccessMessage(staff.message || "Staff creation request submitted for Owner approval.");
      } else {
        setSuccessMessage(`${staff.fullName ?? "Staff member"} was added as ${staff.roles?.join(", ") ?? targetRole}.`);
      }

      setForm({
        ...initialForm,
        role: "CASHIER",
        branchId: isOwner ? "" : (user?.branchId ?? ""),
      });
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
    return (
      <Alert variant="error">
        Only an Owner or Manager can add staff accounts.
      </Alert>
    );
  }

  const assignedBranchName =
    branches.find((b) => b.id === (user?.branchId || form.branchId))?.name ?? "Current Branch";

  return (
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
        {isOwner ? (
          <Select id="role" value={form.role} onChange={(e) => update("role", e.target.value as FormState["role"])}>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0) + role.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="role"
            readOnly
            disabled
            value="Cashier"
            className="bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
          />
        )}
      </FormField>

      <FormField label="Branch" htmlFor="branchId" error={fieldErrors.branchId}>
        {isOwner ? (
          <Select id="branchId" value={form.branchId} onChange={(e) => update("branchId", e.target.value)}>
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name ?? "Unnamed branch"}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            id="branchId"
            readOnly
            disabled
            value={assignedBranchName}
            className="bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
          />
        )}
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

      {(isOwner ? form.role === "CASHIER" : true) && (
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

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Processing…" : "Add staff member"}
      </Button>
    </form>
  );
}