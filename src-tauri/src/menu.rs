use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Wry,
};

/// 构建应用主菜单。
///
/// 设计：所有自定义菜单项都使用普通 `MenuItem`，点击时通过 `app.emit("menu", "<id>")`
/// 把 id 字符串发到前端；前端是真相来源（包括「面板可见性」「引擎选择」等可勾选状态），
/// 菜单只承担命令入口、不承载持久状态。这样避免了在 Rust 和 JS 之间来回同步勾选态。
pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    // macOS 的 App 子菜单（其他平台 Tauri 会忽略）
    let app_submenu = Submenu::with_items(
        app,
        "dotdesk",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("dotdesk"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    // File
    let file_open = MenuItem::with_id(app, "file:open", "Open\u{2026}", true, Some("CmdOrCtrl+O"))?;
    let file_save = MenuItem::with_id(app, "file:save", "Save", true, Some("CmdOrCtrl+S"))?;
    let file_render =
        MenuItem::with_id(app, "file:render", "Render Now", true, Some("CmdOrCtrl+R"))?;
    let file_export_svg = MenuItem::with_id(
        app,
        "file:export-svg",
        "Export SVG\u{2026}",
        true,
        Some("CmdOrCtrl+E"),
    )?;
    let file_export_pdf = MenuItem::with_id(
        app,
        "file:export-pdf",
        "Export PDF\u{2026}",
        true,
        Some("CmdOrCtrl+Shift+E"),
    )?;
    let file_submenu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &file_open,
            &file_save,
            &PredefinedMenuItem::separator(app)?,
            &file_render,
            &file_export_svg,
            &file_export_pdf,
        ],
    )?;

    // Edit（系统默认项）
    let edit_submenu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    // View
    let view_mindmap = MenuItem::with_id(
        app,
        "view:mode-mindmap",
        "Mind Map Mode",
        true,
        Some("CmdOrCtrl+1"),
    )?;
    let view_editor = MenuItem::with_id(
        app,
        "view:mode-editor",
        "DOT Editor Mode",
        true,
        Some("CmdOrCtrl+2"),
    )?;
    let view_style = MenuItem::with_id(
        app,
        "view:toggle-style",
        "Toggle Style Sidebar",
        true,
        Some("CmdOrCtrl+\\"),
    )?;
    let view_preview = MenuItem::with_id(
        app,
        "view:toggle-preview",
        "Toggle SVG Preview",
        true,
        Some("CmdOrCtrl+Shift+\\"),
    )?;
    let view_log = MenuItem::with_id(
        app,
        "view:toggle-log",
        "Toggle Render Log",
        true,
        Some("CmdOrCtrl+`"),
    )?;
    let view_submenu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &view_mindmap,
            &view_editor,
            &PredefinedMenuItem::separator(app)?,
            &view_style,
            &view_preview,
            &view_log,
        ],
    )?;

    // Render
    let render_check_graphviz = MenuItem::with_id(
        app,
        "render:check-graphviz",
        "Check Graphviz",
        true,
        None::<&str>,
    )?;
    let render_check_latex =
        MenuItem::with_id(app, "render:check-latex", "Check LaTeX", true, None::<&str>)?;
    let render_engine_dot = MenuItem::with_id(
        app,
        "render:engine-dot",
        "Engine: DOT (Graphviz)",
        true,
        None::<&str>,
    )?;
    let render_engine_latex = MenuItem::with_id(
        app,
        "render:engine-latex",
        "Engine: LaTeX",
        true,
        None::<&str>,
    )?;
    let render_submenu = Submenu::with_items(
        app,
        "Render",
        true,
        &[
            &render_engine_dot,
            &render_engine_latex,
            &PredefinedMenuItem::separator(app)?,
            &render_check_graphviz,
            &render_check_latex,
        ],
    )?;

    Menu::with_items(
        app,
        &[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &render_submenu,
        ],
    )
}

/// 把菜单事件 id 透传给前端。
pub fn forward_event(app: &AppHandle, event_id: &str) {
    let _ = app.emit("menu", event_id.to_string());
}
