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
    <div className="rounded-xl border border-gray-200 bg-white px-8 py-5 shadow-sm transition-all hover:shadow-md">
    
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-lg mb-5 font-semibold text-gray-900">{deviceName}</h3>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs  uppercase tracking-wide text-gray-700">
                {deviceType}
              </span>

              <span className="text-sm text-gray-600">
                {operatingSystem}
              </span>
            </div>

          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-800">App Version:</span> {appVersion}
          </p>

         <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">Last Seen:</span> {lastSeen}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isCurrentDevice ? (
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              This Device
            </span>
          ) : (
            <button
              onClick={onRevoke}
              className="rounded-md text-sm font-medium px-4 py-2 border border-red-600 bg-white text-red-600 hover:text-white hover:bg-red-500 transition-all duration-200 "
            >
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}