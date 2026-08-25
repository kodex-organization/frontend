import { SuperAdminShell } from "@/components/layout/super-admin-shell";
import { PlatformAdminGuard } from "@/features/platform-admin/components/platform-admin-guard";
import { PlatformAdminAuthProvider } from "@/lib/platform-admin/auth-context";
import { ImpersonationProvider } from "@/lib/platform-admin/impersonation-context";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlatformAdminAuthProvider>
      <PlatformAdminGuard>
        <ImpersonationProvider>
          <SuperAdminShell>{children}</SuperAdminShell>
        </ImpersonationProvider>
      </PlatformAdminGuard>
    </PlatformAdminAuthProvider>
  );
}
