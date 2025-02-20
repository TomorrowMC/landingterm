use serde::Serialize;
use std::process::{Child, Command};
use std::env;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use lazy_static::lazy_static;
use std::collections::HashMap;
use once_cell::sync::Lazy;
use std::io::{BufReader, Read};
use tauri::Runtime;
use regex::Regex;
use serde_json;

lazy_static! {
    static ref CURRENT_DIR: Mutex<PathBuf> = Mutex::new(
        env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from("/"))
    );
    static ref RUNNING_PROCESSES: Mutex<HashMap<String, std::process::Child>> = Mutex::new(HashMap::new());
}

// 存储所有终端进程的全局 HashMap
static TERMINAL_PROCESSES: Lazy<Mutex<HashMap<String, TerminalProcess>>> = 
    Lazy::new(|| Mutex::new(HashMap::new()));

// 用于匹配ANSI转义序列的正则表达式
static ANSI_ESCAPE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(\x9B|\x1B\[)[0-?]*[ -/]*[@-~]").unwrap()
});

// 用于提取进度信息的正则表达式
static PROGRESS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"([\d.]+\s*(?:GB|MB|KB)/[\d.]+\s*(?:GB|MB|KB)|[\d.]+%|[\d.]+\s*(?:GB|MB|KB)/s)").unwrap()
});

// 用于匹配状态信息的正则表达式
static STATUS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"pulling (?:manifest|[0-9a-f]{12})\.\.\.").unwrap()
});

#[derive(Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub current_dir: String,
}

#[derive(Serialize, Clone)]
pub struct StreamOutput {
    pub content: String,
    pub output_type: String,
    pub current_dir: String,
    pub should_replace_last: bool,
    pub terminalId: String,
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

#[tauri::command]
pub async fn execute_command_stream<R: Runtime>(
    window: tauri::Window<R>,
    command: String,
    terminalId: String,
) -> Result<(), String> {
    let current_dir = CURRENT_DIR.lock().unwrap().clone();
    
    if command.trim().starts_with("cd") {
        return handle_cd_command(&command, window, &terminalId).await;
    }

    // 检查命令是否是下载相关命令
    let is_download_command = command.contains("ollama") || command.contains("curl") || command.contains("wget");

    // 检查是否安装了unbuffer
    let has_unbuffer = Command::new("which")
        .arg("unbuffer")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    let mut child = if has_unbuffer {
        Command::new("unbuffer")
            .current_dir(&current_dir)
            .arg("zsh")
            .arg("-c")
            .arg(&command)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
    } else {
        Command::new("script")
            .current_dir(&current_dir)
            .arg("-q")
            .arg("/dev/null")
            .arg("zsh")
            .arg("-c")
            .arg(&command)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
    }.map_err(|e| e.to_string())?;

    // 在存储到RUNNING_PROCESSES之前，先获取stdout和stderr
    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child.stderr.take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    // 将进程存储到全局HashMap中
    RUNNING_PROCESSES.lock().unwrap().insert(terminalId.clone(), child);

    let window_clone = window.clone();
    let current_dir_str = format_current_dir(&current_dir);
    let terminal_id_clone = terminalId.clone();

    // Handle stdout in a separate task
    let stdout_task = {
        let window = window_clone.clone();
        let current_dir = current_dir_str.clone();
        let terminal_id = terminal_id_clone.clone();
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buffer = [0u8; 1024];
            let mut current_line = String::new();
            let mut progress_info = String::new();
            let mut status_info = String::new();
            let mut is_progress_line = false;
            let mut last_status = String::new();

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buffer[..n]);
                        let cleaned_chunk = ANSI_ESCAPE_RE.replace_all(&chunk, "");
                        
                        for c in cleaned_chunk.chars() {
                            match c {
                                '\r' | '\n' => {
                                    if !current_line.is_empty() {
                                        if is_download_command {
                                            let mut new_progress = String::new();
                                            let mut new_status = String::new();
                                            
                                            // 提取进度信息
                                            for cap in PROGRESS_RE.find_iter(&current_line) {
                                                new_progress.push_str(cap.as_str());
                                                new_progress.push(' ');
                                            }
                                            
                                            // 提取状态信息
                                            if let Some(status_match) = STATUS_RE.find(&current_line) {
                                                new_status = status_match.as_str().to_string();
                                            }
                                            
                                            // 更新状态信息（只有当状态改变时）
                                            if !new_status.is_empty() && new_status != last_status {
                                                last_status = new_status.clone();
                                                let _ = window.emit("terminal-output", StreamOutput {
                                                    content: new_status,
                                                    output_type: "stdout".to_string(),
                                                    current_dir: current_dir.clone(),
                                                    should_replace_last: false,
                                                    terminalId: terminal_id.clone(),
                                                });
                                            }
                                            
                                            // 更新进度信息
                                            if !new_progress.is_empty() {
                                                progress_info = new_progress;
                                                is_progress_line = true;
                                                
                                                let _ = window.emit("terminal-output", StreamOutput {
                                                    content: progress_info.clone(),
                                                    output_type: "stdout".to_string(),
                                                    current_dir: current_dir.clone(),
                                                    should_replace_last: true,
                                                    terminalId: terminal_id.clone(),
                                                });
                                            } else if !current_line.trim().is_empty() && 
                                                     !STATUS_RE.is_match(&current_line) {
                                                // 如果不是进度信息也不是状态信息，且不是空行，正常发送
                                                let _ = window.emit("terminal-output", StreamOutput {
                                                    content: current_line.clone(),
                                                    output_type: "stdout".to_string(),
                                                    current_dir: current_dir.clone(),
                                                    should_replace_last: false,
                                                    terminalId: terminal_id.clone(),
                                                });
                                            }
                                        } else {
                                            // 非下载命令，正常发送
                                            let _ = window.emit("terminal-output", StreamOutput {
                                                content: current_line.clone(),
                                                output_type: "stdout".to_string(),
                                                current_dir: current_dir.clone(),
                                                should_replace_last: false,
                                                terminalId: terminal_id.clone(),
                                            });
                                        }
                                    }
                                    current_line.clear();
                                }
                                _ => current_line.push(c),
                            }
                        }
                        
                        // 如果还有未发送的内容且不是进度信息，发送它
                        if !current_line.is_empty() && !is_progress_line && 
                           !STATUS_RE.is_match(&current_line) {
                            let _ = window.emit("terminal-output", StreamOutput {
                                content: current_line.clone(),
                                output_type: "stdout".to_string(),
                                current_dir: current_dir.clone(),
                                should_replace_last: false,
                                terminalId: terminal_id.clone(),
                            });
                        }
                    }
                    Err(e) => {
                        let _ = window.emit("terminal-output", StreamOutput {
                            content: format!("Error reading stdout: {}", e),
                            output_type: "stderr".to_string(),
                            current_dir: current_dir.clone(),
                            should_replace_last: false,
                            terminalId: terminal_id.clone(),
                        });
                        break;
                    }
                }
            }
        })
    };

    // Handle stderr in a similar way
    let stderr_task = {
        let window = window_clone;
        let current_dir = current_dir_str;
        let terminal_id = terminal_id_clone;
        tauri::async_runtime::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buffer = [0u8; 1024];
            let mut current_line = String::new();
            let mut last_status = String::new();
            let mut is_progress_line = false;

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        let chunk = String::from_utf8_lossy(&buffer[..n]);
                        let cleaned_chunk = ANSI_ESCAPE_RE.replace_all(&chunk, "");
                        
                        for c in cleaned_chunk.chars() {
                            match c {
                                '\r' | '\n' => {
                                    if !current_line.is_empty() {
                                        if is_download_command {
                                            // 检查是否是状态信息
                                            if let Some(status_match) = STATUS_RE.find(&current_line) {
                                                let new_status = status_match.as_str().to_string();
                                                if new_status != last_status {
                                                    last_status = new_status.clone();
                                                    let _ = window.emit("terminal-output", StreamOutput {
                                                        content: new_status,
                                                        output_type: "stderr".to_string(),
                                                        current_dir: current_dir.clone(),
                                                        should_replace_last: false,
                                                        terminalId: terminal_id.clone(),
                                                    });
                                                }
                                            } else if PROGRESS_RE.is_match(&current_line) {
                                                is_progress_line = true;
                                                let _ = window.emit("terminal-output", StreamOutput {
                                                    content: current_line.clone(),
                                                    output_type: "stderr".to_string(),
                                                    current_dir: current_dir.clone(),
                                                    should_replace_last: true,
                                                    terminalId: terminal_id.clone(),
                                                });
                                            } else if !current_line.trim().is_empty() {
                                                let _ = window.emit("terminal-output", StreamOutput {
                                                    content: current_line.clone(),
                                                    output_type: "stderr".to_string(),
                                                    current_dir: current_dir.clone(),
                                                    should_replace_last: false,
                                                    terminalId: terminal_id.clone(),
                                                });
                                            }
                                        } else {
                                            let _ = window.emit("terminal-output", StreamOutput {
                                                content: current_line.clone(),
                                                output_type: "stderr".to_string(),
                                                current_dir: current_dir.clone(),
                                                should_replace_last: false,
                                                terminalId: terminal_id.clone(),
                                            });
                                        }
                                    }
                                    current_line.clear();
                                }
                                _ => current_line.push(c),
                            }
                        }
                        
                        if !current_line.is_empty() && !is_progress_line && 
                           !STATUS_RE.is_match(&current_line) {
                            let _ = window.emit("terminal-output", StreamOutput {
                                content: current_line.clone(),
                                output_type: "stderr".to_string(),
                                current_dir: current_dir.clone(),
                                should_replace_last: false,
                                terminalId: terminal_id.clone(),
                            });
                        }
                    }
                    Err(e) => {
                        let _ = window.emit("terminal-output", StreamOutput {
                            content: format!("Error reading stderr: {}", e),
                            output_type: "stderr".to_string(),
                            current_dir: current_dir.clone(),
                            should_replace_last: false,
                            terminalId: terminal_id.clone(),
                        });
                        break;
                    }
                }
            }
        })
    };

    // Wait for output handlers to complete first
    let _ = stdout_task.await;
    let _ = stderr_task.await;

    // Then handle the process completion
    let status = {
        let mut processes = RUNNING_PROCESSES.lock().unwrap();
        if let Some(mut child) = processes.remove(&terminalId) {
            child.wait().map_err(|e| e.to_string())?
        } else {
            return Err("Process not found".to_string());
        }
    };

    // Emit command completion event with terminal ID
    let _ = window.emit("terminal-command-complete", serde_json::json!({
        "terminalId": terminalId,
        "code": status.code()
    }));

    Ok(())
}

async fn handle_cd_command<R: Runtime>(
    command: &str,
    window: tauri::Window<R>,
    terminal_id: &str,
) -> Result<(), String> {
    let mut current_dir = CURRENT_DIR.lock().unwrap();
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
        let current_dir_str = format_current_dir(&current_dir);
        let _ = window.emit("terminal-output", StreamOutput {
            content: String::new(),
            output_type: "stdout".to_string(),
            current_dir: current_dir_str,
            should_replace_last: false,
            terminalId: terminal_id.to_string(),
        });
        Ok(())
    } else {
        let error_msg = format!("cd: no such directory: {}", new_dir);
        let current_dir_str = format_current_dir(&current_dir);
        let _ = window.emit("terminal-output", StreamOutput {
            content: error_msg,
            output_type: "stderr".to_string(),
            current_dir: current_dir_str,
            should_replace_last: false,
            terminalId: terminal_id.to_string(),
        });
        Ok(())
    }
}

#[tauri::command]
pub async fn stop_command(terminal_id: String) -> Result<(), String> {
    let mut processes = RUNNING_PROCESSES.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = processes.remove(&terminal_id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
} 