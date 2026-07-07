"use client";

import { useState } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { PinLoginForm } from "@/features/auth/components/PinLoginForm";
import { cn } from "@/lib/utils/cn";

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "pin">("password");

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
    </main>
  );
}
