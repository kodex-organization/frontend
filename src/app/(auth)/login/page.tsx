"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { PinLoginForm } from "@/features/auth/components/PinLoginForm";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles } from "@/lib/auth/session";

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Issue 2 & 3 fix: if a session already exists, /login should never be
  // reachable — bounce the user straight to their role-based landing page
  // instead of showing the form again.
  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectPathForRoles(user.roles));
    }
  }, [isLoading, user, router]);

  // While we're checking session state, or once we know the user is
  // authenticated (and about to be redirected), render nothing — this
  // avoids a flash of the login form before the redirect kicks in.
  if (isLoading || user) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-brand-700">CueCloud</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "password" ? "Sign in to your account" : "Cashier shift login"}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={cn(
              "rounded-md py-2 transition-colors",
              mode === "password" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
            )}
          >
            Email &amp; password
          </button>
          <button
            type="button"
            onClick={() => setMode("pin")}
            className={cn(
              "rounded-md py-2 transition-colors",
              mode === "pin" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500",
            )}
          >
            Cashier PIN
          </button>
        </div>

        <div className="mt-6">
          {mode === "password" ? <LoginForm /> : <PinLoginForm />}
        </div>
      </div>
    </div>
    
  );
}