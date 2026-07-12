#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      commands::health::check_port,
      commands::logs::read_opencode_logs,
      commands::opencode::check_opencode_status,
      commands::opencode::reveal_opencode_password,
      commands::opencode::start_opencode,
      commands::opencode::save_opencode_password,
      commands::project::open_url,
      commands::project::start_project_manager
    ])
    .run(tauri::generate_context!())
    .expect("启动桌面应用失败");
}
