#!/bin/bash
# FastAPI 应用启动脚本

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

source "$PROJECT_ROOT/deploy/app_config.sh"

LOG_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOG_DIR/uvicorn.pid"

mkdir -p "$LOG_DIR"

resolve_python() {
  if [ -n "$APP_PYTHON" ] && [ -x "$APP_PYTHON" ]; then
    return 0
  fi

  if [ -n "$APP_CONDA_ENV" ] && [ -f "$CONDA_SH" ]; then
    # shellcheck disable=SC1090
    source "$CONDA_SH"
    conda activate "$APP_CONDA_ENV" >/dev/null 2>&1 || {
      echo "Failed to activate conda env: $APP_CONDA_ENV"
      exit 1
    }
    APP_PYTHON="$(command -v python)"
    export APP_PYTHON
    return 0
  fi

  APP_PYTHON="$(command -v python3 || command -v python || true)"
  export APP_PYTHON
  if [ -z "$APP_PYTHON" ]; then
    echo "No python interpreter found."
    exit 1
  fi
}

find_port_listener_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u
    return 0
  fi

  ss -ltnp 2>/dev/null \
    | awk -v port=":$port" '$4 ~ port { print $NF }' \
    | grep -oE 'pid=[0-9]+' \
    | cut -d= -f2 \
    | sort -u
}

wait_for_port_listener() {
  local port="$1"
  local attempts="${2:-20}"
  for _ in $(seq 1 "$attempts"); do
    if [ -n "$(find_port_listener_pids "$port" || true)" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# 启动前先做一次清理，避免残留 worker 占住端口。
"$PROJECT_ROOT/deploy/stop.sh" >/dev/null 2>&1 || true
sleep 1

existing_pids="$(find_port_listener_pids "$APP_PORT" || true)"
if [ -n "$existing_pids" ]; then
  echo "Port $APP_PORT is still occupied. Refusing to start."
  echo "$existing_pids" | sed 's/^/LISTEN_PID: /'
  exit 1
fi

resolve_python

start_cmd=("$APP_PYTHON" -m uvicorn fastapi_app.main:app --workers "$APP_WORKERS" --port "$APP_PORT" --log-level info)

# 使用 setsid + nohup 彻底脱离当前 shell，避免多 worker 被会话一起带走。
if command -v setsid >/dev/null 2>&1; then
  nohup setsid "${start_cmd[@]}" >> "$LOG_DIR/app.log" 2>&1 < /dev/null &
else
  nohup "${start_cmd[@]}" >> "$LOG_DIR/app.log" 2>&1 < /dev/null &
fi

echo $! > "$PID_FILE"
disown 2>/dev/null || true

if wait_for_port_listener "$APP_PORT" 20; then
  echo "FastAPI app started with PID: $(cat "$PID_FILE")"
  exit 0
fi

echo "FastAPI app failed to start. Check $LOG_DIR/app.log"
exit 1
