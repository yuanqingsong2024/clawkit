use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

fn repo_root() -> Result<PathBuf, String> {
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  manifest_dir
    .ancestors()
    .nth(3)
    .map(Path::to_path_buf)
    .ok_or_else(|| String::from("无法定位仓库根目录"))
}

fn tail_lines(content: &str, limit: usize) -> Vec<String> {
  let mut lines: Vec<String> = content.lines().map(ToOwned::to_owned).collect();
  if lines.len() > limit {
    lines.drain(0..lines.len().saturating_sub(limit));
  }
  lines
}

#[derive(Serialize)]
pub struct ReadOpenCodeLogsResult {
  pub log_file: String,
  pub lines: Vec<String>,
}

#[tauri::command]
pub fn read_opencode_logs(lines: usize) -> Result<ReadOpenCodeLogsResult, String> {
  let root = repo_root()?;
  let log_path = root.join("opencode.log");
  let content = fs::read_to_string(&log_path).map_err(|error| format!("读取 OpenCode 日志失败：{error}"))?;
  let limit = lines.clamp(1, 1000);

  Ok(ReadOpenCodeLogsResult {
    log_file: log_path.to_string_lossy().to_string(),
    lines: tail_lines(&content, limit),
  })
}
