use serde::Serialize;
use std::env;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[derive(Serialize)]
pub struct GraphvizStatus {
    available: bool,
    version: Option<String>,
    message: String,
    /// 当前进程可见的 PATH（按目录分行编号），用于核对 dot 等是否在搜索路径里。
    process_path: String,
}

#[derive(Serialize)]
pub struct RenderResult {
    ok: bool,
    svg: Option<String>,
    stdout: String,
    stderr: String,
}

#[cfg(windows)]
fn path_join_dot(dir: &Path) -> PathBuf {
    dir.join("dot.exe")
}

#[cfg(not(windows))]
fn path_join_dot(dir: &Path) -> PathBuf {
    dir.join("dot")
}

/// 仅在 `DOTDESK_GRAPHVIZ_DOT` 或系统 `PATH` 中查找 `dot`（不猜测 Homebrew 等固定路径）。
fn graphviz_command() -> Option<PathBuf> {
    if let Ok(p) = env::var("DOTDESK_GRAPHVIZ_DOT") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }
    let path = env::var("PATH").ok()?;
    for dir in env::split_paths(&path) {
        let candidate = path_join_dot(&dir);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

#[tauri::command]
pub fn check_graphviz() -> GraphvizStatus {
    let path_block = crate::env_debug::process_path_numbered();
    let Some(dot_path) = graphviz_command() else {
        return GraphvizStatus {
            available: false,
            version: None,
            message: "Graphviz is not available: no `dot` on PATH and DOTDESK_GRAPHVIZ_DOT is unset or invalid. Install Graphviz and ensure its bin directory is in PATH, or set DOTDESK_GRAPHVIZ_DOT to the full path of `dot`.".to_string(),
            process_path: path_block,
        };
    };

    match Command::new(&dot_path).arg("-V").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let version = if stderr.is_empty() { stdout } else { stderr };

            GraphvizStatus {
                available: output.status.success(),
                version: Some(version.clone()),
                message: if output.status.success() {
                    format!("Graphviz detected at {}: {version}", dot_path.display())
                } else {
                    format!("Graphviz command returned a non-zero status: {version}")
                },
                process_path: path_block,
            }
        }
        Err(error) => GraphvizStatus {
            available: false,
            version: None,
            message: format!(
                "Graphviz is not available: `dot` not found on PATH (or DOTDESK_GRAPHVIZ_DOT invalid). Details: {error}"
            ),
            process_path: path_block,
        },
    }
}

#[tauri::command]
pub fn render_dot_to_svg(source: String) -> Result<RenderResult, String> {
    let dot_path = graphviz_command().ok_or_else(|| {
        "Graphviz is not available: no `dot` on PATH; set PATH or DOTDESK_GRAPHVIZ_DOT.".to_string()
    })?;

    let mut child = Command::new(dot_path)
        .args(["-Tsvg"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!("Failed to start Graphviz `dot`. Install Graphviz and make sure it is on PATH. Details: {error}")
        })?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| "Failed to open stdin for Graphviz.".to_string())?;
        stdin
            .write_all(source.as_bytes())
            .map_err(|error| format!("Failed to write DOT source to Graphviz: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Failed to read Graphviz output: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    Ok(RenderResult {
        ok: output.status.success(),
        svg: output.status.success().then_some(stdout.clone()),
        stdout: if output.status.success() {
            String::new()
        } else {
            stdout
        },
        stderr,
    })
}
