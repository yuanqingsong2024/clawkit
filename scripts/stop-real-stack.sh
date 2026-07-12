#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTROLLER_PID_FILE="$PROJECT_ROOT/.clawkit/controller.pid"
WORKER_PID_FILE="$PROJECT_ROOT/.clawkit/worker.pid"
OPENCODE_PID_FILE="$PROJECT_ROOT/.clawkit/opencode.pid"

stop_from_pid_file() {
  local name="$1"
  local pid_file="$2"

  if [ ! -f "$pid_file" ]; then
    echo "- $name: 未找到 PID 文件 ($pid_file)"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [ -z "$pid" ]; then
    echo "- $name: PID 文件为空，已清理"
    rm -f "$pid_file"
    return 0
  fi

  if ps -p "$pid" > /dev/null 2>&1; then
    kill "$pid" 2>/dev/null || true
    sleep 1
    if ps -p "$pid" > /dev/null 2>&1; then
      kill -9 "$pid" 2>/dev/null || true
    fi
    echo "- $name: 已停止 (PID: $pid)"
  else
    echo "- $name: 进程不存在 (PID: $pid)，已清理 PID 文件"
  fi

  rm -f "$pid_file"
}

echo "=========================================="
echo "停止 clawkit 真实执行全链路"
echo "=========================================="

stop_from_pid_file "Controller" "$CONTROLLER_PID_FILE"
stop_from_pid_file "Worker" "$WORKER_PID_FILE"
stop_from_pid_file "OpenCode" "$OPENCODE_PID_FILE"

echo ""
echo "✓ 停止流程完成"
