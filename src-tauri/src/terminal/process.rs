use serde::Serialize;
use std::process::Command;
use std::env;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref CURRENT_DIR: Mutex<PathBuf> = Mutex::new(
        env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("/"))
    );
}

#[derive(Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub current_dir: String,
}

#[cfg(target_os = "macos")]
pub fn execute_command(command: &str) -> Result<CommandOutput, std::io::Error> {
    let mut current_dir = CURRENT_DIR.lock().unwrap();
    
    // 特殊处理 cd 命令
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
        .output()?;

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

#[cfg(not(target_os = "macos"))]
pub fn execute_command(command: &str) -> Result<CommandOutput, std::io::Error> {
    let home_dir = env::var("HOME").unwrap_or_default();
    
    let output = Command::new("sh")
        .current_dir(home_dir)
        .arg("-c")
        .arg(command)
        .output()?;
    
    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        current_dir: format_current_dir(&Path::new(&home_dir)),
    })
} 