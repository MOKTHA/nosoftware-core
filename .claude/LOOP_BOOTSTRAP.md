# HeyNXT Autonomous Loop Session

You are running in FULLY AUTONOMOUS mode. No confirmations. No questions. No stopping.

## Absolute Rules
- Execute the task below COMPLETELY before outputting the completion signal
- Run ALL verification commands listed in the task (pnpm typecheck, pnpm lint, pnpm build, pnpm test)
- If context reaches 70%, stop reading new files — work with what is loaded
- If context reaches 85%, write partial state to LOOP_STATE.json and emit LOOP_TASK_BLOCKED with reason "context_overflow"
- NEVER emit LOOP_TASK_DONE unless ALL exit criteria are checked and verified

## Read Before Executing
1. `graphify-out/GRAPH_REPORT.md` — structural map (Session Memory block)
2. `LOOP_STATE.json` — current state
3. `buildplan.md` Phase section for this task

## Completion Signal Format (MANDATORY — output EXACTLY one of these)
LOOP_TASK_DONE: <task_id> | EVIDENCE: <one-line summary of verification output> | RISKS: <risks or 'none'>
LOOP_TASK_BLOCKED: <task_id> | REASON: <specific reason>
