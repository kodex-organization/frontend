"use client";

interface Props {
  date: string;
  setDate: (v: string) => void;
  onFilter: () => void;
}

export default function DateFilter({
  date,
  setDate,
  onFilter,
}: Props) {
  return (
    <div className="flex items-center gap-3">

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="
          rounded-lg
          border
          border-gray-300
          px-3
          py-2
          text-sm
          focus:border-blue-500
          focus:outline-none
        "
      />

      <button
        onClick={onFilter}
        className="
          rounded-lg
          bg-green-800
          px-4
          py-2
          text-sm
          font-medium
          text-white
          hover:bg-blue-700
        "
      >
        Filter
      </button>

    </div>
  );
}