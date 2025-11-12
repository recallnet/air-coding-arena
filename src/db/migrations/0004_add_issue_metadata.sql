-- Add issue metadata columns
-- Migration: 0004_add_issue_metadata.sql

ALTER TABLE issues
  ADD COLUMN description TEXT,
  ADD COLUMN description_markdown TEXT,
  ADD COLUMN estimate INTEGER,
  ADD COLUMN priority INTEGER,
  ADD COLUMN labels_json JSONB,
  ADD COLUMN assignee_id TEXT,
  ADD COLUMN assignee_name TEXT,
  ADD COLUMN assignee_email TEXT,
  ADD COLUMN creator_id TEXT,
  ADD COLUMN creator_name TEXT,
  ADD COLUMN creator_email TEXT,
  ADD COLUMN project_id TEXT,
  ADD COLUMN project_name TEXT,
  ADD COLUMN cycle_id TEXT,
  ADD COLUMN cycle_name TEXT,
  ADD COLUMN cycle_number INTEGER,
  ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN linear_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN linear_updated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN parent_id TEXT;
