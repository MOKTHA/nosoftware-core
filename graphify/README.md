# Graphify — Unified Repo Map

All structural knowledge graphs for heynxt-core and its reference repositories
live under this directory. Future Claude Code sessions should consult these
graphs **before** opening raw source files.

## Layout

Every repo has its graph at: `graphify/<repo_name>/`

```
graphify/
├── README.md                        <- you are here
├── heynxt-core/                     <- symlink → ../graphify-out (canonical)
│   ├── GRAPH_REPORT.md
│   ├── graph.html
│   └── graph.json
├── FactoryNXT_PY_v2_Extrusion/      <- copy of the extrusion MES graph
│   ├── GRAPH_REPORT.md
│   ├── graph.html
│   └── graph.json
├── FactoryNXT_PY_V2/                <- copy of the PCB MES graph
│   ├── GRAPH_REPORT.md
│   ├── graph.html
│   └── graph.json
└── coding-agent-template/           <- copy of the Vercel agent-substrate graph
    ├── GRAPH_REPORT.md
    ├── graph.html
    └── graph.json
```

## How to Use This Map

When starting any session:

1. **Paste the Session Memory block** for the relevant repo into your prompt.
   Each `GRAPH_REPORT.md` has a dedicated "Session Memory" section (also in a
   collapsible `<details>` at top of each `graph.html`).
2. **Read `GRAPH_REPORT.md`** for the relevant repo to understand structure.
3. **Open `graph.html`** in a browser for interactive exploration.
4. **Inspect `graph.json`** programmatically when you need precise dependency
   information, blast-radius lists, or module inventories.
5. **Only then** open raw source files as needed for the task.

## File Contents

| File | Use When |
|---|---|
| `GRAPH_REPORT.md` | Quick orientation; human-readable architecture |
| `graph.html` | Interactive exploration in browser |
| `graph.json` | Programmatic queries (dependency lookup, blast radius) |
| `README.md` | This document — layout and conventions |

## Priority Order for Any Repo

1. `graphify/<repo_name>/GRAPH_REPORT.md`
2. `graphify/<repo_name>/graph.html` (interactive)
3. Targeted source files needed for the task

Do not reread entire repos if a valid graph exists. Refresh the graph after
major structural changes or after extracting new blueprint data.

## How Graphs Are Generated

Graphs are produced by running a Graphify agent (manual implementation in this
session, using `find`/`grep` + LLM summarization, no external library).
Outputs:
- HTML uses d3.js via CDN for force-directed visualization.
- JSON uses a simple `{ nodes, edges, clusters, workflows }` schema.
- Report is markdown with a consistent section layout (Overview,
  Top-Level Architecture, Module Inventory, Hub Files, Safe/Caution zones,
  Workflows, API Boundaries, Session Memory).

## Refreshing a Graph

After major structural changes to a repo, rerun Graphify for that repo:

```bash
# Spawn a Graphify agent targeting the changed repo
# It will read existing graph to avoid regressions and update in place
```

Graphify agents re-scan, compare to previous graph, and update any changed
nodes/edges while preserving stable identifiers where possible.

## Repo Roles

| Repo | Role | Read First? |
|---|---|---|
| `heynxt-core` | Product control plane (this repo) | Always |
| `FactoryNXT_PY_v2_Extrusion` | Reference — aluminum extrusion MES | When extracting extrusion blueprints |
| `FactoryNXT_PY_V2` | Reference — PCB/electronics MES | When extracting PCB blueprints |
| `coding-agent-template` | Reference — agent execution substrate | When building `@heynxt/agent-adapter` |

## Cross-Repo Navigation

The graph reports link between repos where relevant. For example:
- heynxt-core's architecture diagram references the three reference repos.
- FactoryNXT graphs include a note: "extracted patterns will populate
  `@heynxt/blueprint-registry` and `@heynxt/domain-models` in heynxt-core".
- coding-agent-template's patterns note: "adopted by
  `@heynxt/agent-adapter` in heynxt-core".
