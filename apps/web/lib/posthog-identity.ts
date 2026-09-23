import type { Properties } from "posthog-js";

const identifiedUserStorageKey = "chofex_posthog_identified_user";

export type IdentityState = {
  readonly isLoaded: boolean;
  readonly userId: string | null;
};

type IdentityAnalytics = {
  get_property(property: string): unknown;
  identify(userId: string): void;
  reset(): void;
};

type IdentityStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function canCaptureBeforeIdentityResolution(
  analytics: Pick<IdentityAnalytics, "get_property">,
  storage: IdentityStorage | undefined,
): boolean {
  try {
    if (typeof analytics.get_property("$user_id") === "string") return false;
  } catch {
    return false;
  }

  if (!storage) return true;
  try {
    return !storage.getItem(identifiedUserStorageKey);
  } catch {
    return false;
  }
}

export function identityStorageFromBrowser(
  browser: Pick<Window, "localStorage">,
): IdentityStorage | undefined {
  try {
    return browser.localStorage;
  } catch {
    return;
  }
}

export function propertiesForPostHogReplay(
  eventName: string,
  properties: Properties,
): Properties {
  if (eventName === "$identify" || eventName === "$set") return properties;

  const replayProperties = { ...properties };
  for (const property of [
    "distinct_id",
    "$anon_distinct_id",
    "$device_id",
    "$user_id",
    "$session_id",
    "$window_id",
  ]) {
    delete replayProperties[property];
  }
  return replayProperties;
}

/** Synchronizes trusted Clerk identity and reports whether a prior identity was reset. */
export function syncPostHogIdentity(
  state: IdentityState,
  analytics: IdentityAnalytics,
  storage: IdentityStorage | undefined,
  beforeReset?: () => void,
): boolean {
  if (!state.isLoaded) return false;

  let previousUserId: string | null = null;
  try {
    const posthogUserId = analytics.get_property("$user_id");
    if (typeof posthogUserId === "string") previousUserId = posthogUserId;
  } catch {
    // The persisted marker remains a fallback for unusual PostHog states.
  }
  try {
    previousUserId ??= storage?.getItem(identifiedUserStorageKey) ?? null;
  } catch {
    // Identification still works when browser storage is unavailable.
  }

  if (!state.userId) {
    if (!previousUserId) return false;
    beforeReset?.();
    analytics.reset();
    try {
      storage?.removeItem(identifiedUserStorageKey);
    } catch {
      // PostHog has still been reset, which is the privacy-critical behavior.
    }
    return true;
  }

  let didReset = false;
  if (previousUserId && previousUserId !== state.userId) {
    beforeReset?.();
    analytics.reset();
    didReset = true;
  }
  analytics.identify(state.userId);
  try {
    storage?.setItem(identifiedUserStorageKey, state.userId);
  } catch {
    // The current browser session remains identified even without persistence.
  }
  return didReset;
}
