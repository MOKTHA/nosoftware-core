#!/usr/bin/env bash
# Generates all task prompt files from LOOP_STATE.json
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$REPO_ROOT/.claude/tasks"

generate_task() {
  local id="$1" phase="$2" title="$3" file="$REPO_ROOT/.claude/tasks/${id}.md"
  cat > "$file" << TASK
# Task $id — Phase $phase: $title

## Context
- Read buildplan.md Phase $phase section for full scope and exit criteria
- Read graphify-out/GRAPH_REPORT.md Session Memory block before touching files
- Current dependency: all P$((phase-1)) tasks must be DONE (verify in LOOP_STATE.json)

## Execution Protocol (CLAUDE.md Work Order)
1. Read relevant heynxt-core files for this task scope
2. Read relevant reference repo patterns (Vercel template / FactoryNXT as appropriate)
3. Compare current repo state vs buildplan.md Phase $phase exit criteria
4. Implement the smallest enabling code that satisfies ALL exit criteria
5. Run: pnpm typecheck && pnpm lint && pnpm build && pnpm test
6. Update graphify: graphify update . (if structural changes made)

## Exit Criteria
See buildplan.md Phase $phase — satisfy ALL checkboxes for this task scope.

## Completion
After ALL exit criteria for this task are met and verifications pass, output:
LOOP_TASK_DONE: $id | EVIDENCE: <verification output summary> | RISKS: <risks or 'none'>
TASK
  echo "Generated: $file"
}

# Read tasks from LOOP_STATE.json and generate prompt files
jq -r '.tasks[] | [.id, (.phase|tostring), .title] | @tsv' \
  "$REPO_ROOT/LOOP_STATE.json" | \
while IFS=$'\t' read -r id phase title; do
  generate_task "$id" "$phase" "$title"
done
