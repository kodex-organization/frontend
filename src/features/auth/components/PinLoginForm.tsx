"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useAuth, ApiError } from "@/lib/auth/auth-context";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { WifiOff } from "lucide-react";

export function PinLoginForm() {
  const { loginPin } = useAuth();
  const isOnline = useOnlineStatus();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; pin?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = "Enter the account email to look up your profile";
    if (!/^\d{4,6}$/.test(pin)) errors.pin = "PIN must be 4-6 digits";
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      await loginPin(pin, { email });
    } catch (err: any) {
      setFormError(
        err?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 border border-amber-200/80">
          <WifiOff size={15} className="text-amber-600 shrink-0" />
          <span>Offline Mode: Signing in with local PIN credentials</span>
        </div>
      )}
      {formError && <Alert variant="error">{formError}</Alert>}

      <FormField label="Email" htmlFor="pin-email" error={fieldErrors.email}>
        <Input
          id="pin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@club.com"
        />
      </FormField>

      <FormField label="PIN" htmlFor="pin" error={fieldErrors.pin}>
        <Input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={6}
          autoComplete="off"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="••••"
          className="text-center text-lg tracking-[0.5em]"
        />
      </FormField>

      <Button type="submit" isLoading={isSubmitting}>
        {isSubmitting ? "Checking PIN…" : "Start shift"}
      </Button>
    </form>
  );
}
