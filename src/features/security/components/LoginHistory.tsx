"use client";

import { useEffect, useState } from "react";
import {
  getLoginHistory,
  type LoginHistoryItem,
} from "../api";

//const loginHistory: any[] = []; //for testing empty state

export default function LoginHistory() {
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const data = await getLoginHistory();
      setLoginHistory(data);
    } catch (error) {
      console.error("Failed to load login history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const hasLoginHistory = loginHistory.length > 0;
   
  if (loading) //loading state
  {
    return (
      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-semibold text-slate-900">
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
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Login History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-200 border-b border-gray-400">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Device</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">IP Address</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Login Time</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Status</th>
            </tr>
          </thead>

          <tbody>
            {
              hasLoginHistory ? (
              loginHistory.map((item) => (
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
      </div>
    </div>
  );
}