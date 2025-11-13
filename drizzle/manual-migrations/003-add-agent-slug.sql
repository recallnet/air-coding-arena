-- Add slug column to agents table (nullable first)
ALTER TABLE agents ADD COLUMN slug TEXT;

-- Backfill slug from name (convert spaces to hyphens, lowercase)
UPDATE agents SET slug = LOWER(REPLACE(name, ' ', '-'));

-- Make slug NOT NULL and UNIQUE
ALTER TABLE agents ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX agents_slug_unique ON agents(slug);
