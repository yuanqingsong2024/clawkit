# 局域网部署检查清单

1. 确认 Controller 机器 IP。
2. 确认 Controller 监听 `0.0.0.0` 或局域网可达地址。
3. 确认端口已开放。
4. 确认防火墙未阻断。
5. 在 SoloForge Office OS 机器上执行 `curl /health`。
6. 确认 `tokenEnv` 配置为 `CLAWKIT_CONTROLLER_TOKEN`。
7. 确认 `GET /workers` 可以返回列表。
8. 确认 Worker 是 sandbox/test Worker。
9. 确认 dry-run 不会真实执行。
10. 确认 dispatch 只允许 sandbox worker。
