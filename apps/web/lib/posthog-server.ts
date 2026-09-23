import { campaignAttributionHandoffHeader } from "@chofex/registration-contract";
import { PostHog } from "posthog-node";

import { isPostHogConfigured, posthogHost, posthogKey } from "./analytics";
import {
  campaignAttributionProperties,
  campaignAttributionPropertiesFromHandoff,
} from "./campaign-attribution";

type EventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface ProductEvent {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: EventProperties;
}

interface RequestProductEvent extends ProductEvent {
  readonly request: Request;
}

let client: PostHog | undefined;
let reportedMissingConfiguration = false;

const posthogClient = (): PostHog | undefined => {
  if (!isPostHogConfigured(posthogKey)) {
    if (
      process.env.NODE_ENV === "development" &&
      !reportedMissingConfiguration
    ) {
      reportedMissingConfiguration = true;
      console.error(
        new Error(
          "NEXT_PUBLIC_POSTHOG_KEY variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_KEY is configured",
        ),
      );
    }
    return undefined;
  }

  client ??= new PostHog(posthogKey, {
    host: posthogHost,
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
};

/** Analytics failures must never turn a successful participant action into a failure. */
export async function captureProductEvent({
  distinctId,
  event,
  properties,
  request,
}: RequestProductEvent): Promise<void> {
  const posthog = posthogClient();
  if (!posthog) return;

  const attributedProperties = productEventWithCampaignAttribution(request, {
    distinctId,
    event,
    properties,
  }).properties;

  try {
    posthog.capture({
      distinctId,
      event,
      properties: attributedProperties,
      disableGeoip: true,
    });
    await posthog.flush();
  } catch (error) {
    console.error("Could not send PostHog product event", { event, error });
  }
}

/** Keeps request-cookie parsing and validation out of individual route handlers. */
export function productEventWithCampaignAttribution(
  request: Request,
  event: ProductEvent,
  now = Date.now(),
): ProductEvent {
  const handoffProperties = campaignAttributionPropertiesFromHandoff(
    request.headers.get(campaignAttributionHandoffHeader),
    now,
  );
  const cookieProperties = campaignAttributionProperties(
    request.headers.get("cookie"),
    now,
  );
  return {
    ...event,
    properties: {
      ...event.properties,
      ...handoffProperties,
      ...cookieProperties,
    },
  };
}
