"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { usePlatformAdminAuth } from "@/lib/platform-admin/auth-context";
import { getPlatformAdminRouteDecision } from "../route-guard";

export function PlatformAdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = usePlatformAdminAuth();
  const decision = getPlatformAdminRouteDecision(
    isLoading,
    isAuthenticated,
    pathname,
  );

  useEffect(() => {
    if (decision.status === "redirect") {
      router.replace(decision.destination);
    }
  }, [decision, router]);

  if (decision.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <LoaderCircle aria-hidden="true" className="mr-2 h-5 w-5 animate-spin" />
        Verifying platform session
      </div>
    );
  }
  if (decision.status === "redirect") return null;
  return <>{children}</>;
}
