"use client";

interface Props {
  isReprint: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}

export default function PrintConfirmModal({
  isReprint,
  onConfirm,
  onClose,
  loading,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">
          {isReprint ? "Reprint Receipt" : "Print Receipt"}
        </h3>

        <p className="mb-6 text-gray-500">
          {isReprint
            ? "This will reprint the receipt. Continue?"
            : "This will print the receipt now. Continue?"}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-gray-300 px-4 py-2 font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-xl bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Printing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}