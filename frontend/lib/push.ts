import { getAuthenticatedBackend } from "./backend";

// VAPID public keys are base64url; the browser's subscribe() wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Compares the key an existing subscription was created with against the key we
// want to use now. After a VAPID key rotation these differ, and the old
// subscription can no longer receive pushes — so we drop it and re-subscribe.
function sameApplicationServerKey(existing: ArrayBuffer | null | undefined, desired: Uint8Array): boolean {
  if (!existing) return false;
  const a = new Uint8Array(existing);
  if (a.length !== desired.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== desired[i]) return false;
  return true;
}

export type PushResult = "ok" | "denied" | "unsupported" | "error";

// Asks for notification permission, subscribes this device to Web Push, and
// stores the (anonymous) token on the backend. Must be called from a user
// gesture (a button click) so the permission prompt is allowed.
export async function enablePushNotifications(): Promise<PushResult> {
  try {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return "unsupported";
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return "denied";

    const reg = await navigator.serviceWorker.ready;
    const backend = getAuthenticatedBackend();
    const res: any = await backend.push.vapidPublicKey();
    const publicKey: string = res?.publicKey || "";
    if (!publicKey) return "error";

    const desiredKey = urlBase64ToUint8Array(publicKey);

    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameApplicationServerKey(sub.options?.applicationServerKey, desiredKey)) {
      // Existing subscription was made under a different (rotated) VAPID key and
      // can no longer be delivered to — drop it so we re-subscribe cleanly.
      try { await sub.unsubscribe(); } catch { /* ignore */ }
      sub = null;
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey as BufferSource,
      });
    }
    const json: any = sub.toJSON();
    await backend.push.subscribe({
      endpoint: json.endpoint,
      p256dh: (json.keys && json.keys.p256dh) || "",
      auth: (json.keys && json.keys.auth) || "",
    });
    return "ok";
  } catch (e) {
    console.error("enablePushNotifications failed", e);
    return "error";
  }
}

// True once this device has notification permission AND an active subscription.
export async function isPushEnabled(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
