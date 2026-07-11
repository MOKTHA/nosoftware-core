-- Migration 0003 — Agent execution tables (Phase 2)
-- Adds agent_specs and agent_execution_results tables for coding agent orchestration

CREATE TYPE agent_type AS ENUM ('vercel-coding-agent', 'anthropic-claude-code', 'stub-shell');
CREATE TYPE agent_status AS ENUM ('draft', 'active', 'deprecated', 'error');
CREATE TYPE execution_result_status AS ENUM ('succeeded', 'failed', 'cancelled', 'timeout');

-- Table: agent_specs (declarative agent configuration)
CREATE TABLE agent_specs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    display_name TEXT NOT NULL,
    type agent_type NOT NULL DEFAULT 'vercel-coding-agent',
    status agent_status NOT NULL DEFAULT 'draft',
    system_prompt TEXT,
    task_description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX agent_specs_status_idx ON agent_specs(status);
CREATE INDEX agent_specs_type_idx ON agent_specs(type);

-- Table: agent_execution_results (execution outcome records)
CREATE TABLE agent_execution_results (
    id TEXT PRIMARY KEY,
    agent_spec_id TEXT NOT NULL REFERENCES agent_specs(id),
    task_id TEXT NOT NULL,
    status execution_result_status NOT NULL,
    raw_payload JSONB,
    summary TEXT,
    error_details TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX agent_exec_agent_spec_idx ON agent_execution_results(agent_spec_id);
CREATE INDEX agent_exec_task_idx ON agent_execution_results(task_id);
