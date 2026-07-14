"use client";

interface DeviceCardProps {
  deviceName: string;
  deviceType: string;
  operatingSystem: string;
  appVersion: string;
  lastSeen: string;
  isCurrentDevice: boolean;
  onRevoke?: () => void;
}

export default function DeviceCard({
  deviceName,
  deviceType,
  operatingSystem,
  appVersion,
  lastSeen,
  isCurrentDevice,
  onRevoke,
}: DeviceCardProps) {
  return (
     <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white px-4 py-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">

      {/* Device Name */}
      <h3
        className="truncate text-center text-lg font-medium  tracking-wider text-green-700"
        title={deviceName}
      >
        {deviceName}
      </h3>

      {/* Details */}
     <div className="mt-6 space-y-4 border-t border-green-500 pt-5">

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-gray-500">
            Type
          </span>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {deviceType}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <span className="text-[14px] font-medium text-gray-500 whitespace-nowrap">
            Operating System
          </span>

          <span
            className="whitespace-nowrap text-right text-[14px] text-gray-700 "
            title={operatingSystem}
          >
            {operatingSystem}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-gray-500">
            App Version
          </span>

          <span className="text-[14px] font-medium text-gray-800">
            {appVersion}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[14px] font-medium text-gray-500">
            Last Seen
          </span>

          <span className="text-[14px] text-gray-700">
            {lastSeen}
          </span>
        </div>

      </div>

      {/* Bottom Button */}
     <div className="mt-6 pt-6 flex justify-center">

      {isCurrentDevice ? (
        <span className="rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
          ✓ This Device
        </span>
      ) : (
        <button
          onClick={onRevoke}
          className="rounded-lg border border-red-500 px-5 py-2 text-sm font-medium text-red-600 transition-all duration-200 hover:bg-red-500 hover:text-white"
        >
          Revoke
        </button>
      )}

     </div>
    </div>
  );
}