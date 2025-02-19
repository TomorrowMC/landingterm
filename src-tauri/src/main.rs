// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use app::terminal;

#[tauri::command]
async fn execute_terminal_command(command: String) -> Result<terminal::process::CommandOutput, String> {
    terminal::process::execute_command(&command).await
}

fn main() {
    println!("Starting Landing Terminal...");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![execute_terminal_command])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
