"use client";

import { useAuth } from "@clerk/nextjs";
import posthog, { type CaptureOptions, type CaptureResult } from "posthog-js";
import { useCallback, useEffect, useRef } from "react";

import {
  type CampaignProperties,
  campaignPropertyNames,
  isPostHogConfigured,
  isSessionRecordingEvent,
  isTrackableUrl,
  normalizeCampaignProperties,
  postHogEventForPublicAnalytics,
  posthogHost,
  posthogKey,
  replaceCampaignProperties,
} from "@/lib/analytics";
import {
  type CampaignAttributionFallback,
  campaignAttributionCookieForLanding,
  campaignAttributionFallbackForLanding,
  campaignPropertiesForAttributionFallback,
  campaignPropertiesForAttributionLanding,
  expiredCampaignAttributionCookie,
  latestCampaignProperties,
} from "@/lib/campaign-attribution";
import {
  canCaptureBeforeIdentityResolution,
  type IdentityState,
  identityStorageFromBrowser,
  propertiesForPostHogReplay,
  syncPostHogIdentity,
} from "@/lib/posthog-identity";

const campaignLandingProperty = "chofex_campaign_landing";

type CampaignLandingSnapshot = {
  readonly capturedAt: number;
  readonly campaign: CampaignProperties;
  readonly landingId: string;
  readonly url: string;
};

function browserCookie(): string {
  try {
    return document.cookie;
  } catch {
    return "";
  }
}

function writeBrowserCookie(cookie: string): void {
  try {
    // biome-ignore lint/suspicious/noDocumentCookie: the server must receive pre-auth landing attribution
    document.cookie = cookie;
  } catch {
    // The in-memory fallback keeps browser analytics attributed when cookies
    // are blocked, while server events correctly remain unattributed.
  }
}

function persistCampaignLanding(
  url: string,
  capturedAt = Date.now(),
  landingId?: string,
): void {
  if (!isTrackableUrl(url)) return;
  const attributionCookie = campaignAttributionCookieForLanding(
    url,
    browserCookie(),
    capturedAt,
    window.location.protocol === "https:",
    landingId,
  );
  if (attributionCookie) writeBrowserCookie(attributionCookie);
}

function registerCampaign(campaign: CampaignProperties): void {
  for (const property of campaignPropertyNames) posthog.unregister(property);
  posthog.register(campaign);
}

function syncRegisteredCampaign(
  fallback: CampaignAttributionFallback | undefined,
): {
  readonly campaign: CampaignProperties;
  readonly fallback: CampaignAttributionFallback | undefined;
} {
  const fallbackCampaign = campaignPropertiesForAttributionFallback(fallback);
  if (Object.keys(fallbackCampaign).length > 0) {
    registerCampaign(fallbackCampaign);
    return { campaign: fallbackCampaign, fallback };
  }

  const campaign = latestCampaignProperties(browserCookie());
  registerCampaign(campaign);
  return { campaign, fallback: undefined };
}

function isCampaignLandingEvent(event: CaptureResult): boolean {
  return (
    event.event === "$pageview" &&
    event.properties[campaignLandingProperty] === true
  );
}

function eventWithCampaign(
  event: CaptureResult,
  campaign: CampaignProperties,
): CaptureResult {
  const updatedEvent = {
    ...event,
    properties: replaceCampaignProperties(event.properties, campaign),
  };
  if (event.$set) {
    updatedEvent.$set = replaceCampaignProperties(event.$set, {});
  }
  if (event.$set_once) {
    updatedEvent.$set_once = replaceCampaignProperties(event.$set_once, {});
  }
  return updatedEvent;
}

function replayEvent(
  event: CaptureResult,
  replayCampaign: { current: CampaignProperties | undefined },
): void {
  const options: CaptureOptions = {
    timestamp: event.timestamp,
    uuid: event.uuid,
  };
  if (event.$set) options.$set = event.$set;
  if (event.$set_once) options.$set_once = event.$set_once;
  replayCampaign.current = normalizeCampaignProperties(event.properties);
  try {
    posthog.capture(
      event.event,
      propertiesForPostHogReplay(event.event, event.properties),
      options,
    );
  } finally {
    replayCampaign.current = undefined;
  }
}

/**
 * Pageviews capture the campaign landing URL. Registering the UTM dimensions
 * also carries that campaign into later conversion events in the same browser.
 */
export function PostHogAnalytics({
  identity,
}: {
  readonly identity?: IdentityState;
}) {
  const identitySyncEnabled = identity !== undefined;
  const identityIsLoaded = identity?.isLoaded ?? false;
  const identityUserId = identity?.userId ?? null;
  const initialized = useRef(false);
  const initialPageviewObserved = useRef(false);
  const attributionSuppressed = useRef(false);
  const identityReady = useRef(!identitySyncEnabled);
  const queuedEvents = useRef<CaptureResult[]>([]);
  const queuedLandingSnapshots = useRef(
    new Map<string, CampaignLandingSnapshot>(),
  );
  const inMemoryCampaign = useRef<CampaignAttributionFallback | undefined>(
    undefined,
  );
  const replayCampaign = useRef<CampaignProperties | undefined>(undefined);

  const beforeIdentityReset = useCallback(() => {
    const campaignLandings = queuedEvents.current.filter(
      isCampaignLandingEvent,
    );
    const landingSnapshots = campaignLandings.flatMap((event) => {
      const snapshot = queuedLandingSnapshots.current.get(event.uuid);
      return snapshot ? [snapshot] : [];
    });
    queuedEvents.current = campaignLandings;
    queuedLandingSnapshots.current = new Map(
      campaignLandings.flatMap((event) => {
        const snapshot = queuedLandingSnapshots.current.get(event.uuid);
        return snapshot ? [[event.uuid, snapshot]] : [];
      }),
    );

    const secure = window.location.protocol === "https:";
    writeBrowserCookie(expiredCampaignAttributionCookie(secure));
    let rebuiltCookie = "";
    for (const snapshot of landingSnapshots) {
      const cookie = campaignAttributionCookieForLanding(
        snapshot.url,
        rebuiltCookie,
        snapshot.capturedAt,
        secure,
        snapshot.landingId,
      );
      if (!cookie) continue;
      writeBrowserCookie(cookie);
      rebuiltCookie = cookie;
    }
    const latestLanding = landingSnapshots.at(-1);
    if (latestLanding) {
      inMemoryCampaign.current = campaignAttributionFallbackForLanding(
        browserCookie(),
        latestLanding,
      );
    } else {
      inMemoryCampaign.current = undefined;
    }
    attributionSuppressed.current = campaignLandings.length === 0;
  }, []);

  const completeAnalyticsReadiness = useCallback(() => {
    identityReady.current = true;
    const queued = queuedEvents.current.splice(0);
    queuedLandingSnapshots.current.clear();
    const identityEvents = queued.filter(
      (event) => event.event === "$identify" || event.event === "$set",
    );
    for (const event of identityEvents) replayEvent(event, replayCampaign);

    for (const event of queued) {
      if (event.event === "$identify" || event.event === "$set") continue;
      replayEvent(event, replayCampaign);
    }
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    if (!isPostHogConfigured(posthogKey)) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          new Error(
            "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
          ),
        );
      }
      return;
    }

    persistCampaignLanding(window.location.href);
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: "history_change",
      defaults: "2025-05-24",
      save_campaign_params: false,
      save_referrer: false,
      before_send: (event) => {
        if (isSessionRecordingEvent(event)) return event;
        let pageviewUrl: string | undefined;
        if (event?.event === "$pageview") {
          initialPageviewObserved.current = true;
          const currentUrl = event.properties?.$current_url;
          if (typeof currentUrl === "string") pageviewUrl = currentUrl;
        }
        const publicEvent = postHogEventForPublicAnalytics(event);
        if (!publicEvent) return null;
        const queuedCampaign = replayCampaign.current;
        if (queuedCampaign) {
          return eventWithCampaign(publicEvent, queuedCampaign);
        }
        let eventForCampaign: CaptureResult = publicEvent;
        let landingSnapshot: CampaignLandingSnapshot | undefined;
        if (publicEvent.event === "$pageview") {
          attributionSuppressed.current = false;
          if (pageviewUrl) {
            const capturedAt = Date.now();
            persistCampaignLanding(pageviewUrl, capturedAt, publicEvent.uuid);
            const landingCampaign =
              campaignPropertiesForAttributionLanding(pageviewUrl);
            if (Object.keys(landingCampaign).length > 0) {
              landingSnapshot = {
                capturedAt,
                campaign: landingCampaign,
                landingId: publicEvent.uuid,
                url: pageviewUrl,
              };
              eventForCampaign = {
                ...publicEvent,
                properties: {
                  ...publicEvent.properties,
                  [campaignLandingProperty]: true,
                },
              };
            }
          }
        }
        let campaign: CampaignProperties = {};
        if (!attributionSuppressed.current) {
          const registeredCampaign = syncRegisteredCampaign(
            inMemoryCampaign.current,
          );
          campaign = registeredCampaign.campaign;
          inMemoryCampaign.current = registeredCampaign.fallback;
        }
        if (landingSnapshot) {
          campaign = landingSnapshot.campaign;
          inMemoryCampaign.current = campaignAttributionFallbackForLanding(
            browserCookie(),
            landingSnapshot,
          );
          registerCampaign(campaign);
        }
        const updatedEvent = eventWithCampaign(eventForCampaign, campaign);
        if (!identityReady.current) {
          queuedEvents.current.push(updatedEvent);
          if (landingSnapshot) {
            queuedLandingSnapshots.current.set(
              updatedEvent.uuid,
              landingSnapshot,
            );
          }
          return null;
        }
        return updatedEvent;
      },
    });
    initialized.current = true;
    if (!identitySyncEnabled) completeAnalyticsReadiness();
  }, [completeAnalyticsReadiness, identitySyncEnabled]);

  useEffect(() => {
    if (
      !identitySyncEnabled ||
      !identityIsLoaded ||
      !initialized.current ||
      !isPostHogConfigured(posthogKey)
    ) {
      return;
    }
    const wasIdentityReady = identityReady.current;
    const didResetIdentity = syncPostHogIdentity(
      { isLoaded: identityIsLoaded, userId: identityUserId },
      posthog,
      identityStorageFromBrowser(window),
      beforeIdentityReset,
    );
    const preservedLanding = Array.from(
      queuedLandingSnapshots.current.values(),
    ).at(-1);
    if (didResetIdentity && preservedLanding) {
      registerCampaign(preservedLanding.campaign);
    } else if (
      didResetIdentity &&
      !wasIdentityReady &&
      initialPageviewObserved.current
    ) {
      // Replace the discarded landing; otherwise PostHog's pending initial
      // pageview will capture it after this identity decision.
      posthog.capture("$pageview");
    }
    completeAnalyticsReadiness();
  }, [
    beforeIdentityReset,
    completeAnalyticsReadiness,
    identitySyncEnabled,
    identityIsLoaded,
    identityUserId,
  ]);

  useEffect(() => {
    if (
      !identitySyncEnabled ||
      identityIsLoaded ||
      !initialized.current ||
      !isPostHogConfigured(posthogKey)
    ) {
      return;
    }
    const fallback = window.setTimeout(() => {
      if (identityReady.current) return;
      const storage = identityStorageFromBrowser(window);
      if (!canCaptureBeforeIdentityResolution(posthog, storage)) return;
      completeAnalyticsReadiness();
    }, 5000);
    return () => window.clearTimeout(fallback);
  }, [completeAnalyticsReadiness, identitySyncEnabled, identityIsLoaded]);

  return null;
}

export function AuthenticatedPostHogAnalytics() {
  const { isLoaded, userId } = useAuth();
  return <PostHogAnalytics identity={{ isLoaded, userId: userId ?? null }} />;
}
