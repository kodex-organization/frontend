'use client';

import { useState } from 'react';
import CancellationModal from '@/features/governance/CancellationModal';
import ManagerApprovalModal from '@/features/governance/ManagerApprovalModal';
import RateOverrideModal from '@/features/governance/RateOverrideModal';
import TakeoverModal from '@/features/governance/TakeoverModal';
import ShiftHandoverScreen from '@/features/governance/ShiftHandoverScreen';
import AuditLogViewer from '@/features/governance/AuditLogViewer';

export default function GovernancePage() {
  const [showCancellation, setShowCancellation] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showRateOverride, setShowRateOverride] = useState(false);
  const [showTakeover, setShowTakeover] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // Demo values — will come from real session data later
  const demoSessionId = 'demo-session-id';
  const demoRequestId = 'demo-request-id';
  const demoUserId = 'demo-user-id';
  const demoUserName = 'Demo Cashier';
  const demoCurrentRate = 200;

  return (
    <div className="p-6">

      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Session Governance
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Manage session policies, approvals, and handovers
      </p>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Cancellation Request */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Request Cancellation
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Submit a session cancellation request for manager approval
          </p>
          <button
            onClick={() => setShowCancellation(true)}
            className="px-4 py-2 text-sm text-white bg-red-500 rounded-md hover:bg-red-600"
          >
            Request Cancellation
          </button>
        </div>

        {/* Manager Approval */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Review Cancellation
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Approve or reject pending cancellation requests
          </p>
          <button
            onClick={() => setShowApproval(true)}
            className="px-4 py-2 text-sm text-white bg-yellow-500 rounded-md hover:bg-yellow-600"
          >
            Review Request
          </button>
        </div>

        {/* Rate Override */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Rate Override
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Override the hourly rate for an active session
          </p>
          <button
            onClick={() => setShowRateOverride(true)}
            className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600"
          >
            Override Rate
          </button>
        </div>

        {/* Manager Takeover */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Manager Takeover
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Take over a session from an offline device
          </p>
          <button
            onClick={() => setShowTakeover(true)}
            className="px-4 py-2 text-sm text-white bg-orange-500 rounded-md hover:bg-orange-600"
          >
            Take Over Session
          </button>
        </div>

        {/* Shift Handover */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Shift Handover
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Transfer all open sessions to incoming cashier
          </p>
          <button
            onClick={() => setShowHandover(true)}
            className="px-4 py-2 text-sm text-white bg-purple-500 rounded-md hover:bg-purple-600"
          >
            Start Handover
          </button>
        </div>

        {/* Audit Log */}
        <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
          <h3 className="font-semibold text-gray-700 mb-1">
            Audit Log
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            View all governance actions for a session
          </p>
          <button
            onClick={() => setShowAuditLog(true)}
            className="px-4 py-2 text-sm text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            View Audit Log
          </button>
        </div>

      </div>

      {/* Modals */}
      {showCancellation && (
        <CancellationModal
          sessionId={demoSessionId}
          onClose={() => setShowCancellation(false)}
          onSuccess={() => console.log('Cancellation requested!')}
        />
      )}

      {showApproval && (
        <ManagerApprovalModal
          requestId={demoRequestId}
          sessionId={demoSessionId}
          onClose={() => setShowApproval(false)}
          onSuccess={() => console.log('Request reviewed!')}
        />
      )}

      {showRateOverride && (
        <RateOverrideModal
          sessionId={demoSessionId}
          currentRate={demoCurrentRate}
          onClose={() => setShowRateOverride(false)}
          onSuccess={() => console.log('Rate overridden!')}
        />
      )}

      {showTakeover && (
        <TakeoverModal
          sessionId={demoSessionId}
          onClose={() => setShowTakeover(false)}
          onSuccess={() => console.log('Takeover done!')}
        />
      )}

      {showHandover && (
        <ShiftHandoverScreen
          fromUserId={demoUserId}
          fromUserName={demoUserName}
          onClose={() => setShowHandover(false)}
          onSuccess={() => console.log('Handover done!')}
        />
      )}

      {showAuditLog && (
        <AuditLogViewer
          sessionId={demoSessionId}
          onClose={() => setShowAuditLog(false)}
        />
      )}

    </div>
  );
}