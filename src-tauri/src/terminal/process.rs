use serde::Serialize;
use std::process::{Child, Command};
use std::env;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use lazy_static::lazy_static;
use std::collections::HashMap;
use once_cell::sync::Lazy;

lazy_static! {
    static ref CURRENT_DIR: Mutex<PathBuf> = Mutex::new(
        env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("/"))
    );
}

// 存储所有终端进程的全局 HashMap
static TERMINAL_PROCESSES: Lazy<Mutex<HashMap<String, TerminalProcess>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub current_dir: String,
}

#[allow(dead_code)]
pub struct TerminalProcess {
    process: Child,
    current_dir: PathBuf,
}

impl TerminalProcess {
    pub fn new() -> Result<Self, String> {
        let home_dir = env::var("HOME").unwrap_or_default();
        let current_dir = PathBuf::from(&home_dir);

        #[cfg(target_os = "macos")]
        let process = Command::new("zsh")
            .current_dir(&current_dir)
            .spawn()
            .map_err(|e| e.to_string())?;

        #[cfg(not(target_os = "macos"))]
        let process = Command::new("bash")
            .current_dir(&current_dir)
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(TerminalProcess {
            process,
            current_dir,
        })
    }

    pub fn kill(&mut self) -> Result<(), String> {
        self.process.kill().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn execute_command(command: &str) -> Result<CommandOutput, String> {
    let mut current_dir = CURRENT_DIR.lock().unwrap();
    
    if command.trim().starts_with("cd") {
        let parts: Vec<&str> = command.trim().splitn(2, ' ').collect();
        let new_dir = parts.get(1).map(|s| s.trim()).unwrap_or("~");

        let new_path = if new_dir == "~" {
            PathBuf::from(env::var("HOME").unwrap_or_default())
        } else if new_dir.starts_with('~') {
            let home = env::var("HOME").unwrap_or_default();
            let without_tilde = &new_dir[1..];
            if without_tilde.is_empty() {
                PathBuf::from(home)
            } else {
                PathBuf::from(home).join(&without_tilde[1..])
            }
        } else if new_dir.starts_with('/') {
            PathBuf::from(new_dir)
        } else {
            // 处理相对路径，包括 .. 和 .
            let mut new_path = current_dir.clone();
            new_path.push(new_dir);
            if let Ok(canonicalized) = new_path.canonicalize() {
                canonicalized
            } else {
                new_path
            }
        };

        if new_path.exists() && new_path.is_dir() {
            *current_dir = new_path;
            return Ok(CommandOutput {
                stdout: String::new(),
                stderr: String::new(),
                current_dir: format_current_dir(&current_dir),
            });
        } else {
            return Ok(CommandOutput {
                stdout: String::new(),
                stderr: format!("cd: no such directory: {}", new_dir),
                current_dir: format_current_dir(&current_dir),
            });
        }
    }

    let output = Command::new("zsh")
        .current_dir(&*current_dir)
        .arg("-c")
        .arg(command)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        current_dir: format_current_dir(&current_dir),
    })
}

fn format_current_dir(path: &Path) -> String {
    let home = env::var("HOME").unwrap_or_default();
    if let Ok(canonical_path) = path.canonicalize() {
        let path_str = canonical_path.to_string_lossy();
        if path_str.starts_with(&home) {
            format!("~{}", &path_str[home.len()..])
        } else {
            path_str.to_string()
        }
    } else {
        path.to_string_lossy().to_string()
    }
}

#[tauri::command]
pub async fn create_terminal(id: String) -> Result<(), String> {
    let mut processes = TERMINAL_PROCESSES.lock().unwrap();
    if !processes.contains_key(&id) {
        let process = TerminalProcess::new()?;
        processes.insert(id, process);
    }
    Ok(())
}

#[tauri::command]
pub async fn close_terminal(id: String) -> Result<(), String> {
    let mut processes = TERMINAL_PROCESSES.lock().unwrap();
    if let Some(mut process) = processes.remove(&id) {
        process.kill()?;
    }
    Ok(())
} 