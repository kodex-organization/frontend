/* The query string contains only the public Firebase Web config. It never
   contains Firebase Admin credentials or private keys. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = JSON.parse(params.get("config") || "{}");
if (config.apiKey && config.projectId && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    const data = payload.data || {};
    return self.registration.showNotification(
      notification.title || data.title || "CueCloud notification",
      {
        body: notification.body || data.body || "You have a new notification.",
        icon: notification.icon || "/icon-192.png",
        data,
      },
    );
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => "focus" in client);
    if (existing) return existing.focus().then(() => existing.navigate(path));
    return clients.openWindow(path);
  }));
});
