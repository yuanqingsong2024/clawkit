use std::net::{SocketAddr, TcpStream};
use std::time::Duration;

#[tauri::command]
pub fn check_port(port: u16) -> bool {
  let addr = SocketAddr::from(([127, 0, 0, 1], port));
  TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}
