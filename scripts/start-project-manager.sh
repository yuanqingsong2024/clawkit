#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CONTROLLER_PID_FILE="$PROJECT_ROOT/.clawkit/project-manager-controller.pid"
WEB_PID_FILE="$PROJECT_ROOT/.clawkit/project-manager-web.pid"
CONTROLLER_LOG_FILE="$PROJECT_ROOT/.clawkit/project-manager-controller.log"
WEB_LOG_FILE="$PROJECT_ROOT/.clawkit/project-manager-web.log"
RUNTIME_MANIFEST_FILE="$PROJECT_ROOT/.clawkit/runtime-simple.yaml"

mkdir -p "$PROJECT_ROOT/.clawkit"

log() {
  printf '%s\n' "$1"
}

check_command() {
  local command_name="$1"
  local hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    log "错误：未找到 $command_name"
    log "$hint"
    exit 1
  fi
}

write_pid() {
  local pid_file="$1"
  local pid="$2"
  printf '%s\n' "$pid" > "$pid_file"
}

is_running() {
  local pid_file="$1"

  if [ ! -f "$pid_file" ]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [ -z "$pid" ]; then
    return 1
  fi

  ps -p "$pid" >/dev/null 2>&1
}

stop_if_running() {
  local name="$1"
  local pid_file="$2"

  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file")"
  log "停止已有的 $name 进程 (PID: $pid)"
  kill "$pid" >/dev/null 2>&1 || true
  sleep 1
  if ps -p "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
}

generate_runtime_manifest() {
  local source_manifest="$1"

  node - "$source_manifest" "$RUNTIME_MANIFEST_FILE" <<'NODE'
const fs = require('node:fs');
const yaml = require('yaml');

const sourcePath = process.argv[2];
const targetPath = process.argv[3];
const content = fs.readFileSync(sourcePath, 'utf8');
const data = yaml.parse(content);

const projects = Array.isArray(data?.projects) ? data.projects.map((project) => ({
  key: String(project.key ?? ''),
  path: String(project.path ?? ''),
  baseBranch: String(project.baseBranch ?? 'main'),
  autoExecute: Boolean(project.autoExecute ?? false),
  dangerousOps: Array.isArray(project.dangerousOps) ? project.dangerousOps.map((item) => String(item)) : [],
  openCodePort: Number(project.openCodePort ?? 4096),
})) : [];

const openClaw = data?.openClaw && typeof data.openClaw === 'object'
  ? {
      url: data.openClaw.url,
      webhookToken: String(data.openClaw.webhookToken ?? 'replace-me'),
    }
  : { webhookToken: 'replace-me' };

const runtimeManifest = {
  version: String(data?.version ?? '2.0'),
  projects,
  openClaw,
};

fs.writeFileSync(targetPath, yaml.stringify(runtimeManifest, { indent: 2 }), 'utf8');
NODE
}

sync_controller_config() {
  local manifest_path="$1"

  mkdir -p "$PROJECT_ROOT/data"
  cat > "$PROJECT_ROOT/data/controller-config.json" <<EOF
{
  "manifestPath": "${manifest_path}"
}
EOF
}

wait_until_healthy() {
  local url="$1"
  local name="$2"
  local retries=30

  while [ "$retries" -gt 0 ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    retries=$((retries - 1))
  done

  log "错误：$name 启动后未能在预期时间内就绪"
  return 1
}

resolve_web_port() {
  local requested_port="$1"

  node - "$requested_port" <<'NODE'
const net = require('node:net');

const startPort = Number(process.argv[2] || 5888);
const maxAttempts = 20;

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true));
    });
  });
}

(async () => {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await checkPort(port)) {
      process.stdout.write(String(port));
      return;
    }
  }

  process.stderr.write(`错误：无法找到可用的项目管理页端口，起始端口 ${startPort}，已尝试 ${maxAttempts} 个端口\n`);
  process.exit(1);
})();
NODE
}

log "=========================================="
log "启动 clawkit 项目管理页"
log "=========================================="

check_command node "请先安装 Node.js 20+"
check_command corepack "当前环境缺少 corepack，无法使用 pnpm"
check_command curl "请先安装 curl，用于健康检查"

cd "$PROJECT_ROOT"

export PNPM="corepack pnpm"
export CLAWKIT_MANIFEST_PATH="${CLAWKIT_MANIFEST_PATH:-$PROJECT_ROOT/examples/simple.yaml}"
export CLAWKIT_MANIFEST_PATH="$(node -e "console.log(require('node:path').resolve(process.argv[1]))" "$CLAWKIT_MANIFEST_PATH")"
export CONTROLLER_ENABLE_PERSISTENCE="${CONTROLLER_ENABLE_PERSISTENCE:-false}"
export CONTROLLER_DB_PATH="${CONTROLLER_DB_PATH:-$PROJECT_ROOT/.clawkit/clawkit.db}"
export OPENCLAW_WEBHOOK_TOKEN="${OPENCLAW_WEBHOOK_TOKEN:-replace-me}"
export VITE_PORT="$(resolve_web_port "${VITE_PORT:-5888}")"

if ! command -v git >/dev/null 2>&1; then
  log "警告：未检测到 git，项目管理页中的 Git 功能将不可用"
fi

stop_if_running "Controller" "$CONTROLLER_PID_FILE"
stop_if_running "Web" "$WEB_PID_FILE"

log "构建 shared 和 controller 产物"
$PNPM --filter @clawkit/shared build

if ! (cd "$PROJECT_ROOT/packages/controller" && "$PROJECT_ROOT/node_modules/.bin/tsc" --pretty false --noEmitOnError false); then
  log "警告：controller 存在已知类型错误，但已尽量输出 dist，继续启动"
fi

mkdir -p "$PROJECT_ROOT/packages/controller/dist/persistence"
cp "$PROJECT_ROOT/packages/controller/src/persistence/init.sql" "$PROJECT_ROOT/packages/controller/dist/persistence/init.sql"

log "生成 controller 可读取的简化 manifest"
generate_runtime_manifest "$CLAWKIT_MANIFEST_PATH"
export CLAWKIT_MANIFEST_PATH="$RUNTIME_MANIFEST_FILE"
sync_controller_config "$RUNTIME_MANIFEST_FILE"

log "启动 Controller..."
nohup env \
  CLAWKIT_MANIFEST_PATH="$CLAWKIT_MANIFEST_PATH" \
  CONTROLLER_ENABLE_PERSISTENCE="$CONTROLLER_ENABLE_PERSISTENCE" \
  CONTROLLER_DB_PATH="$CONTROLLER_DB_PATH" \
  OPENCLAW_WEBHOOK_TOKEN="$OPENCLAW_WEBHOOK_TOKEN" \
  node "$PROJECT_ROOT/packages/controller/dist/index.js" > "$CONTROLLER_LOG_FILE" 2>&1 &
CONTROLLER_PID=$!
write_pid "$CONTROLLER_PID_FILE" "$CONTROLLER_PID"

if ! wait_until_healthy "http://127.0.0.1:8787/api/health" "Controller"; then
  log "查看日志：tail -f $CONTROLLER_LOG_FILE"
  exit 1
fi

log "启动 Web Console..."
nohup env \
  VITE_PORT="$VITE_PORT" \
  API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8787}" \
  $PNPM --filter @clawkit/web dev --host 127.0.0.1 --port "$VITE_PORT" --strictPort > "$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!
write_pid "$WEB_PID_FILE" "$WEB_PID"

if ! wait_until_healthy "http://127.0.0.1:${VITE_PORT}" "Web Console"; then
  log "查看日志：tail -f $WEB_LOG_FILE"
  exit 1
fi

log ""
log "=========================================="
log "启动完成"
log "=========================================="
log "Web Console: http://127.0.0.1:${VITE_PORT}"
log "Controller  : http://127.0.0.1:8787"
log "Controller 日志: $CONTROLLER_LOG_FILE"
log "Web 日志      : $WEB_LOG_FILE"
log "停止命令      : bash $PROJECT_ROOT/scripts/stop-project-manager.sh"
