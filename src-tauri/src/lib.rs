mod license;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            license::get_license_status,
            license::install_license,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run 班阵 desktop application");
}
