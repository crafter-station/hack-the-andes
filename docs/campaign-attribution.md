# Campaign attribution

The web app keeps campaign attribution in a first-party
`chofex_campaign_attribution` cookie. The cookie is written only from public
landing URLs with recognized UTM parameters. It is browser-readable because
the first landing can happen before authentication, and it uses `SameSite=Lax`,
`Path=/`, `Secure` on HTTPS, and a 90-day maximum age.

The stored first and latest touches each contain only normalized UTM values, a
capture time, and the opaque PostHog landing-event UUID. Each touch expires
independently after 90 days; when the older
first touch expires, the still-valid latest touch becomes the first touch for
the new retention window. Cookie input is untrusted: the server validates its
version, timestamps, recognized fields, value lengths, and retention window before
adding `first_utm_*`, `latest_utm_*`, `first_campaign_at`, and
`latest_campaign_at` to product events. No participant email or profile data is
stored. Sign-out and account switches reset PostHog identity and remove the
attribution cookie so a shared browser cannot carry one participant's identity
or campaign into another participant's activity.

The browser calls `posthog.identify` with the authenticated Clerk user ID. This
follows the installed `posthog-js` 1.433.10 identity interface, which replaces
the anonymous distinct ID and connects the prior anonymous history. Email is
never used as a distinct ID.

The CLI begins Clerk authorization through the first-party
`/api/v1/oauth/authorize` bridge. That redirect copies only the latest landing
UUID and capture time into OAuth state. After Clerk returns it, the CLI sends
the bounded reference in `x-chofex-campaign-attribution`; the API revalidates
its shape and 90-day lifetime before adding it to product events. This links a
CLI conversion directly to its anonymous landing without exposing UTM values,
participant data, or a reusable browser identity through OAuth.

## Reproducible campaign funnels

New conversions join directly to the landing event UUID carried through the
cookie or CLI OAuth handoff. The `person_id` fallback, rather than raw
`distinct_id`, keeps older browser events compatible with PostHog's
anonymous-to-Clerk identity merge. Replace the campaign literal when running
each query.

Challenge-link outcomes:

```sql
WITH campaign_landings AS (
    SELECT
        toString(uuid) AS landing_id,
        person_id,
        timestamp AS landed_at,
        properties.$utm_campaign AS landing_campaign
    FROM events
    WHERE event = '$pageview'
      AND properties.chofex_campaign_landing = true
      AND properties.$utm_campaign IS NOT NULL
      AND (
          properties.$current_url LIKE '%/challenges'
          OR properties.$current_url LIKE '%/challenges/%'
      )
),
conversion_candidates AS (
    SELECT
        conversions.uuid AS conversion_id,
        conversions.person_id,
        conversions.event,
        landings.landing_campaign,
        row_number() OVER (
            PARTITION BY conversions.uuid
            ORDER BY landings.landed_at DESC, landings.landing_id DESC
        ) AS landing_rank
    FROM events AS conversions
    LEFT JOIN campaign_landings AS landings
       ON conversions.timestamp >= landings.landed_at - INTERVAL 5 MINUTE
       AND conversions.timestamp < landings.landed_at + INTERVAL 30 DAY
       AND (
           conversions.properties.latest_campaign_landing_id = landings.landing_id
           OR (
               isNull(conversions.properties.latest_campaign_landing_id)
               AND conversions.person_id = landings.person_id
               AND (
                   isNull(conversions.properties.latest_utm_campaign)
                   OR conversions.properties.latest_utm_campaign = landings.landing_campaign
               )
           )
       )
    WHERE conversions.event IN (
        'challenge_query_completed',
        'challenge_local_test_completed',
        'challenge_evaluation_submitted'
    )
),
attributed_conversions AS (
    SELECT person_id, event
    FROM conversion_candidates
    WHERE landing_rank = 1
      AND landing_campaign = 'CAMPAIGN'
)
SELECT
    (
        SELECT uniq(person_id)
        FROM campaign_landings
        WHERE landing_campaign = 'CAMPAIGN'
    ) AS landed,
    uniqIf(person_id, event IN (
        'challenge_query_completed',
        'challenge_local_test_completed',
        'challenge_evaluation_submitted'
    )) AS started,
    uniqIf(person_id, event = 'challenge_query_completed') AS queried,
    uniqIf(person_id, event = 'challenge_local_test_completed') AS tested,
    uniqIf(person_id, event = 'challenge_evaluation_submitted') AS evaluated
FROM attributed_conversions
```

Application outcomes remain a separate funnel because those links have a
different intent:

```sql
WITH campaign_landings AS (
    SELECT
        toString(uuid) AS landing_id,
        person_id,
        timestamp AS landed_at,
        properties.$utm_campaign AS landing_campaign
    FROM events
    WHERE event = '$pageview'
      AND properties.chofex_campaign_landing = true
      AND properties.$utm_campaign IS NOT NULL
      AND properties.$current_url NOT LIKE '%/challenges'
      AND properties.$current_url NOT LIKE '%/challenges/%'
),
conversion_candidates AS (
    SELECT
        conversions.uuid AS conversion_id,
        conversions.person_id,
        conversions.event,
        landings.landing_campaign,
        row_number() OVER (
            PARTITION BY conversions.uuid
            ORDER BY landings.landed_at DESC, landings.landing_id DESC
        ) AS landing_rank
    FROM events AS conversions
    LEFT JOIN campaign_landings AS landings
       ON conversions.timestamp >= landings.landed_at - INTERVAL 5 MINUTE
       AND conversions.timestamp < landings.landed_at + INTERVAL 30 DAY
       AND (
           conversions.properties.latest_campaign_landing_id = landings.landing_id
           OR (
               isNull(conversions.properties.latest_campaign_landing_id)
               AND conversions.person_id = landings.person_id
               AND (
                   isNull(conversions.properties.latest_utm_campaign)
                   OR conversions.properties.latest_utm_campaign = landings.landing_campaign
               )
           )
       )
    WHERE conversions.event IN (
        'application_draft_saved',
        'application_submitted'
    )
),
attributed_conversions AS (
    SELECT person_id, event
    FROM conversion_candidates
    WHERE landing_rank = 1
      AND landing_campaign = 'CAMPAIGN'
)
SELECT
    (
        SELECT uniq(person_id)
        FROM campaign_landings
        WHERE landing_campaign = 'CAMPAIGN'
    ) AS landed,
    uniqIf(person_id, event = 'application_draft_saved') AS saved_draft,
    uniqIf(person_id, event = 'application_submitted') AS submitted
FROM attributed_conversions
```

Each qualifying landing opens its own 30-day conversion window. The `uniq`
aggregates keep conversions from double-counting a person. Conversions carrying
`latest_campaign_landing_id` match their exact browser landing, including CLI
conversions whose Clerk identity never appeared on the main site. Older events
without that reference fall back to the merged PostHog person and campaign;
`row_number()` selects only the nearest qualifying landing for that legacy
fallback. `chofex_campaign_landing` is set only when the raw pageview URL
contains recognized UTM parameters; registered campaign properties on later
navigation pageviews do not extend or reclassify the landing. The lower join
bound allows the same five minutes of browser/server clock skew as attribution
cookie validation.

The report and campaign operating artifacts remain the source for campaign
names and link templates; do not duplicate recipient or message content here.
