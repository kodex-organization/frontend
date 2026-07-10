interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-5xl mb-4">⚠️</div>

      <h2 className="text-xl font-semibold text-red-600">
        Error
      </h2>

      <p className="mt-2 text-gray-600 text-center">
        {message}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 rounded-lg bg-blue-600 px-5 py-2 text-white hover:bg-blue-700 transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}