"use client";

import { useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { shiftHandover } from "./governance.api";
import type { GovernanceStaff } from "./governance.types";

interface Props {
  staff: GovernanceStaff[];
  onClose: () => void;
  onSuccess: () => void;
}

const staffLabel = (staff: GovernanceStaff) =>
  staff.fullName ?? staff.email ?? `Staff ${staff.id.slice(0, 8)}`;

export default function ShiftHandoverScreen({
  staff,
  onClose,
  onSuccess,
}: Props) {
  const isOnline = useOnlineStatus();
  const outgoingStaff = useMemo(
    () => staff.filter((member) => member.openSessionCount > 0),
    [staff],
  );
  const [fromUserId, setFromUserId] = useState(
    outgoingStaff[0]?.id ?? "",
  );
  const [toUserId, setToUserId] = useState(
    staff.find((member) => member.id !== outgoingStaff[0]?.id)?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const incomingStaff = staff.filter((member) => member.id !== fromUserId);

  function handleOutgoingChange(userId: string) {
    setFromUserId(userId);
    if (toUserId === userId) {
      setToUserId(staff.find((member) => member.id !== userId)?.id ?? "");
    }
  }

  async function handleSubmit() {
    if (!isOnline) {
      setError("Reconnect before completing a shift handover");
      return;
    }
    if (!fromUserId || !toUserId) {
      setError("Select both outgoing and incoming staff");
      return;
    }
    if (fromUserId === toUserId) {
      setError("Outgoing and incoming staff must be different");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await shiftHandover({ fromUserId, toUserId });
      setSuccess(
        `Successfully transferred ${data.transferredCount} open session${
          data.transferredCount === 1 ? "" : "s"
        }.`,
      );
      onSuccess();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to process handover",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <h2 className="mb-1 text-xl font-bold text-gray-800">
          Shift Handover
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Transfer every open session from one branch staff member to another.
        </p>

        {loading && (
          <p className="mb-2 text-sm text-blue-500">Processing handover...</p>
        )}
        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
        {success && <p className="mb-2 text-sm text-green-600">{success}</p>}

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Outgoing staff
          </label>
          <select
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            value={fromUserId}
            onChange={(event) => handleOutgoingChange(event.target.value)}
            disabled={loading || outgoingStaff.length === 0}
          >
            {outgoingStaff.length === 0 && (
              <option value="">No staff member has open sessions</option>
            )}
            {outgoingStaff.map((member) => (
              <option key={member.id} value={member.id}>
                {staffLabel(member)} ({member.openSessionCount} open)
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Incoming staff
          </label>
          <select
            className="w-full rounded-md border border-gray-300 p-2 text-sm"
            value={toUserId}
            onChange={(event) => setToUserId(event.target.value)}
            disabled={loading || incomingStaff.length === 0}
          >
            {incomingStaff.length === 0 && (
              <option value="">No other eligible staff available</option>
            )}
            {incomingStaff.map((member) => (
              <option key={member.id} value={member.id}>
                {staffLabel(member)} — {member.roles.join(", ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              loading ||
              !isOnline ||
              !fromUserId ||
              !toUserId ||
              fromUserId === toUserId
            }
            className="rounded-md bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 disabled:opacity-50"
          >
            {loading ? "Processing..." : "Complete Handover"}
          </button>
        </div>
      </div>
    </div>
  );
}
