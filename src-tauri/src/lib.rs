// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Runtime;
use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, WindowEvent};

pub mod terminal;  // 声明 terminal 模块

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("terminal")
        .invoke_handler(tauri::generate_handler![
            terminal::process::execute_command,
            terminal::process::execute_command_stream,
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
        .setup(|app| {
            let main_window = app.get_window("main").unwrap();
            let window_handle = main_window.clone();
            
            main_window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // 在这里可以添加关闭前的清理工作
                    println!("Window is closing");
                    
                    api.prevent_close();
                    
                    // 异步执行清理工作
                    let window = window_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        // 在这里执行任何需要的异步清理
                        // 例如，关闭所有终端进程
                        let _ = window.emit("cleanup", ());
                        
                        // 等待一小段时间确保清理完成
                        std::thread::sleep(std::time::Duration::from_millis(100));
                        
                        // 关闭窗口
                        window.close().unwrap();
                    });
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
