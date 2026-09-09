"use client";

import { useEffect, useState } from "react";
import {
  getLoginHistory,
  type LoginHistoryItem,
} from "../api";
import { toast } from "@/lib/toast";

const ITEMS_PER_PAGE = 10;

export default function LoginHistory() {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  const loadHistory = async () => {
    try {
      const data = await getLoginHistory();
      setLoginHistory(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load login history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const hasLoginHistory = loginHistory.length > 0;

  const totalPages = Math.ceil(loginHistory.length / ITEMS_PER_PAGE);

const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

const paginatedHistory = loginHistory.slice(
  startIndex,
  startIndex + ITEMS_PER_PAGE
);
   
  if (loading) //loading state
  {
    return (
      <div className="mt-12">
        <h2 className="mb-8 text-2xl font-semibold text-left text-slate-900 border-b-2 border-gray-200 pb-2 ">
          Login History
        </h2>

        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Loading login history...
        </div>
      </div>
    );
  }


  return (
    <div className="mt-12">
        <h2 className="mb-8 text-2xl font-semibold text-left text-slate-900 border-b-2 border-gray-200 pb-2 ">
            Login History
        </h2>
      <div className="overflow-x-auto">
          <table className="min-w-full overflow-hidden rounded-xl">
         {/* <thead className="bg-gray-200 border-b border-gray-400"> */}
           <thead className="border-b border-green-700 bg-white">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider text-green-700">Device</th>
              <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider text-green-700">IP Address</th>
              <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider text-green-700">Login Time</th>
              <th className="px-6 py-4 text-left text-sm font-medium uppercase tracking-wider text-green-700">Status</th>
            </tr>
          </thead> 
          
      

          <tbody>
            {
              hasLoginHistory ? (
              paginatedHistory.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">

                <td className="border-b border-gray-200 bg-white px-6 py-5 text-sm text-gray-800">
                  {item.device?.deviceName ?? "Unknown Device"}
                </td>

                <td className="border-b border-gray-200 bg-white px-6 py-5 text-sm text-gray-800">
                  {item.ipAddress ?? "-"}
                </td>

                <td className="border-b border-gray-200 bg-white px-6 py-5 text-sm text-gray-800">
                  {new Date(item.attemptedAt).toLocaleString()}
                </td>

                <td className="border-b border-gray-200 bg-white px-6 py-5 text-sm text-gray-800">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      item.success
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.success ? "Successful" : "Failed"}
                  </span>
                </td>

              </tr>
            ))) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-20 text-center text-gray-500"
                  >
                    <div>
                      <h3 className="text-md font-semibold text-gray-600">
                        No login activity yet
                      </h3>

                      <p className="mt-3 text-sm text-gray-500">
                        When users log in, their login activity will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )
            }
          </tbody>
        </table>

        {hasLoginHistory && totalPages > 1 && (
  <div className="mt-8 flex items-center justify-center gap-2">
    <button
      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
      disabled={currentPage === 1}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-300"
    >
      Previous
    </button>

    {Array.from({ length: totalPages }, (_, index) => (
      <button
        key={index}
        onClick={() => setCurrentPage(index + 1)}
        className={`h-10 w-10 rounded-md text-sm font-medium transition ${
          currentPage === index + 1
            ? "bg-[#15803D] text-white"
            : "border border-gray-300 bg-white hover:bg-gray-300"
        }`}
      >
        {index + 1}
      </button>
    ))}

    <button
      onClick={() =>
        setCurrentPage((p) => Math.min(p + 1, totalPages))
      }
      disabled={currentPage === totalPages}
      className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-300"
    >
      Next
    </button>
  </div>
)}
      </div>
    </div>
  );
}
