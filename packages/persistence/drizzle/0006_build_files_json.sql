-- Add filesJson column to builds table for generated file storage (code viewer)
ALTER TABLE "builds" ADD COLUMN IF NOT EXISTS "filesJson" text;
