ALTER TABLE "attempts" ADD COLUMN "ci_status" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "ci_last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "description_markdown" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "estimate" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "priority" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "labels_json" jsonb;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assignee_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "assignee_email" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "creator_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "creator_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "creator_email" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "project_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cycle_id" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cycle_name" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "cycle_number" integer;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "linear_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "linear_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "parent_id" text;