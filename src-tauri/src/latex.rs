use serde::Serialize;
use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;

/// 与 GraphvizStatus 形状一致，便于前端复用 RenderLog 显示。
#[derive(Serialize)]
pub struct LatexStatus {
    available: bool,
    version: Option<String>,
    message: String,
    process_path: String,
}

#[derive(Serialize)]
pub struct LatexRenderResult {
    ok: bool,
    svg: Option<String>,
    /// 是否额外把 PDF 写入了 output_path
    pdf_written: bool,
    stdout: String,
    stderr: String,
}

fn path_join_executable(dir: &Path, name: &str) -> PathBuf {
    #[cfg(windows)]
    {
        dir.join(format!("{name}.exe"))
    }
    #[cfg(not(windows))]
    {
        dir.join(name)
    }
}

/// 仅在「环境变量指定的完整路径」或系统 `PATH` 目录中查找可执行文件（不猜测其它安装路径）。
fn find_command(name: &str, env_override: Option<&str>) -> Option<PathBuf> {
    if let Some(env_key) = env_override {
        if let Ok(p) = env::var(env_key) {
            let pb = PathBuf::from(p);
            if pb.is_file() {
                return Some(pb);
            }
        }
    }
    if let Ok(path) = env::var("PATH") {
        for dir in env::split_paths(&path) {
            let candidate = path_join_executable(&dir, name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// dot2tex 虽是 pip/Python 包，`pip install` 会在 PATH 的某个目录放下 **`dot2tex` / `dot2tex3` 可执行脚本**（优先使用）。
/// 查找顺序：`DOTDESK_DOT2TEX` → 遍历 `PATH` 找上述可执行文件 → 最后再试 `python -m dot2tex`。
#[derive(Clone)]
enum Dot2texInvoker {
    /// PATH 或 `DOTDESK_DOT2TEX` 指向的入口脚本（常见情况）
    Executable(PathBuf),
    /// 仅当 PATH 中找不到脚本时：用 PATH/`DOTDESK_PYTHON` 的解释器执行 `python -m dot2tex`
    PythonModule(PathBuf),
}

fn find_dot2tex_invoker() -> Option<Dot2texInvoker> {
    if let Ok(p) = env::var("DOTDESK_DOT2TEX") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(Dot2texInvoker::Executable(pb));
        }
    }
    if let Ok(path) = env::var("PATH") {
        for dir in env::split_paths(&path) {
            for cmd in ["dot2tex", "dot2tex3"] {
                let candidate = path_join_executable(&dir, cmd);
                if candidate.is_file() {
                    return Some(Dot2texInvoker::Executable(candidate));
                }
            }
        }
    }

    // `python -m dot2tex`：解释器也必须能在 PATH（或 DOTDESK_PYTHON 完整路径）里找到
    let mut python_candidates: Vec<PathBuf> = Vec::new();
    if let Ok(p) = env::var("DOTDESK_PYTHON") {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            python_candidates.push(pb);
        }
    }
    for opt in [
        find_command("python3", None),
        find_command("python", None),
    ] {
        if let Some(py) = opt {
            if !python_candidates.iter().any(|p| p == &py) {
                python_candidates.push(py);
            }
        }
    }

    for py in python_candidates {
        let ok = Command::new(&py)
            .args(["-m", "dot2tex", "--version"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);
        if ok {
            return Some(Dot2texInvoker::PythonModule(py));
        }
    }

    None
}

fn dot2tex_display_path(inv: &Dot2texInvoker) -> String {
    match inv {
        Dot2texInvoker::Executable(p) => p.display().to_string(),
        Dot2texInvoker::PythonModule(py) => format!("{} -m dot2tex", py.display()),
    }
}

fn version_of(cmd: &Path, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let e = String::from_utf8_lossy(&o.stderr).trim().to_string();
            let v = if !s.is_empty() { s } else { e };
            v.lines().next().map(|l| l.to_string())
        })
}

#[tauri::command]
pub fn check_latex() -> LatexStatus {
    let xelatex = find_command("xelatex", Some("DOTDESK_XELATEX"));
    let dot2tex = find_dot2tex_invoker();
    let pdf2svg = find_command("pdf2svg", Some("DOTDESK_PDF2SVG"));

    let mut parts = Vec::new();
    let mut all_ok = true;
    match &xelatex {
        Some(p) => parts.push(format!(
            "xelatex: {}",
            version_of(p, &["--version"]).unwrap_or_else(|| p.display().to_string())
        )),
        None => {
            parts.push("xelatex: missing".into());
            all_ok = false;
        }
    }
    match &dot2tex {
        Some(inv) => {
            let ver = match inv {
                Dot2texInvoker::Executable(p) => {
                    version_of(p, &["--version"]).unwrap_or_else(|| p.display().to_string())
                }
                Dot2texInvoker::PythonModule(py) => Command::new(py)
                    .args(["-m", "dot2tex", "--version"])
                    .output()
                    .ok()
                    .filter(|o| o.status.success())
                    .map(|o| {
                        let out = String::from_utf8_lossy(&o.stdout);
                        let err = String::from_utf8_lossy(&o.stderr);
                        let line = out.trim().lines().next().unwrap_or("").to_string();
                        if !line.is_empty() {
                            line
                        } else {
                            err.trim().lines().next().unwrap_or("").to_string()
                        }
                    })
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| format!("{} -m dot2tex", py.display())),
            };
            parts.push(format!("dot2tex: {} ({})", ver, dot2tex_display_path(inv)));
        }
        None => {
            parts.push("dot2tex: missing".into());
            all_ok = false;
        }
    }
    match &pdf2svg {
        Some(p) => parts.push(format!("pdf2svg: {}", p.display())),
        None => {
            parts.push("pdf2svg: missing".into());
            all_ok = false;
        }
    }

    LatexStatus {
        available: all_ok,
        version: Some(parts.join(" · ")),
        message: if all_ok {
            "LaTeX pipeline ready (xelatex + dot2tex + pdf2svg).".into()
        } else {
            "LaTeX pipeline incomplete: need xelatex, dot2tex (or python with dot2tex module), and pdf2svg each discoverable via the process PATH, or set DOTDESK_XELATEX / DOTDESK_DOT2TEX / DOTDESK_PDF2SVG / DOTDESK_PYTHON to absolute paths.".into()
        },
        process_path: crate::env_debug::process_path_numbered(),
    }
}

/// 调用 dot2tex 生成 **完整** LaTeX 文档（不使用 `--codeonly`）。
///
/// `--codeonly` 只输出 `\begin{tikzpicture}` 内代码，会省略序言里的
/// `\definecolor{strokecolor}{...}` 等定义，导致 `draw=strokecolor` 等报错。
fn run_dot2tex(inv: &Dot2texInvoker, source: &str) -> Result<String, String> {
    let mut child = match inv {
        Dot2texInvoker::Executable(p) => Command::new(p)
            .args(["--format=tikz", "--crop"])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("dot2tex spawn failed: {e}"))?,
        Dot2texInvoker::PythonModule(py) => Command::new(py)
            .args(["-m", "dot2tex", "--format=tikz", "--crop"])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("python -m dot2tex spawn failed: {e}"))?,
    };
    child
        .stdin
        .as_mut()
        .ok_or_else(|| "dot2tex stdin unavailable".to_string())?
        .write_all(source.as_bytes())
        .map_err(|e| format!("dot2tex stdin write failed: {e}"))?;
    let out = child
        .wait_with_output()
        .map_err(|e| format!("dot2tex wait failed: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "dot2tex exited with status {}: {}",
            out.status,
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

/// dot2tex 把 Graphviz 的 `style=rounded,filled` 等改成 TikZ 选项里的 `rounded`、`filled` 键名，
/// 这些**不是**现代 PGF 的合法 `/tikz/` 键，会触发 `I do not know the key '/tikz/rounded'`。
///
/// 另外部分图/dot2tex 版本不会在序言里定义 `fillcolor`，但 `filled` 仍会展开为 `fill=fillcolor`，
/// 故用 xcolor 的 `\providecolor` 给出与默认导图一致的兜底（已定义则跳过）。
fn inject_dot2tex_tikz_compat(tex: &str) -> String {
    const PATCH: &str = concat!(
        r"\providecolor{fillcolor}{HTML}{EEF4FF}",
        "\n",
        r"\providecolor{strokecolor}{HTML}{5B7CFA}",
        "\n",
        r"\tikzset{rounded/.style={rounded corners=3pt},filled/.style={fill=fillcolor}}",
    );
    if let Some(idx) = tex.find(r"\begin{document}") {
        let insert_at = idx + r"\begin{document}".len();
        let mut out = String::with_capacity(tex.len().checked_add(PATCH.len()).unwrap_or(tex.len()));
        out.push_str(&tex[..insert_at]);
        out.push('\n');
        out.push_str(PATCH);
        out.push('\n');
        out.push_str(&tex[insert_at..]);
        out
    } else {
        format!("{PATCH}\n{tex}")
    }
}

/// 通过 dot2tex + xelatex + pdf2svg 编译 DOT 源到 SVG（可选导出 PDF）。
///
/// 流程：
/// 1. dot2tex(stdin=DOT) → **完整** .tex（含颜色等序言；勿用 --codeonly）
/// 2. 写入临时目录 main.tex
/// 3. xelatex -interaction=nonstopmode -halt-on-error main.tex → main.pdf
/// 4. pdf2svg main.pdf main.svg
/// 5. 若提供 output_path 则把 main.pdf 复制过去
#[tauri::command]
pub fn compile_via_latex(
    source: String,
    output_path: Option<String>,
) -> Result<LatexRenderResult, String> {
    let xelatex = find_command("xelatex", Some("DOTDESK_XELATEX"))
        .ok_or_else(|| "xelatex not found on PATH".to_string())?;
    let dot2tex = find_dot2tex_invoker()
        .ok_or_else(|| "dot2tex not found on PATH (install dot2tex and ensure its directory is in PATH, or set DOTDESK_DOT2TEX / DOTDESK_PYTHON)".to_string())?;
    let pdf2svg = find_command("pdf2svg", Some("DOTDESK_PDF2SVG"))
        .ok_or_else(|| "pdf2svg not found on PATH".to_string())?;

    let tmp = tempdir_in_app()?;
    let tex_path = tmp.join("main.tex");
    let pdf_path = tmp.join("main.pdf");
    let svg_path = tmp.join("main.svg");

    // 1. dot → 完整 LaTeX（含序言中的颜色定义等）
    let tex_doc = match run_dot2tex(&dot2tex, &source) {
        Ok(s) => inject_dot2tex_tikz_compat(&s),
        Err(e) => {
            return Ok(LatexRenderResult {
                ok: false,
                svg: None,
                pdf_written: false,
                stdout: String::new(),
                stderr: e,
            });
        }
    };

    fs::write(&tex_path, &tex_doc).map_err(|e| format!("write tex: {e}"))?;

    // 2. xelatex
    let xeout = Command::new(&xelatex)
        .args(["-interaction=nonstopmode", "-halt-on-error"])
        .arg(format!(
            "-output-directory={}",
            tmp.to_string_lossy()
        ))
        .arg(&tex_path)
        .output()
        .map_err(|e| format!("xelatex spawn failed: {e}"))?;

    let xe_stdout = String::from_utf8_lossy(&xeout.stdout).to_string();
    let xe_stderr = String::from_utf8_lossy(&xeout.stderr).to_string();
    if !xeout.status.success() || !pdf_path.is_file() {
        return Ok(LatexRenderResult {
            ok: false,
            svg: None,
            pdf_written: false,
            stdout: xe_stdout,
            stderr: if xe_stderr.is_empty() {
                "xelatex failed; see stdout for log".into()
            } else {
                xe_stderr
            },
        });
    }

    // 3. pdf2svg
    let pdf2svg_out = Command::new(&pdf2svg)
        .arg(&pdf_path)
        .arg(&svg_path)
        .output()
        .map_err(|e| format!("pdf2svg spawn failed: {e}"))?;
    if !pdf2svg_out.status.success() || !svg_path.is_file() {
        return Ok(LatexRenderResult {
            ok: false,
            svg: None,
            pdf_written: false,
            stdout: xe_stdout,
            stderr: format!(
                "pdf2svg failed: {}",
                String::from_utf8_lossy(&pdf2svg_out.stderr)
            ),
        });
    }

    let svg = fs::read_to_string(&svg_path).map_err(|e| format!("read svg: {e}"))?;

    // 5. 可选：把 PDF 落到用户指定路径
    let mut pdf_written = false;
    if let Some(dest) = output_path {
        if !dest.is_empty() {
            let dest_path = PathBuf::from(&dest);
            fs::copy(&pdf_path, &dest_path).map_err(|e| format!("copy pdf to {dest}: {e}"))?;
            pdf_written = true;
        }
    }

    Ok(LatexRenderResult {
        ok: true,
        svg: Some(svg),
        pdf_written,
        stdout: xe_stdout,
        stderr: xe_stderr,
    })
}

/// 在系统 tmp 下为 dotdesk 创建一个稳定的工作目录（同一进程复用）。
fn tempdir_in_app() -> Result<PathBuf, String> {
    let base = env::temp_dir().join("dotdesk-latex");
    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("create tempdir: {e}"))?;
    }
    Ok(base)
}
