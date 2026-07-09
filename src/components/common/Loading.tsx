interface LoadingProps {
  message?: string;
}

export default function Loading({
  message = "Loading...",
}: LoadingProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto"></div>

        <p className="mt-4 text-gray-600 font-medium">
          {message}
        </p>
      </div>
    </div>
  );
}