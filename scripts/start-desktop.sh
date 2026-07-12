#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[信息]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[成功]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
  echo -e "${RED}[错误]${NC} $1"
}

check_linux_desktop_prerequisites() {
  if [ "$(uname -s)" != "Linux" ]; then
    return 0
  fi

  local missing_packages=()

  if ! command -v pkg-config &> /dev/null; then
    log_error "未找到 pkg-config，Linux 桌面壳需要它来探测 Tauri 原生依赖。"
    log_info "Ubuntu / Debian 可执行：sudo apt install -y pkg-config libdbus-1-dev libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev"
    log_info "Fedora 可执行：sudo dnf install -y pkgconf-pkg-config dbus-devel"
    log_info "Arch 可执行：sudo pacman -S pkgconf dbus"
    exit 1
  fi

  if ! pkg-config --exists dbus-1; then
    missing_packages+=("dbus-1")
  fi

  if ! pkg-config --exists javascriptcoregtk-4.1; then
    missing_packages+=("javascriptcoregtk-4.1")
  fi

  if ! pkg-config --exists webkit2gtk-4.1; then
    missing_packages+=("webkit2gtk-4.1")
  fi

  if [ ${#missing_packages[@]} -gt 0 ]; then
    log_error "未检测到以下 Linux 桌面开发库：${missing_packages[*]}"
    log_info "Ubuntu / Debian 可执行：sudo apt install -y libdbus-1-dev libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev pkg-config"
    log_info "Fedora 可执行：sudo dnf install -y dbus-devel pkgconf-pkg-config webkit2gtk4.1-devel javascriptcoregtk4.1-devel"
    log_info "Arch 可执行：sudo pacman -S dbus pkgconf webkit2gtk-4.1"
    log_info "安装完成后可执行：pkg-config --modversion dbus-1 javascriptcoregtk-4.1 webkit2gtk-4.1"
    exit 1
  fi
}

check_desktop_dev_port() {
  local port="5888"

  if ! command -v lsof &> /dev/null; then
    return 0
  fi

  if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    local pid
    pid="$(lsof -Pi :"$port" -sTCP:LISTEN -t | head -n 1)"
    log_error "端口 ${port} 已被占用，Tauri 桌面开发模式要求 Web 前端固定监听该端口。"
    log_info "请先停止占用进程后重试。占用 PID：${pid}"
    log_info "可执行：lsof -i :${port}"
    exit 1
  fi
}

kill_listening_port() {
  local port="$1"

  if ! command -v lsof &> /dev/null; then
    log_warn "未找到 lsof，无法自动清理端口 ${port}"
    return 0
  fi

  local pids=()
  mapfile -t pids < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)

  if [ ${#pids[@]} -eq 0 ]; then
    return 0
  fi

  log_warn "端口 ${port} 已被占用，正在自动清理..."
  log_info "占用 PID：${pids[*]}"

  for pid in "${pids[@]}"; do
    kill "$pid" >/dev/null 2>&1 || true
  done

  sleep 1

  for pid in "${pids[@]}"; do
    if ps -p "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done

  log_success "端口 ${port} 清理完成"
}

prompt_yes_no() {
  local question="$1"
  local answer

  if [ ! -t 0 ]; then
    return 1
  fi

  read -r -p "$question [y/N] " answer
  case "$answer" in
    y|Y|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

install_rust() {
  log_info "开始安装 Rust（rustup）..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"

  if command -v cargo &> /dev/null; then
    log_success "Rust 安装完成：$(cargo --version)"
    return 0
  fi

  log_error "Rust 安装后仍未找到 cargo，请手动执行：source \"$HOME/.cargo/env\""
  return 1
}

show_help() {
  cat <<'EOF'
clawkit 桌面一键启动脚本

用法：
  ./scripts/start-desktop.sh [选项]

选项：
  --skip-install        跳过 pnpm install
  --build               启动前执行一次完整构建
  --start-project       启动项目管理页（controller + web）
  --desktop-only        只启动桌面壳，不启动项目管理页
  -h, --help            显示此帮助信息

说明：
  - 默认会执行：环境检查 → 安装依赖 → 启动桌面壳
  - 如果加了 --build，会在启动前执行一次完整构建
  - 如果加了 --start-project，会先启动项目管理页，再启动桌面壳
  - 桌面壳采用 Tauri，加载 packages/web
  - 该脚本适合本地开发和桌面联调，不适合生产服务器部署
  - 如果未安装 Rust，脚本会尝试自动安装 rustup；如需禁止可设置 CLAWKIT_SKIP_RUST_INSTALL=true

示例：
  ./scripts/start-desktop.sh
  ./scripts/start-desktop.sh --start-project
  ./scripts/start-desktop.sh --skip-install --skip-build --desktop-only

EOF
}

INSTALL_DEPS=true
BUILD_PROJECT=false
START_PROJECT=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-install)
      INSTALL_DEPS=false
      shift
      ;;
    --build)
      BUILD_PROJECT=true
      shift
      ;;
    --start-project)
      START_PROJECT=true
      shift
      ;;
    --desktop-only)
      START_PROJECT=false
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "未知参数：$1"
      show_help
      exit 1
      ;;
  esac
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}clawkit 桌面一键启动${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  log_error "当前目录不是项目根目录，请在仓库根目录执行此脚本"
  exit 1
fi

if ! command -v node &> /dev/null; then
  log_error "未找到 Node.js，请先安装 Node.js >= 20.0.0"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  log_error "未找到 pnpm，请先安装 pnpm >= 8.0.0"
  exit 1
fi

if [ "$INSTALL_DEPS" = true ]; then
  log_info "安装依赖..."
  pnpm install
  log_success "依赖安装完成"
else
  log_warn "跳过依赖安装"
fi

if [ "$BUILD_PROJECT" = true ]; then
  log_info "构建项目..."
  pnpm build
  log_success "项目构建完成"
else
  log_info "跳过项目构建（默认不构建，如需构建请加 --build）"
fi

kill_listening_port "5888"

if [ "$START_PROJECT" = true ]; then
  if [ -z "${OPENCLAW_WEBHOOK_TOKEN:-}" ]; then
    log_warn "未设置 OPENCLAW_WEBHOOK_TOKEN，项目管理页可能无法完整启动"
  fi

  log_info "启动项目管理页..."
  PROJECT_MANAGER_WEB_PORT="${CLAWKIT_PROJECT_MANAGER_WEB_PORT:-5889}"
  VITE_PORT="$PROJECT_MANAGER_WEB_PORT" bash "$PROJECT_ROOT/scripts/start-project-manager.sh" &
  PROJECT_PID=$!
  log_success "项目管理页启动已触发 (PID: $PROJECT_PID, Web 端口: $PROJECT_MANAGER_WEB_PORT)"
  echo ""
fi

if [ -f "$HOME/.cargo/env" ]; then
  # rustup 默认把 cargo 放在 ~/.cargo/bin，这里自动加载，避免要求用户手动 source
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
fi

check_linux_desktop_prerequisites
check_desktop_dev_port

log_info "启动桌面应用..."
if ! command -v cargo &> /dev/null; then
  if [ "${CLAWKIT_SKIP_RUST_INSTALL:-false}" = "true" ]; then
    log_error "未找到 cargo，且已设置 CLAWKIT_SKIP_RUST_INSTALL=true，跳过自动安装。"
    log_info "你可以手动安装："
    log_info "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    log_info "  source \"$HOME/.cargo/env\""
    log_info "  cargo --version"
    exit 1
  fi

  if ! command -v curl &> /dev/null; then
    log_error "未找到 cargo，同时也未找到 curl，无法自动安装 Rust。请先安装 curl 后重试。"
    exit 1
  fi

  if [ -t 0 ]; then
    log_warn "未找到 cargo，桌面壳需要 Rust 环境。"
    if prompt_yes_no "是否现在自动安装 Rust？"; then
      install_rust
    else
      log_info "你也可以手动安装："
      log_info "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
      log_info "  source \"$HOME/.cargo/env\""
      log_info "  cargo --version"
      exit 1
    fi
  else
    log_warn "未找到 cargo，当前为非交互环境，自动安装 Rust..."
    install_rust
  fi
fi

pnpm --filter @clawkit/desktop dev
