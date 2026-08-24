"use client";

import React, { useEffect, useState } from "react";
import type { AuditRetentionPolicy } from "../../types/audit";
import { updateRetentionPolicy } from "../../lib/api/audit";

interface RetentionPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPolicy: AuditRetentionPolicy | null;
  onPolicyUpdated: (updatedPolicy: AuditRetentionPolicy) => void;
}

export function RetentionPolicyModal({
  isOpen,
  onClose,
  currentPolicy,
  onPolicyUpdated,
}: RetentionPolicyModalProps) {
  const [retentionDays, setRetentionDays] = useState<number>(365);
  const [autoArchive, setAutoArchive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentPolicy) {
      setRetentionDays(currentPolicy.retentionDays || 365);
      setAutoArchive(currentPolicy.autoArchive ?? true);
    }
  }, [currentPolicy]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (retentionDays < 30) {
      setErrorMessage("Compliance retention policy requires a minimum of 30 days.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const updated = await updateRetentionPolicy({
        retentionDays: Number(retentionDays),
        autoArchive,
      });
      onPolicyUpdated(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update retention policy.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Audit Retention Policy
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Configure immutable audit log lifetime and archiving rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Preset Buttons */}
          <div>
            <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Retention Duration (Days)
            </label>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[90, 180, 365, 730].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setRetentionDays(days)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors ${
                    retentionDays === days
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs"
                      : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {days === 365 ? "1 Year" : days === 730 ? "2 Years" : `${days} Days`}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={30}
              max={3650}
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="w-full p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
              required
            />
            <span className="text-[11px] text-zinc-400 mt-1 block">
              Logs older than {retentionDays} days will be systematically processed according to compliance rules.
            </span>
          </div>

          {/* Auto Archive Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                Automatic Cold Archiving
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Compress & store expired logs before database truncation.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoArchive}
                onChange={(e) => setAutoArchive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-zinc-900 dark:peer-checked:bg-zinc-100 dark:peer-checked:after:bg-zinc-900"></div>
            </label>
          </div>

          {/* Policy Metadata */}
          {currentPolicy?.lastArchivedAt && (
            <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
              <span>Last Archive Execution:</span>
              <span className="font-mono text-zinc-600 dark:text-zinc-300">
                {new Date(currentPolicy.lastArchivedAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Apply Retention Policy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}