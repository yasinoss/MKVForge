pub mod executor;
pub mod grouping;
pub mod models;
pub mod probe;
pub mod subtitles;
pub mod tools;

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, Window};
use walkdir::WalkDir;

use crate::executor::{kill_process_by_pid, resume_process, run_job, suspend_process};
use crate::grouping::group_and_probe_files;
use crate::models::{ImportStats, QueueJobPayload, QueueState, ScanResult};
use crate::tools::Tools;

#[tauri::command]
fn center_window(window: Window) {
    let _ = window.center();
}

#[tauri::command]
fn start_drag(window: Window) {
    let _ = window.start_dragging();
}

#[tauri::command]
fn minimize_window(window: Window) {
    let _ = window.minimize();
}

#[tauri::command]
fn toggle_maximize(window: Window) {
    if let Ok(is_max) = window.is_maximized() {
        if is_max {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
}

#[tauri::command]
fn close_window(window: Window) {
    let _ = window.close();
}

#[tauri::command]
fn pause_queue(queue_state: State<Arc<QueueState>>) {
    queue_state.is_paused.store(true, Ordering::SeqCst);
    if let Ok(lock) = queue_state.active_pid.lock() {
        if let Some(pid) = *lock {
            #[cfg(windows)]
            suspend_process(pid);
        }
    }
}

#[tauri::command]
fn resume_queue(queue_state: State<Arc<QueueState>>) {
    queue_state.is_paused.store(false, Ordering::SeqCst);
    if let Ok(lock) = queue_state.active_pid.lock() {
        if let Some(pid) = *lock {
            #[cfg(windows)]
            resume_process(pid);
        }
    }
}

#[tauri::command]
fn skip_job(queue_state: State<Arc<QueueState>>) {
    queue_state.skip_current.store(true, Ordering::SeqCst);
    if let Ok(lock) = queue_state.active_pid.lock() {
        if let Some(pid) = *lock {
            #[cfg(windows)]
            kill_process_by_pid(pid);
        }
    }
}

#[tauri::command]
fn cancel_queue(queue_state: State<Arc<QueueState>>) {
    queue_state.cancel_requested.store(true, Ordering::SeqCst);
    queue_state.is_paused.store(false, Ordering::SeqCst);
    if let Ok(lock) = queue_state.active_pid.lock() {
        if let Some(pid) = *lock {
            #[cfg(windows)]
            kill_process_by_pid(pid);
        }
    }
}

#[tauri::command]
async fn pick_files() -> Vec<String> {
    if let Some(files) = rfd::AsyncFileDialog::new()
        .add_filter("Media Files", &["mkv", "mp4", "avi", "ts", "m4v", "mov", "webm", "srt", "ass", "ac3", "aac", "flac", "xml"])
        .add_filter("All Files (*.*)", &["*"])
        .pick_files()
        .await
    {
        files.into_iter().map(|p| p.path().to_string_lossy().to_string()).collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
async fn pick_attachment_files() -> Vec<String> {
    if let Some(files) = rfd::AsyncFileDialog::new()
        .add_filter("All Attachments (Fonts, Images, etc.)", &["ttf", "otf", "woff", "woff2", "jpg", "jpeg", "png", "webp", "bmp", "gif", "srt", "ass", "xml", "txt"])
        .add_filter("Fonts (*.ttf, *.otf, *.woff)", &["ttf", "otf", "woff", "woff2"])
        .add_filter("Images (*.jpg, *.png, *.webp)", &["jpg", "jpeg", "png", "webp", "bmp", "gif"])
        .add_filter("All Files (*.*)", &["*"])
        .pick_files()
        .await
    {
        files.into_iter().map(|p| p.path().to_string_lossy().to_string()).collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
async fn pick_image_file() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .add_filter("Images (*.jpg, *.png, *.webp, *.jpeg)", &["jpg", "jpeg", "png", "webp"])
        .add_filter("All Files (*.*)", &["*"])
        .pick_file()
        .await
        .map(|p| p.path().to_string_lossy().to_string())
}

#[tauri::command]
fn read_image_data_url(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.is_file() {
        return Err("File not found".to_string());
    }
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("jpg").to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        _ => "image/jpeg",
    };
    let bytes = std::fs::read(p).map_err(|e| e.to_string())?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[tauri::command]
async fn pick_folder() -> Option<String> {
    rfd::AsyncFileDialog::new()
        .pick_folder()
        .await
        .map(|p| p.path().to_string_lossy().to_string())
}

#[tauri::command]
fn save_settings(settings_json: String) -> Result<(), String> {
    let app_dir = std::env::var("LOCALAPPDATA")
        .map(|p| PathBuf::from(p).join("com.movieconverter.app"))
        .unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&app_dir);
    fs::write(app_dir.join("settings.json"), settings_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_settings() -> Option<String> {
    let app_dir = std::env::var("LOCALAPPDATA")
        .map(|p| PathBuf::from(p).join("com.movieconverter.app"))
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::read_to_string(app_dir.join("settings.json")).ok()
}

#[tauri::command]
fn detect_subtitle_language(path: String) -> String {
    crate::subtitles::detect_subtitle_language(Path::new(&path)).0
}

#[tauri::command]
fn download_cover_image(key: String, url: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("movie_converter_covers");
    let _ = fs::create_dir_all(&temp_dir);

    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    let url_hash = hasher.finish();

    let safe_key = key.replace([':', '/', '\\', '*', '?', '"', '<', '>', '|', ' '], "_");
    let clean_key: String = safe_key.chars().take(24).collect();
    let dest_path = temp_dir.join(format!("cover_{}_{:016x}.jpg", clean_key, url_hash));

    // Instant return if already downloaded and valid
    if dest_path.is_file() && fs::metadata(&dest_path).map(|m| m.len()).unwrap_or(0) > 200 {
        return Ok(dest_path.to_string_lossy().to_string());
    }

    // Use create_command to enforce CREATE_NO_WINDOW on Windows (prevents DOS console popup)
    let mut cmd = crate::tools::create_command("curl");
    cmd.args([
        "-sSL",
        "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MKVForge/2.0",
        "--connect-timeout", "5",
        "--max-time", "12",
        &url,
        "-o", dest_path.to_str().unwrap_or("cover.jpg")
    ]);
    let output = cmd.output().map_err(|e| format!("Failed to run curl: {}", e))?;

    if !output.status.success() {
        let _ = fs::remove_file(&dest_path);
        return Err(format!("curl failed with status {:?}", output.status));
    }
    if !dest_path.exists() || dest_path.metadata().map(|m| m.len()).unwrap_or(0) <= 200 {
        let _ = fs::remove_file(&dest_path);
        return Err("Downloaded cover file is empty or invalid".to_string());
    }
    Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_folder(path: String) {
    let p = Path::new(&path);
    if p.exists() {
        let _ = std::process::Command::new("explorer").arg(p).spawn();
    }
}

#[tauri::command]
fn open_url(url: String) {
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("mailto:") {
        #[cfg(target_os = "windows")]
        {
            let mut cmd = crate::tools::create_command("cmd");
            cmd.args(["/C", "start", "", &url]);
            let _ = cmd.spawn();
        }
    }
}

#[tauri::command]
fn scan_files(paths: Vec<String>) -> ScanResult {
    let tools = Tools::locate();
    let video_exts = ["mkv", "mp4", "avi", "ts", "m4v", "mov", "webm", "flv", "wmv", "vob", "ogv", "m2ts", "mts"];
    let audio_exts = ["ac3", "eac3", "aac", "flac", "mp3", "opus", "wav"];
    let sub_exts = ["srt", "ass", "ssa", "vtt", "sub"];

    let mut videos: Vec<String> = Vec::new();
    let mut others: Vec<String> = Vec::new();

    let mut a_cnt = 0;
    let mut s_cnt = 0;
    let mut c_cnt = 0;

    for p_str in paths {
        let p = PathBuf::from(&p_str);
        if p.is_dir() {
            for entry in WalkDir::new(&p).into_iter().flatten() {
                if entry.file_type().is_file() {
                    let ep = entry.path();
                    let ext = ep.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                    let e_str = ep.to_string_lossy().to_string();

                    if video_exts.contains(&ext.as_str()) {
                        videos.push(e_str);
                    } else if audio_exts.contains(&ext.as_str()) {
                        a_cnt += 1;
                        others.push(e_str);
                    } else if sub_exts.contains(&ext.as_str()) {
                        s_cnt += 1;
                        others.push(e_str);
                    } else if ext == "xml" && ep.file_name().unwrap().to_string_lossy().to_lowercase().contains("chapter") {
                        c_cnt += 1;
                        others.push(e_str);
                    }
                }
            }
        } else if p.is_file() {
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if video_exts.contains(&ext.as_str()) {
                videos.push(p_str);
            } else if audio_exts.contains(&ext.as_str()) {
                a_cnt += 1;
                others.push(p_str);
            } else if sub_exts.contains(&ext.as_str()) {
                s_cnt += 1;
                others.push(p_str);
            } else if ext == "xml" && p.file_name().unwrap().to_string_lossy().to_lowercase().contains("chapter") {
                c_cnt += 1;
                others.push(p_str);
            }
        }
    }

    let groups = group_and_probe_files(&videos, &others, &tools);
    let v_cnt = groups.len();

    ScanResult {
        stats: ImportStats {
            videos: v_cnt,
            audios: a_cnt,
            subtitles: s_cnt,
            chapters: c_cnt,
            groups: v_cnt,
        },
        groups,
    }
}

#[tauri::command]
async fn run_queue(
    app: AppHandle,
    jobs: Vec<QueueJobPayload>,
    queue_state: State<'_, Arc<QueueState>>,
) -> Result<(), String> {
    let tools = Tools::locate();
    let mut out_dirs: HashSet<PathBuf> = HashSet::new();

    queue_state.reset();

    for job in &jobs {
        out_dirs.insert(PathBuf::from(&job.output_folder));
    }

    for job in jobs {
        if queue_state.cancel_requested.load(Ordering::SeqCst) {
            break;
        }
        let _ = run_job(&app, job, &tools, &queue_state).await;
    }

    // Ensure all temporary folders are completely deleted across all output directories
    for out_dir in out_dirs {
        let temp_parent = out_dir.join(".temp_mc");
        if temp_parent.is_dir() {
            let _ = std::fs::remove_dir_all(&temp_parent);
        }
    }

    Ok(())
}

#[derive(serde::Deserialize)]
pub struct InPlaceItem {
    pub file_path: String,
    pub new_filename: Option<String>,
    pub cover_path: Option<String>,
}

#[derive(serde::Serialize)]
pub struct InPlaceResult {
    pub file_path: String,
    pub new_path: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
fn rename_file(old_path: String, new_path: String) -> Result<String, String> {
    let p_old = Path::new(&old_path);
    let p_new = Path::new(&new_path);
    if !p_old.is_file() {
        return Err("Source file does not exist".into());
    }
    if let Some(parent) = p_new.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::rename(p_old, p_new).map_err(|e| format!("Failed to rename file: {}", e))?;
    Ok(new_path)
}

#[tauri::command]
fn update_mkv_cover_in_place(file_path: String, cover_path: String) -> Result<(), String> {
    let p_file = Path::new(&file_path);
    let p_cover = Path::new(&cover_path);
    if !p_file.is_file() {
        return Err("Target file does not exist".into());
    }
    if !p_cover.is_file() {
        return Err("Cover image does not exist".into());
    }

    let tools = Tools::locate();
    let is_png = cover_path.to_lowercase().ends_with(".png");
    let mime = if is_png { "image/png" } else { "image/jpeg" };
    let att_name = if is_png { "cover.png" } else { "cover.jpg" };

    let mut cmd = tools::create_command(&tools.mkvpropedit);
    cmd.arg(&file_path)
        .arg("--delete-attachment")
        .arg("mime-type:image/jpeg")
        .arg("--delete-attachment")
        .arg("mime-type:image/png")
        .arg("--attachment-name")
        .arg(att_name)
        .arg("--attachment-mime-type")
        .arg(mime)
        .arg("--add-attachment")
        .arg(&cover_path);

    let output = cmd.output().map_err(|e| format!("Failed to run mkvpropedit: {}", e))?;
    let code = output.status.code().unwrap_or(-1);
    // In mkvpropedit: 0 = success, 1 = success with warnings (e.g. no existing attachment to delete). Only 2+ is error.
    if code != 0 && code != 1 {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        let out_msg = String::from_utf8_lossy(&output.stdout);
        return Err(format!("mkvpropedit error: {} {}", out_msg, err_msg));
    }

    Ok(())
}

#[tauri::command]
fn batch_in_place_action(items: Vec<InPlaceItem>) -> Vec<InPlaceResult> {
    let tools = Tools::locate();
    let mut results = Vec::new();

    for item in items {
        let cur_path = item.file_path.clone();
        let mut err_msg: Option<String> = None;
        let mut success = true;

        // 1. Update cover if requested
        if let Some(ref cover_p) = item.cover_path {
            if !cover_p.trim().is_empty() {
                let p_cover = Path::new(cover_p);
                if p_cover.is_file() && cur_path.to_lowercase().ends_with(".mkv") {
                    let is_png = cover_p.to_lowercase().ends_with(".png");
                    let mime = if is_png { "image/png" } else { "image/jpeg" };
                    let att_name = if is_png { "cover.png" } else { "cover.jpg" };

                    let mut cmd = tools::create_command(&tools.mkvpropedit);
                    cmd.arg(&cur_path)
                        .arg("--delete-attachment")
                        .arg("mime-type:image/jpeg")
                        .arg("--delete-attachment")
                        .arg("mime-type:image/png")
                        .arg("--attachment-name")
                        .arg(att_name)
                        .arg("--attachment-mime-type")
                        .arg(mime)
                        .arg("--add-attachment")
                        .arg(cover_p);

                    match cmd.output() {
                        Ok(output) => {
                            let code = output.status.code().unwrap_or(-1);
                            // 0 = ok, 1 = warning (file updated successfully). Only >= 2 is error.
                            if code != 0 && code != 1 {
                                let e = String::from_utf8_lossy(&output.stderr);
                                let o = String::from_utf8_lossy(&output.stdout);
                                err_msg = Some(format!("mkvpropedit failed: {} {}", o, e));
                                success = false;
                            }
                        },
                        Err(e) => {
                            err_msg = Some(format!("mkvpropedit spawn error: {}", e));
                            success = false;
                        }
                    }
                }
            }
        }

        // 2. Rename file if requested
        let mut final_path = cur_path.clone();
        if success {
            if let Some(ref new_name) = item.new_filename {
                if !new_name.trim().is_empty() {
                    let old_p = Path::new(&cur_path);
                    if let Some(parent) = old_p.parent() {
                        let safe_name = new_name
                            .replace(['<', '>', ':', '"', '/', '\\', '|', '?', '*'], "")
                            .trim()
                            .trim_matches(['.', '-', ' '])
                            .to_string();

                        if !safe_name.is_empty() {
                            let new_p = parent.join(&safe_name);
                            if new_p != old_p {
                                match fs::rename(old_p, &new_p) {
                                    Ok(_) => {
                                        final_path = new_p.to_string_lossy().to_string();
                                    },
                                    Err(e) => {
                                        let kind_msg = if e.kind() == std::io::ErrorKind::PermissionDenied {
                                            "File is currently in use or permission denied."
                                        } else {
                                            "Rename error"
                                        };
                                        err_msg = Some(format!("{}: {}", kind_msg, e));
                                        success = false;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        results.push(InPlaceResult {
            file_path: item.file_path,
            new_path: Some(final_path),
            success,
            error: err_msg,
        });
    }

    results
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let queue_state = Arc::new(QueueState::default());

    let res = tauri::Builder::default()
        .manage(queue_state)
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.center();
                let _ = w.show();
                let _ = w.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            center_window,
            start_drag,
            minimize_window,
            toggle_maximize,
            close_window,
            pause_queue,
            resume_queue,
            skip_job,
            cancel_queue,
            pick_files,
            pick_attachment_files,
            pick_folder,
            open_folder,
            scan_files,
            run_queue,
            save_settings,
            load_settings,
            detect_subtitle_language,
            download_cover_image,
            pick_image_file,
            read_image_data_url,
            rename_file,
            update_mkv_cover_in_place,
            batch_in_place_action,
            open_url
        ])
        .run(tauri::generate_context!());

    if let Err(e) = res {
        let _ = std::fs::write("d:\\Projects\\MKV Convert\\launch_err.txt", format!("Run error: {:?}\n", e));
    }
}
