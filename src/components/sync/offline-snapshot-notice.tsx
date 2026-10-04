interface OfflineSnapshotNoticeProps {
  savedAt: string;
  /** Extra sentence, e.g. what cannot be done while offline. */
  note?: string;
}

/**
 * Shown on settings / admin screens while the server cannot be reached and the
 * screen is displaying the last copy saved on this device (SRS 3.10 / 3.13:
 * tell the user when the data was last synchronised).
 */
export function OfflineSnapshotNotice({
  savedAt,
  note = "Changes on this screen need an internet connection.",
}: OfflineSnapshotNoticeProps) {
  return (
    <div
      role="status"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800"
    >
      You are offline. Showing data saved on this device at{" "}
      <span className="font-semibold">{new Date(savedAt).toLocaleString()}</span>. {note}
    </div>
  );
}