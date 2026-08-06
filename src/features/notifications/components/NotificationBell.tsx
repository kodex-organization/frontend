"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isUnread, notificationHref, notificationMessage, type Notification } from "../types";

export function NotificationBell({ notifications, unreadCount, onMarkAsRead, onMarkAllAsRead }: { notifications: Notification[]; unreadCount: number; onMarkAsRead: (id: string) => Promise<void>; onMarkAllAsRead: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <div className="relative">
    <Button variant="ghost" className="relative px-2" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Button>
    {open && <>
      <button className="fixed inset-0 z-40 cursor-default" aria-label="Close notifications" onClick={() => setOpen(false)} />
      <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
        <div className="flex items-center justify-between border-b p-3"><div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p></div>{unreadCount > 0 && <button className="text-xs font-semibold text-brand-700" onClick={() => void onMarkAllAsRead()}>Mark all read</button>}</div>
        <div className="max-h-96 divide-y overflow-y-auto">{notifications.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">No notifications</p> : notifications.slice(0, 8).map((item) => { const href = notificationHref(item); const content = <span className={`block p-3 text-left ${isUnread(item) ? "bg-blue-50/60" : ""}`}><span className="flex gap-2"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${isUnread(item) ? "bg-blue-600" : "bg-slate-300"}`} /><span><span className="block text-sm">{notificationMessage(item)}</span><span className="mt-1 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span></span></span></span>; return href ? <Link key={item.id} href={href} onClick={() => { setOpen(false); if (isUnread(item)) void onMarkAsRead(item.id); }}>{content}</Link> : <button key={item.id} className="block w-full" onClick={() => { if (isUnread(item)) void onMarkAsRead(item.id); }}>{content}</button>; })}</div>
        <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t p-3 text-center text-xs font-semibold text-brand-700 hover:bg-slate-50">View all notifications</Link>
      </div>
    </>}
  </div>;
}

