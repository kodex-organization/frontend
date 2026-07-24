'use client';

import { useState } from 'react';
import { createCancellationRequest } from './governance.api';
import { ApiError } from '@/lib/api/client';
import { useOnlineStatus } from '@/lib/connectivity/online-status';

interface Props {
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancellationModal({ sessionId, onClose, onSuccess }: Props) {
  const isOnline = useOnlineStatus();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!isOnline) {
      setError('Reconnect before submitting a cancellation request');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Reason must be at least 5 characters');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createCancellationRequest({ sessionId, reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to submit request');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        
        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Request Session Cancellation
        </h2>

        {/* Loading State */}
        {loading && (
          <p className="text-blue-500 text-sm mb-2">Submitting request...</p>
        )}

        {/* Error State */}
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}

        {/* Form */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason for Cancellation
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
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
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

      </div>
    </div>
  );
}
