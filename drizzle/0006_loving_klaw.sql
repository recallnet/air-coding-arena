ALTER TABLE "agents" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_score_history" ADD CONSTRAINT "agent_score_history_issue_id_agent_name_unique" UNIQUE("issue_id","agent_name");--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_slug_unique" UNIQUE("slug");