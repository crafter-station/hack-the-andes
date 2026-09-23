import {
  type CampaignAttributionHandoff,
  campaignAttributionHandoffFromValue,
} from "@chofex/registration-contract";

import {
  type CampaignProperties,
  campaignPropertiesFromUrl,
  campaignPropertyNames,
  isTrackableUrl,
  normalizeCampaignProperties,
} from "./analytics";

const attributionCookieName = "chofex_campaign_attribution";
const attributionRetentionSeconds = 90 * 24 * 60 * 60;
const attributionRetentionMilliseconds = attributionRetentionSeconds * 1000;
const maximumClockSkewMilliseconds = 5 * 60 * 1000;
const maximumEncodedCampaignValueLength = 200;
const maximumCookieLength = 3800;

type CampaignTouch = {
  readonly at: number;
  readonly campaign: CampaignProperties;
  readonly landingId?: string;
};

export type CampaignAttributionFallback = {
  readonly capturedAt: number;
  readonly campaign: CampaignProperties;
  readonly landingId?: string;
};

type CampaignAttribution = {
  readonly version: 1;
  readonly first: CampaignTouch;
  readonly latest: CampaignTouch;
};

export type CampaignAttributionProperties = Record<string, string>;

function cookieSafeCampaign(
  campaign: CampaignProperties,
  maximumEncodedValueLength = maximumEncodedCampaignValueLength,
): CampaignProperties {
  const cookieSafeProperties: Record<string, string> = {};
  for (const [property, value] of Object.entries(campaign)) {
    if (!value) continue;
    let encodedLength = 0;
    let cookieSafeValue = "";
    for (const character of value) {
      let characterLength: number;
      try {
        const jsonCharacter = JSON.stringify(character).slice(1, -1);
        characterLength = encodeURIComponent(jsonCharacter).length;
      } catch {
        continue;
      }
      if (encodedLength + characterLength > maximumEncodedValueLength) {
        break;
      }
      encodedLength += characterLength;
      cookieSafeValue += character;
    }
    if (cookieSafeValue) cookieSafeProperties[property] = cookieSafeValue;
  }
  return normalizeCampaignProperties(cookieSafeProperties);
}

function readCookie(
  cookieHeader: string | null | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== attributionCookieName) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

function isValidAttributionTimestamp(timestamp: unknown, now: number): boolean {
  return (
    typeof timestamp === "number" &&
    Number.isSafeInteger(timestamp) &&
    timestamp >= 0 &&
    timestamp <= now + maximumClockSkewMilliseconds &&
    now - timestamp <= attributionRetentionMilliseconds
  );
}

function normalizedLandingId(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  return campaignAttributionHandoffFromValue(`${value}.0`)?.landingId;
}

function normalizedTouch(
  value: unknown,
  now: number,
): CampaignTouch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const candidate = value as Record<string, unknown>;
  if (
    !isValidAttributionTimestamp(candidate.at, now) ||
    typeof candidate.at !== "number"
  ) {
    return;
  }

  const campaign = cookieSafeCampaign(
    normalizeCampaignProperties(candidate.campaign),
  );
  if (Object.keys(campaign).length === 0) return;
  const landingId = normalizedLandingId(candidate.landingId);
  return { at: candidate.at, campaign, landingId };
}

function parseAttribution(
  cookieHeader: string | null | undefined,
  now: number,
): CampaignAttribution | undefined {
  const cookie = readCookie(cookieHeader);
  if (!cookie) return;

  try {
    const value = JSON.parse(decodeURIComponent(cookie)) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const candidate = value as Record<string, unknown>;
    if (candidate.version !== 1) return;
    const storedFirst = normalizedTouch(candidate.first, now);
    const storedLatest = normalizedTouch(candidate.latest, now);
    if (!storedFirst && !storedLatest) return;
    const first = storedFirst ?? storedLatest;
    const latest = storedLatest ?? storedFirst;
    if (!first || !latest || latest.at < first.at) return;
    return { version: 1, first, latest };
  } catch {
    return;
  }
}

function campaignTouchFromUrl(
  url: string,
  now: number,
  landingId?: string,
): CampaignTouch | undefined {
  const campaign = campaignPropertiesForAttributionLanding(url);
  if (Object.keys(campaign).length === 0) return;
  return { at: now, campaign, landingId: normalizedLandingId(landingId) };
}

export function campaignPropertiesForAttributionLanding(
  url: string,
): CampaignProperties {
  if (!isTrackableUrl(url)) return {};
  try {
    return cookieSafeCampaign(campaignPropertiesFromUrl(url));
  } catch {
    return {};
  }
}

function serializedCookie(
  value: string,
  maxAge: number,
  secure: boolean,
): string {
  const attributes = [
    `${attributionCookieName}=${value}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (secure) attributes.push("Secure");
  return attributes.join("; ");
}

function serializedAttributionCookie(
  attribution: CampaignAttribution,
  secure: boolean,
): string | undefined {
  for (
    let valueLength = maximumEncodedCampaignValueLength;
    valueLength > 0;
    valueLength -= 10
  ) {
    const boundedAttribution: CampaignAttribution = {
      version: 1,
      first: {
        ...attribution.first,
        campaign: cookieSafeCampaign(attribution.first.campaign, valueLength),
      },
      latest: {
        ...attribution.latest,
        campaign: cookieSafeCampaign(attribution.latest.campaign, valueLength),
      },
    };
    const value = encodeURIComponent(JSON.stringify(boundedAttribution));
    const cookie = serializedCookie(value, attributionRetentionSeconds, secure);
    if (cookie.length <= maximumCookieLength) return cookie;
  }
  return;
}

/** Returns a cookie assignment only when the URL is a public campaign landing. */
export function campaignAttributionCookieForLanding(
  url: string,
  cookieHeader: string | null | undefined,
  now: number,
  secure: boolean,
  landingId?: string,
): string | undefined {
  const latest = campaignTouchFromUrl(url, now, landingId);
  if (!latest) return;
  const existing = parseAttribution(cookieHeader, now);
  const first = existing?.first ?? latest;
  return serializedAttributionCookie({ version: 1, first, latest }, secure);
}

function appendTouchProperties(
  properties: CampaignAttributionProperties,
  prefix: "first" | "latest",
  touch: CampaignTouch,
): void {
  properties[`${prefix}_campaign_at`] = new Date(touch.at).toISOString();
  if (touch.landingId) {
    properties[`${prefix}_campaign_landing_id`] = touch.landingId;
  }
  for (const [property, value] of Object.entries(touch.campaign)) {
    if (!value) continue;
    properties[`${prefix}_${property.slice(1)}`] = value;
  }
}

/** Reads and revalidates the browser-written cookie before server analytics use. */
export function campaignAttributionProperties(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): CampaignAttributionProperties {
  const attribution = parseAttribution(cookieHeader, now);
  if (!attribution) return {};
  const properties: CampaignAttributionProperties = {};
  appendTouchProperties(properties, "first", attribution.first);
  appendTouchProperties(properties, "latest", attribution.latest);
  return properties;
}

export function latestCampaignProperties(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): CampaignProperties {
  return parseAttribution(cookieHeader, now)?.latest.campaign ?? {};
}

export function campaignAttributionFallbackForLanding(
  cookieHeader: string | null | undefined,
  fallback: CampaignAttributionFallback,
): CampaignAttributionFallback | undefined {
  const latest = parseAttribution(cookieHeader, fallback.capturedAt)?.latest;
  if (latest?.at !== fallback.capturedAt) return fallback;
  if (latest.landingId !== fallback.landingId) return fallback;
  for (const property of campaignPropertyNames) {
    if (latest.campaign[property] !== fallback.campaign[property]) {
      return fallback;
    }
  }
  return;
}

export function campaignPropertiesForAttributionFallback(
  fallback: CampaignAttributionFallback | undefined,
  now = Date.now(),
): CampaignProperties {
  if (!fallback) return {};
  return (
    normalizedTouch(
      {
        at: fallback.capturedAt,
        campaign: fallback.campaign,
        landingId: fallback.landingId,
      },
      now,
    )?.campaign ?? {}
  );
}

export function campaignAttributionHandoff(
  cookieHeader: string | null | undefined,
  now = Date.now(),
): CampaignAttributionHandoff | undefined {
  const latest = parseAttribution(cookieHeader, now)?.latest;
  if (!latest?.landingId) return;
  return { capturedAt: latest.at, landingId: latest.landingId };
}

export function campaignAttributionPropertiesFromHandoff(
  value: string | null | undefined,
  now = Date.now(),
): CampaignAttributionProperties {
  const handoff = campaignAttributionHandoffFromValue(value);
  if (!handoff || !isValidAttributionTimestamp(handoff.capturedAt, now)) {
    return {};
  }
  return {
    latest_campaign_at: new Date(handoff.capturedAt).toISOString(),
    latest_campaign_landing_id: handoff.landingId,
  };
}

export function expiredCampaignAttributionCookie(secure: boolean): string {
  return serializedCookie("", 0, secure);
}
