#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTROLLER_PID_FILE="$PROJECT_ROOT/.clawkit/project-manager-controller.pid"
WEB_PID_FILE="$PROJECT_ROOT/.clawkit/project-manager-web.pid"

stop_by_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    echo "$name：未找到 PID 文件"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    rm -f "$pid_file"
    echo "$name：PID 为空，已清理"
    return 0
  fi

  if ps -p "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
    if ps -p "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
    echo "$name：已停止 (PID: $pid)"
  else
    echo "$name：进程不存在，已清理 PID 文件"
  fi

  rm -f "$pid_file"
}

echo "=========================================="
echo "停止 clawkit 项目管理页"
echo "=========================================="

stop_by_pid_file "Web" "$WEB_PID_FILE"
stop_by_pid_file "Controller" "$CONTROLLER_PID_FILE"

echo ""
echo "完成"
