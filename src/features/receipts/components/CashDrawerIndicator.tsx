"use client";

interface Props {
  paymentMethod: string;
  drawerOpened: boolean;
}

export default function CashDrawerIndicator({
  paymentMethod,
  drawerOpened,
}: Props) {
  if (paymentMethod !== "cash") {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border p-4 ${
        drawerOpened
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-50 text-gray-500"
      }`}
    >
      <span className="text-lg">{drawerOpened ? "🟢" : "⚪"}</span>
      <span className="font-medium">
        {drawerOpened ? "Cash drawer opened" : "Cash drawer closed"}
      </span>
    </div>
  );
}