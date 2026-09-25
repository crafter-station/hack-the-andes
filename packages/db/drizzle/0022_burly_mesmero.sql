ALTER TABLE "challenge_best_evaluations" ADD COLUMN "execution_cost" integer;--> statement-breakpoint
ALTER TABLE "challenge_evaluations" ADD COLUMN "execution_cost" integer;--> statement-breakpoint
UPDATE "challenge_best_evaluations" AS best
SET "execution_cost" = evaluation."execution_cost"
FROM "challenge_evaluations" AS evaluation
WHERE evaluation."id" = best."evaluation_id";--> statement-breakpoint
CREATE OR REPLACE FUNCTION "upsert_challenge_best_evaluation"() RETURNS trigger AS $$
BEGIN
	INSERT INTO "challenge_best_evaluations" (
		"attempt_id",
		"evaluation_id",
		"accuracy",
		"exact_count",
		"queries_used",
		"runtime_ms",
		"execution_cost",
		"evaluated_at"
	) VALUES (
		NEW."attempt_id",
		NEW."id",
		NEW."accuracy",
		NEW."exact_count",
		NEW."queries_used",
		NEW."runtime_ms",
		NEW."execution_cost",
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
			"execution_cost",
			"evaluated_at"
		) = (
			SELECT
				candidate."evaluation_id",
				candidate."accuracy",
				candidate."exact_count",
				candidate."queries_used",
				candidate."runtime_ms",
				candidate."execution_cost",
				candidate."evaluated_at"
			FROM (
				VALUES
					(
						excluded."evaluation_id",
						excluded."accuracy",
						excluded."exact_count",
						excluded."queries_used",
						excluded."runtime_ms",
						excluded."execution_cost",
						excluded."evaluated_at"
					),
					(
						"challenge_best_evaluations"."evaluation_id",
						"challenge_best_evaluations"."accuracy",
						"challenge_best_evaluations"."exact_count",
						"challenge_best_evaluations"."queries_used",
						"challenge_best_evaluations"."runtime_ms",
						"challenge_best_evaluations"."execution_cost",
						"challenge_best_evaluations"."evaluated_at"
					)
			) AS candidate(
				"evaluation_id",
				"accuracy",
				"exact_count",
				"queries_used",
				"runtime_ms",
				"execution_cost",
				"evaluated_at"
			)
			ORDER BY
				candidate."accuracy" DESC,
				candidate."exact_count" DESC,
				candidate."queries_used" ASC,
				COALESCE(candidate."execution_cost", candidate."runtime_ms") ASC,
				candidate."evaluated_at" ASC,
				candidate."evaluation_id" ASC
			LIMIT 1
		),
		"updated_at" = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP FUNCTION "complete_challenge_evaluation"(
	uuid,
	uuid,
	text,
	jsonb,
	double precision,
	integer,
	integer,
	double precision,
	integer,
	integer
);--> statement-breakpoint
CREATE FUNCTION "complete_challenge_evaluation"(
	p_reservation_id uuid,
	p_attempt_id uuid,
	p_solution_kind text,
	p_solution jsonb,
	p_accuracy double precision,
	p_exact_count integer,
	p_sample_size integer,
	p_mean_error double precision,
	p_queries_used integer,
	p_runtime_ms integer,
	p_execution_cost integer
) RETURNS TABLE (
	share_code varchar,
	evaluations_used integer,
	evaluations_limit integer
) AS $$
DECLARE
	reserved_attempt_id uuid;
	selected_best_evaluation_id uuid;
BEGIN
	DELETE FROM "challenge_reservations"
	WHERE
		"id" = p_reservation_id
		AND "attempt_id" = p_attempt_id
		AND "kind" = 'evaluation'
	RETURNING "attempt_id" INTO reserved_attempt_id;

	IF reserved_attempt_id IS NULL THEN
		RETURN;
	END IF;

	INSERT INTO "challenge_evaluations" (
		"attempt_id",
		"solution_kind",
		"solution",
		"accuracy",
		"exact_count",
		"sample_size",
		"mean_error",
		"queries_used",
		"runtime_ms",
		"execution_cost"
	) VALUES (
		reserved_attempt_id,
		p_solution_kind,
		p_solution,
		p_accuracy,
		p_exact_count,
		p_sample_size,
		p_mean_error,
		p_queries_used,
		p_runtime_ms,
		p_execution_cost
	);

	SELECT best."evaluation_id"
	INTO selected_best_evaluation_id
	FROM "challenge_best_evaluations" AS best
	WHERE best."attempt_id" = reserved_attempt_id;

	RETURN QUERY
	UPDATE "challenge_attempts" AS attempt
	SET
		"evaluations_pending" = GREATEST(attempt."evaluations_pending" - 1, 0),
		"evaluations_used" = attempt."evaluations_used" + 1,
		"best_evaluation_id" = selected_best_evaluation_id,
		"updated_at" = now()
	WHERE attempt."id" = reserved_attempt_id
	RETURNING
		attempt."share_code",
		attempt."evaluations_used",
		attempt."evaluations_limit";
END;
$$ LANGUAGE plpgsql;
