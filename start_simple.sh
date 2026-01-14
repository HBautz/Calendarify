#!/bin/bash
# Simple dev runner with auto-restart on CODE file changes after calm period.

set -euo pipefail
set +m   # Disable job-control termination messages

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=3001
FRONTEND_PORT=3000
CALM_SECONDS=10
CHECK_INTERVAL=2

BACKEND_PID=""
FRONTEND_PID=""

CODE_EXTENSIONS_REGEX='\.(sh|js|jsx|ts|tsx|json|html|css|scss|md|yml|yaml)$'

log() {
  echo "[$(date '+%H:%M:%S')] $*"
}

cleanup() {
  log "🧹 Cleaning up..."
  pkill -f "npm run start:dev" 2>/dev/null || true
  pkill -f "node server.js" 2>/dev/null || true
  lsof -ti:${BACKEND_PORT},${FRONTEND_PORT} | xargs kill -9 2>/dev/null || true
  log "✅ Cleanup completed"
}
trap cleanup EXIT INT TERM

ensure_ports_free() {
  for p in $BACKEND_PORT $FRONTEND_PORT; do
    if lsof -i:$p >/dev/null 2>&1; then
      log "❌ Port $p is in use"
      exit 1
    fi
  done
  log "✅ Ports are free"
}

wait_for_health() {
  for i in {1..60}; do
    if curl -s "http://localhost:${BACKEND_PORT}/api" >/dev/null 2>&1; then
      log "✅ Backend ready on ${BACKEND_PORT}"
      break
    fi
    sleep 1
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      log "❌ Backend died"
      tail -20 "$ROOT_DIR/backend.log"
      exit 1
    fi
    if [ "$i" -eq 60 ]; then
      log "❌ Backend not ready"
      tail -50 "$ROOT_DIR/backend.log"
      exit 1
    fi
  done

  for i in {1..30}; do
    if curl -s "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
      log "✅ Frontend ready on ${FRONTEND_PORT}"
      break
    fi
    sleep 1
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      log "❌ Frontend died"
      tail -20 "$ROOT_DIR/frontend.log"
      exit 1
    fi
    if [ "$i" -eq 30 ]; then
      log "❌ Frontend not ready"
      tail -50 "$ROOT_DIR/frontend.log"
      exit 1
    fi
  done
}

hash_code_tree() {
  if command -v git >/dev/null 2>&1 && [ -d "$ROOT_DIR/.git" ]; then
    (
      cd "$ROOT_DIR"
      git ls-files \
        | grep -E "$CODE_EXTENSIONS_REGEX" || true
    ) \
    | LC_ALL=C sort \
    | xargs sha1sum 2>/dev/null || true \
    | sha1sum \
    | cut -d' ' -f1
  else
    find "$ROOT_DIR" \
      \( -path "*/node_modules/*" \
         -o -path "*/.git/*" \
         -o -path "*/.next/*" \
         -o -path "*/dist/*" \
         -o -path "*/build/*" \
         -o -path "*/coverage/*" \
         -o -path "*/logs/*" \
         -o -name "*.log" \
         -o -name "*.tmp" \
      \) -prune -o \
      -type f \
      | grep -E "$CODE_EXTENSIONS_REGEX" || true \
      | LC_ALL=C sort \
      | xargs sha1sum 2>/dev/null || true \
      | sha1sum \
      | cut -d' ' -f1
  fi
}

start_services() {
  pre_start_hash=$(hash_code_tree)

  log "🚀 Starting backend..."
  (cd "$ROOT_DIR/backend" && npm run start:dev > "$ROOT_DIR/backend.log" 2>&1) &
  BACKEND_PID=$!

  log "🚀 Starting frontend..."
  (cd "$ROOT_DIR" && node server.js > "$ROOT_DIR/frontend.log" 2>&1) &
  FRONTEND_PID=$!

  wait_for_health

  post_start_hash=$(hash_code_tree)
  if [ "$pre_start_hash" != "$post_start_hash" ]; then
    log "📌 Code changed during startup; scheduling restart after calm."
    last_hash="$post_start_hash"
    last_change_ts=$(date +%s)
    change_pending=true
  fi
}

restart_services() {
  log "🔄 Restarting services after calm period..."
  cleanup
  ensure_ports_free
  start_services
}

log "🚀 Starting Calendarify dev runner (code-only watcher, ${CALM_SECONDS}s calm)..."
cleanup
ensure_ports_free
start_services

last_hash=$(hash_code_tree)
last_change_ts=0
change_pending=false

log "👀 Watching for *code* file changes only..."

while true; do
  sleep "$CHECK_INTERVAL"

  new_hash=$(hash_code_tree)

  if [ "$new_hash" != "$last_hash" ]; then
    last_hash="$new_hash"
    last_change_ts=$(date +%s)
    change_pending=true
    log "📌 Code change detected, waiting for calm..."
    continue
  fi

  if $change_pending; then
    now=$(date +%s)
    if (( now - last_change_ts >= CALM_SECONDS )); then
      restart_services
      last_hash=$(hash_code_tree)
      last_change_ts=0
      change_pending=false
      log "✅ Restart complete; resuming watch."
    fi
  fi
done
