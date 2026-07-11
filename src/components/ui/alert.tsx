import { cn } from "@/lib/utils/cn";

interface AlertProps {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
}

export function Alert({ variant = "info", children }: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        variant === "error" && "border-red-200 bg-red-50 text-red-700",
        variant === "success" && "border-brand-100 bg-brand-50 text-brand-700",
        variant === "info" && "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {children}
    </div>
  );
}
