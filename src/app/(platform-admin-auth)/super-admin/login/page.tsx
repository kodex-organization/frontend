import { Suspense } from "react";
import { PlatformAdminLoginForm } from "@/features/platform-admin/components/platform-admin-login-form";

export default function PlatformAdminLoginPage() {
  return (
    <main className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-8 font-sans overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <Suspense
        fallback={
          <div className="text-sm font-medium text-slate-400">Loading sign in...</div>
        }
      >
        <PlatformAdminLoginForm />
      </Suspense>
    </main>
  );
}
