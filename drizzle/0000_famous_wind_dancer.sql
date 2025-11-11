CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"repo" text NOT NULL,
	"pr_number" integer NOT NULL,
	"pr_url" text NOT NULL,
	"branch" text,
	"opened_at" timestamp with time zone NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"status" text NOT NULL,
	"commit_count" integer DEFAULT 1 NOT NULL,
	"last_commit_sha" text,
	CONSTRAINT "attempts_issue_id_agent_name_pr_number_unique" UNIQUE("issue_id","agent_name","pr_number")
);
--> statement-breakpoint
CREATE TABLE "ci_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"tests_passed" integer,
	"tests_failed" integer,
	"coverage_delta" real,
	"perf_delta_ms" real,
	"lint_errors" integer,
	"size_delta_bytes" integer,
	"json_blob" jsonb
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_source_key_unique" UNIQUE("source","key")
);
--> statement-breakpoint
CREATE TABLE "issue_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"agent_name" text NOT NULL,
	"status" text NOT NULL,
	"external_job_id" text,
	"triggered_at" timestamp with time zone,
	CONSTRAINT "issue_agents_issue_id_agent_name_unique" UNIQUE("issue_id","agent_name")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linear_id" text NOT NULL,
	"linear_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"repo" text,
	"status" text,
	"arena_ready_labeled_at" timestamp with time zone,
	"winner_attempt_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issues_linear_id_unique" UNIQUE("linear_id")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ci_metrics" ADD CONSTRAINT "ci_metrics_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_agents" ADD CONSTRAINT "issue_agents_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;