-- Migration 0004 — Phase 8 Industrial Runtime Services
-- Adds workflow engine, rules engine, notifications, file evidence service, and KPI aggregation tables

-- ============================================================================
-- Workflow Engine Tables (Phase 8)
-- ============================================================================

CREATE TYPE workflow_definition_status AS ENUM ('draft', 'published', 'deprecated');
CREATE TYPE workflow_domain AS ENUM ('work-order', 'routing', 'quality', 'maintenance', 'inventory', 'custom');
CREATE TYPE workflow_instance_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- Table: workflow_definitions (state machine templates)
CREATE TABLE workflow_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    status workflow_definition_status NOT NULL DEFAULT 'draft',
    domain workflow_domain NOT NULL,
    states JSONB NOT NULL DEFAULT '[]'::jsonb,
    transitions JSONB DEFAULT '{}'::jsonb,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX workflow_definitions_domain_idx ON workflow_definitions(domain);
CREATE INDEX workflow_definitions_status_idx ON workflow_definitions(status);
CREATE INDEX workflow_definitions_createdBy_idx ON workflow_definitions(created_by);

-- Table: workflow_instances (runtime execution state)
CREATE TABLE workflow_instances (
    id TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
    definition_version TEXT NOT NULL,
    status workflow_instance_status NOT NULL DEFAULT 'pending',
    current_state TEXT NOT NULL,
    context_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX workflow_instances_definitionId_idx ON workflow_instances(definition_id);
CREATE INDEX workflow_instances_status_idx ON workflow_instances(status);
CREATE INDEX workflow_instances_currentState_idx ON workflow_instances(current_state);

-- Table: workflow_transitions (audit trail for state changes)
CREATE TABLE workflow_transitions (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'timer', 'manual', 'webhook')),
    event_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX workflow_transitions_instanceId_idx ON workflow_transitions(instance_id);
CREATE INDEX workflow_transitions_state_idx ON workflow_transitions(from_state, to_state);


-- ============================================================================
-- Runtime Events Tables (Phase 8)
-- ============================================================================

CREATE TYPE event_source AS ENUM ('plc', 'barcode_scanner', 'manual_entry', 'external_api', 'sensor', 'system');
CREATE TYPE event_priority AS ENUM ('low', 'normal', 'high', 'critical');

-- Table: runtime_events (unified event ingestion)
CREATE TABLE runtime_events (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    source event_source NOT NULL DEFAULT 'system',
    priority event_priority NOT NULL DEFAULT 'normal',
    event_type TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    generation_run_id TEXT,
    workspace_id TEXT
);

CREATE INDEX runtime_events_eventId_idx ON runtime_events(event_id);
CREATE INDEX runtime_events_source_idx ON runtime_events(source);
CREATE INDEX runtime_events_eventType_idx ON runtime_events(event_type);
CREATE INDEX runtime_events_timestamp_idx ON runtime_events(timestamp);
CREATE INDEX runtime_events_receivedAt_idx ON runtime_events(received_at);

-- Table: event_processing_log (processing audit trail)
CREATE TABLE event_processing_log (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES runtime_events(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX event_processing_log_eventId_idx ON event_processing_log(event_id);
CREATE INDEX event_processing_log_stepName_idx ON event_processing_log(step_name);


-- ============================================================================
-- Rules Engine Tables (Phase 8)
-- ============================================================================

CREATE TYPE rule_status AS ENUM ('draft', 'active', 'disabled');
CREATE TYPE violation_severity AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE rule_domain AS ENUM ('quality', 'process', 'equipment', 'production', 'safety', 'custom');

-- Table: rules (business rule definitions)
CREATE TABLE rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status rule_status NOT NULL DEFAULT 'draft',
    domain rule_domain NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluation_window JSONB DEFAULT '{}'::jsonb,
    dependencies JSONB DEFAULT '[]'::jsonb,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX rules_domain_idx ON rules(domain);
CREATE INDEX rules_status_idx ON rules(status);
CREATE INDEX rules_createdBy_idx ON rules(created_by);

-- Table: rule_violations (rule triggers/firings)
CREATE TABLE rule_violations (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES rules(id),
    severity violation_severity NOT NULL,
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    trigger_details JSONB DEFAULT '[]'::jsonb,
    actions_taken JSONB DEFAULT '[]'::jsonb,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX rule_violations_ruleId_idx ON rule_violations(rule_id);
CREATE INDEX rule_violations_severity_idx ON rule_violations(severity);
CREATE INDEX rule_violations_acknowledgedBy_idx ON rule_violations(acknowledged_by);

-- Table: rule_evaluation_log (evaluation audit trail)
CREATE TABLE rule_evaluation_log (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES rules(id),
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    condition_results JSONB DEFAULT '[]'::jsonb,
    all_conditions_passed TEXT NOT NULL CHECK (all_conditions_passed IN ('true', 'false')),
    triggered_action_index INTEGER,
    error TEXT
);

CREATE INDEX rule_evaluation_log_ruleId_idx ON rule_evaluation_log(rule_id);
CREATE INDEX rule_evaluation_log_evaluatedAt_idx ON rule_evaluation_log(evaluated_at);


-- ============================================================================
-- Notification Service Tables (Phase 8)
-- ============================================================================

CREATE TYPE notification_channel AS ENUM ('email', 'slack', 'webhook', 'inApp');
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE notification_status AS ENUM ('pending', 'sending', 'sent', 'failed', 'expired');

-- Table: notifications (notification records)
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    priority notification_priority NOT NULL DEFAULT 'normal',
    channel notification_channel NOT NULL,
    status notification_status NOT NULL DEFAULT 'pending',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_id TEXT,
    schedule JSONB DEFAULT '{}'::jsonb,
    digest JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_status_idx ON notifications(status);
CREATE INDEX notifications_channel_idx ON notifications(channel);
CREATE INDEX notifications_priority_idx ON notifications(priority);

-- Table: notification_delivery_attempts (delivery audit trail)
CREATE TABLE notification_delivery_attempts (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
    status_code TEXT,
    error_message TEXT,
    response_payload JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX notification_delivery_attempts_notificationId_idx ON notification_delivery_attempts(notification_id);
CREATE INDEX notification_delivery_attempts_status_idx ON notification_delivery_attempts(status);
CREATE INDEX notification_delivery_attempts_attemptedAt_idx ON notification_delivery_attempts(attempted_at);

-- Table: notification_templates (reusable templates)
CREATE TABLE notification_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    channel notification_channel NOT NULL,
    title_format TEXT NOT NULL,
    body_format TEXT NOT NULL,
    fields JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX notification_templates_channel_idx ON notification_templates(channel);


-- ============================================================================
-- File/Evidence Service Tables (Phase 8) - Artifacts with integrity tracking
-- Note: This is separate from the Phase 1 artifacts table for generation outputs.
--       We use a different name prefix to avoid confusion.
-- ============================================================================

CREATE TYPE artifact_storage_type AS ENUM ('local', 's3', 'gcs', 'azure_blob');
CREATE TYPE storage_tier AS ENUM ('hot', 'cold', 'archive');

-- Content types for Phase 8 file evidence service (subset of common MIME types)
DO $$ BEGIN
    CREATE TYPE artifact_content_type_phase8 AS ENUM (
        'application/json',
        'application/pdf',
        'text/plain',
        'image/png',
        'image/jpeg',
        'video/mp4',
        'application/zip'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TYPE evidence_type AS ENUM (
    'validation-log',
    'generation-diff',
    'test-report',
    'screenshot',
    'terminal-output',
    'process-run-log',
    'quality-inspection',
    'genealogy-record',
    'custom'
);

-- Table: file_evidence_artifacts (content-addressable artifact storage)
CREATE TABLE file_evidence_artifacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content_type artifact_content_type_phase8 NOT NULL,
    size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
    content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
    storage_type artifact_storage_type NOT NULL DEFAULT 'local',
    storage_location TEXT NOT NULL,
    storage_tier storage_tier NOT NULL DEFAULT 'hot',
    evidence_type evidence_type,
    related_generation_run_id TEXT,
    related_validation_run_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX file_evidence_artifacts_contentHash_idx ON file_evidence_artifacts(content_hash);
CREATE INDEX file_evidence_artifacts_evidenceType_idx ON file_evidence_artifacts(evidence_type);
CREATE INDEX file_evidence_artifacts_storageType_idx ON file_evidence_artifacts(storage_type);
CREATE INDEX file_evidence_artifacts_genRunId_idx ON file_evidence_artifacts(related_generation_run_id);
CREATE INDEX file_evidence_artifacts_valRunId_idx ON file_evidence_artifacts(related_validation_run_id);

-- Table: artifact_verification_log (integrity audit trail)
CREATE TABLE artifact_verification_log (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL REFERENCES file_evidence_artifacts(id) ON DELETE CASCADE,
    verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('valid', 'corrupted', 'missing')),
    actual_hash TEXT,
    expected_hash TEXT NOT NULL,
    error_message TEXT
);

CREATE INDEX artifact_verification_log_artifactId_idx ON artifact_verification_log(artifact_id);
CREATE INDEX artifact_verification_log_status_idx ON artifact_verification_log(status);


-- ============================================================================
-- KPI Aggregation Tables (Phase 8)
-- ============================================================================

CREATE TYPE kpi_type AS ENUM ('oee', 'throughput', 'quality', 'downtime');
CREATE TYPE aggregation_window AS ENUM ('minute', 'hourly', 'daily', 'weekly', 'monthly');
CREATE TYPE kpi_calculation_status AS ENUM ('pending', 'calculating', 'completed', 'failed');

-- Table: kpi_snapshots (computed KPI metrics)
CREATE TABLE kpi_snapshots (
    id TEXT PRIMARY KEY,
    kpi_type kpi_type NOT NULL,
    line_id TEXT NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    availability NUMERIC CHECK (availability >= 0 AND availability <= 1),
    performance NUMERIC CHECK (performance >= 0 AND performance <= 1),
    quality NUMERIC CHECK (quality >= 0 AND quality <= 1),
    oee_score NUMERIC CHECK (oee_score >= 0 AND oee_score <= 1),
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX kpi_snapshots_lineId_idx ON kpi_snapshots(line_id);
CREATE INDEX kpi_snapshots_kpiType_idx ON kpi_snapshots(kpi_type);
CREATE INDEX kpi_snapshots_periodStart_idx ON kpi_snapshots(period_start);

-- Table: kpi_definitions (KPI configuration)
CREATE TABLE kpi_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    kpi_type kpi_type NOT NULL,
    scope JSONB DEFAULT '{}'::jsonb,
    aggregation_window aggregation_window NOT NULL DEFAULT 'hourly',
    enabled TEXT NOT NULL DEFAULT 'true' CHECK (enabled IN ('true', 'false')),
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX kpi_definitions_kpiType_idx ON kpi_definitions(kpi_type);
CREATE INDEX kpi_definitions_enabled_idx ON kpi_definitions(enabled);

-- Table: kpi_calculation_jobs (scheduled computation tracking)
CREATE TABLE kpi_calculation_jobs (
    id TEXT PRIMARY KEY,
    definition_id TEXT NOT NULL REFERENCES kpi_definitions(id),
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    status kpi_calculation_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error TEXT
);

CREATE INDEX kpi_calculation_jobs_definitionId_idx ON kpi_calculation_jobs(definition_id);
CREATE INDEX kpi_calculation_jobs_status_idx ON kpi_calculation_jobs(status);
CREATE INDEX kpi_calculation_jobs_windowStart_idx ON kpi_calculation_jobs(window_start);


-- ============================================================================
-- Migration Complete
-- ============================================================================
