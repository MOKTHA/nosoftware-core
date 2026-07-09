# FactoryNXT_PY_V2 — Structural Knowledge Graph

> Generated: 2026-07-09 · Source repo: `/Users/pskbmohan/Documents/GitHub/FactoryNXT_PY_V2`
> **Reference repo for heynxt-core** — PCB/electronics MES, do not copy-paste. Study patterns, not code.

---

## Repository Overview

| Field | Value |
|---|---|
| Python files | **36** (30 under `app/`, 6 migrations/run) |
| HTML templates | 145 |
| Total files (non-vendor) | ~233 |
| SQLAlchemy models | **51** (46 in `models.py` + 5 in `models_routing.py`) |
| Flask blueprints | **24 registered** / **25 declared** (24 via `register_blueprint` in `__init__.py`; `app/routes/users.py` declares a BP but is never registered — orphaned) |
| Route handlers | ~176 |
| Migrations | 4 |

## What the repo does

- **Production MES for PCB/electronics assembly (SMT)**: a full Manufacturing Execution System for a surface-mount technology (SMT) factory floor
- **Work orders**: create, release, schedule (Gantt), track lifecycle, serial numbers
- **Barcode-scan execution engine**: operator scans serial at a station → validates routing order → records operation transaction (OK/NG) → advances WO status
- **Quality management**: NCR, CAPA, defect records, inspection plans (AQL), golden boards, PPAP, test results, burn-in sessions
- **Traceability**: panel → board → unit history, genealogy events (component placement, lot tracking), repair records, PCB genealogy search
- **SMT material management**: feeder reels, solder paste lots (floor life, expiry), stencils, kitting
- **Machine reliability**: OEE snapshots (availability × performance × quality), downtime events, preventive maintenance, calibration records
- **Scheduling**: Gantt chart (Frappe Gantt), shift calendar, plan-vs-actual, drag-to-reschedule
- **Integrations**: ERP sync (queued log), webhooks, API key management
- **Governance**: roles, operator certifications, audit log, electronic signatures (21 CFR Part 11 style)
- **Visual routing builder (V2)**: DAG-based routing with Drawflow canvas, revision control, snapshot on WO release

## Top-Level Architecture

```
FactoryNXT_PY_V2/
├── run.py                          ← entry point (create_app)
├── app/__init__.py                 ← Flask app factory (create_app), 24 blueprint registrations
├── app/config.py                   ← Config class (PostgreSQL, SQLALCHEMY_*)
├── app/models.py                   ← 55 models, highest blast radius (~635 lines)
├── app/models_routing.py           ← 5 models, V2 visual routing (DAG + snapshot)
├── app/routes/                     ← 26 blueprint files
│   ├── operations.py               ← execution engine (the crown jewel)
│   ├── production.py               ← Gantt scheduler, WO list, plan-vs-actual
│   ├── routing_builder.py          ← V2 visual routing CRUD + DAG validation
│   ├── integrations.py             ← ERP, webhooks, API keys
│   └── [22 other modules]
├── app/templates/                  ← 145 Jinja2 templates
├── static/                         ← 2 files (likely CSS/JS)
└── migrations/versions/            ← 4 Alembic migrations
```

## Module Inventory

| Module path | Purpose | File count | Key models |
|---|---|---|---|
| `app/__init__.py` | App factory, blueprint registration | 1 | — |
| `app/models.py` | All primary SQLAlchemy models | 1 | 55 models |
| `app/models_routing.py` | V2 visual routing models | 1 | 5 models |
| `app/config.py` | Flask config | 1 | — |
| `app/routes/operations.py` | Execution engine (barcode scan) | 1 | WorkOrder, SerialNumber, OperationTransaction, RoutingStep, Station |
| `app/routes/production.py` | Gantt scheduler, WO list, OEE dashboard | 1 | WorkOrder, ProductionSchedule, OeeSnapshot, DowntimeEvent, SmtLine |
| `app/routes/routing_builder.py` | V2 visual routing CRUD + DAG validation | 1 | RoutingMaster, RoutingStepV2, RoutingConnection, RoutingProductAssignment, WorkOrderRoutingSnapshot |
| `app/routes/integrations.py` | ERP sync, webhooks, API keys | 1 | Integration, ErpSyncLog, Webhook, ApiKey |
| `app/routes/machines.py` | Machine CRUD, alarm display | 1 | Machine, Alarm, Line |
| `app/routes/maintenance.py` | PM scheduling, maintenance logs, calibration | 1 | PmSchedule, MaintenanceLog, CalibrationRecord, Machine |
| `app/routes/quality_ext.py` | Quality views: defects, CAPA, inspection, golden boards, PPAP, burn-in | 1 | DefectRecord, Capa, InspectionPlan, GoldenBoard, PpapRecord, TestResult, BurnInSession |
| `app/routes/ncr.py` | NCR (Non-Conformance Report) list/create | 1 | NCR |
| `app/routes/pcb.py` | PCB panel/board management | 1 | PcbPanel, PcbBoard |
| `app/routes/genealogy.py` | Component-level genealogy search & repair | 1 | GenealogyEvent, RepairRecord, PcbBoard, UnitHistory |
| `app/routes/traceability.py` | Traceability search/display | 1 | UnitHistory, PcbBoard |
| `app/routes/smt_materials.py` | Solder paste, stencils, feeder reels | 1 | SolderPasteLot, Stencil, FeederReel |
| `app/routes/kitting.py` | Kit assembly for WO | 1 | Kit |
| `app/routes/inventory.py` | Inventory locations/items | 1 | InventoryLocation, InventoryItem |
| `app/routes/work_orders.py` | Legacy WO views (superseded by production.py) | 1 | WorkOrder |
| `app/routes/routing.py` | V1 routing list/form | 1 | RoutingStep, BOMItem |
| `app/routes/bom.py` | BOM management | 1 | BOMItem |
| `app/routes/stations.py` | Station CRUD | 1 | Station |
| `app/routes/scheduling.py` | Shift schedules | 1 | ShiftCalendar |
| `app/routes/oee.py` | OEE dashboards | 1 | OeeSnapshot, DowntimeEvent, Machine |
| `app/routes/admin.py` | Admin views | 1 | UserProfile, Role, AuditLog |
| `app/routes/users.py` | User management, certifications | 1 | UserProfile, Role, OperatorCertification |
| `app/routes/auth.py` | Login (session-based) | 1 | — |
| `app/routes/dashboard.py` | Dashboard (landing page) | 1 | — |
| `app/routes/api.py` | Status endpoint | 1 | — |

## Entry Points

- `run.py` — `app = create_app(); app.run(debug=True)`
- `app/__init__.py` — `create_app()` registers 24 blueprints with mixed conventions:
  - URL-prefix blueprints: `/auth`, `/api`, `/production`, `/users`, `/maintenance`, `/quality/ext`, `/pcb`, `/genealogy`, `/stations`, `/scheduling`, `/kitting`, `/oee`, `/integrations`
  - Flat-prefix blueprints (routes define their own path): dashboard, machines, operations, routing, bom, work_orders, ncr, traceability, smt_materials, inventory, admin, routing_builder, api

## Model Inventory — Grouped by Domain

### Shop-floor topology
- **Plant** — plant master (uuid PK, code, timezone)
- **Line** — production line (string name, status)
- **SmtLine** — SMT-specific line (uuid PK, plant_id, code)
- **Machine** — a machine on a line (FK to Line)
- **Alarm** — machine alarm (FK to Machine)
- **Station** — workstation (name, code, is_active)

### Orders & production
- **WorkOrder** — core WO: uuid PK, order_number, part_number, quantity, status (`DRAFT → RELEASED → RUNNING → COMPLETED | CANCELLED`), scheduled_start/end, released_at/started_at/completed_at
- **SerialNumber** — one per unit in a WO; current_step, current_status (`PENDING → IN_PROGRESS → COMPLETED | REJECTED`)
- **OperationTransaction** — audit trail: WO, serial, routing_step sequence, station_id, operator_id, start/end time, result (OK/NG)
- **ProductionSchedule** — WO → SMT line schedule (scheduled_start/end, sequence_order, is_locked)
- **ShiftCalendar** — shift definitions (day_of_week, start_time, end_time)
- **Kit** — per-WO kitting record (status, kit_lines JSON)

### Product definition
- **BOMItem** — bill of materials (part → component, qty_per_unit, designator, revision)
- **RoutingStep** (V1) — linear routing (part_number, operation_sequence, station_name FK)

### SMT materials
- **FeederReel** — SMT tape reel (reel_id, qty_remaining, feeder_slot, splice tracking)
- **SolderPasteLot** — solder paste (lot, manufacturer, expiry, floor life)
- **Stencil** — stencil asset (print_count, clean_cycle_interval)
- **InventoryLocation** — warehouse location
- **InventoryItem** — stock item (RoHS/REACH, MSD level, expiry, floor life)

### PCB traceability
- **PcbPanel** — WO panel (panel_serial, board_count, status `In-Assembly`)
- **PcbBoard** — individual board in panel (serial_number, status)
- **UnitHistory** — per-board operation history (JSON process_parameters)
- **GenealogyEvent** — component placement trace (board, WO, machine, operator, reel, reference_designator, lot)
- **RepairRecord** — component-level repair (removed/installed part+lot, reference_designator, FK to NCR)

### Quality
- **NCR** — Non-Conformance Report (severity, status, quarantine_location, disposition)
- **Capa** — Corrective/Preventive Action (root_cause_analysis JSON, actions JSON array)
- **DefectRecord** — per-unit defect (defect_code, defect_category, disposition)
- **InspectionPlan** — AQL sampling (aql_level, sample_size, accept/reject limits, critical_checklist JSON)
- **GoldenBoard** — reference board (limit_file_path, reference_data JSON)
- **PpapRecord** — PPAP submission (level, status, documents JSON)
- **TestResult** — test outcome (test_data JSON, failure_codes ARRAY)
- **BurnInSession** — burn-in chamber session (chamber_id, planned/actual hours)

### Machine reliability
- **PmSchedule** — preventive maintenance schedule (frequency_days, due_at)
- **MaintenanceLog** — maintenance action (parts_replaced JSON, downtime_minutes)
- **CalibrationRecord** — calibration event (certificate_number, next_due_at)
- **DowntimeEvent** — downtime (reason_code, reason_category, duration_min)
- **OeeSnapshot** — OEE metrics (availability × performance × quality)

### Governance
- **Role** — RBAC role (permissions ARRAY of strings)
- **UserProfile** — user (FK Plant, FK Role, employee_id)
- **OperatorCertification** — per-operation certification (certification_level, expiry_date)
- **AuditLog** — generic audit trail (table_name, record_id, old_values JSON, new_values JSON, esig_reason)
- **ElectronicSignature** — signed record (signature_hash, record_type, record_id)

### Integrations
- **Integration** — named integration record (is_active)
- **ErpSyncLog** — ERP sync job log (entity_type, status, details JSON)
- **Webhook** — webhook config (url, event_type, secret)
- **ApiKey** — API key (key_value, scope, last_used_at, revoked_at)

## Routing V2 (models_routing.py) — DAG + Snapshot Pattern

V2 visual routing builder uses a **DAG (Directed Acyclic Graph)** model distinct from the legacy V1 linear `RoutingStep`:

| Model | Purpose |
|---|---|
| **RoutingMaster** | Header record per routing revision; fields: routing_code, product_id, revision (A→B→C), status (`DRAFT → RELEASED → OBSOLETE`), canvas_data (Drawflow JSON) |
| **RoutingStepV2** | Step in the DAG; FK to RoutingMaster; step_no, station_id, cycle_time, parallel flag, qc_required, mandatory, rework_allowed; node position for canvas |
| **RoutingConnection** | DAG edges (from_step → to_step, both FK to RoutingStepV2); validated for cycles (DFS in `_validate_routing`) |
| **RoutingProductAssignment** | Links product/part_number to a specific routing revision |
| **WorkOrderRoutingSnapshot** | Frozen copy of steps at WO release time — prevents routing edits from altering released WOs |

The execution engine (`operations.py`) currently reads **V1 `RoutingStep`** by `part_number` + `operation_sequence`. V2 is in `models_routing.py` and `routing_builder.py` but **V1 ↔ V2 integration is not yet bridged** — a known gap (see Uncertain section).

## Service Inventory

### `app/routes/operations.py` — Execution Engine
The most valuable pattern in the repo. Single endpoint `/api/operations/scan` (POST) that:
1. Validates scan payload (serial_number, station_id, operator_id, result OK/NG)
2. Looks up `SerialNumber` → `WorkOrder` → `RoutingStep` by part_number
3. Finds the routing step for the scanned station by `station_name`
4. **First step check**: requires WO in `RELEASED` or `RUNNING`, no prior transaction at first step
5. **Subsequent step check**: previous step must have a completed `OperationTransaction` with result `OK`
6. Records new `OperationTransaction`, advances `SerialNumber.current_step`
7. Auto-advances WO: `RELEASED → RUNNING` on first step; checks all-SNs-completed → `COMPLETED`

### `app/routes/production.py` — Gantt Scheduler
- Work order list with status filter
- Gantt board using Frappe Gantt (JSON feed at `/api/gantt-data`)
- Drag-to-reschedule endpoint (`PATCH /api/work-orders/<id>/schedule`) with defensive date parsing
- Plan-vs-actual, OEE dashboard, downtime log, production floor views

### `app/routes/integrations.py` — ERP Adapter Patterns
- Integration hub (toggle active/inactive)
- ERP sync trigger → creates `ErpSyncLog` with `status=pending` (async worker pattern, inferred)
- Webhook CRUD for event-driven integrations
- API key generation (secrets.token_hex) with scope and revocation

## Hub Files / High Blast Radius

| File | Lines | Why it matters |
|---|---|---|
| `app/models.py` | ~635 | **60 model classes**. Every relationship, FK, and field name defines the schema. Highest blast radius. |
| `app/__init__.py` | 67 | App factory, all 24 blueprint registrations. Breaks everything if a BP name conflicts. |
| `app/models_routing.py` | 175 | V2 routing DAG + snapshot. Separate file to avoid merge conflicts (per docstring). |
| `app/routes/operations.py` | ~319 | **Execution engine**. The scan endpoint enforces routing order, advances serials, auto-completes WOs. |
| `app/routes/production.py` | ~389 | Gantt scheduler, WO status transitions, drag-to-reschedule with downgrade-to-DRAFT. |

## Safe to Edit

- **Individual route files** that only add new views/endpoints (bom.py, ncr.py, api.py, dashboard.py, auth.py, api.py)
- **Templates** (145 Jinja2 files) — pure HTML/CSS/JS
- **New route files** — add blueprint registration in `app/__init__.py`

## Edit with Caution

- `app/models.py` — adding/removing columns requires Alembic migration; FK changes cascade
- `app/__init__.py` — blueprint name conflicts will crash app startup
- `app/routes/operations.py` — the execution engine's routing-order enforcement. Changing the chain logic affects every scan on the floor. **Must read the full chain before modifying.**
- `app/routes/production.py` — Gantt drag-to-reschedule downgrades WO to DRAFT; status-transition logic is subtle
- `app/models_routing.py` ↔ `app/models.py` — V1/V2 coexistence. Do not assume they're wired up.

## Workflows Implemented

### WorkOrder Lifecycle
```
DRAFT ──[release guard: schedule window required]──→ RELEASED
  ──[first barcode scan]──→ RUNNING
  ──[all serials pass final step]──→ COMPLETED
  ──[any time]──→ CANCELLED
  ──[Gantt drag/resize]──→ DRAFT (auto-downgrade, planner must re-release)
```

### Operation Execution Engine (`/api/operations/scan`)
1. Scan serial barcode at station
2. Lookup serial → WO → routing (by part_number) → find step for this station
3. First step: WO must be RELEASED/RUNNING, no prior transaction
4. Subsequent steps: previous step's last transaction must be `OK`
5. Record OperationTransaction, update serial.current_step
6. Auto-advance WO: RELEASED→RUNNING on first scan; RUNNING→COMPLETED when all serials finish final step

### Routing Revision (V2)
```
DRAFT ──[validate DAG: no cycles, all stations exist]──→ RELEASED
RELEASED ──[new revision created]──→ OBSOLETE
```
On WO release: `WorkOrderRoutingSnapshot` frozen copy taken.

### Release Guard
- Cannot release WO without `scheduled_start` AND `scheduled_end`
- Cannot release WO that is not `DRAFT`
- Cannot scan serial at station not in routing for WO's part_number

## API Boundaries

Blueprints use **mixed URL-prefix conventions**:

**With url_prefix** (routes inside file are relative):
- `/auth` → login
- `/api` → /status
- `/production` → work-orders, gantt, scheduler, plan-vs-actual, oee, downtime, production-floor, api/*
- `/quality/ext` → defects, capas, inspection_plans, golden_boards, ppap, test_results, burn_in, audit_trail, containment
- `/users`, `/maintenance`, `/pcb`, `/genealogy`, `/stations`, `/scheduling`, `/kitting`, `/oee`, `/integrations`

**Without prefix** (routes are absolute paths):
- `dashboard` → `/`
- `machines` → `/machines`, `/machines/<id>`, `/alarms`
- `operations` → `/operations`, `/api/operations/*`
- `routing` → `/routing`
- `bom` → `/bom`
- `work_orders` → `/work-orders`, `/work-orders/<id>`
- `ncr` → `/quality/ncr`
- `traceability` → `/traceability`
- `smt_materials` → `/solder-paste`, `/stencils`, `/feeder-reels`
- `inventory` → `/inventory`, `/inventory-locations`
- `admin` → `/admin`, `/admin/audit-log`
- `routing_builder` → `/routing-builder`, `/routing-builder/api/*`

## Uncertain / Inferred

- **V1/V2 routing gap** (observed): The execution engine in `operations.py` reads `RoutingStep` (V1, linear by operation_sequence). The V2 DAG in `models_routing.py` has its own models but no bridge to execution. V2 routes exist in `routing_builder.py` but do not feed the scan engine. This is a **known integration gap** inferred from code.
- **Feature duplication** (observed): `maintenance` and `machines` both show PM/calibration views. `quality_ext.py`, `ncr.py`, and `smt_materials` overlap on golden boards, PPAP. Inferred from parallel development.
- **Auth is a stub** (inferred): `auth.py` login sets `session['username']` directly from form input — **no password verification, no hashing**. This is a development stub, not production auth.
- **ERP sync is async-queued** (inferred): `erp_trigger()` creates an `ErpSyncLog` with status `pending` but no worker is visible in the repo. A background worker (Celery, cron, or external process) processes these off-band.
- **No middleware / no decorator-based auth enforcement** (inferred): No `@login_required` or auth middleware. Auth checks, if any, are absent from scan.

---

## Session Memory

> **Copy this into future Claude Code sessions when working with FactoryNXT as a reference.**

**Repo role**: FactoryNXT is a **production MES (Manufacturing Execution System) for PCB/electronics assembly (SMT)**. Flask 3.0 + SQLAlchemy + PostgreSQL. It is a **reference implementation for heynxt-core** — study its patterns, **do NOT copy-paste its code**.

**Tech stack**: Python 3, Flask 3.0, SQLAlchemy (declarative), Flask-Migrate (Alembic), PostgreSQL, Jinja2, Frappe Gantt (JS), Drawflow (JS for V2 visual routing canvas).

**Model layout**: 51 models total. `app/models.py` (~635 lines, 46 models) holds the primary domain. `app/models_routing.py` (~175 lines, 5 models) holds V2 visual routing separately to avoid merge conflicts. Models grouped by domain:
- Topology: Plant, Line, SmtLine, Machine, Alarm, Station
- Orders: WorkOrder (status lifecycle `DRAFT → RELEASED → RUNNING → COMPLETED | CANCELLED`), SerialNumber, OperationTransaction, ProductionSchedule, ShiftCalendar, Kit
- Product def: BOMItem, RoutingStep (V1 linear)
- SMT materials: FeederReel, SolderPasteLot, Stencil, InventoryLocation, InventoryItem
- PCB traceability: PcbPanel, PcbBoard, UnitHistory, GenealogyEvent, RepairRecord
- Quality: NCR, Capa, DefectRecord, InspectionPlan, GoldenBoard, PpapRecord, TestResult, BurnInSession
- Reliability: PmSchedule, MaintenanceLog, CalibrationRecord, DowntimeEvent, OeeSnapshot
- Governance: Role, UserProfile, OperatorCertification, AuditLog, ElectronicSignature
- Integrations: Integration, ErpSyncLog, Webhook, ApiKey
- V2 Routing: RoutingMaster, RoutingStepV2, RoutingConnection, RoutingProductAssignment, WorkOrderRoutingSnapshot

**The most valuable pattern to extract**: `app/routes/operations.py` `scan_serial()` endpoint. It enforces routing order (previous step must be OK), advances `SerialNumber.current_step`, auto-advances WO `RELEASED → RUNNING` on first scan, auto-completes WO when all serials pass final step. This is the execution engine — study how it chains validation → transaction → status transitions.

**What to read first**:
1. `app/models.py` first 200 lines — topological models + WorkOrder + SerialNumber + OperationTransaction (the execution chain)
2. `app/__init__.py` — blueprint registration pattern
3. `app/routes/operations.py` — full file, the execution engine
4. `app/models_routing.py` — V2 DAG + snapshot pattern (if working on routing)

**What NOT to touch without reading the full chain**:
- `app/routes/operations.py` scan endpoint — the routing-order enforcement is subtle. Changing it affects every serial on the floor.
- Auto-release logic — `operations.py` auto-advances WO status based on scan. Do not modify without tracing all status transitions.
- `app/__init__.py` blueprint order/name — conflicts crash startup.
- `app/models.py` — FK changes cascade; requires Alembic migration.

**Known gaps**:
- V1 RoutingStep (linear) still drives execution; V2 RoutingMaster/RoutingStepV2 (DAG) has no bridge — they coexist but execution still reads V1.
- Auth is a stub: `session['username'] = request.form.get("username")` — no password check.
- ERP sync is fire-and-queue (no worker in repo).
- Some duplication (maintenance/machines, quality_ext/ncr/smt_materials views).

**Language**: Python. This is a Python reference repo — do not port patterns into heynxt-core verbatim; extract the ideas.
