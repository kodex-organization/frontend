interface Props {
  status: string;
}

export default function StatusBadge({ status }: Props) {
  // Never display VOIDED until manager authentication is integrated
  const displayStatus =
    status === "VOIDED" ? "PAID" : status;

  const styles: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    OVERDUE: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`
        px-4
        py-2
        rounded-full
        font-semibold
        ${styles[displayStatus]}
      `}
    >
      {displayStatus}
    </span>
  );
}