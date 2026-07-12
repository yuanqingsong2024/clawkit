# clawkit 桌面包

这是 clawkit 的桌面宿主层，负责把现有 Web Console 包装成桌面应用，并提供本机受控能力。

## 首版职责

- 加载 `packages/web`
- 提供 OpenCode 启动能力
- 提供 OpenCode 日志读取能力
- 提供项目管理脚本启动能力

## 注意事项

- 不暴露任意 shell 执行能力
- 只允许白名单动作
- 所有本机操作都应复用仓库内已有脚本

## Linux 运行依赖

桌面应用在 Linux 下需要系统级开发库才能编译 Tauri 相关原生依赖。若启动 `pnpm --filter @clawkit/desktop dev` 或 `pnpm desktop:start` 时出现 `libdbus-sys`、`dbus-1.pc`、`javascriptcoregtk-4.1.pc` 或 `webkit2gtk-4.1.pc` 找不到的错误，请先安装下面依赖：

- Ubuntu / Debian：`sudo apt install -y libdbus-1-dev libjavascriptcoregtk-4.1-dev libwebkit2gtk-4.1-dev pkg-config`
- Fedora：`sudo dnf install -y dbus-devel pkgconf-pkg-config webkit2gtk4.1-devel javascriptcoregtk4.1-devel`
- Arch：`sudo pacman -S dbus pkgconf webkit2gtk-4.1`

如果已经安装过这些包，但仍然报错，请确认 `pkg-config` 能找到 `dbus-1.pc`、`javascriptcoregtk-4.1.pc` 和 `webkit2gtk-4.1.pc`，并检查 `PKG_CONFIG_PATH` 是否被错误覆盖。

另外，桌面开发模式固定使用 `127.0.0.1:5888` 作为前端地址；如果该端口被其他进程占用，启动脚本会直接报错，请先释放端口后再重试。
