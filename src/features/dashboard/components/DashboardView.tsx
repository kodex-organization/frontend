"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchBranches } from "@/lib/api/branch";
import { DashboardApi, LiveTableSession, RevenueKPIs, OutstandingUdhaar, SyncDeviceStatus, RevenueTrend, TableHeatmap, AnomalyItem, TransactionItem } from "../dashboard.api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Activity, CreditCard, Users, RefreshCw, AlertTriangle, ChevronRight, TrendingUp } from "lucide-react";
import { FullPageLoader } from "@/components/ui/loader";
import { toast } from "@/lib/toast";

export function DashboardView() {
  const { user } = useAuth();
  const router = useRouter();

  // States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedBranch = user?.branchId ?? "";

  // Data States
  const [liveTables, setLiveTables] = useState<LiveTableSession[]>([]);
  const [kpis, setKPIs] = useState<RevenueKPIs | null>(null);
  const [udhaar, setUdhaar] = useState<OutstandingUdhaar | null>(null);
  const [syncDevices, setSyncDevices] = useState<SyncDeviceStatus[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend | null>(null);
  const [heatmap, setHeatmap] = useState<TableHeatmap | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [staffPerf, setStaffPerf] = useState<Record<string, number>>({});

  // Tabs
  const [activeTab, setActiveTab] = useState<"live" | "kpi" | "heatmap" | "udhaar" | "staff" | "anomalies">("live");

  // Drilldown Modal
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownTransactions, setDrilldownTransactions] = useState<TransactionItem[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Check roles
  const isCashier = user?.roles.includes("CASHIER");

  const fetchData = async (branchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const tablesData = await DashboardApi.getLiveTables(branchId);
      setLiveTables(tablesData.sessions);

      if (isCashier) {
        setLoading(false);
        return;
      }

      const [
        kpisData,
        udhaarData,
        syncData,
        trendData,
        heatmapData,
        anomaliesData,
        staffData
      ] = await Promise.all([
        DashboardApi.getKPIs(branchId),
        DashboardApi.getUdhaar(branchId),
        DashboardApi.getSyncStatus(branchId),
        DashboardApi.getRevenueTrend(branchId),
        DashboardApi.getTableHeatmap(branchId),
        DashboardApi.getAnomalies(branchId),
        DashboardApi.getStaffPerformance(branchId)
      ]);

      setKPIs(kpisData);
      setUdhaar(udhaarData);
      setSyncDevices(syncData);
      setRevenueTrend(trendData);
      setHeatmap(heatmapData);
      setAnomalies(anomaliesData);
      setStaffPerf(staffData.sessionsHandledByUser);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedBranch || undefined);
  }, [selectedBranch]);

  const handleDrilldown = async (category: string) => {
    setDrilldownCategory(category);
    setDrilldownLoading(true);
    try {
      const txs = await DashboardApi.getTransactions(category, selectedBranch || undefined);
      setDrilldownTransactions(txs);
    } catch (err: any) {
      toast.error(err.message || "Failed to load transactions for drilldown.");
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (loading) {
    return <FullPageLoader text="Loading metrics..." />;
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-xl mx-auto mt-12 text-center">
        <Alert variant="error">
          <p className="font-semibold">Dashboard Load Error</p>
          <p className="text-xs mt-1">{error}</p>
        </Alert>
        <Button onClick={() => fetchData(selectedBranch || undefined)} className="w-auto px-6 mx-auto">
          Retry Loading
        </Button>
      </div>
    );
  }

  // 1. Cashier Role-Based Simple Dashboard
  if (isCashier) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Today's Sessions</h1>
          <p className="text-sm text-slate-500">Overview of table play sessions on shift today.</p>
        </div>

        {liveTables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No active sessions</h3>
            <p className="mt-1 text-sm text-slate-500">Go to Floor View to start a new session.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                <tr>
                  <th className="px-6 py-4">Table Number</th>
                  <th className="px-6 py-4">Branch</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Started At</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {liveTables.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">Table {s.table?.tableNumber || s.tableId}</td>
                    <td className="px-6 py-4">{s.branch.name}</td>
                    <td className="px-6 py-4">{s.customer?.fullName || "Walk-in"}</td>
                    <td className="px-6 py-4">{new Date(s.startedAt).toLocaleTimeString()}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.status === "OPEN" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // 2. Owner & Manager Full Dashboard
  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h1>
          <p className="text-sm text-slate-500">Real-time performance metrics for your active branch.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => fetchData(selectedBranch || undefined)} variant="secondary" className="w-auto px-3 py-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue KPI */}
        <div
          onClick={() => handleDrilldown("all")}
          className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-300 transition-all duration-300 transform hover:-translate-y-0.5"
        >
          <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-brand-50 group-hover:scale-110 transition-transform duration-300"></div>
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Today's Revenue</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 ring-4 ring-brand-50 shadow-sm">
              <CreditCard className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl font-bold text-slate-900">Rs. {kpis?.totalRevenue.toLocaleString() || "0"}</span>
            <span className="flex items-center gap-1 text-xs text-brand-600 mt-1 font-medium">
              <TrendingUp className="h-3 w-3" /> Combined daily sales
            </span>
          </div>
        </div>

        {/* Live Table Sessions */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-green-50 group-hover:scale-110 transition-transform duration-300"></div>
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Active Play Sessions</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 ring-4 ring-green-50 shadow-sm">
              <Activity className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl font-bold text-slate-900">{liveTables.length} Tables Active</span>
            <span className="flex items-center gap-1 text-xs text-green-600 mt-1 font-medium">
              Occupied & paused rooms
            </span>
          </div>
        </div>

        {/* Outstanding Udhaar */}
        <div
          onClick={() => handleDrilldown("udhaar_issued")}
          className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm cursor-pointer hover:shadow-md hover:border-red-300 transition-all duration-300 transform hover:-translate-y-0.5"
        >
          <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-red-50 group-hover:scale-110 transition-transform duration-300"></div>
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Outstanding Udhaar</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-600 ring-4 ring-red-50 shadow-sm">
              <Users className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl font-bold text-slate-900">Rs. {udhaar?.totalOutstanding.toLocaleString() || "0"}</span>
            <span className="flex items-center gap-1 text-xs text-red-600 mt-1 font-medium">
              Settlements pending
            </span>
          </div>
        </div>

        {/* Active Sync Status */}
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-blue-50 group-hover:scale-110 transition-transform duration-300"></div>
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Sync Status</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 ring-4 ring-blue-50 shadow-sm">
              <RefreshCw className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </div>
          <div className="relative mt-4">
            <span className="text-2xl font-bold text-slate-900">
              {syncDevices.filter(d => new Date().getTime() - new Date(d.lastHeartbeatAt).getTime() < 120000).length} / {syncDevices.length} Online
            </span>
            <span className="flex items-center gap-1 text-xs text-blue-600 mt-1 font-medium">
              Offline sync active
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        {(["live", "kpi", "heatmap", "udhaar", "staff", "anomalies"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-semibold capitalize transition-all border-b-2 -mb-px ${
              activeTab === tab
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab === "live" ? "Live Tables" : tab === "kpi" ? "Revenue Trends" : tab === "heatmap" ? "Table Heatmap" : tab === "udhaar" ? "Udhaar Ledger" : tab === "staff" ? "Staff Activity" : "Anomaly Alerts"}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">

        {/* Live Tables */}
        {activeTab === "live" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Live Operational Play overview</h3>
              <span className="text-xs text-slate-500">{liveTables.length} sessions active now</span>
            </div>

            {liveTables.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">No active sessions at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {liveTables.map((s) => (
                  <div key={s.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 p-5 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Table {s.table?.tableNumber || s.tableId}</h4>
                        <p className="mt-1 text-xs font-semibold text-brand-600">Branch: {s.branch.name}</p>
                        <p className="text-xs text-slate-500 mt-1">Customer: {s.customer?.fullName || "Walk-in"}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.status === "OPEN" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-150 pt-3">
                      <span>Started At: {new Date(s.startedAt).toLocaleTimeString()}</span>
                      {s.expectedEndTime && (
                        <span>End: {new Date(s.expectedEndTime).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Revenue KPIs & Custom SVG Chart */}
        {activeTab === "kpi" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Today's Revenue Breakdown & Comparative Trends</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Category Breakdown list */}
              <div className="space-y-4 border border-slate-150 rounded-xl p-5 bg-slate-50/30">
                <h4 className="font-bold text-slate-900 text-sm">Revenue Channels</h4>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm py-2 border-b border-slate-150 cursor-pointer hover:bg-slate-100 px-2 rounded" onClick={() => handleDrilldown("table")}>
                    <span className="text-slate-600">Table Sessions</span>
                    <span className="font-semibold text-slate-950">Rs. {kpis?.tableRevenue.toLocaleString() || "0"}</span>
                  </div>
                  <div className="flex justify-between text-sm py-2 border-b border-slate-150 cursor-pointer hover:bg-slate-100 px-2 rounded" onClick={() => handleDrilldown("canteen")}>
                    <span className="text-slate-600">Canteen Sales</span>
                    <span className="font-semibold text-slate-950">Rs. {kpis?.canteenRevenue.toLocaleString() || "0"}</span>
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 text-sm mt-6">Payment Methods</h4>
                <div className="space-y-3">
                  {kpis?.paymentMethods && Object.entries(kpis.paymentMethods).map(([method, amt]) => (
                    <div key={method} className="flex justify-between text-sm py-2 border-b border-slate-150">
                      <span className="text-slate-600 uppercase">{method}</span>
                      <span className="font-semibold text-slate-950">Rs. {amt.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hourly Trend custom SVG graph */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">Hourly Sales Trend</h4>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-brand-600">
                      <span className="h-3 w-3 rounded-full bg-brand-600"></span> Today
                    </span>
                    <span className="flex items-center gap-1.5 font-medium text-slate-400">
                      <span className="h-3 w-3 rounded-full bg-slate-300"></span> Same Day Last Week
                    </span>
                  </div>
                </div>

                {revenueTrend ? (
                  <div className="relative h-64 border-b border-l border-slate-200">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Lines */}
                      {(() => {
                        const todayMax = Math.max(...revenueTrend.today, 1);
                        const lastWeekMax = Math.max(...revenueTrend.lastWeek, 1);
                        const maxVal = Math.max(todayMax, lastWeekMax, 1);

                        const todayPoints = revenueTrend.today
                          .map((val, idx) => `${(idx / 23) * 100},${100 - (val / maxVal) * 90}`)
                          .join(" ");

                        const lastWeekPoints = revenueTrend.lastWeek
                          .map((val, idx) => `${(idx / 23) * 100},${100 - (val / maxVal) * 90}`)
                          .join(" ");

                        return (
                          <>
                            {/* Last Week Line */}
                            <polyline
                              fill="none"
                              stroke="#cbd5e1"
                              strokeWidth="1.5"
                              points={lastWeekPoints}
                            />
                            {/* Today Line */}
                            <polyline
                              fill="none"
                              stroke="#4f46e5"
                              strokeWidth="2.5"
                              points={todayPoints}
                            />
                          </>
                        );
                      })()}
                    </svg>
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-slate-400 pt-2 px-1">
                      <span>12 AM</span>
                      <span>6 AM</span>
                      <span>12 PM</span>
                      <span>6 PM</span>
                      <span>11 PM</span>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center border border-slate-100 rounded-xl bg-slate-50/50">
                    <p className="text-slate-400 text-xs">No trend data loaded.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        {activeTab === "heatmap" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Table Utilization Heatmap</h3>
              <p className="text-xs text-slate-500">Visualizes busiest days and hours to optimize staffing & pricing.</p>
            </div>

            {heatmap && Object.keys(heatmap).length > 0 ? (
              <div className="space-y-8">
                {Object.entries(heatmap).map(([tableNum, daysData]) => (
                  <div key={tableNum} className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-900">Table {tableNum}</h4>
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px] grid gap-1" style={{ gridTemplateColumns: 'repeat(25, minmax(0, 1fr))' }}>
                        {/* Empty spacer for day label */}
                        <div className="text-xs font-semibold text-slate-500 w-12"></div>
                        {/* Hour headers */}
                        {[...Array(24)].map((_, hour) => (
                          <div key={hour} className="text-[10px] font-semibold text-slate-400 text-center">
                            {hour}h
                          </div>
                        ))}

                        {/* Days rows */}
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, dayIdx) => (
                          <div key={dayIdx} className="contents">
                            <div className="text-xs font-semibold text-slate-500 pr-2 self-center">{dayName}</div>
                            {[...Array(24)].map((_, hour) => {
                              const value = daysData[dayIdx]?.[hour] || 0;
                              // Colors based on usage counts
                              const opacity = value === 0 ? "bg-slate-50" : value < 2 ? "bg-brand-100" : value < 5 ? "bg-brand-300" : value < 8 ? "bg-brand-500" : "bg-brand-700";
                              return (
                                <div
                                  key={hour}
                                  title={`${dayName} at ${hour}:00 — ${value} hours of play`}
                                  className={`h-6 rounded border border-slate-150/40 cursor-help transition-all hover:scale-110 ${opacity}`}
                                />
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">No historical session data to generate utilization maps.</p>
              </div>
            )}
          </div>
        )}

        {/* Outstanding Udhaar */}
        {activeTab === "udhaar" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Outstanding Udhaar Balances</h3>
              <span className="text-sm font-semibold text-red-600">Total: Rs. {udhaar?.totalOutstanding.toLocaleString() || "0"}</span>
            </div>

            {udhaar?.outstandingList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">All clear! No customer accounts have outstanding debt.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                    <tr>
                      <th className="px-6 py-4">Customer Name</th>
                      <th className="px-6 py-4">Outstanding Balance</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {udhaar?.outstandingList.map((item) => (
                      <tr key={item.customerId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{item.fullName}</td>
                        <td className="px-6 py-4 font-semibold text-red-600">Rs. {item.balance.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => router.push(`/customers/${item.customerId}?tab=udhaar`)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800"
                          >
                            View ledger <ChevronRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Staff Performance */}
        {activeTab === "staff" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Staff Shift activity</h3>
            </div>

            {Object.keys(staffPerf).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">No sessions registered under staff accounts today.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="px-6 py-4">Staff User ID</th>
                        <th className="px-6 py-4 text-right">Sessions Handled</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(staffPerf).map(([userId, count]) => (
                        <tr key={userId} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-medium text-slate-900">{userId}</td>
                          <td className="px-6 py-4 text-right font-bold text-slate-950">{count} sessions</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Anomalies */}
        {activeTab === "anomalies" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-950">Operational Anomalies flagged</h3>
              <span className="text-xs text-slate-500">Flags unusual patterns requiring review</span>
            </div>

            {anomalies.length === 0 ? (
              <div className="text-center py-12 bg-green-50/50 rounded-xl border border-green-150">
                <p className="text-green-700 text-sm font-semibold">No operational anomalies flagged today.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {anomalies.map((item) => (
                  <div key={item.id} className="flex gap-4 rounded-xl border border-yellow-200 bg-yellow-50/50 p-4 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 self-start shadow-sm ring-4 ring-yellow-50">
                      <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-yellow-700 uppercase tracking-wider">
                          {item.type.replace("_", " ")}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 mt-1">{item.message}</p>
                      {item.branchName && (
                        <p className="text-xs text-slate-500 mt-0.5">Branch: {item.branchName}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Drill-down transactions Modal */}
      {drilldownCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-950">
                Transaction Details: <span className="uppercase text-brand-600">{drilldownCategory.replace("_", " ")}</span>
              </h3>
              <button
                onClick={() => setDrilldownCategory(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-medium"
              >
                &times;
              </button>
            </div>

            <div className="p-6 max-h-[500px] overflow-y-auto">
              {drilldownLoading ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
                  <p className="text-sm text-slate-500">Loading underlying transactions...</p>
                </div>
              ) : drilldownTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-sm">No transactions found for this category today.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                      <tr>
                        <th className="px-6 py-4">Ref/Invoice</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Branch</th>
                        <th className="px-6 py-4">Detail</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {drilldownTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-bold text-slate-950">{tx.referenceNumber}</td>
                          <td className="px-6 py-4">{tx.customerName}</td>
                          <td className="px-6 py-4">{tx.branchName}</td>
                          <td className="px-6 py-4">{tx.detail}</td>
                          <td className="px-6 py-4 font-semibold text-slate-900">Rs. {tx.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs text-slate-400">{new Date(tx.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 px-6 py-4">
              <Button onClick={() => setDrilldownCategory(null)} variant="secondary" className="w-auto px-5">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}