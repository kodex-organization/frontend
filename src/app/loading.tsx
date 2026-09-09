import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] w-screen items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute h-full w-full animate-ping rounded-full bg-brand-100 opacity-75"></div>
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-100">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        </div>
        <p className="animate-pulse text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Loading...
        </p>
      </div>
    </div>
  );
}
