// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Runtime;
use tauri::plugin::{Builder, TauriPlugin};

pub mod terminal;  // 声明 terminal 模块

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("terminal")
        .invoke_handler(tauri::generate_handler![
            terminal::process::execute_command,
            terminal::process::create_terminal,
            terminal::process::close_terminal,
        ])
        .setup(|_app| {
            Ok(())
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(init::<tauri::Wry>())  // 添加插件
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
