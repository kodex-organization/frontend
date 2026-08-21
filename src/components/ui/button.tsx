import { cn } from "@/lib/utils/cn";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export function Button({
  variant = "primary",
  size = "default",
  isLoading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",

        size === "default" && "px-4 py-2.5",
        size === "sm" && "px-3 py-2 text-sm",
        size === "lg" && "px-6 py-3 text-base",
        size === "icon" && "h-9 w-9 p-0",

        variant === "primary" &&
          "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600",

        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400",

        variant === "ghost" &&
          "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",

        variant === "outline" &&
          "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400",

        variant === "default" &&
          "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-600",

        className,
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}

      {children}
    </button>
  );
}