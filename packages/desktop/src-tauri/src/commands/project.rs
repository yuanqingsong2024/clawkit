use serde::Serialize;
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;

fn repo_root() -> Result<PathBuf, String> {
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  manifest_dir
    .ancestors()
    .nth(3)
    .map(Path::to_path_buf)
    .ok_or_else(|| String::from("无法定位仓库根目录"))
}

fn find_available_port(start_port: u16, max_attempts: u16) -> Result<u16, String> {
  for offset in 0..max_attempts {
    let port = start_port.saturating_add(offset);
    if TcpListener::bind(("127.0.0.1", port)).is_ok() {
      return Ok(port);
    }
  }

  Err(format!(
    "无法找到可用的项目管理页端口，起始端口 {start_port}，已尝试 {max_attempts} 个端口"
  ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartProjectManagerResult {
  pub started: bool,
  pub message: String,
  pub controller_url: Option<String>,
  pub web_url: Option<String>,
  pub opened: bool,
  pub open_detail: Option<String>,
}

fn open_url_in_browser(url: &str) -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    Command::new("cmd")
      .args(["/C", "start", "", url])
      .spawn()
      .map_err(|error| format!("调用系统浏览器失败：{error}"))?;
    return Ok(());
  }

  #[cfg(target_os = "macos")]
  {
    Command::new("open")
      .arg(url)
      .spawn()
      .map_err(|error| format!("调用系统浏览器失败：{error}"))?;
    return Ok(());
  }

  #[cfg(all(unix, not(target_os = "macos")))]
  {
    Command::new("xdg-open")
      .arg(url)
      .spawn()
      .map_err(|error| format!("调用系统浏览器失败：{error}"))?;
    return Ok(());
  }

  #[allow(unreachable_code)]
  Err(String::from("当前平台不支持自动打开浏览器"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenUrlResult {
  pub opened: bool,
  pub message: String,
  pub detail: Option<String>,
}

#[tauri::command]
pub fn open_url(url: String) -> Result<OpenUrlResult, String> {
  match open_url_in_browser(&url) {
    Ok(()) => Ok(OpenUrlResult {
      opened: true,
      message: String::from("已尝试打开系统浏览器"),
      detail: None,
    }),
    Err(error) => Ok(OpenUrlResult {
      opened: false,
      message: String::from("打开系统浏览器失败"),
      detail: Some(error),
    }),
  }
}

#[tauri::command]
pub fn start_project_manager() -> Result<StartProjectManagerResult, String> {
  let root = repo_root()?;
  let script = root.join("scripts").join("start-project-manager.sh");
  if !script.exists() {
    return Err(String::from("未找到 scripts/start-project-manager.sh"));
  }

  let requested_port = std::env::var("CLAWKIT_PROJECT_MANAGER_WEB_PORT")
    .ok()
    .and_then(|value| value.parse::<u16>().ok())
    .unwrap_or(5889);
  let web_port = find_available_port(requested_port, 20)?;

  Command::new("bash")
    .env("VITE_PORT", web_port.to_string())
    .arg(script)
    .current_dir(&root)
    .spawn()
    .map_err(|error| format!("启动项目管理页失败：{error}"))?;

  let web_url = format!("http://127.0.0.1:{web_port}");

  Ok(StartProjectManagerResult {
    started: true,
    message: format!("项目管理页已在后台启动，未自动打开浏览器：{web_url}"),
    controller_url: Some(String::from("http://127.0.0.1:8787")),
    web_url: Some(web_url),
    opened: false,
    open_detail: Some(String::from("已取消自动打开浏览器，请复制地址或使用手动打开按钮访问")),
  })
}
