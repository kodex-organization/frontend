"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  Megaphone,
  Percent,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { useNotifications } from "@/features/notifications/context";
import {
  getDeliveryLogs,
  notificationCategories,
  retryDeliveryLog,
  type DeliveryLog,
  type NotificationPreference,
} from "@/features/notifications/api";
import {
  isUnread,
  notificationHref,
  notificationMessage,
  type Notification,
} from "@/features/notifications/types";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";

const PAGE_SIZE = 10;
const defaultChannels = ["push", "sms"];
const statuses = ["queued", "pending", "sent", "failed", "read"];

function formatRelativeTime(value: string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function categoryLabel(category: string | null | undefined) {
  return (category ?? "system").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function CategoryIcon({ category }: { category: string | null | undefined }) {
  const className = "h-4 w-4";
  if (category === "overtime") return <Clock3 className={className} />;
  if (category === "manager_takeover") return <ShieldCheck className={className} />;
  if (category === "anomaly") return <AlertTriangle className={className} />;
  if (category === "discount") return <Percent className={className} />;
  if (category === "invoice_void") return <ReceiptText className={className} />;
  if (category === "udhaar") return <WalletCards className={className} />;
  if (category === "end_of_day") return <CalendarDays className={className} />;
  if (category === "announcement") return <Megaphone className={className} />;
  return <Info className={className} />;
}

function categoryTone(category: string | null | undefined) {
  if (category === "anomaly" || category === "invoice_void") return "bg-rose-50 text-rose-700";
  if (category === "overtime" || category === "manager_takeover") return "bg-amber-50 text-amber-700";
  if (category === "discount") return "bg-violet-50 text-violet-700";
  if (category === "udhaar") return "bg-blue-50 text-blue-700";
  if (category === "announcement") return "bg-sky-50 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "sent" || status === "read"
    ? "bg-brand-50 text-brand-700"
    : status === "failed"
      ? "bg-rose-50 text-rose-700"
      : "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function getAnnouncementDates(item: Notification): {
  startsAt: Date | null;
  expiresAt: Date | null;
} {
  let startsAtStr: string | null = (item as any).startsAt ?? null;
  let expiresAtStr: string | null = (item as any).expiresAt ?? null;

  if (!startsAtStr || !expiresAtStr) {
    try {
      const payload = typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload;
      if (payload && typeof payload === "object") {
        if (!startsAtStr && payload.startsAt) startsAtStr = payload.startsAt;
        if (!expiresAtStr && payload.expiresAt) expiresAtStr = payload.expiresAt;
      }
    } catch {
      // ignore parsing errors
    }
  }

  return {
    startsAt: startsAtStr ? new Date(startsAtStr) : null,
    expiresAt: expiresAtStr ? new Date(expiresAtStr) : null,
  };
}

function PreferenceControls() {
  const { user } = useAuth();
  const isOwner = Boolean(user?.roles?.includes("OWNER"));
  const {
    preferences,
    preferencesLoading,
    preferencesSaving,
    preferencesError,
    savePreferences,
    pushState,
    pushMessage,
    enablePush,
    disablePush,
  } = useNotifications();
  const [draft, setDraft] = useState<NotificationPreference>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(preferences), [preferences]);

  const update = <K extends keyof NotificationPreference>(key: K, value: NotificationPreference[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    const toSave = isOwner ? draft : { ...draft, pushEnabled: false };
    if (await savePreferences(toSave)) setSaved(true);
  }

  const browserPushStatus = pushState === "registered"
    ? "Enabled"
    : pushState === "denied"
      ? "Permission denied"
      : pushState === "failed"
        ? "Unavailable"
        : "Not enabled";

  const channelOptions = useMemo(() => {
    type ChannelKey = "inAppEnabled" | "pushEnabled" | "smsEnabled" | "dailyDigestEnabled";
    const list: { key: ChannelKey; label: string; description: string }[] = [
      { key: "inAppEnabled", label: "In-app notifications", description: "Alerts in CueCloud" },
    ];
    if (isOwner) {
      list.push({ key: "pushEnabled", label: "Push notifications", description: "Saved preference for browser push" });
    }
    list.push(
      { key: "smsEnabled", label: "SMS notifications", description: "Only where a phone number is available" },
      { key: "dailyDigestEnabled", label: "Daily digest", description: "One summary per branch day" },
    );
    return list;
  }, [isOwner]);

  if (preferencesLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <Loading message="Loading notification preferences…" />
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-950">Notification preferences</h2>
        <p className="mt-1 text-sm text-slate-500">Choose which channels and alert categories matter to you.</p>
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</p>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {channelOptions.map(({ key, label, description }) => (
              <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-3 py-3 hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-medium text-slate-800">{label}</span>
                  <span className="block text-xs text-slate-500">{description}</span>
                </span>
                <input
                  aria-label={label}
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={draft[key]}
                  onChange={(event) => update(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
          {isOwner && (
            <>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-slate-600">Browser push</span>
                <span className="font-medium text-slate-800">{browserPushStatus}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {pushState !== "registered" && (
                  <Button
                    variant="secondary"
                    className="w-auto"
                    disabled={["generating", "registering", "revoking"].includes(pushState)}
                    onClick={() => void enablePush()}
                  >
                    {pushState === "generating" ? "Generating…" : pushState === "registering" ? "Registering…" : "Enable push"}
                  </Button>
                )}
                {pushState === "registered" && (
                  <Button
                    variant="secondary"
                    className="w-auto"
                    disabled={pushState === "revoking"}
                    onClick={() => void disablePush()}
                  >
                    {pushState === "revoking" ? "Disabling…" : "Disable push"}
                  </Button>
                )}
              </div>
              {pushMessage && <p className="mt-2 text-xs text-slate-500">{pushMessage}</p>}
            </>
          )}
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {notificationCategories.map((category) => (
              <label
                key={category}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-600"
                  checked={draft.enabledCategories.includes(category)}
                  onChange={(event) =>
                    update(
                      "enabledCategories",
                      event.target.checked
                        ? [...draft.enabledCategories, category]
                        : draft.enabledCategories.filter((item) => item !== category),
                    )
                  }
                />
                <span>{categoryLabel(category)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-5 py-4">
        <Button className="w-auto" disabled={preferencesSaving} onClick={() => void save()}>
          {preferencesSaving ? "Saving…" : "Save preferences"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-brand-700">
            <Check className="h-4 w-4" />Saved
          </span>
        )}
        {preferencesError && <p role="alert" className="text-sm text-rose-700">{preferencesError}</p>}
      </div>
    </section>
  );
}

function DeliveryLogSection() {
  const { user } = useAuth();
  const isOwner = Boolean(user?.roles?.includes("OWNER"));
  const availableChannels = useMemo(
    () => (isOwner ? defaultChannels : defaultChannels.filter((c) => c !== "push")),
    [isOwner],
  );
  const [items, setItems] = useState<DeliveryLog[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getDeliveryLogs({ page, pageSize: PAGE_SIZE, channel, status, category })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "Could not load delivery logs.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, channel, status, category, reloadNonce]);

  function filterChanged(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setChannel("");
    setStatus("");
    setCategory("");
    setPage(1);
  }

  async function retry(item: DeliveryLog) {
    if (!isOwner || retryingId) return;
    setRetryingId(item.id);
    setError(null);
    try {
      await retryDeliveryLog(item.id);
      const result = await getDeliveryLogs({ page, pageSize: PAGE_SIZE, channel, status, category });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry delivery.");
    } finally {
      setRetryingId(null);
    }
  }

  const hasFilters = Boolean(channel || status || category);
  const hasNext = page * PAGE_SIZE < total;

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Delivery logs</h2>
            <p className="mt-1 text-sm text-slate-500">Recent delivery attempts for your authorized notifications.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{total} records</span>
            <button
              aria-label="Refresh delivery logs"
              title="Refresh"
              className="rounded-md p-1.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
              onClick={() => setReloadNonce((value) => value + 1)}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select aria-label="Filter by channel" value={channel} onChange={(event) => filterChanged(setChannel, event.target.value)}>
            <option value="">All channels</option>
            {availableChannels.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select aria-label="Filter by status" value={status} onChange={(event) => filterChanged(setStatus, event.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </Select>
          <Select aria-label="Filter by category" value={category} onChange={(event) => filterChanged(setCategory, event.target.value)}>
            <option value="">All categories</option>
            {notificationCategories.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item)}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <button
              className="inline-flex items-center gap-1 px-2 text-xs font-medium text-slate-600 hover:text-slate-950 cursor-pointer"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />Clear
            </button>
          )}
        </div>
      </div>
      <div className="p-5">
        {loading ? (
          <Loading message="Loading delivery logs…" />
        ) : error && items.length === 0 ? (
          <ErrorState message={error} onRetry={() => setReloadNonce((value) => value + 1)} />
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No delivery history yet.</p>
            <p className="mt-1 text-xs text-slate-500">Delivery attempts will appear here when notifications are sent.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2 pr-4">Category</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Attempts</th>
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Details</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4 font-medium text-slate-700">{item.channel}</td>
                      <td className="py-3 pr-4 text-slate-600">{categoryLabel(item.category)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={item.status} /></td>
                      <td className="py-3 pr-4 text-slate-600">{item.attempts}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-500" title={new Date(item.updatedAt).toLocaleString()}>
                        {formatRelativeTime(item.updatedAt)}
                      </td>
                      <td className="max-w-xs py-3 pr-4 text-xs text-slate-500" title={item.error?.message ?? undefined}>
                        <span className="block truncate">{item.error?.message ?? "—"}</span>
                      </td>
                      <td className="py-3 text-right">
                        {isOwner && item.channel === "push" && item.status === "failed" && (
                          <button
                            disabled={retryingId !== null}
                            onClick={() => void retry(item)}
                            className="text-xs font-semibold text-brand-700 disabled:opacity-50 cursor-pointer"
                          >
                            {retryingId === item.id ? "Retrying…" : "Retry"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-2 md:hidden">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{categoryLabel(item.category)}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.channel} · {item.attempts} attempt{item.attempts === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3 text-xs text-slate-500">
                    <span title={new Date(item.updatedAt).toLocaleString()}>
                      {formatRelativeTime(item.updatedAt)}
                      {item.error?.message ? ` · ${item.error.message}` : ""}
                    </span>
                    {isOwner && item.channel === "push" && item.status === "failed" && (
                      <button
                        disabled={retryingId !== null}
                        onClick={() => void retry(item)}
                        className="shrink-0 font-semibold text-brand-700 disabled:opacity-50 cursor-pointer"
                      >
                        {retryingId === item.id ? "Retrying…" : "Retry"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {error && items.length > 0 && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">{total ? `Page ${page} · ${total} total` : ""}</span>
          <div className="flex gap-2">
            <Button
              aria-label="Previous delivery log page"
              variant="secondary"
              className="w-auto px-3"
              disabled={page === 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft className="h-4 w-4" />Previous
            </Button>
            <Button
              aria-label="Next delivery log page"
              variant="secondary"
              className="w-auto px-3"
              disabled={!hasNext || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function NotificationRow({
  item,
  onRead,
}: {
  item: Notification;
  onRead: (id: string) => Promise<void>;
}) {
  const href = notificationHref(item);
  const unread = isUnread(item);

  // Check if announcement is past its expiration date
  const { expiresAt } = getAnnouncementDates(item);
  const isExpired =
    item.category === "announcement" &&
    Boolean(expiresAt && expiresAt.getTime() <= Date.now());

  return (
    <article
      className={`relative flex gap-3 border-b border-slate-100 px-3 py-4 last:border-0 sm:px-4 ${
        unread ? "bg-blue-50/40" : ""
      }`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${categoryTone(
          item.category,
        )}`}
      >
        <CategoryIcon category={item.category} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h3
              className={`text-sm ${
                unread ? "font-semibold text-slate-950" : "font-medium text-slate-700"
              }`}
            >
              {notificationMessage(item)}
            </h3>
            {unread && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600"
                aria-label="Unread"
              />
            )}
          </div>
          <time
            className="shrink-0 text-xs text-slate-400"
            dateTime={item.createdAt}
            title={new Date(item.createdAt).toLocaleString()}
          >
            {formatRelativeTime(item.createdAt)}
          </time>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryTone(
              item.category,
            )}`}
          >
            {categoryLabel(item.category)}
          </span>
          <span className="text-xs text-slate-400">{item.channel ?? "in-app"}</span>

          {/* Expired Label for ended announcements */}
          {isExpired && (
            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              Expired
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {href && (
            <Link
              href={href}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Open related record <span aria-hidden>→</span>
            </Link>
          )}
          {unread && (
            <button
              className="text-xs font-medium text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
              onClick={() => void onRead(item.id)}
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const isOwner = Boolean(user?.roles?.includes("OWNER"));
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    markAllLoading,
    markAllError,
    pushState,
  } = useNotifications();

  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [channel, setChannel] = useState("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Filter out future/scheduled announcements so they never appear before startsAt
  const visibleNotifications = useMemo(() => {
    const now = Date.now();
    return notifications.filter((item) => {
      if (item.category === "announcement") {
        const { startsAt } = getAnnouncementDates(item);
        if (startsAt && startsAt.getTime() > now) {
          return false;
        }
      }
      return true;
    });
  }, [notifications]);

  const categories = useMemo(
    () => Array.from(new Set(visibleNotifications.map((item) => item.category).filter(Boolean))),
    [visibleNotifications],
  );

  const channelsFromNotifications = useMemo(
    () => Array.from(new Set(visibleNotifications.map((item) => item.channel).filter(Boolean))),
    [visibleNotifications],
  );

  const filtered = visibleNotifications.filter(
    (item) =>
      (scope === "all" || isUnread(item)) &&
      (category === "all" || item.category === category) &&
      (channel === "all" || item.channel === channel),
  );

  const todayCount = visibleNotifications.filter(
    (item) => new Date(item.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const clearFilters = () => {
    setScope("all");
    setCategory("all");
    setChannel("all");
    setLimit(PAGE_SIZE);
  };

  const hasFilters = scope !== "all" || category !== "all" || channel !== "all";

  if (loading && notifications.length === 0) return <Loading />;
  if (error && notifications.length === 0) {
    return <ErrorState message={error} onRetry={() => void refresh()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-700">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Operational alerts for your authorized branch.
          </p>
        </div>
        <div
          className={`grid ${
            isOwner ? "grid-cols-3" : "grid-cols-2"
          } divide-x rounded-lg border border-slate-200 bg-white text-center`}
        >
          <div className="px-3 py-2">
            <p className="text-lg font-semibold text-slate-950">{unreadCount}</p>
            <p className="text-[11px] text-slate-500">Unread</p>
          </div>
          <div className="px-3 py-2">
            <p className="text-lg font-semibold text-slate-950">{todayCount}</p>
            <p className="text-[11px] text-slate-500">Today</p>
          </div>
          {isOwner && (
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">
                {pushState === "registered" ? "Enabled" : "Off"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">Browser push</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="Filter by read status"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="all">All notifications</option>
            <option value="unread">Unread only</option>
          </Select>

          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item as string}>
                {categoryLabel(item)}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by channel"
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value);
              setLimit(PAGE_SIZE);
            }}
          >
            <option value="all">All channels</option>
            {channelsFromNotifications.map((item) => (
              <option key={item} value={item as string}>
                {item}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <button
              className="inline-flex items-center justify-center gap-1 px-2 text-xs font-medium text-slate-600 hover:text-slate-950 cursor-pointer"
              onClick={clearFilters}
            >
              <X className="h-3.5 w-3.5" />Clear filters
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="w-auto" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              className="w-auto"
              disabled={markAllLoading}
              onClick={() => void markAllAsRead()}
            >
              {markAllLoading ? "Marking…" : "Mark all read"}
            </Button>
          )}
        </div>
      </div>

      {markAllError && <p role="alert" className="text-sm text-rose-700">{markAllError}</p>}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            {notifications.length === 0 ? "No notifications yet" : "No notifications match these filters."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {notifications.length === 0
              ? "New operational alerts will appear here."
              : "Try clearing a filter to see more alerts."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {filtered.slice(0, limit).map((item) => (
            <NotificationRow key={item.id} item={item} onRead={markAsRead} />
          ))}
        </div>
      )}

      {limit < filtered.length && (
        <Button variant="secondary" className="mx-auto w-auto" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
          Load more
        </Button>
      )}

      <PreferenceControls />
      <DeliveryLogSection />
    </div>
  );
}