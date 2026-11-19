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

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
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
