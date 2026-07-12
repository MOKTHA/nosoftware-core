#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$REPO_ROOT/LOOP_STATE.json"
LOG_DIR="$REPO_ROOT/logs/loop"
BOOTSTRAP="$REPO_ROOT/.claude/LOOP_BOOTSTRAP.md"
MAX_RETRIES=3
SLEEP_BETWEEN_TASKS=30
SESSION_TIMEOUT=3600  # 60 min max per task session
OLLAMA_MODEL="qwen3.5-amd-simple"
OLLAMA_HOST="http://localhost:11434"

mkdir -p "$LOG_DIR"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" | tee -a "$LOG_DIR/daemon.log"; }

get_state() { jq -r "$1" "$STATE_FILE"; }

get_pending_task_index() {
  jq '.tasks | to_entries[] | select(.value.status == "PENDING") | .key' "$STATE_FILE" | head -1
}

advance_task() {
  local idx="$1" evidence="$2" risks="$3"
  local tmp; tmp=$(mktemp)
  jq --argjson idx "$idx" \
     --arg ev "$evidence" \
     --arg ri "$risks" \
     --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.tasks[$idx].status = "DONE" |
      .tasks[$idx].evidence = $ev |
      .tasks[$idx].risks = $ri |
      .tasks[$idx].completed_at = $ts |
      .last_session = $ts |
      .status = "READY"' \
     "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

mark_blocked() {
  local idx="$1" reason="$2"
  local tmp; tmp=$(mktemp)
  jq --argjson idx "$idx" --arg r "$reason" \
     '.tasks[$idx].status = "BLOCKED" | .blocked_by = $r | .status = "BLOCKED"' \
     "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

build_task_prompt() {
  local task_idx="$1"
  local task_id; task_id=$(jq -r ".tasks[$task_idx].id" "$STATE_FILE")
  local prompt_file; prompt_file=$(jq -r ".tasks[$task_idx].prompt_file" "$STATE_FILE")
  local full_prompt_path="$REPO_ROOT/$prompt_file"

  cat "$BOOTSTRAP"
  echo ""
  echo "---"
  echo "## Active Task: $task_id"
  echo ""
  cat "$full_prompt_path"
  echo ""
  echo "---"
  echo "## Mandatory Completion Signal"
  echo "When ALL exit criteria are met and verifications pass, output EXACTLY this line:"
  echo "LOOP_TASK_DONE: $task_id | EVIDENCE: <one-line verification summary> | RISKS: <risks or none>"
  echo ""
  echo "If blocked by a missing dependency or unresolvable issue, output EXACTLY:"
  echo "LOOP_TASK_BLOCKED: $task_id | REASON: <specific reason>"
  echo ""
  echo "Now begin. Execute the full task. Do not stop for confirmation."
}

ensure_ollama_ready() {
  # Start ollama serve if not already running
  if ! curl -s "$OLLAMA_HOST" > /dev/null 2>&1; then
    log "Ollama not running — starting ollama serve..."
    ollama serve > "$LOG_DIR/ollama-serve.log" 2>&1 &
    local wait=0
    while ! curl -s "$OLLAMA_HOST" > /dev/null 2>&1; do
      sleep 2; wait=$((wait+2))
      if [ $wait -gt 30 ]; then
        log "ERROR: Ollama failed to start after 30s. Check logs/loop/ollama-serve.log"
        exit 1
      fi
    done
    log "Ollama started."
  fi

  # Verify model is available
  if ! ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
    log "ERROR: Model '$OLLAMA_MODEL' not found."
    log "Run: ollama pull $OLLAMA_MODEL"
    exit 1
  fi

  log "Ollama ready — model: $OLLAMA_MODEL"
}

run_session() {
  local task_idx="$1"
  local task_id; task_id=$(jq -r ".tasks[$task_idx].id" "$STATE_FILE")
  local session_log="$LOG_DIR/session-${task_id}-$(date +%s).log"
  local prompt_tmp; prompt_tmp=$(mktemp /tmp/heynxt-prompt-XXXXX.md)

  log "Building prompt for: $task_id"
  build_task_prompt "$task_idx" > "$prompt_tmp"
  log "Prompt ready: $(wc -c < "$prompt_tmp") bytes"

  # ── KEY: use ollama launch claude with local model via env vars ──────────────
  # ollama launch claude sets up Claude Code CLI to talk to Ollama as backend.
  # We pass the task prompt via --print mode (non-interactive, single-shot).
  # ANTHROPIC_BASE_URL points Claude Code at local Ollama Anthropic-compatible API.
  # ANTHROPIC_AUTH_TOKEN=ollama is the required dummy token for local use.
  log "Launching: ollama launch claude --model $OLLAMA_MODEL (non-interactive)"

  local exit_code=0
  ANTHROPIC_BASE_URL="$OLLAMA_HOST" \
  ANTHROPIC_AUTH_TOKEN="ollama" \
  timeout "$SESSION_TIMEOUT" \
    claude \
      --print \
      --dangerously-skip-permissions \
      --model "$OLLAMA_MODEL" \
      < "$prompt_tmp" \
    2>&1 | tee "$session_log" || exit_code=$?

  rm -f "$prompt_tmp"

  local line_count; line_count=$(wc -l < "$session_log")
  log "Session done. Exit: $exit_code | Lines: $line_count"
  log "Last 5 lines:"
  tail -5 "$session_log" | tee -a "$LOG_DIR/daemon.log"

  if [ $exit_code -eq 124 ]; then
    log "WARNING: Session timed out for $task_id after ${SESSION_TIMEOUT}s"
    return 1
  fi

  # Parse completion signal
  local done_line; done_line=$(grep "^LOOP_TASK_DONE:" "$session_log" || true)
  local blocked_line; blocked_line=$(grep "^LOOP_TASK_BLOCKED:" "$session_log" || true)

  if [ -n "$done_line" ]; then
    local evidence; evidence=$(echo "$done_line" | sed 's/.*EVIDENCE: //' | sed 's/ | RISKS:.*//')
    local risks; risks=$(echo "$done_line" | sed 's/.*RISKS: //')
    advance_task "$task_idx" "$evidence" "$risks"
    log "✓ Task $task_id DONE. Evidence: $evidence"
    git_commit_push "$task_id"
    return 0
  elif [ -n "$blocked_line" ]; then
    local reason; reason=$(echo "$blocked_line" | sed 's/.*REASON: //')
    mark_blocked "$task_idx" "$reason"
    log "✗ Task $task_id BLOCKED: $reason"
    return 2
  else
    log "WARNING: No completion signal found for $task_id"
    return 1
  fi
}

git_commit_push() {
  local task_id="$1"
  cd "$REPO_ROOT"
  git add -A
  git diff --cached --quiet && { log "No new changes to commit for $task_id"; return 0; }
  git commit -m "loop: $task_id complete [auto]"
  git push origin HEAD
  log "Pushed: $task_id"
}

check_all_done() {
  local pending; pending=$(jq '[.tasks[] | select(.status == "PENDING")] | length' "$STATE_FILE")
  local blocked; blocked=$(jq '[.tasks[] | select(.status == "BLOCKED")] | length' "$STATE_FILE")
  [ "$pending" -eq 0 ] && [ "$blocked" -eq 0 ]
}

print_status() {
  local done_c pending_c blocked_c total
  done_c=$(jq '[.tasks[] | select(.status=="DONE")] | length' "$STATE_FILE")
  pending_c=$(jq '[.tasks[] | select(.status=="PENDING")] | length' "$STATE_FILE")
  blocked_c=$(jq '[.tasks[] | select(.status=="BLOCKED")] | length' "$STATE_FILE")
  total=$(jq '.tasks | length' "$STATE_FILE")
  log "Progress → DONE: $done_c | PENDING: $pending_c | BLOCKED: $blocked_c | TOTAL: $total"
}

# ── MAIN LOOP ──────────────────────────────────────────────────────────────────
log "========================================================="
log " HeyNXT Autonomous Loop Daemon"
log " Backend: ollama launch claude → $OLLAMA_MODEL"
log " Repo:    $REPO_ROOT"
log "========================================================="

# One-time setup: configure ollama launch claude to use local model
# This sets ANTHROPIC_BASE_URL + ANTHROPIC_AUTH_TOKEN for all child processes
export ANTHROPIC_BASE_URL="$OLLAMA_HOST"
export ANTHROPIC_AUTH_TOKEN="ollama"

ensure_ollama_ready

while true; do
  cd "$REPO_ROOT"
  git pull --rebase origin HEAD 2>/dev/null || true

  print_status

  if check_all_done; then
    log "ALL TASKS COMPLETE — Production app delivered."
    exit 0
  fi

  current_status=$(get_state '.status')
  if [ "$current_status" = "BLOCKED" ]; then
    log "Loop BLOCKED — fix LOOP_STATE.json then set status=READY to resume."
    sleep 300
    continue
  fi

  task_idx=$(get_pending_task_index)
  if [ -z "$task_idx" ]; then
    log "No PENDING tasks found but not all DONE — check LOOP_STATE.json. Sleeping 60s."
    sleep 60
    continue
  fi

  retries=0
  success=false
  rc=0
  while [ $retries -lt $MAX_RETRIES ]; do
    run_session "$task_idx" && { success=true; break; } || rc=$?
    if [ "$rc" -eq 2 ]; then
      break  # BLOCKED — don't retry
    fi
    retries=$((retries + 1))
    log "Retry $retries/$MAX_RETRIES — sleeping 60s"
    sleep 60
  done

  if ! $success; then
    task_id=$(jq -r ".tasks[$task_idx].id" "$STATE_FILE")
    if [ "$(jq -r ".tasks[$task_idx].status" "$STATE_FILE")" != "BLOCKED" ]; then
      mark_blocked "$task_idx" "Failed after $MAX_RETRIES retries — check session log"
      log "Task $task_id BLOCKED after $MAX_RETRIES failures"
    fi
  fi

  log "Sleeping ${SLEEP_BETWEEN_TASKS}s..."
  sleep "$SLEEP_BETWEEN_TASKS"
done
