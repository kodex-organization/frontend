"use client";

import Link from "next/link";
import { Invoice } from "../types/invoice";
import StatusBadge from "./StatusBadge";

interface Props {
  invoices: Invoice[];
}

export default function InvoiceTable({ invoices }: Props) {
  return (
    <div className="overflow-x-auto">

      <table className="w-full">

        <thead className="bg-gray-50">

          <tr>

            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
              Invoice #
            </th>

            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
              Branch
            </th>

            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
              Amount
            </th>

            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
              Status
            </th>

            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">
              Date
            </th>

            <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">
              Action
            </th>

          </tr>

        </thead>

        <tbody>

          {invoices.map((invoice) => (

            <tr
              key={invoice.id}
              className="border-t hover:bg-gray-50 transition"
            >

              <td className="px-6 py-5 font-semibold">
                #{invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
              </td>

              <td className="px-6 py-5">
                {invoice.branchId}
              </td>

              <td className="px-6 py-5">
                Rs. {Number(invoice.total).toLocaleString()}
              </td>

              <td className="px-6 py-5">
                <StatusBadge status={invoice.status} />
              </td>

              <td className="px-6 py-5">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </td>

              <td className="px-6 py-5 text-center">

                <Link
                  href={`/billing/${invoice.id}`}
                  className="inline-flex items-center rounded-lg bg-green-800 px-5 py-2 text-white hover:bg-grey-700 transition"
                >
                  View
                </Link>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}