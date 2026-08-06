"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { useNotifications } from "@/features/notifications/context";
import { getDeliveryLogs, notificationCategories, retryDeliveryLog, type DeliveryLog, type NotificationPreference } from "@/features/notifications/api";
import { isUnread, notificationHref, notificationMessage, type Notification } from "@/features/notifications/types";
import { ApiError } from "@/lib/api/client";

const PAGE_SIZE = 10;
const channels = ["in_app", "push", "sms"];
const statuses = ["queued", "pending", "sent", "failed", "read"];

function PreferenceControls() {
  const { preferences, preferencesLoading, preferencesSaving, preferencesError, savePreferences, pushState, pushMessage, enablePush, disablePush } = useNotifications();
  const [draft, setDraft] = useState<NotificationPreference>(preferences);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(preferences), [preferences]);

  const update = <K extends keyof NotificationPreference>(key: K, value: NotificationPreference[K]) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    if (await savePreferences(draft)) setSaved(true);
  }

  if (preferencesLoading) return <section className="rounded-xl border border-slate-200 bg-white p-5"><Loading message="Loading notification preferences…" /></section>;

  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-4"><h2 className="font-semibold">Notification preferences</h2><p className="text-sm text-slate-500">Saved delivery preferences are separate from browser push permission.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {([ ["inAppEnabled", "In-app notifications"], ["pushEnabled", "Push preference"], ["smsEnabled", "SMS notifications"], ["dailyDigestEnabled", "Daily digest mode"]] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={draft[key]} onChange={(event) => update(key, event.target.checked)} /></label>)}
    </div>
    <div className="mt-4"><p className="text-sm font-medium">Notification categories</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{notificationCategories.map((category) => <label key={category} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.enabledCategories.includes(category)} onChange={(event) => update("enabledCategories", event.target.checked ? [...draft.enabledCategories, category] : draft.enabledCategories.filter((item) => item !== category))} />{category}</label>)}</div></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button className="w-auto" disabled={preferencesSaving} onClick={() => void save()}>{preferencesSaving ? "Saving…" : "Save preferences"}</Button>{pushState !== "registered" && <Button variant="secondary" className="w-auto" disabled={pushState === "generating" || pushState === "registering" || pushState === "revoking"} onClick={() => void enablePush()}>{pushState === "generating" ? "Generating…" : pushState === "registering" ? "Registering…" : "Enable Push Notifications"}</Button>}{pushState === "registered" && <Button variant="secondary" className="w-auto" disabled={pushState === "revoking"} onClick={() => void disablePush()}>{pushState === "revoking" ? "Disabling…" : "Disable Push Notifications"}</Button>}{saved && <span className="text-sm text-emerald-700">Preferences saved.</span>}</div>
    {preferencesError && <p className="mt-3 text-sm text-rose-700">{preferencesError}</p>}{pushMessage && <p className="mt-3 text-sm text-slate-600">{pushMessage}</p>}
  </section>;
}

function DeliveryLogSection() {
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
    void getDeliveryLogs({ page, pageSize: PAGE_SIZE, channel, status, category }).then((result) => {
      if (!active) return;
      setItems(result.items); setTotal(result.total); setError(null);
    }).catch((err) => {
      if (active) setError(err instanceof ApiError ? err.message : "Could not load delivery logs.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, channel, status, category, reloadNonce]);

  function filterChanged(setter: (value: string) => void, value: string) { setter(value); setPage(1); }

  async function retry(item: DeliveryLog) {
    if (retryingId) return;
    setRetryingId(item.id); setError(null);
    try {
      await retryDeliveryLog(item.id);
      const result = await getDeliveryLogs({ page, pageSize: PAGE_SIZE, channel, status, category });
      setItems(result.items); setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retry delivery.");
    } finally { setRetryingId(null); }
  }

  const hasNext = page * PAGE_SIZE < total;
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Delivery logs</h2><p className="mt-1 text-sm text-slate-500">Push delivery history for your authorized notifications.</p></div><div className="grid grid-cols-3 gap-2"><Select value={channel} onChange={(event) => filterChanged(setChannel, event.target.value)}><option value="">All channels</option>{channels.map((item) => <option key={item}>{item}</option>)}</Select><Select value={status} onChange={(event) => filterChanged(setStatus, event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</Select><Select value={category} onChange={(event) => filterChanged(setCategory, event.target.value)}><option value="">All categories</option>{notificationCategories.map((item) => <option key={item}>{item}</option>)}</Select></div></div>
    {loading ? <Loading message="Loading delivery logs…" /> : error && items.length === 0 ? <ErrorState message={error} onRetry={() => setReloadNonce((value) => value + 1)} /> : items.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No delivery logs found.</div> : <div className="mt-4 overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Category</th><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Error</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Updated</th><th className="px-3 py-2" /></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id}><td className="px-3 py-2">{item.category ?? "—"}</td><td className="px-3 py-2">{item.channel}</td><td className="px-3 py-2">{item.status}</td><td className="px-3 py-2">{item.attempts}</td><td className="max-w-xs px-3 py-2 text-xs text-slate-500">{item.error?.message ?? "—"}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{new Date(item.createdAt).toLocaleString()}</td><td className="whitespace-nowrap px-3 py-2 text-xs">{new Date(item.updatedAt).toLocaleString()}</td><td className="px-3 py-2">{item.channel === "push" && item.status === "failed" && <button disabled={retryingId !== null} onClick={() => void retry(item)} className="text-xs font-semibold text-brand-700 disabled:opacity-50">{retryingId === item.id ? "Retrying…" : "Retry"}</button>}</td></tr>)}</tbody></table></div>}
    {error && items.length > 0 && <p className="mt-3 text-sm text-rose-700">{error}</p>}<div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate-500">{total ? `Page ${page} · ${total} total` : ""}</span><div className="flex gap-2"><Button variant="secondary" className="w-auto" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" className="w-auto" disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
  </section>;
}

function NotificationRow({ item, onRead }: { item: Notification; onRead: (id: string) => Promise<void> }) {
  const href = notificationHref(item);
  const body = <div className={`rounded-xl border p-4 ${isUnread(item) ? "border-blue-200 bg-blue-50/50" : "bg-white"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{notificationMessage(item)}</p><p className="mt-1 text-xs text-slate-500">{item.category ?? "General"} · {item.channel ?? "in-app"} · {new Date(item.createdAt).toLocaleString()}</p></div>{isUnread(item) && <button className="shrink-0 text-xs font-semibold text-brand-700" onClick={() => void onRead(item.id)}>Mark read</button>}</div>{href && <span className="mt-3 inline-block text-xs font-semibold text-brand-700">Open related record →</span>}</div>;
  return href ? <Link href={href}>{body}</Link> : <div>{body}</div>;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, error, refresh, markAsRead, markAllAsRead, markAllLoading, markAllError } = useNotifications();
  const [scope, setScope] = useState("all"); const [category, setCategory] = useState("all"); const [channel, setChannel] = useState("all"); const [limit, setLimit] = useState(PAGE_SIZE);
  const categories = useMemo(() => Array.from(new Set(notifications.map((item) => item.category).filter(Boolean))), [notifications]);
  const channelsFromNotifications = useMemo(() => Array.from(new Set(notifications.map((item) => item.channel).filter(Boolean))), [notifications]);
  const filtered = notifications.filter((item) => (scope === "all" || isUnread(item)) && (category === "all" || item.category === category) && (channel === "all" || item.channel === channel));
  if (loading && notifications.length === 0) return <Loading />;
  if (error && notifications.length === 0) return <ErrorState message={error} onRetry={() => void refresh()} />;
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-500">Operational alerts for your authorized branch.</p></div><div className="flex gap-2"><Button variant="secondary" className="w-auto" onClick={() => void refresh()}>Refresh</Button>{unreadCount > 0 && <Button className="w-auto" disabled={markAllLoading} onClick={() => void markAllAsRead()}>{markAllLoading ? "Marking…" : "Mark all read"}</Button>}</div></div>{markAllError && <p className="text-sm text-rose-700">{markAllError}</p>}
    <div className="grid gap-2 sm:grid-cols-3"><Select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">All notifications</option><option value="unread">Unread only</option></Select><Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item as string}>{item}</option>)}</Select><Select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option>{channelsFromNotifications.map((item) => <option key={item} value={item as string}>{item}</option>)}</Select></div>
    {filtered.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center text-sm text-slate-500">{notifications.length === 0 ? "You have no notifications." : "No notifications match these filters."}</div> : <div className="space-y-3">{filtered.slice(0, limit).map((item) => <NotificationRow key={item.id} item={item} onRead={markAsRead} />)}</div>}{limit < filtered.length && <Button variant="secondary" className="mx-auto w-auto" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Load more</Button>}
    <PreferenceControls /><DeliveryLogSection />
  </div>;
}
