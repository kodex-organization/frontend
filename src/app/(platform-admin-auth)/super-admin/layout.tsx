import { PlatformAdminAuthProvider } from "@/lib/platform-admin/auth-context";

export default function PlatformAdminLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlatformAdminAuthProvider>{children}</PlatformAdminAuthProvider>;
}
