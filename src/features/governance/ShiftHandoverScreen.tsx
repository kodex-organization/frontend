'use client';

import { useState } from 'react';
import { shiftHandover } from './governance.api';

interface Props {
  fromUserId: string;
  fromUserName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ShiftHandoverScreen({
  fromUserId,
  fromUserName,
  onClose,
  onSuccess,
}: Props) {
  const [toUserId, setToUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit() {
    if (!toUserId.trim()) {
      setError('Please enter incoming cashier ID');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await shiftHandover({ fromUserId, toUserId });
      if (res.success) {
       setSuccess(
  `Successfully transferred ${res.data.transferredCount} sessions!`
);
        onSuccess();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to process handover');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">

        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Shift Handover
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Transferring sessions from: <strong>{fromUserName}</strong>
        </p>

        {/* Loading State */}
        {loading && (
          <p className="text-blue-500 text-sm mb-2">Processing handover...</p>
        )}

        {/* Error State */}
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}

        {/* Success State */}
        {success && (
          <p className="text-green-500 text-sm mb-2">{success}</p>
        )}

        {/* Incoming Cashier Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Incoming Cashier ID
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter cashier user ID..."
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
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
            className="px-4 py-2 text-sm text-white bg-purple-500 rounded-md hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Complete Handover'}
          </button>
        </div>

      </div>
    </div>
  );
}