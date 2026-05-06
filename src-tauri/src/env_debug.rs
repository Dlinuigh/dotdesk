use std::env;

/// 当前进程环境变量 `PATH` 按目录拆分并编号，便于在日志里核对搜索顺序。
pub fn process_path_numbered() -> String {
    match env::var("PATH") {
        Ok(p) if p.is_empty() => "(PATH is empty)".to_string(),
        Ok(p) => env::split_paths(&p)
            .enumerate()
            .map(|(i, d)| format!("{:>3}. {}", i + 1, d.display()))
            .collect::<Vec<_>>()
            .join("\n"),
        Err(_) => "(PATH unset)".to_string(),
    }
}

#[tauri::command]
pub fn get_process_path_debug() -> String {
    process_path_numbered()
}
