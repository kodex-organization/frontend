'use client';

import { useState } from 'react';
import { reviewCancellationRequest } from './governance.api';

interface Props {
  requestId: string;
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ManagerApprovalModal({
  requestId,
  sessionId,
  onClose,
  onSuccess,
}: Props) {
  const [reviewReason, setReviewReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDecision(status: 'approved' | 'rejected') {
    if (!reviewReason.trim()) {
      setError('Please provide a reason');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await reviewCancellationRequest(requestId, {
        status,
        reviewReason,
      });
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to process request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">

        {/* Header */}
        <h2 className="text-xl font-bold text-gray-800 mb-1">
          Review Cancellation Request
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Session ID: {sessionId}
        </p>

        {/* Loading State */}
        {loading && (
          <p className="text-blue-500 text-sm mb-2">Processing...</p>
        )}

        {/* Error State */}
        {error && (
          <p className="text-red-500 text-sm mb-2">{error}</p>
        )}

        {/* Form */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Review Reason
          </label>
          <textarea
            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder="Enter your reason..."
            value={reviewReason}
            onChange={(e) => setReviewReason(e.target.value)}
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={() => handleDecision('rejected')}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => handleDecision('approved')}
            disabled={loading}
            className="px-4 py-2 text-sm text-white bg-green-500 rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            Approve
          </button>
        </div>

      </div>
    </div>
  );
}