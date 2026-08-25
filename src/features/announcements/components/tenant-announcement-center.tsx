"use client";

import { Check, Inbox, Megaphone, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import {
  dismissTenantAnnouncement,
  getVisibleTenantAnnouncements,
  listTenantAnnouncements,
  markTenantAnnouncementRead,
  type TenantAnnouncement,
} from "@/features/platform-admin/announcements";

export function TenantAnnouncementCenter() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<TenantAnnouncement[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      setAnnouncements(await listTenantAnnouncements());
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Announcements are temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const visible = useMemo(
    () => getVisibleTenantAnnouncements(announcements),
    [announcements],
  );
  const unreadCount = visible.filter((announcement) => !announcement.readAt).length;
  const banner = visible.find((announcement) => !announcement.readAt) ?? visible[0];

  const markRead = async (announcement: TenantAnnouncement) => {
    if (announcement.readAt || pendingId) return;
    setPendingId(announcement.id);
    setError(null);
    try {
      const receipt = await markTenantAnnouncementRead(announcement.id);
      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id ? { ...item, readAt: receipt.readAt } : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not mark the announcement as read.",
      );
    } finally {
      setPendingId(null);
    }
  };

  const dismiss = async (announcement: TenantAnnouncement) => {
    if (pendingId) return;
    setPendingId(announcement.id);
    setError(null);
    try {
      const receipt = await dismissTenantAnnouncement(announcement.id);
      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? { ...item, dismissedAt: receipt.dismissedAt }
            : item,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : "Could not dismiss the announcement.",
      );
    } finally {
      setPendingId(null);
    }
  };

  if (loading && announcements.length === 0) return null;
  if (!banner && !error) return null;

  return (
    <section className="relative mb-4" aria-label="System announcements">
      {banner ? (
        <div className="flex items-start justify-between gap-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
          <div className="flex min-w-0 gap-3">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{banner.title}</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-sky-900/80">
                {banner.body}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!banner.readAt ? (
              <button
                type="button"
                disabled={pendingId === banner.id}
                onClick={() => void markRead(banner)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                title="Mark announcement as read"
                aria-label="Mark announcement as read"
              >
                <Check className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              disabled={pendingId === banner.id}
              onClick={() => void dismiss(banner)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sky-700 hover:bg-sky-100 disabled:opacity-50"
              title="Dismiss announcement"
              aria-label="Dismiss announcement"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="relative ml-1 inline-flex h-8 items-center gap-2 rounded-md border border-sky-200 bg-white px-2.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
              aria-expanded={open}
            >
              <Inbox className="h-4 w-4" />
              Inbox
              {unreadCount > 0 ? (
                <span className="inline-flex min-w-5 justify-center rounded-full bg-sky-700 px-1.5 py-0.5 text-[10px] text-white">
                  {unreadCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 max-h-96 w-full max-w-md overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Announcement inbox</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
              aria-label="Close announcement inbox"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No active announcements.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {visible.map((announcement) => (
                <article key={announcement.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {!announcement.readAt ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-600" />
                        ) : null}
                        <h3 className="text-sm font-semibold text-slate-900">
                          {announcement.title}
                        </h3>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                        {announcement.body}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pendingId === announcement.id}
                      onClick={() => void dismiss(announcement)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      title="Dismiss announcement"
                      aria-label={`Dismiss ${announcement.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {!announcement.readAt ? (
                    <button
                      type="button"
                      disabled={pendingId === announcement.id}
                      onClick={() => void markRead(announcement)}
                      className="mt-3 text-xs font-medium text-sky-700 hover:text-sky-900 disabled:opacity-50"
                    >
                      Mark as read
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
