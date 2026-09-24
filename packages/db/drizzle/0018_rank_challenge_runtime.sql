CREATE OR REPLACE FUNCTION "upsert_challenge_best_evaluation"() RETURNS trigger AS $$
BEGIN
	INSERT INTO "challenge_best_evaluations" (
		"attempt_id",
		"evaluation_id",
		"accuracy",
		"exact_count",
		"queries_used",
		"runtime_ms",
		"evaluated_at"
	) VALUES (
		NEW."attempt_id",
		NEW."id",
		NEW."accuracy",
		NEW."exact_count",
		NEW."queries_used",
		NEW."runtime_ms",
		NEW."created_at"
	)
	ON CONFLICT ("attempt_id") DO UPDATE
	SET
		(
			"evaluation_id",
			"accuracy",
			"exact_count",
			"queries_used",
			"runtime_ms",
			"evaluated_at"
		) = (
			SELECT
				candidate."evaluation_id",
				candidate."accuracy",
				candidate."exact_count",
				candidate."queries_used",
				candidate."runtime_ms",
				candidate."evaluated_at"
			FROM (
				VALUES
					(
						excluded."evaluation_id",
						excluded."accuracy",
						excluded."exact_count",
						excluded."queries_used",
						excluded."runtime_ms",
						excluded."evaluated_at"
					),
					(
						"challenge_best_evaluations"."evaluation_id",
						"challenge_best_evaluations"."accuracy",
						"challenge_best_evaluations"."exact_count",
						"challenge_best_evaluations"."queries_used",
						"challenge_best_evaluations"."runtime_ms",
						"challenge_best_evaluations"."evaluated_at"
					)
			) AS candidate(
				"evaluation_id",
				"accuracy",
				"exact_count",
				"queries_used",
				"runtime_ms",
				"evaluated_at"
			)
			ORDER BY
				candidate."accuracy" DESC,
				candidate."exact_count" DESC,
				candidate."queries_used" ASC,
				candidate."runtime_ms" ASC,
				candidate."evaluated_at" ASC,
				candidate."evaluation_id" ASC
			LIMIT 1
		),
		"updated_at" = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
INSERT INTO "challenge_best_evaluations" (
	"attempt_id",
	"evaluation_id",
	"accuracy",
	"exact_count",
	"queries_used",
	"runtime_ms",
	"evaluated_at"
)
SELECT DISTINCT ON (evaluation."attempt_id")
	evaluation."attempt_id",
	evaluation."id",
	evaluation."accuracy",
	evaluation."exact_count",
	evaluation."queries_used",
	evaluation."runtime_ms",
	evaluation."created_at"
FROM "challenge_evaluations" AS evaluation
ORDER BY
	evaluation."attempt_id",
	evaluation."accuracy" DESC,
	evaluation."exact_count" DESC,
	evaluation."queries_used" ASC,
	evaluation."runtime_ms" ASC,
	evaluation."created_at" ASC,
	evaluation."id" ASC
ON CONFLICT ("attempt_id") DO UPDATE
SET
	"evaluation_id" = excluded."evaluation_id",
	"accuracy" = excluded."accuracy",
	"exact_count" = excluded."exact_count",
	"queries_used" = excluded."queries_used",
	"runtime_ms" = excluded."runtime_ms",
	"evaluated_at" = excluded."evaluated_at",
	"updated_at" = now();--> statement-breakpoint
UPDATE "challenge_attempts" AS attempt
SET
	"best_evaluation_id" = best."evaluation_id",
	"updated_at" = now()
FROM "challenge_best_evaluations" AS best
WHERE attempt."id" = best."attempt_id";
