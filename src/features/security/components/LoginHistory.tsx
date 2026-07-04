const loginHistory: any[] = []; //for testing empty state
// const loginHistory = [
//   {
//     id: 1,
//     device: "Nimra's Laptop",
//     location: "Lahore",
//     time: "Today, 10:15 AM",
//     status: "Successful",
//   },
//   {
//     id: 2,
//     device: "Office Desktop",
//     location: "Islamabad",
//     time: "Yesterday, 4:30 PM",
//     status: "Successful",
//   },
//   {
//     id: 3,
//     device: "Unknown Device",
//     location: "Karachi",
//     time: "3 Days Ago",
//     status: "Failed",
//   },
// ];

const hasLoginHistory = loginHistory.length > 0;

export default function LoginHistory() {
  return (
    <div className="mt-12">
      <h2 className="mb-6 text-2xl font-semibold text-slate-900">Login History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-200 border-b border-gray-400">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Device</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Location</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Login Time</th>
              <th className="px-6 py-4 text-left font-semibold text-gray-700">Status</th>
            </tr>
          </thead>

          <tbody>
            {
              hasLoginHistory ? (
              loginHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="border-b border-gray-200 px-6 py-5 text-sm text-gray-800 bg-white">{item.device}</td>
                  <td className="border-b border-gray-200 px-6 py-5 text-sm text-gray-800 bg-white">{item.location}</td>
                  <td className="border-b border-gray-200 px-6 py-5 text-sm text-gray-800 bg-white">{item.time}</td>
                  <td className="border-b border-gray-200 px-6 py-5 text-sm text-gray-800 bg-white">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        item.status === "Successful"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {item.status}
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