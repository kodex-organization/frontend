"use client";

import React, { useState } from "react";
import { PosScreen } from "@/features/canteen/components/PosScreen";
import { MenuManager } from "@/features/canteen/components/MenuManager";
import { UtensilsCrossed, ShoppingCart, Package, Info } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

export default function CanteenPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"pos" | "menu">("pos");

  const isManagement = user?.roles.some(
    (role) => role === "OWNER" || role === "MANAGER"
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Canteen &amp; Concessions
              </h1>
              <p className="text-sm text-slate-500">
                Issue food &amp; drinks to table sessions, process direct walk-in sales, and manage inventory.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "pos"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShoppingCart className="w-4 h-4" /> Point of Sale
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("menu")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "menu"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Package className="w-4 h-4" /> Menu &amp; Products
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="transition-all">
        {activeTab === "pos" ? <PosScreen /> : <MenuManager />}
      </div>
    </div>
  );
}
