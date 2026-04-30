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
}

#[derive(Serialize)]
pub struct RenderResult {
    ok: bool,
    svg: Option<String>,
    stdout: String,
    stderr: String,
}

fn dot_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(configured_path) = env::var("DOTDESK_GRAPHVIZ_DOT") {
        candidates.push(PathBuf::from(configured_path));
    }

    candidates.extend([
        PathBuf::from("/opt/homebrew/bin/dot"),
        PathBuf::from("/opt/homebrew/opt/graphviz/bin/dot"),
        PathBuf::from("/usr/local/bin/dot"),
        PathBuf::from("/usr/local/opt/graphviz/bin/dot"),
        PathBuf::from("dot"),
    ]);

    candidates
}

fn command_exists(candidate: &Path) -> bool {
    candidate
        .to_str()
        .is_some_and(|value| value == "dot" || candidate.is_file())
}

fn graphviz_command() -> Option<PathBuf> {
    dot_candidates()
        .into_iter()
        .find(|candidate| command_exists(candidate))
}

#[tauri::command]
pub fn check_graphviz() -> GraphvizStatus {
    let Some(dot_path) = graphviz_command() else {
        return GraphvizStatus {
            available: false,
            version: None,
            message: "Graphviz is not available. Install Graphviz or set DOTDESK_GRAPHVIZ_DOT to the `dot` binary path.".to_string(),
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
            }
        }
        Err(error) => GraphvizStatus {
            available: false,
            version: None,
            message: format!(
                "Graphviz is not available. Install Graphviz or set DOTDESK_GRAPHVIZ_DOT to the `dot` binary path. Details: {error}"
            ),
        },
    }
}

#[tauri::command]
pub fn render_dot_to_svg(source: String) -> Result<RenderResult, String> {
    let dot_path = graphviz_command().ok_or_else(|| {
        "Graphviz is not available. Install Graphviz or set DOTDESK_GRAPHVIZ_DOT to the `dot` binary path.".to_string()
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
