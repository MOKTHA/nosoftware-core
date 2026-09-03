-- Add eventsJson column to builds table for SSE event replay on reconnect
ALTER TABLE "builds" ADD COLUMN IF NOT EXISTS "eventsJson" text;
