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

const ROLES: CreateStaffInput["role"][] = ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"];

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
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4" noValidate>
      {formError && <Alert variant="error">{formError}</Alert>}
      {successMessage && <Alert variant="success">{successMessage}</Alert>}

      <FormField label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
        <Input
          id="fullName"
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          placeholder="e.g. Ahtesham Raza"
        />
      </FormField>

      <FormField label="Email" htmlFor="staffEmail" error={fieldErrors.email}>
        <Input
          id="staffEmail"
          type="email"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="staff@club.com"
        />
      </FormField>

      <FormField label="Phone (optional)" htmlFor="phone" error={fieldErrors.phone}>
        <Input
          id="phone"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+92 3XX XXXXXXX"
        />
      </FormField>

      <FormField label="Role" htmlFor="role" error={fieldErrors.role}>
        <Select id="role" value={form.role} onChange={(e) => update("role", e.target.value as FormState["role"])}>
          {ROLES.map((role) => (
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
          />
        </FormField>
      )}

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Adding staff…" : "Add staff member"}
      </Button>
    </form>
  );
}
