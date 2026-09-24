UPDATE "participants" AS "participant"
SET "name" = "badge_name"."display_name"
FROM (
  SELECT DISTINCT ON ("application"."participant_id")
    "application"."participant_id",
    "badge"."display_name"
  FROM "participant_badges" AS "badge"
  INNER JOIN "applications" AS "application"
    ON "application"."id" = "badge"."application_id"
  WHERE "badge"."display_name" IS NOT NULL
  ORDER BY "application"."participant_id", "application"."created_at" DESC
) AS "badge_name"
WHERE "participant"."id" = "badge_name"."participant_id"
  AND "participant"."name" IS NULL;--> statement-breakpoint
ALTER TABLE "participant_badges" DROP COLUMN "display_name";
