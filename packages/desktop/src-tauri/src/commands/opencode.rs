use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

fn repo_root() -> Result<PathBuf, String> {
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  manifest_dir
    .ancestors()
    .nth(3)
    .map(Path::to_path_buf)
    .ok_or_else(|| String::from("无法定位仓库根目录"))
}

fn parse_pid_file(path: &Path) -> Option<u32> {
  fs::read_to_string(path).ok()?.trim().parse::<u32>().ok()
}

fn is_port_open(port: u16) -> bool {
  let addr = SocketAddr::from(([127, 0, 0, 1], port));
  TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

fn summarize_output(output: &str) -> String {
  for line in output.lines().map(str::trim).filter(|line| !line.is_empty()) {
    if line.chars().all(|ch| ch == '=' || ch == '-' || ch == '─') {
      continue;
    }

    return line.to_string();
  }

  String::from("启动脚本没有返回可读信息")
}

fn opencode_password_config_path(root: &Path) -> PathBuf {
  root.join(".clawkit").join("opencode-password.json")
}

fn read_env_password() -> Option<String> {
  env::var("OPENCODE_SERVER_PASSWORD")
    .ok()
    .and_then(|value| if value.trim().is_empty() { None } else { Some(value) })
}

fn read_stored_password(root: &Path) -> Result<Option<String>, String> {
  let config_path = opencode_password_config_path(root);
  if !config_path.exists() {
    return Ok(None);
  }

  let content = fs::read_to_string(&config_path)
    .map_err(|error| format!("读取 OpenCode 密码配置失败：{error}"))?;
  let stored: StoredOpenCodePassword = serde_json::from_str(&content)
    .map_err(|error| format!("OpenCode 密码配置格式无效：{error}"))?;

  if stored.password.trim().is_empty() {
    return Ok(None);
  }

  Ok(Some(stored.password))
}

fn resolve_password(root: Option<&Path>) -> Result<Option<String>, String> {
  if let Some(root) = root {
    if let Some(password) = read_stored_password(root)? {
      return Ok(Some(password));
    }
  }

  Ok(read_env_password())
}

fn password_configured(root: Option<&Path>) -> bool {
  match root {
    Some(root) => read_stored_password(root).ok().flatten().is_some() || read_env_password().is_some(),
    None => read_env_password().is_some(),
  }
}

#[derive(Deserialize, Serialize)]
struct StoredOpenCodePassword {
  password: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveOpenCodePasswordResult {
  pub password_configured: bool,
  pub config_path: String,
  pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevealOpenCodePasswordResult {
  pub password: String,
  pub config_path: String,
  pub message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenCodeStatus {
  pub online: bool,
  pub port: u16,
  pub host: String,
  pub password_configured: bool,
  pub pid: Option<u32>,
  pub log_file: Option<String>,
  pub detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOpenCodeResult {
  pub started: bool,
  pub port: u16,
  pub pid: Option<u32>,
  pub log_file: String,
  pub message: String,
  pub detail: Option<String>,
}

#[tauri::command]
pub fn check_opencode_status() -> OpenCodeStatus {
  let port = 4096;
  let host = String::from("127.0.0.1");

  match repo_root() {
    Ok(root) => {
      let pid_file = root.join(".clawkit").join("opencode.pid");
      let log_file = root.join("opencode.log");
      let pid = parse_pid_file(&pid_file);
      let online = is_port_open(port);

      OpenCodeStatus {
        online,
        port,
        host,
        password_configured: password_configured(Some(&root)),
        pid,
        log_file: Some(log_file.to_string_lossy().to_string()),
        detail: Some(if online {
          String::from("OpenCode 服务在线")
        } else {
          String::from("OpenCode 服务未启动或端口不可达")
        }),
      }
    }
    Err(message) => OpenCodeStatus {
      online: false,
      port,
      host,
      password_configured: password_configured(None),
      pid: None,
      log_file: None,
      detail: Some(message),
    },
  }
}

#[tauri::command]
pub fn save_opencode_password(password: String) -> Result<SaveOpenCodePasswordResult, String> {
  if password.trim().is_empty() {
    return Err(String::from("OpenCode 密码不能为空"));
  }

  let root = repo_root()?;
  let config_path = opencode_password_config_path(&root);
  let parent_dir = config_path
    .parent()
    .ok_or_else(|| String::from("无法定位 OpenCode 密码配置目录"))?;

  fs::create_dir_all(parent_dir).map_err(|error| format!("创建 OpenCode 密码配置目录失败：{error}"))?;

  let stored = StoredOpenCodePassword { password };
  let content = serde_json::to_string_pretty(&stored)
    .map_err(|error| format!("序列化 OpenCode 密码配置失败：{error}"))?;
  fs::write(&config_path, format!("{content}\n"))
    .map_err(|error| format!("保存 OpenCode 密码失败：{error}"))?;

  Ok(SaveOpenCodePasswordResult {
    password_configured: true,
    config_path: config_path.to_string_lossy().to_string(),
    message: String::from("OpenCode 密码已保存，之后启动会自动带入配置"),
  })
}

#[tauri::command]
pub fn reveal_opencode_password() -> Result<RevealOpenCodePasswordResult, String> {
  let root = repo_root()?;
  let config_path = opencode_password_config_path(&root);
  let password = read_stored_password(&root)?
    .ok_or_else(|| String::from("未找到已保存的 OpenCode 密码，请先保存密码"))?;

  Ok(RevealOpenCodePasswordResult {
    password,
    config_path: config_path.to_string_lossy().to_string(),
    message: String::from("已读取本机保存的 OpenCode 密码"),
  })
}

#[tauri::command]
pub fn start_opencode() -> Result<StartOpenCodeResult, String> {
  let root = repo_root()?;
  let log_file = root.join("opencode.log").to_string_lossy().to_string();
  let pid_file = root.join(".clawkit").join("opencode.pid");
  let script = root.join("scripts").join("start-opencode.sh");
  if !script.exists() {
    return Err(String::from("未找到 scripts/start-opencode.sh"));
  }

  let password = resolve_password(Some(&root))?;
  if password.is_none() {
    return Ok(StartOpenCodeResult {
      started: false,
      port: 4096,
      pid: None,
      log_file,
      message: String::from("未设置 OPENCODE_SERVER_PASSWORD"),
      detail: Some(String::from("请先在桌面端保存 OpenCode 密码，或手动导出 OPENCODE_SERVER_PASSWORD")),
    });
  }

  let output = Command::new("bash")
    .arg(script)
    .current_dir(&root)
    .env("OPENCODE_SERVER_PASSWORD", password.unwrap_or_default())
    .output()
    .map_err(|error| format!("启动 OpenCode 失败：{error}"))?;

  let stdout = String::from_utf8_lossy(&output.stdout).to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).to_string();
  let failure_summary = if !stderr.trim().is_empty() { summarize_output(&stderr) } else { summarize_output(&stdout) };
  let message = if output.status.success() {
    // 启动脚本最后一行是“停止服务”的操作提示，不适合作为成功消息展示。
    String::from("OpenCode 服务已启动")
  } else {
    String::from("OpenCode 启动脚本执行失败")
  };

  let pid = parse_pid_file(&pid_file);

  Ok(StartOpenCodeResult {
    started: output.status.success(),
    port: 4096,
    pid,
    log_file,
    message,
    detail: if output.status.success() {
      None
    } else {
      Some(failure_summary)
    },
  })
}
