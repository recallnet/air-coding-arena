CREATE TABLE "agent_config" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"mode" text DEFAULT 'all' NOT NULL,
	"max_agents" integer,
	"last_discovery_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "single_row" CHECK ("agent_config"."id" = 'singleton'),
	CONSTRAINT "valid_mode" CHECK ("agent_config"."mode" IN ('all', 'max_n', 'manual')),
	CONSTRAINT "valid_max_agents" CHECK ("agent_config"."max_agents" IS NULL OR "agent_config"."max_agents" >= 2)
);
--> statement-breakpoint
CREATE TABLE "agent_score_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"issue_id" uuid NOT NULL,
	"mu" real NOT NULL,
	"sigma" real NOT NULL,
	"ordinal" real NOT NULL,
	"rank" integer NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"mu" real DEFAULT 25 NOT NULL,
	"sigma" real DEFAULT 8.333 NOT NULL,
	"ordinal" real DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"last_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_scores_agent_name_unique" UNIQUE("agent_name")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"linear_user_id" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_name_unique" UNIQUE("name"),
	CONSTRAINT "agents_linear_user_id_unique" UNIQUE("linear_user_id")
);
--> statement-breakpoint
ALTER TABLE "agent_score_history" ADD CONSTRAINT "agent_score_history_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agents_enabled" ON "agents" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_agents_active" ON "agents" USING btree ("is_active");