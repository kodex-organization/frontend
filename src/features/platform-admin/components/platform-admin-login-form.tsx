"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api/client";
import { usePlatformAdminAuth } from "@/lib/platform-admin/auth-context";
import { getSafePlatformAdminDestination } from "../login-navigation";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export function PlatformAdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, isLoading, login } = usePlatformAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const destination = getSafePlatformAdminDestination(searchParams.get("next"));

  useEffect(() => {
    if (!isLoading && admin) router.replace(destination);
  }, [admin, destination, isLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "email") errors.email = issue.message;
        if (issue.path[0] === "password") errors.password = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.replace(destination);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || admin) {
    return (
      <div className="flex min-h-28 items-center justify-center text-sm text-slate-500">
        Verifying platform session
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-md border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            CueCloud Platform
          </h1>
          <p className="text-sm text-slate-500">Administrator sign in</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {formError ? <Alert variant="error">{formError}</Alert> : null}

        <FormField
          label="Platform admin email"
          htmlFor="platform-admin-email"
          error={fieldErrors.email}
        >
          <Input
            id="platform-admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@cuecloud.com"
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="platform-admin-password"
          error={fieldErrors.password}
        >
          <PasswordInput
            id="platform-admin-password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
          />
        </FormField>

        <Button type="submit" isLoading={submitting} className="w-full">
          <LockKeyhole aria-hidden="true" className="h-4 w-4" />
          {submitting ? "Signing in" : "Sign in"}
        </Button>
      </form>

      <div className="mt-5 border-t border-slate-200 pt-4 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Tenant user sign in
        </Link>
      </div>
    </div>
  );
}
