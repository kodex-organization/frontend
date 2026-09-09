import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "outline"
    | "danger"
    | "success"
    | "default";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "default",
      isLoading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none select-none",

          size === "default" && "px-4 py-2.5",
          size === "sm" && "px-3 py-1.5 text-xs rounded-lg",
          size === "lg" && "px-6 py-3 text-base rounded-2xl",
          size === "icon" && "h-9 w-9 p-0 rounded-lg",

          (variant === "primary" || variant === "default") &&
            "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow active:bg-brand-800 focus-visible:ring-brand-600",

          variant === "secondary" &&
            "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus-visible:ring-slate-400",

          variant === "outline" &&
            "border border-slate-200 bg-transparent text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 focus-visible:ring-slate-400",

          variant === "ghost" &&
            "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400",

          variant === "danger" &&
            "bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:shadow active:bg-rose-800 focus-visible:ring-rose-600",

          variant === "success" &&
            "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow active:bg-emerald-800 focus-visible:ring-emerald-600",

          className,
        )}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden
            className={cn(
              "h-4 w-4 animate-spin rounded-full border-2 border-t-transparent",
              variant === "secondary" || variant === "ghost" || variant === "outline"
                ? "border-slate-400 border-t-transparent"
                : "border-white/50 border-t-white",
            )}
          />
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";