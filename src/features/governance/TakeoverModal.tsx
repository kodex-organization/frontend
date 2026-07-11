'use client';

import { useState } from 'react';
import { managerTakeover } from './governance.api';

interface Props {
  sessionId: string;
  newDeviceId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TakeoverModal({
  sessionId,
  newDeviceId,
  onClose,
  onSuccess,
}: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!reason.trim()) {
      setError('Please provide a reason');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await managerTakeover({ sessionId, newDeviceId, reason });
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to process takeover');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">

        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Manager Takeover
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          You are taking over Session ID: {sessionId}
        </p>

        {/* Loading State */}
        {loading && (
          <p className="text-blue-500 text-sm mb-2">Processing takeover...</p>
        )}

        {/* Error State */}
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}

        {/* Reason Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Takeover
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Enter reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Takeover'}
          </button>
        </div>

      </div>
    </div>
  );
}