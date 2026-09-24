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
UPDATE "participants" AS "participant"
SET "name" = "application_name"."name"
FROM (
  SELECT DISTINCT ON ("application"."participant_id")
    "application"."participant_id",
    trim(concat_ws(' ', "application"."first_name", "application"."last_name")) AS "name"
  FROM "applications" AS "application"
  ORDER BY "application"."participant_id", "application"."created_at" DESC
) AS "application_name"
WHERE "participant"."id" = "application_name"."participant_id"
  AND "participant"."name" IS NULL
  AND "application_name"."name" <> '';--> statement-breakpoint
ALTER TABLE "participant_badges" DROP COLUMN "display_name";
