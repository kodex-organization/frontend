"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { createStaff, type CreateStaffInput } from "@/features/auth";
import { useAuth, ApiError } from "@/lib/auth/auth-context";

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
};

export function AddStaffForm() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only an Owner or Manager should ever reach this form — the route itself
  // is also gated, this is a defence-in-depth UI check.
  const canManageStaff = user?.roles.some((r) => r === "OWNER" || r === "MANAGER");
  const roleOptions = assignableRoles(user?.roles);

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

    if (!roleOptions.includes(parsed.data.role)) {
      // Defence-in-depth: a Manager should never be able to submit OWNER
      // even if the select were tampered with client-side. Backend rejects
      // this too, but fail fast here with a clear message.
      setFieldErrors({ role: "You are not allowed to assign this role." });
      return;
    }

    if (!user?.branchId) {
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
        branchId: user.branchId,
        password: parsed.data.password,
        pin: parsed.data.pin || undefined,
      });
      setSuccessMessage(`${staff.fullName} was added as ${staff.roles.join(", ")}.`);
      setForm(initialForm);
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

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Adding staff…" : "Add staff member"}
      </Button>
    </form>
  );
}