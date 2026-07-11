"use client";

import { useMemo, useState } from "react";

interface Payment {
  id: string;
  amount: number | string;
  paymentMethod: string;
  paidAt: string;
}

interface Props {
  payments: Payment[];
}

export default function TransactionHistory({
  payments,
}: Props) {
  const [selectedDate, setSelectedDate] = useState("");

  const filteredPayments = useMemo(() => {
    if (!selectedDate) return payments;

    return payments.filter((payment) => {
      const paymentDate = new Date(payment.paidAt)
        .toISOString()
        .split("T")[0];

      return paymentDate === selectedDate;
    });
  }, [payments, selectedDate]);

  return (
    <div className="mb-6">
      <div
        className="
          bg-white
          rounded-2xl
          border
          border-green-100
          shadow-sm
          p-6
        "
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Transaction History
            </h2>

            <p className="text-sm text-gray-500 mt-1">
              Complete record of invoice payments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">
              Filter by Date
            </label>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) =>
                setSelectedDate(e.target.value)
              }
              className="
                rounded-lg
                border
                border-gray-300
                px-3
                py-2
                text-sm
                focus:border-green-500
                focus:outline-none
              "
            />

            {selectedDate && (
              <button
                onClick={() => setSelectedDate("")}
                className="
                  rounded-lg
                  bg-gray-200
                  px-3
                  py-2
                  text-sm
                  hover:bg-gray-300
                "
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div
            className="
              rounded-xl
              bg-gray-50
              p-8
              text-center
              text-gray-500
            "
          >
            No transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="
                    bg-green-50
                    border-b
                    text-sm
                    text-gray-600
                  "
                >
                  <th className="p-4 text-left font-medium">
                    Date
                  </th>

                  <th className="p-4 text-left font-medium">
                    Type
                  </th>

                  <th className="p-4 text-left font-medium">
                    Method
                  </th>

                  <th className="p-4 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="
                      border-b
                      last:border-none
                      hover:bg-green-50
                      transition
                    "
                  >
                    <td className="p-4">
                      {new Date(
                        payment.paidAt
                      ).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <span
                        className="
                          rounded-full
                          bg-green-100
                          px-3
                          py-1
                          text-sm
                          font-medium
                          text-green-700
                        "
                      >
                        Payment
                      </span>
                    </td>

                    <td className="p-4">
                      {payment.paymentMethod}
                    </td>

                    <td className="p-4 text-right font-semibold text-green-700">
                      Rs.{" "}
                      {Number(payment.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}