mod env_debug;
mod graphviz;
mod latex;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let menu = menu::build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::forward_event(app, event.id().0.as_str());
        })
        .invoke_handler(tauri::generate_handler![
            env_debug::get_process_path_debug,
            graphviz::check_graphviz,
            graphviz::render_dot_to_svg,
            latex::check_latex,
            latex::compile_via_latex,
        ])
        .run(tauri::generate_context!())
        .expect("error while running dotdesk");
}
