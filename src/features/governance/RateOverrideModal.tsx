'use client';

import { useState } from 'react';
import { overrideRate } from './governance.api';
import { ApiError } from '@/lib/api/client';
import { useOnlineStatus } from '@/lib/connectivity/online-status';

interface Props {
  sessionId: string;
  currentRate: number;
  currency: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function formatRate(amount: number, currency: string | null) {
  if (!currency) return amount.toFixed(2);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function RateOverrideModal({
  sessionId,
  currentRate,
  currency,
  onClose,
  onSuccess,
}: Props) {
  const isOnline = useOnlineStatus();
  const [newRate, setNewRate] = useState<number>(currentRate);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!isOnline) {
      setError('Reconnect before applying a rate override');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }
    if (newRate <= 0) {
      setError('Rate must be greater than 0');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await overrideRate({
        sessionId,
        newRate,
        expectedRate: currentRate,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to override rate');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">

        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Override Session Rate
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Current rate: {formatRate(currentRate, currency)}/hr
        </p>

        {/* Loading State */}
        {loading && (
          <p className="text-blue-500 text-sm mb-2">Applying override...</p>
        )}

        {/* Error State */}
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}

        {/* New Rate Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New rate {currency ? `(${currency}/hr)` : "(per hour)"}
          </label>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newRate}
            onChange={(e) => setNewRate(Number(e.target.value))}
            min={1}
            max={1000000}
            step="0.01"
          />
        </div>

        {/* Reason Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Override
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !isOnline}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Applying...' : 'Apply Override'}
          </button>
        </div>

      </div>
    </div>
  );
}
