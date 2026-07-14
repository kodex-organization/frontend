"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles } from "@/lib/auth/session";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(redirectPathForRoles(user.roles));
    } else {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  return null;
}