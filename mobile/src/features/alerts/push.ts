import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { PUSH_ERRORS, type PushKind, type PushRegistration } from "@/features/push/protocol";
import { SITE_URL } from "~/lib/env";

/**
 * The phone's side of push (S26.4): permission, the Expo token, and the registration the server handed back. The
 * device secret lives in the keychain (it is what can switch this phone's news off); the rest is not secret.
 */

const KEY = "agari.push.registration";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
/** Android's channel for everything Agari sends; its name is what Settings shows. */
export const ANDROID_CHANNEL = "activity";

export interface StoredRegistration {
  expoToken: string;
  secret: string;
  wallet: string;
  kinds: PushKind[];
}

export async function readRegistration(): Promise<StoredRegistration | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    return raw ? (JSON.parse(raw) as StoredRegistration) : null;
  } catch {
    return null;
  }
}

export async function writeRegistration(reg: StoredRegistration | null): Promise<void> {
  if (reg === null) await SecureStore.deleteItemAsync(KEY, OPTIONS);
  else await SecureStore.setItemAsync(KEY, JSON.stringify(reg), OPTIONS);
}

export type TokenResult = { ok: true; token: string } | { ok: false; why: "denied" | "no-project" | "failed"; detail?: string };

/** Asks once (the system prompt), then fetches this install's Expo token. */
export async function expoPushToken(): Promise<TokenResult> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: "Calls, results and payouts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 80, 120],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return { ok: false, why: "denied" };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) return { ok: false, why: "no-project" };
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch (error) {
    return { ok: false, why: "failed", detail: error instanceof Error ? error.message : String(error) };
  }
}

async function call(method: "POST" | "PATCH", body: unknown): Promise<{ ok: true; value: PushRegistration } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${SITE_URL}/api/push/register`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as Partial<PushRegistration> & { error?: string };
    if (!res.ok || typeof json.wallet !== "string") return { ok: false, error: json.error ?? PUSH_ERRORS.unavailable };
    return { ok: true, value: json as PushRegistration };
  } catch {
    return { ok: false, error: PUSH_ERRORS.unavailable };
  }
}

export const registerDevice = (body: { address: string; expoToken: string; platform: "ios" | "android"; kinds: PushKind[]; issuedAtMs: number; signature: string }) => call("POST", body);
export const updateDevice = (body: { expoToken: string; secret: string; kinds: PushKind[] | null }) => call("PATCH", body);
