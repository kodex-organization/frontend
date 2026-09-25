export default function OfflineFallbackPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
      <div className="rounded-full bg-amber-100 p-4 text-2xl">📡</div>
      <h1 className="text-xl font-semibold text-gray-900">
        This page is not available offline
      </h1>
      <p className="max-w-sm text-sm text-gray-600">
        Your data is safe and will sync automatically when the connection is restored.
        Please visit this page online once so it can be available offline.
      </p>
      <p className="text-xs text-gray-400">
        Previously visited tabs (such as Sessions) will continue to work normally offline.
      </p>
    </div>
  );
}