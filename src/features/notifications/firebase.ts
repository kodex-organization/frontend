"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported, onMessage, type Messaging } from "firebase/messaging";
import { env } from "@/config/env";

export type PushSetupResult =
  | { status: "generated"; token: string }
  | { status: "unsupported" | "missing-config" | "denied" | "failed"; message: string };

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasConfig = Object.values(firebaseConfig).slice(0, 6).every(Boolean) && Boolean(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getFirebaseApp() {
  if (typeof window === "undefined") return null;
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return app;
}

async function getFirebaseMessaging() {
  if (!getFirebaseApp() || !(await isSupported())) return null;
  if (!messaging) messaging = getMessaging(app!);
  return messaging;
}

export async function getPushSupport() {
  if (!hasConfig || typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return false;
  try { return await isSupported(); } catch { return false; }
}

function serviceWorkerUrl() {
  const config = Object.fromEntries(Object.entries(firebaseConfig).filter(([, value]) => value));
  return `/firebase-messaging-sw.js?config=${encodeURIComponent(JSON.stringify(config))}`;
}

export async function requestPushPermission(): Promise<PushSetupResult> {
  if (!hasConfig) return { status: "missing-config", message: "Firebase push configuration is incomplete." };
  if (!(await getPushSupport())) return { status: "unsupported", message: "Push notifications are not supported in this browser." };
  if (Notification.permission === "denied") return { status: "denied", message: "Browser notifications are blocked. Allow them in browser settings to enable push." };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied", message: "Notification permission was not granted." };
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl(), { scope: "/" });
    const currentMessaging = await getFirebaseMessaging();
    if (!currentMessaging) return { status: "unsupported", message: "Firebase Messaging is not supported in this browser." };
    const token = await getToken(currentMessaging, { vapidKey: env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!, serviceWorkerRegistration: registration });
    if (!token) return { status: "failed", message: "Firebase did not return a push token." };
    return { status: "generated", token };
  } catch (error) {
    return { status: "failed", message: error instanceof Error ? error.message : "Push setup failed." };
  }
}

export async function revokePushToken() {
  const currentMessaging = await getFirebaseMessaging();
  if (currentMessaging) await deleteToken(currentMessaging);
}

export async function listenForForegroundMessages(onMessageReceived: (payload: unknown) => void) {
  const currentMessaging = await getFirebaseMessaging();
  if (!currentMessaging || Notification.permission !== "granted") return () => undefined;
  return onMessage(currentMessaging, onMessageReceived);
}
