"use client";
import { useEffect, useState } from "react";
import DeviceCard from "./DeviceCard";

const devices = [
  {
    id: 1,
    deviceName: "Nimra's Laptop",
    deviceType: "Laptop",
    operatingSystem: "Windows 11",
    appVersion: "1.0.0",
    lastSeen: "Today, 10:15 AM",
    isCurrentDevice: true,
  },
  {
    id: 2,
    deviceName: "Office Desktop",
    deviceType: "Desktop",
    operatingSystem: "Windows 10",
    appVersion: "1.0.0",
    lastSeen: "Yesterday, 4:30 PM",
    isCurrentDevice: false,
  },
];



export default function DeviceTable() {
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 2000);

      return () => clearTimeout(timer);
    }, []);

    const handleRevoke = (deviceName: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to revoke "${deviceName}"?\n\nThe user will need to sign in again to access the account.`
      );

      if (!confirmed) return;

      alert(`${deviceName} revoked successfully. (Dummy UI only)`);
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
  
  return (
    
    <div className="space-y-4">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          deviceName={device.deviceName}
          deviceType={device.deviceType}
          operatingSystem={device.operatingSystem}
          appVersion={device.appVersion}
          lastSeen={device.lastSeen}
          isCurrentDevice={device.isCurrentDevice}
          onRevoke={() => handleRevoke(device.deviceName)}
        />
      ))}
    </div>
  );
}