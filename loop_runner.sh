#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="$REPO_ROOT/LOOP_STATE.json"
LOG_DIR="$REPO_ROOT/logs/loop"
BOOTSTRAP="$REPO_ROOT/.claude/LOOP_BOOTSTRAP.md"
MAX_RETRIES=3
SLEEP_BETWEEN_TASKS=30
OLLAMA_TIMEOUT=3600  # 60 min max per session (local LLM is slower)
OLLAMA_MODEL="qwen3.5-amd-simple"

mkdir -p "$LOG_DIR"

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*" | tee -a "$LOG_DIR/daemon.log"; }

get_state() { jq -r "$1" "$STATE_FILE"; }

set_state() {
  local tmp; tmp=$(mktemp)
  jq "$1" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

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

build_session_prompt() {
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
  echo "When this task is 100% complete (all exit criteria met, verifications passed), output EXACTLY this line (no extra text on that line):"
  echo "LOOP_TASK_DONE: $task_id | EVIDENCE: <one-line summary> | RISKS: <risks or none>"
  echo ""
  echo "If you cannot complete due to missing info or a blocker, output EXACTLY:"
  echo "LOOP_TASK_BLOCKED: $task_id | REASON: <specific reason>"
  echo ""
  echo "Now begin. Do not ask for confirmation. Execute the full task completely."
}

ensure_ollama_running() {
  if ! pgrep -x ollama > /dev/null 2>&1; then
    log "Ollama not running — starting ollama serve in background..."
    ollama serve > "$LOG_DIR/ollama-serve.log" 2>&1 &
    sleep 5
  fi

  # Verify the model is available
  if ! ollama list 2>/dev/null | grep -q "$OLLAMA_MODEL"; then
    log "ERROR: Model '$OLLAMA_MODEL' not found in ollama list. Pull it first:"
    log "  ollama pull $OLLAMA_MODEL"
    exit 1
  fi

  log "Ollama ready. Model: $OLLAMA_MODEL"
}

run_ollama_prompt() {
  local prompt_text="$1"
  local session_log="$2"

  # Feed prompt via stdin to ollama run — non-interactive single-shot mode
  echo "$prompt_text" | timeout "$OLLAMA_TIMEOUT" \
    ollama run "$OLLAMA_MODEL" \
    --nowordwrap \
    2>&1 | tee "$session_log"
}

run_session() {
  local task_idx="$1"
  local task_id; task_id=$(jq -r ".tasks[$task_idx].id" "$STATE_FILE")
  local session_log="$LOG_DIR/session-${task_id}-$(date +%s).log"
  local prompt_tmp; prompt_tmp=$(mktemp /tmp/heynxt-prompt-XXXXX.txt)

  log "Building prompt for task: $task_id"
  build_session_prompt "$task_idx" > "$prompt_tmp"
  local prompt_size; prompt_size=$(wc -c < "$prompt_tmp")
  log "Prompt size: ${prompt_size} bytes"

  log "Launching ollama ($OLLAMA_MODEL) for task: $task_id"
  local exit_code=0
  local prompt_text; prompt_text=$(cat "$prompt_tmp")
  rm -f "$prompt_tmp"

  run_ollama_prompt "$prompt_text" "$session_log" || exit_code=$?

  local line_count; line_count=$(wc -l < "$session_log")
  log "Session finished. Exit code: $exit_code | Lines: $line_count"

  if [ $exit_code -eq 124 ]; then
    log "WARNING: Session timed out for $task_id after ${OLLAMA_TIMEOUT}s — will retry"
    return 1
  fi

  # Parse completion signal
  local done_line; done_line=$(grep "^LOOP_TASK_DONE:" "$session_log" || true)
  local blocked_line; blocked_line=$(grep "^LOOP_TASK_BLOCKED:" "$session_log" || true)

  if [ -n "$done_line" ]; then
    local evidence; evidence=$(echo "$done_line" | sed 's/.*EVIDENCE: //' | sed 's/ | RISKS:.*//')
    local risks; risks=$(echo "$done_line" | sed 's/.*RISKS: //')
    advance_task "$task_idx" "$evidence" "$risks"
    log "Task $task_id DONE. Evidence: $evidence"
    git_commit_push "$task_id"
    return 0
  elif [ -n "$blocked_line" ]; then
    local reason; reason=$(echo "$blocked_line" | sed 's/.*REASON: //')
    mark_blocked "$task_idx" "$reason"
    log "Task $task_id BLOCKED: $reason"
    return 2
  else
    log "WARNING: No completion signal found for $task_id"
    log "Last 10 lines of session output:"
    tail -10 "$session_log" | tee -a "$LOG_DIR/daemon.log"
    return 1
  fi
}

git_commit_push() {
  local task_id="$1"
  cd "$REPO_ROOT"
  git add -A
  git diff --cached --quiet && { log "No changes to commit for $task_id"; return 0; }
  git commit -m "loop: $task_id complete [auto]"
  git push origin HEAD
  log "Pushed commit for $task_id"
}

check_all_done() {
  local pending; pending=$(jq '[.tasks[] | select(.status == "PENDING")] | length' "$STATE_FILE")
  local blocked; blocked=$(jq '[.tasks[] | select(.status == "BLOCKED")] | length' "$STATE_FILE")
  [ "$pending" -eq 0 ] && [ "$blocked" -eq 0 ]
}

print_status() {
  local done_count; done_count=$(jq '[.tasks[] | select(.status == "DONE")] | length' "$STATE_FILE")
  local pending_count; pending_count=$(jq '[.tasks[] | select(.status == "PENDING")] | length' "$STATE_FILE")
  local blocked_count; blocked_count=$(jq '[.tasks[] | select(.status == "BLOCKED")] | length' "$STATE_FILE")
  local total; total=$(jq '.tasks | length' "$STATE_FILE")
  log "Status → DONE: $done_count | PENDING: $pending_count | BLOCKED: $blocked_count | TOTAL: $total"
}

# ── MAIN LOOP ──────────────────────────────────────────────────────────────────
log "======================================================"
log "HeyNXT autonomous loop daemon started"
log "Model: $OLLAMA_MODEL"
log "Repo:  $REPO_ROOT"
log "======================================================"

# Ensure ollama is running and model is available before starting loop
ensure_ollama_running

while true; do
  cd "$REPO_ROOT"
  git pull --rebase origin HEAD 2>/dev/null || true

  print_status

  if check_all_done; then
    log "ALL TASKS COMPLETE. Production build delivered. Loop exiting."
    exit 0
  fi

  current_status=$(get_state '.status')
  if [ "$current_status" = "BLOCKED" ]; then
    log "Loop BLOCKED. Inspect LOOP_STATE.json, fix the blocker, then set status=READY."
    log "Sleeping 5 min then rechecking..."
    sleep 300
    continue
  fi

  task_idx=$(get_pending_task_index)
  if [ -z "$task_idx" ]; then
    log "No PENDING tasks but not all DONE — check LOOP_STATE.json. Sleeping 60s..."
    sleep 60
    continue
  fi

  retries=0
  success=false
  while [ $retries -lt $MAX_RETRIES ]; do
    run_session "$task_idx" && { success=true; break; } || rc=$?
    if [ "${rc:-0}" -eq 2 ]; then
      # BLOCKED — don't retry
      break
    fi
    retries=$((retries + 1))
    log "Retry $retries/$MAX_RETRIES for task index $task_idx — sleeping 60s"
    sleep 60
  done

  if ! $success; then
    task_id=$(jq -r ".tasks[$task_idx].id" "$STATE_FILE")
    if [ "$(jq -r ".tasks[$task_idx].status" "$STATE_FILE")" != "BLOCKED" ]; then
      mark_blocked "$task_idx" "Failed after $MAX_RETRIES retries — check session log"
      log "Task $task_id marked BLOCKED after $MAX_RETRIES failures"
    fi
  fi

  log "Sleeping ${SLEEP_BETWEEN_TASKS}s before next task..."
  sleep "$SLEEP_BETWEEN_TASKS"
done
