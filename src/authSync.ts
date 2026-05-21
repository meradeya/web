export type AuthSyncEventType = "logout" | "tokensRefreshed";

interface AuthSyncMessage {
  id: string;
  type: AuthSyncEventType;
  timestamp: number;
}

const AUTH_SYNC_CHANNEL = "meradeya-auth-sync";
const AUTH_SYNC_STORAGE_KEY = "meradeya:auth-sync";
const AUTH_SYNC_LOCAL_EVENT = "meradeya:auth-sync-local";

let channel: BroadcastChannel | null = null;

const canUseBrowserApis = () =>
  typeof globalThis !== "undefined" &&
  typeof globalThis.addEventListener === "function" &&
  typeof localStorage !== "undefined";

const makeMessage = (type: AuthSyncEventType): AuthSyncMessage => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  type,
  timestamp: Date.now(),
});

const getChannel = (): BroadcastChannel | null => {
  if (channel) return channel;

  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
  return channel;
};

export const emitAuthSyncEvent = (type: AuthSyncEventType) => {
  if (!canUseBrowserApis()) return;

  const message = makeMessage(type);

  // Same-tab updates are immediate through a local custom event.
  globalThis.dispatchEvent(
    new CustomEvent<AuthSyncMessage>(AUTH_SYNC_LOCAL_EVENT, { detail: message }),
  );

  const authChannel = getChannel();
  authChannel?.postMessage(message);

  // Storage events work as a fallback for tabs without BroadcastChannel.
  try {
    localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(message));
    localStorage.removeItem(AUTH_SYNC_STORAGE_KEY);
  } catch {
    // Ignore quota/private-mode issues for best-effort sync.
  }
};

export const subscribeAuthSyncEvents = (
  onEvent: (type: AuthSyncEventType) => void,
): (() => void) => {
  if (!canUseBrowserApis()) return () => {};

  const seenMessageIds = new Set<string>();

  const processMessage = (message: AuthSyncMessage | null | undefined) => {
    if (!message?.id || !message.type) return;
    if (seenMessageIds.has(message.id)) return;

    seenMessageIds.add(message.id);
    if (seenMessageIds.size > 100) {
      const first = seenMessageIds.values().next().value;
      if (first) seenMessageIds.delete(first);
    }

    onEvent(message.type);
  };

  const handleLocal = (event: Event) => {
    const customEvent = event as CustomEvent<AuthSyncMessage>;
    processMessage(customEvent.detail);
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SYNC_STORAGE_KEY || !event.newValue) return;

    try {
      const parsed = JSON.parse(event.newValue) as AuthSyncMessage;
      processMessage(parsed);
    } catch {
      // Ignore malformed payloads.
    }
  };

  const authChannel = getChannel();
  const handleChannelMessage = (event: MessageEvent<AuthSyncMessage>) => {
    processMessage(event.data);
  };

  globalThis.addEventListener(AUTH_SYNC_LOCAL_EVENT, handleLocal);
  globalThis.addEventListener("storage", handleStorage);
  authChannel?.addEventListener("message", handleChannelMessage);

  return () => {
    globalThis.removeEventListener(AUTH_SYNC_LOCAL_EVENT, handleLocal);
    globalThis.removeEventListener("storage", handleStorage);
    authChannel?.removeEventListener("message", handleChannelMessage);
  };
};

