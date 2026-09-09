import { Loader2 } from "lucide-react";

export function FullPageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 transition-all duration-300">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute h-full w-full animate-ping rounded-full bg-brand-100 opacity-75"></div>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-100">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      </div>
      <p className="animate-pulse text-xs font-semibold tracking-widest text-slate-400 uppercase">
        {text}
      </p>
    </div>
  );
}
