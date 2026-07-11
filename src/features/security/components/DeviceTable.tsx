"use client";

import { useEffect, useState } from "react";
import DeviceCard from "./DeviceCard";
import { getDevices, revokeDevice, type Device } from "../api";
import { getDeviceInfo } from "@/features/auth/index";

export default function DeviceTable() {
  const [devices, setDevices] = useState<Device[]>([]);
  const currentDeviceIdentifier = getDeviceInfo().deviceIdentifier;

  const [loading, setLoading] = useState(true);

  const loadDevices = async () => {
    try {
      const data = await getDevices();
      setDevices(data);
    } catch (error) {
      console.error("Failed to load devices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRevoke = async (device: Device) => {
    const confirmed = window.confirm(
      `Are you sure you want to revoke "${device.deviceName ?? "Unknown Device"}"?\n\nThe user will need to sign in again to access the account.`
    );

    if (!confirmed) return;

    try {
      await revokeDevice(device.id);

      alert("Device revoked successfully.");

      // Refresh the device list
      await loadDevices();
    } catch (error) {
      console.error("Failed to revoke device:", error);
      alert("Failed to revoke device.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="animate-pulse rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 h-6 w-48 rounded bg-gray-200"></div>
            <div className="mb-3 h-4 w-32 rounded bg-gray-200"></div>
            <div className="mb-2 h-4 w-40 rounded bg-gray-200"></div>
            <div className="h-4 w-36 rounded bg-gray-200"></div>
          </div>
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
        No active devices found.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          deviceName={device.deviceName ?? "Unknown Device"}
          deviceType={device.deviceType ?? "-"}
          operatingSystem={device.os ?? "-"}
          appVersion={device.appVersion ?? "-"}
          lastSeen={new Date(device.lastSeenAt).toLocaleString()}
          isCurrentDevice={
            device.deviceIdentifier === currentDeviceIdentifier
          }
          onRevoke={() => handleRevoke(device)}
        />
      ))}
    </div>
  );
}

