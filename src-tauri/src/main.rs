// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod terminal;
use terminal::process::CommandOutput;

#[tauri::command]
async fn execute_cmd(command: String) -> Result<CommandOutput, String> {
    println!("Executing command: {}", command);
    terminal::process::execute_command(&command).map_err(|e| {
        println!("Command error: {}", e);
        e.to_string()
    })
}

fn main() {
    println!("Starting Landing Terminal...");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![execute_cmd])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
