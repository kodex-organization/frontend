"use client";

import Link from "next/link";
import { Bell, CheckCheck, ChevronRight, Inbox } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isUnread, notificationHref, notificationMessage, type Notification } from "../types";

function shortTime(value: string) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

export function NotificationBell({ notifications, unreadCount, onMarkAsRead, onMarkAllAsRead, markAllLoading, markAllError }: { notifications: Notification[]; unreadCount: number; onMarkAsRead: (id: string) => Promise<void>; onMarkAllAsRead: () => Promise<void>; markAllLoading?: boolean; markAllError?: string | null }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <Button variant="ghost" className="relative h-10 w-10 px-0" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Button>
    {open && <>
      <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setOpen(false)} />
      <div role="dialog" aria-label="Recent notifications" className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-semibold text-slate-950">Notifications</p><p className="mt-0.5 text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p></div>{unreadCount > 0 && <button disabled={markAllLoading} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 disabled:opacity-50" onClick={() => void onMarkAllAsRead()}><CheckCheck className="h-3.5 w-3.5" />{markAllLoading ? "Marking…" : "Mark all read"}</button>}</div>
        {markAllError && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">{markAllError}</p>}
        <div className="max-h-[min(24rem,60vh)] divide-y divide-slate-100 overflow-y-auto">{notifications.length === 0 ? <div className="px-5 py-10 text-center"><Inbox className="mx-auto h-7 w-7 text-slate-300" /><p className="mt-2 text-sm font-medium text-slate-700">No notifications yet</p><p className="mt-1 text-xs text-slate-500">New operational alerts will appear here.</p></div> : notifications.slice(0, 8).map((item) => { const href = notificationHref(item); const unread = isUnread(item); const content = <span className={`flex gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${unread ? "bg-blue-50/40" : ""}`}><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? "bg-brand-600" : "bg-slate-300"}`} /><span className="min-w-0 flex-1"><span className={`block truncate text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-700"}`}>{notificationMessage(item)}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400"><span className="truncate">{item.category?.replaceAll("_", " ") ?? "System"}</span><span className="shrink-0">{shortTime(item.createdAt)}</span></span></span>{href && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />}</span>; return href ? <Link key={item.id} href={href} onClick={() => { setOpen(false); if (unread) void onMarkAsRead(item.id); }}>{content}</Link> : <button key={item.id} className="block w-full" onClick={() => { if (unread) void onMarkAsRead(item.id); }}>{content}</button>; })}</div>
        <Link href="/notifications" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-brand-700 hover:bg-slate-50">View all notifications<ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
    </>}
  </div>;
}
