import test from 'node:test';
import assert from 'node:assert/strict';
import fs from "node:fs";
import path from "node:path";

type ChannelKey = "inAppEnabled" | "pushEnabled" | "smsEnabled" | "dailyDigestEnabled";

function resolveNotificationChannels(roles: string[]) {
  const isOwner = roles.includes("OWNER");
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
}

function resolveNotificationUI(roles: string[]) {
  const isOwner = roles.includes("OWNER");
  return {
    showPushChannel: resolveNotificationChannels(roles).some((c) => c.key === "pushEnabled"),
    showBrowserPushControls: isOwner,
    headerStatColumns: isOwner ? 3 : 2,
    showBrowserPushStat: isOwner,
    availableLogChannels: isOwner ? ["in_app", "push", "sms"] : ["in_app", "sms"],
    canRetryPushDelivery: isOwner,
  };
}

function sanitizeNotificationPreferences(roles: string[], preferences: {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  dailyDigestEnabled: boolean;
  enabledCategories: string[];
}) {
  const isOwner = roles.includes("OWNER");
  return isOwner ? preferences : { ...preferences, pushEnabled: false };
}

test("delivery log category filter submits canonical lowercase category values", () => {
  const pagePath = path.resolve(process.cwd(), "src/app/(owner)/notifications/page.tsx");
  const pageContent = fs.readFileSync(pagePath, "utf-8");

  assert.match(
    pageContent,
    /notificationCategories\.map\(\(item\) => <option key=\{item\} value=\{item\}>\{categoryLabel\(item\)\}<\/option>\)/,
  );
});

test("Firebase Messaging uses a dedicated service-worker scope separate from the app worker", () => {
  const firebasePath = path.resolve(process.cwd(), "src/features/notifications/firebase.ts");
  const firebaseContent = fs.readFileSync(firebasePath, "utf-8");
  const workerPath = path.resolve(process.cwd(), "public/firebase/firebase-messaging-sw.js");

  assert.match(firebaseContent, /firebase-messaging-sw\.js/);
  assert.match(firebaseContent, /scope:\s*["']\/firebase\/["']/);
  assert.equal(fs.existsSync(workerPath), true);
});

test('push notification channel option is visible only to the OWNER role', () => {
  const ownerChannels = resolveNotificationChannels(['OWNER']);
  assert.ok(ownerChannels.some((c) => c.key === 'pushEnabled'), 'Owner should see push notifications channel');

  const managerChannels = resolveNotificationChannels(['MANAGER']);
  assert.ok(!managerChannels.some((c) => c.key === 'pushEnabled'), 'Manager must NOT see push notifications channel');

  const accountantChannels = resolveNotificationChannels(['ACCOUNTANT']);
  assert.ok(!accountantChannels.some((c) => c.key === 'pushEnabled'), 'Accountant must NOT see push notifications channel');

  const cashierChannels = resolveNotificationChannels(['CASHIER']);
  assert.ok(!cashierChannels.some((c) => c.key === 'pushEnabled'), 'Cashier must NOT see push notifications channel');

  const emptyChannels = resolveNotificationChannels([]);
  assert.ok(!emptyChannels.some((c) => c.key === 'pushEnabled'), 'Unassigned role must NOT see push notifications channel');
});

test('browser push controls and status are completely hidden for non-owner roles', () => {
  const managerUI = resolveNotificationUI(['MANAGER']);
  assert.equal(managerUI.showBrowserPushControls, false, 'Manager must not see browser push controls');
  assert.equal(managerUI.showBrowserPushStat, false, 'Manager must not see browser push header stat');
  assert.equal(managerUI.headerStatColumns, 2, 'Manager header stats should have 2 columns');
  assert.deepEqual(managerUI.availableLogChannels, ['in_app', 'sms'], 'Manager logs filter must not include push');
  assert.equal(managerUI.canRetryPushDelivery, false, 'Manager cannot retry push delivery');

  const accountantUI = resolveNotificationUI(['ACCOUNTANT']);
  assert.equal(accountantUI.showBrowserPushControls, false, 'Accountant must not see browser push controls');
  assert.equal(accountantUI.showBrowserPushStat, false, 'Accountant must not see browser push header stat');
  assert.equal(accountantUI.headerStatColumns, 2, 'Accountant header stats should have 2 columns');
  assert.deepEqual(accountantUI.availableLogChannels, ['in_app', 'sms']);

  const cashierUI = resolveNotificationUI(['CASHIER']);
  assert.equal(cashierUI.showBrowserPushControls, false, 'Cashier must not see browser push controls');
  assert.equal(cashierUI.showBrowserPushStat, false, 'Cashier must not see browser push header stat');
  assert.equal(cashierUI.headerStatColumns, 2, 'Cashier header stats should have 2 columns');

  const ownerUI = resolveNotificationUI(['OWNER']);
  assert.equal(ownerUI.showBrowserPushControls, true, 'Owner must see browser push controls');
  assert.equal(ownerUI.showBrowserPushStat, true, 'Owner must see browser push header stat');
  assert.equal(ownerUI.headerStatColumns, 3, 'Owner header stats should have 3 columns');
  assert.deepEqual(ownerUI.availableLogChannels, ['in_app', 'push', 'sms'], 'Owner logs filter includes push');
  assert.equal(ownerUI.canRetryPushDelivery, true, 'Owner can retry push delivery');
});

test('saving notification preferences forces pushEnabled to false for non-owner roles', () => {
  const rawPreferences = {
    inAppEnabled: true,
    pushEnabled: true,
    smsEnabled: true,
    dailyDigestEnabled: true,
    enabledCategories: ['anomaly'],
  };

  const ownerSaved = sanitizeNotificationPreferences(['OWNER'], rawPreferences);
  assert.equal(ownerSaved.pushEnabled, true, 'Owner preferences should preserve pushEnabled: true');

  const managerSaved = sanitizeNotificationPreferences(['MANAGER'], rawPreferences);
  assert.equal(managerSaved.pushEnabled, false, 'Manager preferences must force pushEnabled: false');

  const accountantSaved = sanitizeNotificationPreferences(['ACCOUNTANT'], rawPreferences);
  assert.equal(accountantSaved.pushEnabled, false, 'Accountant preferences must force pushEnabled: false');

  const cashierSaved = sanitizeNotificationPreferences(['CASHIER'], rawPreferences);
  assert.equal(cashierSaved.pushEnabled, false, 'Cashier preferences must force pushEnabled: false');
});
