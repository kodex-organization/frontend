"use client";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { PinLoginForm } from "@/features/auth/components/PinLoginForm";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { KeyRound, Mail, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/branding/brand-logo";

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(redirectPathForRoles(user.roles));
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return null;
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-4 sm:p-8 overflow-hidden font-sans">
      {/* Subtle Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-700/50 bg-white/95 backdrop-blur-xl p-8 sm:p-10 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <BrandLogo className="mx-auto h-16 w-auto" />
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Cue<span className="text-brand-600">Cloud</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {mode === "password"
              ? "Sign in with your management credentials"
              : "Enter your assigned 4-digit Cashier PIN"}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition-all duration-150",
              mode === "password"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <Mail size={14} className={mode === "password" ? "text-brand-600" : "text-slate-400"} />
            <span>Email Login</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("pin")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition-all duration-150",
              mode === "pin"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900",
            )}
          >
            <KeyRound size={14} className={mode === "pin" ? "text-brand-600" : "text-slate-400"} />
            <span>Cashier PIN</span>
          </button>
        </div>

        {/* Auth Forms */}
        <div className="pt-1">
          {mode === "password" ? <LoginForm /> : <PinLoginForm />}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Sparkles size={12} className="text-brand-500" />
            <span>CueCloud Club OS • Encrypted & Secure</span>
          </p>
        </div>
      </div>
    </main>
  );
}