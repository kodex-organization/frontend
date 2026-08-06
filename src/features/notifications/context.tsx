"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useOnlineStatus } from "@/lib/connectivity/online-status";
import { ApiError } from "@/lib/api/client";
import { getNotifications, markNotificationRead, registerFcmToken, revokeFcmToken } from "./api";
import { flushNotificationQueue, queueNotificationRead } from "./offline";
import { isUnread, type Notification } from "./types";
import { listenForForegroundMessages, requestPushPermission, revokePushToken, type PushSetupResult } from "./firebase";
import { toast, ToastContainer } from "react-toastify";

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  pushToken: string | null;
  pushState: any;
  pushMessage: string | null;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [pushState, setPushState] = useState<NotificationContextValue["pushState"]>("idle");
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!online) { setLoading(false); return; }
    setLoading(true);
    try {
      setNotifications(await getNotifications());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load notifications.");
    } finally { setLoading(false); }
  }, [online]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!online) return;
    void flushNotificationQueue().then(() => refresh());
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [online, refresh]);

  const enablePush = useCallback(async () => {
    setPushState("generating");
    setPushMessage("Generating a secure browser push token…");
    const result = await requestPushPermission();
    if (result.status !== "generated") {
      setPushState(result.status);
      setPushMessage(result.message);
      toast.error(result.message);
      return;
    }
    setPushState("registering");
    setPushMessage("Registering this browser for push notifications…");
    try {
      await registerFcmToken(result.token);
      setPushToken(result.token);
      setPushState("registered");
      setPushMessage("Push notifications are registered for this browser.");
      toast.success("Push notifications enabled.");
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof ApiError ? error.message : "The browser token could not be registered.");
      toast.error("Push registration failed.");
    }
  }, []);

  const disablePush = useCallback(async () => {
    if (!pushToken) {
      setPushState("disabled");
      return;
    }
    setPushState("revoking");
    setPushMessage("Disabling push notifications…");
    try {
      await revokeFcmToken(pushToken);
      await revokePushToken();
      setPushToken(null);
      setPushState("disabled");
      setPushMessage("Push notifications are disabled for this browser.");
      toast.success("Push notifications disabled.");
    } catch (error) {
      setPushState("failed");
      setPushMessage(error instanceof ApiError ? error.message : "The push token could not be revoked.");
      toast.error("Could not disable push notifications.");
    }
  }, [pushToken]);

  useEffect(() => {
    if (pushState !== "registered") return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void listenForForegroundMessages((payload) => {
      const value = payload as { notification?: { title?: string; body?: string }; data?: { body?: string } };
      toast.info(`${value.notification?.title ?? "New notification"}${value.notification?.body || value.data?.body ? `: ${value.notification?.body ?? value.data?.body}` : ""}`);
      void refresh();
    }).then((cleanup) => {
      if (active) unsubscribe = cleanup;
      else cleanup();
    }).catch((listenerError) => {
      if (active) setPushMessage(listenerError instanceof Error ? listenerError.message : "Foreground push listener failed.");
    });
    return () => { active = false; unsubscribe?.(); };
  }, [pushState, refresh]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((current) => current.map((item) => item.id === id
      ? { ...item, status: "read", readAt: new Date().toISOString() }
      : item));
    if (!online) { await queueNotificationRead(id); return; }
    try { await markNotificationRead(id); }
    catch (err) {
      await queueNotificationRead(id);
      setError(err instanceof ApiError ? err.message : "Read status will sync when online.");
    }
  }, [online]);

  const markAllAsRead = useCallback(async () => {
    const ids = notifications.filter(isUnread).map((item) => item.id);
    setNotifications((current) => current.map((item) => isUnread(item)
      ? { ...item, status: "read", readAt: new Date().toISOString() } : item));
    await Promise.all(ids.map((id) => markAsRead(id)));
  }, [markAsRead, notifications]);

  const value = useMemo(() => ({ notifications, unreadCount: notifications.filter(isUnread).length, loading, error, refresh, markAsRead, markAllAsRead, pushToken, pushState, pushMessage, enablePush, disablePush }), [notifications, loading, error, refresh, markAsRead, markAllAsRead, pushToken, pushState, pushMessage, enablePush, disablePush]);
  return <NotificationContext.Provider value={value}><ToastContainer position="top-right" autoClose={4000} />{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
