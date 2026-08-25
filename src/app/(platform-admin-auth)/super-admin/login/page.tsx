import { Suspense } from "react";

import { PlatformAdminLoginForm } from "@/features/platform-admin/components/platform-admin-login-form";

export default function PlatformAdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Suspense
        fallback={
          <div className="text-sm text-slate-500">Loading sign in</div>
        }
      >
        <PlatformAdminLoginForm />
      </Suspense>
    </main>
  );
}
