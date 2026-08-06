"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import ErrorState from "@/components/common/ErrorState";
import Loading from "@/components/common/Loading";
import { useNotifications } from "@/features/notifications/context";
import { isUnread, notificationHref, notificationMessage, type Notification } from "@/features/notifications/types";

const PAGE_SIZE = 10;

function PreferenceControls() {
  const { pushState, pushMessage, enablePush, disablePush } = useNotifications();
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState({ inApp: true, push: false, sms: false, digest: false, categories: "all" });
  const update = (key: keyof typeof preferences, value: boolean | string) => { setSaved(false); setPreferences((current) => ({ ...current, [key]: value })); };
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="mb-4"><h2 className="font-semibold">Notification preferences</h2><p className="text-sm text-slate-500">These controls are ready for the preferences API, which is not exposed by the current backend.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {([ ["inApp", "In-app notifications"], ["push", "Push notifications"], ["sms", "SMS notifications"], ["digest", "Daily digest mode"]] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span>{label}</span><input type="checkbox" checked={preferences[key] as boolean} onChange={(event) => update(key, event.target.checked)} /></label>)}
    </div>
    <div className="mt-3"><label className="text-sm font-medium">Notification categories<Select value={preferences.categories} onChange={(event) => update("categories", event.target.value)} className="mt-1"><option value="all">All categories</option><option value="operational">Operational alerts</option><option value="billing">Billing and ledger</option><option value="governance">Governance</option></Select></label></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><Button className="w-auto" onClick={() => setSaved(true)}>Save preferences</Button>{pushState !== "registered" && <Button variant="secondary" className="w-auto" disabled={pushState === "generating" || pushState === "registering" || pushState === "revoking"} onClick={() => void enablePush()}>{pushState === "generating" ? "Generating…" : pushState === "registering" ? "Registering…" : "Enable Push Notifications"}</Button>}{pushState === "registered" && <Button variant="secondary" className="w-auto" disabled={pushState === "revoking"} onClick={() => void disablePush()}>{pushState === "revoking" ? "Disabling…" : "Disable Push Notifications"}</Button>}{saved && <span className="text-sm text-amber-700">Waiting for backend preferences endpoint.</span>}{pushMessage && <span className="basis-full text-sm text-amber-700">{pushMessage}</span>}</div>
  </section>;
}

function DeliveryLogSection() {
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Delivery log</h2><p className="mt-1 text-sm text-slate-500">Authorized delivery history will appear here when the backend exposes the delivery-log endpoint.</p><div className="mt-4 overflow-x-auto rounded-lg border"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Attempts</th><th className="px-3 py-2">Timestamp</th><th className="px-3 py-2">Error</th></tr></thead><tbody><tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No delivery-log data available.</td></tr></tbody></table></div></section>;
}

function NotificationRow({ item, onRead }: { item: Notification; onRead: (id: string) => Promise<void> }) {
  const href = notificationHref(item);
  const body = <div className={`rounded-xl border p-4 ${isUnread(item) ? "border-blue-200 bg-blue-50/50" : "bg-white"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium">{notificationMessage(item)}</p><p className="mt-1 text-xs text-slate-500">{item.category ?? "General"} · {item.channel ?? "in-app"} · {new Date(item.createdAt).toLocaleString()}</p></div>{isUnread(item) && <button className="shrink-0 text-xs font-semibold text-brand-700" onClick={() => void onRead(item.id)}>Mark read</button>}</div>{href && <span className="mt-3 inline-block text-xs font-semibold text-brand-700">Open related record →</span>}</div>;
  return href ? <Link href={href}>{body}</Link> : <div>{body}</div>;
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, error, refresh, markAsRead, markAllAsRead } = useNotifications();
  const [scope, setScope] = useState("all"); const [category, setCategory] = useState("all"); const [channel, setChannel] = useState("all"); const [limit, setLimit] = useState(PAGE_SIZE);
  const categories = useMemo(() => Array.from(new Set(notifications.map((item) => item.category).filter(Boolean))), [notifications]);
  const channels = useMemo(() => Array.from(new Set(notifications.map((item) => item.channel).filter(Boolean))), [notifications]);
  const filtered = notifications.filter((item) => (scope === "all" || isUnread(item)) && (category === "all" || item.category === category) && (channel === "all" || item.channel === channel));
  if (loading && notifications.length === 0) return <Loading />;
  if (error && notifications.length === 0) return <ErrorState message={error} onRetry={() => void refresh()} />;
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-500">Operational alerts for your authorized branch.</p></div><div className="flex gap-2"><Button variant="secondary" className="w-auto" onClick={() => void refresh()}>Refresh</Button>{unreadCount > 0 && <Button className="w-auto" onClick={() => void markAllAsRead()}>Mark all read</Button>}</div></div>
    <div className="grid gap-2 sm:grid-cols-3"><Select value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">All notifications</option><option value="unread">Unread only</option></Select><Select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item as string}>{item}</option>)}</Select><Select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="all">All channels</option>{channels.map((item) => <option key={item} value={item as string}>{item}</option>)}</Select></div>
    {filtered.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center text-sm text-slate-500">{notifications.length === 0 ? "You have no notifications." : "No notifications match these filters."}</div> : <div className="space-y-3">{filtered.slice(0, limit).map((item) => <NotificationRow key={item.id} item={item} onRead={markAsRead} />)}</div>}{limit < filtered.length && <Button variant="secondary" className="mx-auto w-auto" onClick={() => setLimit((value) => value + PAGE_SIZE)}>Load more</Button>}
    <PreferenceControls /><DeliveryLogSection />
  </div>;
}
