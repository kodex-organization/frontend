"use client";

import React, { useEffect, useState } from "react";
import type { BranchItem, UpdateBranchConfigPayload } from "../../types/branch";
import { updateBranchConfig } from "../../lib/api/branch";

interface BranchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch: BranchItem | null;
  onConfigUpdated: (updatedBranch: BranchItem) => void;
}

type TabType = "pricing_limits" | "taxes" | "operations";

export function BranchConfigModal({
  isOpen,
  onClose,
  branch,
  onConfigUpdated,
}: BranchConfigModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("pricing_limits");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<UpdateBranchConfigPayload>({
    peakHourMultiplier: 1.0,
    discountLimitPercent: 10,
    maxUdhaarPerCustomer: 5000,
    maxSessionMinutes: 240,
    standardTaxPercent: 16,
    concessionTaxPercent: 5,
    taxRegistrationNumber: "",
    serviceChargePercent: 0,
    operatingHoursStart: "10:00",
    operatingHoursEnd: "02:00",
    currency: "PKR",
    timezone: "Asia/Karachi",
    language: "en",
  });

  useEffect(() => {
    if (branch) {
      setFormData({
        peakHourMultiplier: Number(branch.peakHourMultiplier ?? 1.0),
        discountLimitPercent: Number(branch.discountLimitPercent ?? 10),
        maxUdhaarPerCustomer: Number(branch.maxUdhaarPerCustomer ?? 5000),
        maxSessionMinutes: branch.maxSessionMinutes ?? 240,
        standardTaxPercent: Number(branch.standardTaxPercent ?? 16),
        concessionTaxPercent: Number(branch.concessionTaxPercent ?? 5),
        taxRegistrationNumber: branch.taxRegistrationNumber || "",
        serviceChargePercent: Number(branch.serviceChargePercent ?? 0),
        operatingHoursStart: branch.operatingHoursStart || "10:00",
        operatingHoursEnd: branch.operatingHoursEnd || "02:00",
        currency: branch.currency || "PKR",
        timezone: branch.timezone || "Asia/Karachi",
        language: branch.language || "en",
      });
      setErrorMessage(null);
    }
  }, [branch]);

  if (!isOpen || !branch) return null;

  const handleChange = (
    field: keyof UpdateBranchConfigPayload,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const payload: UpdateBranchConfigPayload = {
        peakHourMultiplier: Number(formData.peakHourMultiplier),
        discountLimitPercent: Number(formData.discountLimitPercent),
        maxUdhaarPerCustomer: Number(formData.maxUdhaarPerCustomer),
        maxSessionMinutes: Number(formData.maxSessionMinutes),
        standardTaxPercent: Number(formData.standardTaxPercent),
        concessionTaxPercent: Number(formData.concessionTaxPercent),
        taxRegistrationNumber: formData.taxRegistrationNumber?.trim() || undefined,
        serviceChargePercent: Number(formData.serviceChargePercent),
        operatingHoursStart: formData.operatingHoursStart,
        operatingHoursEnd: formData.operatingHoursEnd,
        currency: formData.currency,
        timezone: formData.timezone,
        language: formData.language,
      };

      const updated = await updateBranchConfig(branch.id, payload);
      onConfigUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update branch configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Operational & Financial Rules
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {branch.name}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Set branch-specific policy limits, tax percentages, and shift constraints.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 pt-2 gap-4 text-xs font-medium bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={() => setActiveTab("pricing_limits")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "pricing_limits"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Limits & Multipliers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("taxes")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "taxes"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Taxes & Invoicing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("operations")}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === "operations"
                ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            Operating Hours & Locale
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* TAB 1: Pricing & Limits */}
          {activeTab === "pricing_limits" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Peak Hour Multiplier (x Rate)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={formData.peakHourMultiplier}
                  onChange={(e) => handleChange("peakHourMultiplier", parseFloat(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  e.g. 1.25 = 25% price surge during peak table demand.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Max Cashier Discount Cap (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formData.discountLimitPercent}
                  onChange={(e) => handleChange("discountLimitPercent", parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Discounts above this threshold trigger an audit anomaly alert.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Max Udhaar (Credit) Cap Per Customer
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={formData.maxUdhaarPerCustomer}
                  onChange={(e) => handleChange("maxUdhaarPerCustomer", parseFloat(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Maximum ledger credit balance allowed before POS block.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Max Continuous Session Duration (Minutes)
                </label>
                <input
                  type="number"
                  step="15"
                  min="30"
                  max="1440"
                  value={formData.maxSessionMinutes}
                  onChange={(e) => handleChange("maxSessionMinutes", parseInt(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  240 mins = 4 hours maximum per single table session.
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Taxes & Invoicing */}
          {activeTab === "taxes" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Standard Tax / GST (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={formData.standardTaxPercent}
                  onChange={(e) => handleChange("standardTaxPercent", parseFloat(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Standard tax percentage applied on table gameplay.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Concession Tax (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={formData.concessionTaxPercent}
                  onChange={(e) => handleChange("concessionTaxPercent", parseFloat(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Concessional rate applied on food/canteen POS orders.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Service Charge (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="30"
                  value={formData.serviceChargePercent}
                  onChange={(e) => handleChange("serviceChargePercent", parseFloat(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tax Registration Number (NTN / STRN)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1234567-8"
                  value={formData.taxRegistrationNumber || ""}
                  onChange={(e) => handleChange("taxRegistrationNumber", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                <span className="text-[11px] text-zinc-400 mt-1 block">
                  Appears on official printed customer receipts.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: Operating Hours & Locale */}
          {activeTab === "operations" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Opening Time
                </label>
                <input
                  type="time"
                  value={formData.operatingHoursStart || "10:00"}
                  onChange={(e) => handleChange("operatingHoursStart", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  value={formData.operatingHoursEnd || "02:00"}
                  onChange={(e) => handleChange("operatingHoursEnd", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Default Currency
                </label>
                <select
                  value={formData.currency || "PKR"}
                  onChange={(e) => handleChange("currency", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="PKR">PKR (Pakistani Rupee)</option>
                  <option value="USD">USD (US Dollar)</option>
                  <option value="AED">AED (UAE Dirham)</option>
                  <option value="GBP">GBP (British Pound)</option>
                  <option value="EUR">EUR (Euro)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Branch Timezone
                </label>
                <select
                  value={formData.timezone || "Asia/Karachi"}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                </select>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Saving Config..." : "Save Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}