interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = "No Data Found",
  description = "There is nothing to display.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-6xl mb-4">📄</div>

      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-gray-500 text-center">
        {description}
      </p>
    </div>
  );
}