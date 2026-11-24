use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::models::{AudioEncodingSettings, JobProgressEvent, QueueJobPayload, QueueState, Track, VideoEncodingSettings};
use crate::subtitles::{ensure_clean_utf8_subtitle, prepare_ass_for_burn};
use crate::tools::{create_command, Tools};

pub fn robust_remove_dir_all(path: &Path) {
    if !path.exists() {
        return;
    }
    for _ in 0..6 {
        if fs::remove_dir_all(path).is_ok() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(80));
    }
    let _ = fs::remove_dir_all(path);
}

pub fn cleanup_temp(temp_dir: &Path, out_folder: &Path) {
    robust_remove_dir_all(temp_dir);
    let parent = out_folder.join(".temp_mc");
    let _ = fs::remove_dir(&parent);
}

#[cfg(windows)]
pub fn suspend_process(pid: u32) {
    unsafe {
        type NtSuspendProcessFn = extern "system" fn(*mut std::ffi::c_void) -> i32;
        let ntdll = windows_sys::Win32::System::LibraryLoader::GetModuleHandleA(b"ntdll.dll\0".as_ptr());
        if !ntdll.is_null() {
            let func = windows_sys::Win32::System::LibraryLoader::GetProcAddress(ntdll, b"NtSuspendProcess\0".as_ptr());
            if let Some(suspend) = func {
                let suspend_fn: NtSuspendProcessFn = std::mem::transmute(suspend);
                let handle = windows_sys::Win32::System::Threading::OpenProcess(
                    windows_sys::Win32::System::Threading::PROCESS_SUSPEND_RESUME,
                    0,
                    pid,
                );
                if !handle.is_null() {
                    suspend_fn(handle);
                    windows_sys::Win32::Foundation::CloseHandle(handle);
                }
            }
        }
    }
}

#[cfg(windows)]
pub fn resume_process(pid: u32) {
    unsafe {
        type NtResumeProcessFn = extern "system" fn(*mut std::ffi::c_void) -> i32;
        let ntdll = windows_sys::Win32::System::LibraryLoader::GetModuleHandleA(b"ntdll.dll\0".as_ptr());
        if !ntdll.is_null() {
            let func = windows_sys::Win32::System::LibraryLoader::GetProcAddress(ntdll, b"NtResumeProcess\0".as_ptr());
            if let Some(resume) = func {
                let resume_fn: NtResumeProcessFn = std::mem::transmute(resume);
                let handle = windows_sys::Win32::System::Threading::OpenProcess(
                    windows_sys::Win32::System::Threading::PROCESS_SUSPEND_RESUME,
                    0,
                    pid,
                );
                if !handle.is_null() {
                    resume_fn(handle);
                    windows_sys::Win32::Foundation::CloseHandle(handle);
                }
            }
        }
    }
}

#[cfg(windows)]
pub fn kill_process_by_pid(pid: u32) {
    unsafe {
        let handle = windows_sys::Win32::System::Threading::OpenProcess(
            windows_sys::Win32::System::Threading::PROCESS_TERMINATE,
            0,
            pid,
        );
        if !handle.is_null() {
            windows_sys::Win32::System::Threading::TerminateProcess(handle, 1);
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
    }
}

fn probe_duration_secs(file_path: &Path, tools: &Tools) -> f64 {
    let mut cmd = create_command(&tools.ffprobe);
    cmd.args([
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1"
    ]);
    cmd.arg(file_path);

    if let Ok(output) = cmd.output() {
        if let Ok(s) = String::from_utf8(output.stdout) {
            if let Ok(d) = s.trim().parse::<f64>() {
                if d > 0.0 {
                    return d;
                }
            }
        }
    }
    0.0
}

fn escape_ffmpeg_filter_path(path_str: &str) -> String {
    let mut s = path_str.replace('\\', "/");
    s = s.replace(':', "\\:")
         .replace('\'', "'\\''");
    s
}

pub fn sanitize_lang_code(raw: &str) -> String {
    let trimmed = raw.trim().to_lowercase();
    if trimmed.is_empty() {
        return "und".to_string();
    }
    match trimmed.as_str() {
        "arabic" | "ara" | "ar" => "ara".to_string(),
        "english" | "eng" | "en" => "eng".to_string(),
        "french" | "fra" | "fre" | "fr" => "fre".to_string(),
        "german" | "ger" | "deu" | "de" => "ger".to_string(),
        "spanish" | "spa" | "es" => "spa".to_string(),
        "italian" | "ita" | "it" => "ita".to_string(),
        "japanese" | "jpn" | "ja" => "jpn".to_string(),
        "russian" | "rus" | "ru" => "rus".to_string(),
        "chinese" | "zho" | "chi" | "zh" => "chi".to_string(),
        "korean" | "kor" | "ko" => "kor".to_string(),
        "portuguese" | "por" | "pt" => "por".to_string(),
        "turkish" | "tur" | "tr" => "tur".to_string(),
        "hindi" | "hin" | "hi" => "hin".to_string(),
        "und" | "unknown" => "und".to_string(),
        other => {
            if (other.len() == 2 || other.len() == 3) && other.chars().all(|c| c.is_ascii_alphabetic()) {
                other.to_string()
            } else {
                "und".to_string()
            }
        }
    }
}

fn normalize_preset(codec: &str, preset: &str) -> Option<&'static str> {
    let lower_codec = codec.to_lowercase();
    let lower_preset = preset.to_lowercase();
    let is_nvenc = lower_codec.contains("nvenc");
    let is_amf = lower_codec.contains("amf");
    let is_qsv = lower_codec.contains("qsv");
    let is_x264_x265 = lower_codec.contains("x264") || lower_codec.contains("x265");

    if is_nvenc {
        match lower_preset.as_str() {
            "p1" | "fastest" | "ultrafast" => Some("p1"),
            "p2" | "superfast" => Some("p2"),
            "p3" | "veryfast" => Some("p3"),
            "p4" | "faster" | "fast" => Some("p4"),
            "p5" | "medium" | "default" => Some("p5"),
            "p6" | "slow" => Some("p6"),
            "p7" | "slower" | "veryslow" | "placebo" => Some("p7"),
            _ => Some("p5"),
        }
    } else if is_amf {
        match lower_preset.as_str() {
            "speed" | "fast" | "faster" | "veryfast" | "ultrafast" | "p1" | "p2" | "p3" => Some("speed"),
            "balanced" | "medium" | "default" | "p4" | "p5" => Some("balanced"),
            "quality" | "slow" | "slower" | "veryslow" | "p6" | "p7" => Some("quality"),
            _ => Some("balanced"),
        }
    } else if is_qsv {
        match lower_preset.as_str() {
            "veryfast" | "ultrafast" | "superfast" | "p1" | "p2" => Some("veryfast"),
            "fast" | "faster" | "p3" | "p4" => Some("fast"),
            "medium" | "default" | "balanced" | "p5" => Some("medium"),
            "slow" | "p6" => Some("slow"),
            "veryslow" | "slower" | "p7" => Some("veryslow"),
            _ => Some("medium"),
        }
    } else if is_x264_x265 {
        match lower_preset.as_str() {
            "p1" | "ultrafast" => Some("ultrafast"),
            "p2" | "superfast" => Some("superfast"),
            "p3" | "veryfast" => Some("veryfast"),
            "p4" | "faster" => Some("faster"),
            "fast" => Some("fast"),
            "p5" | "medium" | "default" => Some("medium"),
            "p6" | "slow" => Some("slow"),
            "p7" | "slower" => Some("slower"),
            "veryslow" => Some("veryslow"),
            "placebo" => Some("placebo"),
            _ => Some("medium"),
        }
    } else if lower_codec.contains("svtav1") || lower_codec.contains("av1") {
        match lower_preset.as_str() {
            "0" => Some("0"), "1" => Some("1"), "2" => Some("2"), "3" => Some("3"),
            "4" => Some("4"), "5" => Some("5"), "6" => Some("6"), "7" => Some("7"),
            "8" => Some("8"), "9" => Some("9"), "10" => Some("10"), "11" => Some("11"),
            "12" => Some("12"),
            "fast" | "faster" | "veryfast" => Some("8"),
            "medium" | "default" => Some("6"),
            "slow" | "slower" => Some("4"),
            _ => Some("6"),
        }
    } else {
        None
    }
}

fn normalize_tune(codec: &str, tune: &str) -> Option<&'static str> {
    let lower_codec = codec.to_lowercase();
    let lower_tune = tune.to_lowercase();
    let is_nvenc = lower_codec.contains("nvenc");
    let is_x264_x265 = lower_codec.contains("x264") || lower_codec.contains("x265");

    if is_nvenc {
        match lower_tune.as_str() {
            "hq" => Some("hq"),
            "ll" => Some("ll"),
            "ull" => Some("ull"),
            "lossless" => Some("lossless"),
            _ => None,
        }
    } else if is_x264_x265 {
        match lower_tune.as_str() {
            "film" => Some("film"),
            "animation" => Some("animation"),
            "grain" => Some("grain"),
            "stillimage" => Some("stillimage"),
            "fastdecode" => Some("fastdecode"),
            "zerolatency" => Some("zerolatency"),
            _ => None,
        }
    } else {
        None
    }
}

pub async fn run_job(
    app: &AppHandle,
    payload: QueueJobPayload,
    tools: &Tools,
    queue_state: &Arc<QueueState>,
) -> Result<(), String> {
    let key = payload.key.clone();

    // Check if queue cancel was already requested
    if queue_state.cancel_requested.load(Ordering::SeqCst) {
        return Err("Queue cancelled".to_string());
    }
    queue_state.skip_current.store(false, Ordering::SeqCst);

    // Helper to emit progress with monotonic forward-only guarantee
    let max_seen_pct = std::sync::atomic::AtomicU32::new(0);
    let emit_status = |pct: f32, speed: &str, status: &str, err: Option<String>| {
        let scaled_int = (pct.clamp(0.0, 100.0) * 10.0) as u32;
        let mut curr = max_seen_pct.load(Ordering::Relaxed);
        let effective_int = if status == "failed" || status == "waiting" || status == "skipped" {
            scaled_int
        } else {
            while scaled_int > curr {
                match max_seen_pct.compare_exchange_weak(curr, scaled_int, Ordering::SeqCst, Ordering::Relaxed) {
                    Ok(_) => { curr = scaled_int; break; }
                    Err(actual) => curr = actual,
                }
            }
            curr
        };
        let effective_pct = (effective_int as f32) / 10.0;

        let _ = app.emit(
            "job-progress",
            JobProgressEvent {
                key: key.clone(),
                progress: effective_pct,
                speed: speed.to_string(),
                status: status.to_string(),
                error: err,
            },
        );
    };

    emit_status(0.0, "", "running", None);

    let src_path = Path::new(&payload.source_path);
    let src_dir = src_path.parent().unwrap_or_else(|| Path::new("."));

    let mut out_folder = match payload.output_folder.as_str() {
        "same" => src_dir.to_path_buf(),
        "converted" => src_dir.join("Converted"),
        folder_str if folder_str.trim().is_empty() => src_dir.to_path_buf(),
        custom => PathBuf::from(custom),
    };

    // Determine output filename
    let raw_name = match &payload.output_filename {
        Some(name) if !name.trim().is_empty() => {
            let mut n = name.trim().to_string();
            if n.to_lowercase().ends_with(".mkv") {
                n.truncate(n.len() - 4);
            }
            n
        }
        _ => key.clone(),
    };
    // Replace colons with hyphen, remove illegal Windows characters (* ? " < > |), and normalize spaces
    let safe_stem = raw_name
        .replace(':', " - ")
        .replace(['/', '\\'], " - ")
        .replace(['*', '?', '"', '<', '>', '|'], "");
    let safe_stem = safe_stem.split_whitespace().collect::<Vec<&str>>().join(" ");
    let safe_stem = safe_stem.trim().trim_matches(['.', '-', ' ']);
    let out_filename = format!("{}.mkv", safe_stem);

    // Collision detection: If output file is identical to source file, auto-divert to "Converted" subfolder
    let mut final_mkv = out_folder.join(&out_filename);
    if final_mkv == src_path {
        out_folder = src_dir.join("Converted");
        final_mkv = out_folder.join(&out_filename);
    }
    fs::create_dir_all(&out_folder).map_err(|e| e.to_string())?;

    // Temp folder for this job
    let temp_dir = out_folder.join(".temp_mc").join(format!("job_{}", key.replace([' ', ':', '/', '\\'], "_")));
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let part_mkv = out_folder.join(format!("{}.part", out_filename));

    // Get input video duration for real progress calculation
    let total_duration_secs = probe_duration_secs(src_path, tools);
    let total_duration_us = (total_duration_secs * 1_000_000.0) as u64;

    // 1. Process and sanitize external subtitles to UTF-8 and enforce single default flags
    let mut sanitized_tracks = payload.tracks.clone();
    let mut default_sub_found = false;
    let mut default_audio_found = false;

    for t in &mut sanitized_tracks {
        if t.kind == "subtitle" && t.origin == "external" {
            let sub_p = Path::new(&t.source_path);
            if let Ok((clean_p, was_converted)) = ensure_clean_utf8_subtitle(sub_p, &temp_dir.join("subs")) {
                t.source_path = clean_p.to_string_lossy().to_string();
                if was_converted {
                    log::info!("Auto-converted subtitle to clean UTF-8: {}", t.name);
                }
            }
        }

        // Strictly enforce that at most ONE subtitle track is marked default
        if t.kind == "subtitle" && t.action != "remove" && t.action != "burn" {
            if t.is_default {
                if default_sub_found {
                    t.is_default = false;
                } else {
                    default_sub_found = true;
                }
            }
        }

        // Strictly enforce that at most ONE audio track is marked default
        if t.kind == "audio" && t.action != "remove" {
            if t.is_default {
                if default_audio_found {
                    t.is_default = false;
                } else {
                    default_audio_found = true;
                }
            }
        }
    }

    emit_status(5.0, "", "running", None);

    // 2. Video conversion if needed
    let mut temp_video_file: Option<PathBuf> = None;
    let video_track = sanitized_tracks.iter().find(|t| t.kind == "video");
    let burn_sub = sanitized_tracks.iter().find(|t| t.kind == "subtitle" && t.action == "burn").cloned();
    let a_is_copy = payload.audio_settings.as_ref().map(|a| a.codec == "copy" || a.codec.is_empty()).unwrap_or(false);
    let has_audio_to_convert = !a_is_copy && sanitized_tracks.iter().any(|t| t.kind == "audio" && t.action == "convert");
    let convert_audio = !a_is_copy && (match &payload.audio_settings {
        Some(a) => a.codec != "copy" && !a.codec.is_empty(),
        None => false,
    } || has_audio_to_convert);

    let dovi_action = payload.video_settings.as_ref().and_then(|v| v.dovi_action.as_deref()).unwrap_or("retain");
    let is_strip_dovi = dovi_action == "strip_hdr10";
    let is_convert_sdr = dovi_action == "convert_sdr";
    let is_convert_p81 = dovi_action == "convert_p81";

    if let Some(vt) = video_track {
        let v_is_copy = payload.video_settings.as_ref().map(|v| v.codec == "copy" || v.codec.is_empty()).unwrap_or(false);

        if is_convert_p81 && burn_sub.is_none() {
            let temp_vid = temp_dir.join("p81_dovi_video.hevc");
            let container_videos: Vec<&Track> = sanitized_tracks.iter()
                .filter(|t| t.kind == "video" && t.origin == "container")
                .collect();
            let v_sub_idx = container_videos.iter().position(|t| t.id == vt.id).unwrap_or(0);
            let v_stream_idx = format!("0:v:{}", v_sub_idx);

            // FFmpeg extracts HEVC bitstream directly to stdout pipe
            let mut ffmpeg_cmd = create_command(&tools.ffmpeg);
            ffmpeg_cmd.args([
                "-hide_banner", "-nostdin", "-y",
                "-progress", "pipe:2", "-nostats",
                "-i", &payload.source_path,
                "-map", &v_stream_idx,
                "-c:v", "copy",
                "-bsf:v", "hevc_mp4toannexb",
                "-an", "-sn", "-dn",
                "-f", "hevc",
                "pipe:1",
            ]);
            ffmpeg_cmd.stdout(Stdio::piped());
            ffmpeg_cmd.stderr(Stdio::piped());

            let mut ffmpeg_child = ffmpeg_cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
            let ffmpeg_pid = ffmpeg_child.id();
            if let Ok(mut apid) = queue_state.active_pid.lock() {
                *apid = Some(ffmpeg_pid);
            }

            let ffmpeg_stdout = ffmpeg_child.stdout.take().ok_or("Failed to open ffmpeg stdout pipe")?;

            // dovi_tool converts Profile 7 -> 8.1 directly from stdin pipe
            let mut dovi_cmd = create_command(&tools.dovi_tool);
            dovi_cmd.args([
                "-m", "2",
                "convert",
                "--discard",
                "-i", "-",
                "-o",
            ]);
            dovi_cmd.arg(&temp_vid);
            dovi_cmd.stdin(ffmpeg_stdout);
            dovi_cmd.stdout(Stdio::null());
            dovi_cmd.stderr(Stdio::piped());

            let mut dovi_child = dovi_cmd.spawn().map_err(|e| {
                let _ = ffmpeg_child.kill();
                format!("Failed to spawn dovi_tool: {}", e)
            })?;
            let dovi_pid = dovi_child.id();

            // Track progress via FFmpeg stderr progress pipe
            if let Some(stderr) = ffmpeg_child.stderr.take() {
                let reader = BufReader::new(stderr);
                for line_res in reader.lines().flatten() {
                    if queue_state.cancel_requested.load(Ordering::SeqCst) {
                        kill_process_by_pid(ffmpeg_pid);
                        kill_process_by_pid(dovi_pid);
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "", "waiting", None);
                        return Err("Queue cancelled".to_string());
                    }
                    if line_res.starts_with("out_time_us=") {
                        if let Ok(us) = line_res.trim_start_matches("out_time_us=").trim().parse::<u64>() {
                            if total_duration_us > 0 {
                                let sub_ratio = (us as f64 / total_duration_us as f64).clamp(0.0, 1.0);
                                let track_pct = (sub_ratio * 100.0) as f32;
                                let global_scale = if convert_audio { 70.0 } else { 83.0 };
                                let global_pct = 5.0 + (sub_ratio as f32 * global_scale);
                                emit_status(global_pct.clamp(0.0, 95.0), &format!("Converting Dolby Vision to Profile 8.1 · {:.0}%", track_pct), "running", None);
                            }
                        }
                    }
                }
            }

            let ffmpeg_status = ffmpeg_child.wait().map_err(|e| format!("FFmpeg error: {}", e))?;
            let dovi_status = dovi_child.wait().map_err(|e| format!("dovi_tool error: {}", e))?;

            if let Ok(mut apid) = queue_state.active_pid.lock() {
                *apid = None;
            }

            if !ffmpeg_status.success() || !dovi_status.success() || !temp_vid.is_file() || fs::metadata(&temp_vid).map(|m| m.len()).unwrap_or(0) == 0 {
                emit_status(0.0, "", "failed", Some("Dolby Vision Profile 8.1 conversion failed".to_string()));
                return Err("Dolby Vision Profile 8.1 conversion failed".to_string());
            }

            temp_video_file = Some(temp_vid);
        } else if is_strip_dovi && burn_sub.is_none() {
            let temp_vid = temp_dir.join("stripped_hdr10_video.hevc");
            let container_videos: Vec<&Track> = sanitized_tracks.iter()
                .filter(|t| t.kind == "video" && t.origin == "container")
                .collect();
            let v_sub_idx = container_videos.iter().position(|t| t.id == vt.id).unwrap_or(0);
            let v_stream_idx = format!("0:v:{}", v_sub_idx);

            let mut cmd = create_command(&tools.ffmpeg);
            cmd.args([
                "-hide_banner", "-nostdin", "-y",
                "-progress", "pipe:1", "-nostats",
                "-i", &payload.source_path,
                "-map", &v_stream_idx,
                "-c:v", "copy",
                "-bsf:v", "hevc_mp4toannexb,filter_units=remove_types=62",
                "-an", "-sn", "-dn",
                "-f", "hevc",
            ]);
            cmd.arg(&temp_vid);

            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
            let pid = child.id();
            if let Ok(mut apid) = queue_state.active_pid.lock() {
                *apid = Some(pid);
            }

            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                for line_res in reader.lines().flatten() {
                    if queue_state.cancel_requested.load(Ordering::SeqCst) {
                        kill_process_by_pid(pid);
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "", "waiting", None);
                        return Err("Queue cancelled".to_string());
                    }
                    if line_res.starts_with("out_time_us=") {
                        if let Ok(us) = line_res.trim_start_matches("out_time_us=").trim().parse::<u64>() {
                            if total_duration_us > 0 {
                                let sub_ratio = (us as f64 / total_duration_us as f64).clamp(0.0, 1.0);
                                let track_pct = (sub_ratio * 100.0) as f32;
                                let global_scale = if convert_audio { 70.0 } else { 83.0 };
                                let global_pct = 5.0 + (sub_ratio as f32 * global_scale);
                                emit_status(global_pct.clamp(0.0, 95.0), &format!("Stripping Dolby Vision · {:.0}%", track_pct), "running", None);
                            }
                        }
                    }
                }
            }

            let status = child.wait().map_err(|e| format!("Process error: {}", e))?;
            if let Ok(mut apid) = queue_state.active_pid.lock() {
                *apid = None;
            }

            if !status.success() || !temp_vid.is_file() || fs::metadata(&temp_vid).map(|m| m.len()).unwrap_or(0) == 0 {
                emit_status(0.0, "", "failed", Some("Dolby Vision stripping failed".to_string()));
                return Err("Dolby Vision stripping failed".to_string());
            }

            temp_video_file = Some(temp_vid);
        } else if (vt.action == "convert" || is_convert_sdr) && (!v_is_copy || is_convert_sdr || burn_sub.is_some()) {
            let temp_vid = temp_dir.join("encoded_video.mkv");
            let mut v_conf = payload.video_settings.clone().unwrap_or(VideoEncodingSettings {
                resolution: "original".to_string(),
                codec: "hevc_nvenc".to_string(),
                rate_control: "cqp".to_string(),
                quality_val: "22".to_string(),
                preset: "p5".to_string(),
                tune: "hq".to_string(),
                pix_fmt: "p010le".to_string(),
                fps: None,
                profile: None,
                level: None,
                multipass: None,
                aq: None,
                dovi_action: None,
            });

            if is_convert_sdr {
                if v_conf.codec == "copy" {
                    v_conf.codec = "h264_nvenc".to_string();
                }
                v_conf.pix_fmt = "yuv420p".to_string();
            }

            let container_videos: Vec<&Track> = sanitized_tracks.iter()
                .filter(|t| t.kind == "video" && t.origin == "container")
                .collect();
            let v_sub_idx = container_videos.iter().position(|t| t.id == vt.id).unwrap_or(0);
            let v_stream_idx = format!("0:v:{}", v_sub_idx);

            let v_lang = if vt.lang.is_empty() { "und" } else { &vt.lang };
            let mut cmd = create_command(&tools.ffmpeg);
            cmd.args([
                "-hide_banner", "-nostdin", "-y",
                "-progress", "pipe:1", "-nostats",
                "-i", &payload.source_path,
                "-map", &v_stream_idx,
                "-map_metadata", "-1",
                "-metadata:s:v:0", &format!("language={}", v_lang),
                "-an", "-sn", "-dn",
            ]);

            // Construct filterchain: Scaling and/or Subtitle Burning (Hardsub)
            let mut filter_chain: Vec<String> = Vec::new();

            if v_conf.resolution != "original" && !v_conf.resolution.is_empty() {
                let parts: Vec<&str> = v_conf.resolution.split('x').collect();
                if parts.len() == 2 {
                    filter_chain.push(format!("scale={}:{}:force_original_aspect_ratio=decrease", parts[0], parts[1]));
                }
            }

            // High-fidelity Hardsub Subtitle Burning (calibrated strictly to Media Player Classic - MPC-HC Default Style)
            // Generates an ASS file with Times New Roman Bold, Border: 2.0, Shadow: 3.0, Margins: 20, Alignment: 2 (bottom center)
            if let Some(ref bsub) = burn_sub {
                let burn_ass_file = temp_dir.join("subs").join("burn_calibrated.ass");
                let _ = fs::create_dir_all(temp_dir.join("subs"));

                let mut prepared = false;
                if bsub.origin == "container" {
                    let container_subs: Vec<&Track> = sanitized_tracks.iter()
                        .filter(|t| t.kind == "subtitle" && t.origin == "container")
                        .collect();
                    let si = container_subs.iter()
                        .position(|t| t.id == bsub.id || t.source_index == bsub.source_index)
                        .unwrap_or(0);

                    let is_ass = bsub.codec.to_lowercase().contains("ass") || bsub.codec.to_lowercase().contains("ssa");
                    let sub_ext = if is_ass { "ass" } else { "srt" };
                    let extracted_raw = temp_dir.join("subs").join(format!("embedded_sub_raw_{}.{}", si, sub_ext));

                    let mut ext_cmd = create_command(&tools.ffmpeg);
                    ext_cmd.args([
                        "-hide_banner", "-nostdin", "-y",
                        "-i", &payload.source_path,
                        "-map", &format!("0:s:{}", si),
                    ]);
                    if !is_ass {
                        ext_cmd.args(["-c:s", "srt"]);
                    }
                    ext_cmd.arg(&extracted_raw);
                    let ext_res = ext_cmd.status();

                    if ext_res.map(|s| s.success()).unwrap_or(false) && extracted_raw.is_file() {
                        if prepare_ass_for_burn(&extracted_raw, &burn_ass_file).is_ok() && burn_ass_file.is_file() {
                            prepared = true;
                        }
                    }
                } else if bsub.origin == "external" {
                    let ext_p = Path::new(&bsub.source_path);
                    if prepare_ass_for_burn(ext_p, &burn_ass_file).is_ok() && burn_ass_file.is_file() {
                        prepared = true;
                    }
                }

                if prepared {
                    let escaped_ass = escape_ffmpeg_filter_path(&burn_ass_file.to_string_lossy());
                    filter_chain.push(format!("ass='{}'", escaped_ass));
                    log::info!("Burning high-fidelity MPC-HC calibrated ASS subtitle: {}", burn_ass_file.display());
                } else {
                    let escaped_src = escape_ffmpeg_filter_path(&bsub.source_path);
                    filter_chain.push(format!("subtitles='{}'", escaped_src));
                }
            }

            if is_convert_sdr {
                filter_chain.push("zscale=tin=smpte2084:pin=bt2020:min=bt2020nc:t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:desat=0.5,zscale=t=bt709:m=bt709:r=tv,format=yuv420p".to_string());
                cmd.args(["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"]);
            } else if is_strip_dovi {
                cmd.args(["-bsf:v", "filter_units=remove_types=39"]);
            }

            if !filter_chain.is_empty() {
                cmd.args(["-vf", &filter_chain.join(",")]);
            }

            // Frame Rate limit if specified (e.g. "30")
            if let Some(ref fps) = v_conf.fps {
                if !fps.is_empty() {
                    cmd.args(["-r", fps]);
                }
            }

            // Codec & Rate Control
            let is_nvenc = v_conf.codec.contains("nvenc");
            let is_amf = v_conf.codec.contains("amf");
            let is_qsv = v_conf.codec.contains("qsv");
            cmd.args(["-c:v", &v_conf.codec]);

            if let Some(ref prof) = v_conf.profile {
                if !prof.is_empty() && prof != "auto" {
                    let prof_lower = prof.to_lowercase();
                    let is_hevc = v_conf.codec.contains("hevc") || v_conf.codec.contains("265");
                    let is_h264 = v_conf.codec.contains("264");
                    let valid_prof = if is_hevc {
                        match prof_lower.as_str() {
                            "main" | "main10" | "rext" => Some(prof.as_str()),
                            "high" | "baseline" => Some("main"),
                            _ => None,
                        }
                    } else if is_h264 {
                        match prof_lower.as_str() {
                            "baseline" | "main" | "high" | "high10" | "high422" | "high444" => Some(prof.as_str()),
                            "main10" => Some("high10"),
                            _ => None,
                        }
                    } else {
                        Some(prof.as_str())
                    };

                    if let Some(p) = valid_prof {
                        cmd.args(["-profile:v", p]);
                    }
                }
            }

            if let Some(ref lvl) = v_conf.level {
                if !lvl.is_empty() && lvl != "auto" {
                    cmd.args(["-level:v", lvl]);
                }
            }

            if is_nvenc {
                if let Some(ref mp) = v_conf.multipass {
                    match mp.as_str() {
                        "fullres" | "2" | "full" => {
                            cmd.args(["-multipass", "fullres"]);
                        }
                        "qres" | "1" => {
                            cmd.args(["-multipass", "qres"]);
                        }
                        "disabled" | "0" | "single" => {
                            cmd.args(["-multipass", "disabled"]);
                        }
                        _ => {}
                    }
                }

                let aq_active = burn_sub.is_some() || v_conf.aq.as_deref() == Some("enabled") || v_conf.aq.as_deref() == Some("1");
                if aq_active {
                    cmd.args(["-spatial-aq", "1", "-temporal-aq", "1", "-aq-strength", "8"]);
                }
                match v_conf.rate_control.as_str() {
                    "cqp" => {
                        cmd.args(["-rc", "vbr", "-cq", &v_conf.quality_val, "-b:v", "0"]);
                    }
                    "vbr" => {
                        let parsed_num = v_conf.quality_val.parse::<u32>().ok();
                        if let Some(num) = parsed_num {
                            if num <= 60 {
                                cmd.args(["-rc", "vbr", "-cq", &v_conf.quality_val, "-b:v", "0"]);
                            } else {
                                cmd.args(["-rc", "vbr", "-b:v", &format!("{}k", num)]);
                            }
                        } else {
                            let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('K') || v_conf.quality_val.ends_with('M') {
                                v_conf.quality_val.clone()
                            } else {
                                format!("{}k", v_conf.quality_val)
                            };
                            cmd.args(["-rc", "vbr", "-b:v", &b]);
                        }
                    }
                    "cbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        let num_val: u64 = v_conf.quality_val.trim_end_matches(|c: char| !c.is_numeric()).parse().unwrap_or(2000);
                        let buf = format!("{}k", num_val * 2);
                        cmd.args(["-rc", "cbr", "-b:v", &b, "-minrate", &b, "-maxrate", &b, "-bufsize", &buf]);
                    }
                    _ => {
                        cmd.args(["-rc", "vbr", "-cq", "22", "-b:v", "0"]);
                    }
                }

                if !v_conf.preset.is_empty() {
                    if let Some(p) = normalize_preset(&v_conf.codec, &v_conf.preset) {
                        cmd.args(["-preset", p]);
                    }
                }
                if !v_conf.tune.is_empty() && v_conf.tune != "none" {
                    if let Some(t) = normalize_tune(&v_conf.codec, &v_conf.tune) {
                        cmd.args(["-tune", t]);
                    }
                }
            } else if is_amf {
                // AMD Radeon AMF Hardware Encoder
                let q_val = v_conf.quality_val.trim_end_matches(|c: char| !c.is_numeric());
                let q_num = q_val.parse::<u32>().unwrap_or(22);
                let q_str = q_num.to_string();

                match v_conf.rate_control.as_str() {
                    "cqp" | "crf" => {
                        cmd.args(["-rc", "cqp", "-qp_i", &q_str, "-qp_p", &q_str]);
                    }
                    "vbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('K') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        cmd.args(["-rc", "vbr_latency", "-b:v", &b]);
                    }
                    "cbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        cmd.args(["-rc", "cbr", "-b:v", &b]);
                    }
                    _ => {
                        cmd.args(["-rc", "cqp", "-qp_i", "22", "-qp_p", "22"]);
                    }
                }

                if !v_conf.preset.is_empty() {
                    if let Some(p) = normalize_preset(&v_conf.codec, &v_conf.preset) {
                        cmd.args(["-quality", p]);
                    }
                }
            } else if is_qsv {
                // Intel Arc / QuickSync (QSV) Hardware Encoder
                let q_val = v_conf.quality_val.trim_end_matches(|c: char| !c.is_numeric());
                let q_num = q_val.parse::<u32>().unwrap_or(23);
                let q_str = q_num.to_string();

                match v_conf.rate_control.as_str() {
                    "cqp" | "crf" => {
                        cmd.args(["-global_quality", &q_str]);
                    }
                    "vbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('K') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        cmd.args(["-b:v", &b]);
                    }
                    "cbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        cmd.args(["-b:v", &b, "-maxrate", &b]);
                    }
                    _ => {
                        cmd.args(["-global_quality", "23"]);
                    }
                }

                if !v_conf.preset.is_empty() {
                    if let Some(p) = normalize_preset(&v_conf.codec, &v_conf.preset) {
                        cmd.args(["-preset", p]);
                    }
                }
            } else {
                // Software CPU (libx264 / libx265 / libvpx-vp9 / libsvtav1)
                match v_conf.rate_control.as_str() {
                    "cqp" | "crf" => {
                        if v_conf.codec.contains("vp9") || v_conf.codec.contains("svtav1") || v_conf.codec.contains("av1") {
                            cmd.args(["-b:v", "0", "-crf", &v_conf.quality_val]);
                        } else {
                            cmd.args(["-crf", &v_conf.quality_val]);
                        }
                    }
                    "vbr" => {
                        let parsed_num = v_conf.quality_val.parse::<u32>().ok();
                        if let Some(num) = parsed_num {
                            if num <= 60 {
                                cmd.args(["-crf", &v_conf.quality_val]);
                            } else {
                                cmd.args(["-b:v", &format!("{}k", num)]);
                            }
                        } else {
                            let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('K') || v_conf.quality_val.ends_with('M') {
                                v_conf.quality_val.clone()
                            } else {
                                format!("{}k", v_conf.quality_val)
                            };
                            cmd.args(["-b:v", &b]);
                        }
                    }
                    "cbr" => {
                        let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('M') {
                            v_conf.quality_val.clone()
                        } else {
                            format!("{}k", v_conf.quality_val)
                        };
                        let num_val: u64 = v_conf.quality_val.trim_end_matches(|c: char| !c.is_numeric()).parse().unwrap_or(2000);
                        let buf = format!("{}k", num_val * 2);
                        cmd.args(["-b:v", &b, "-minrate", &b, "-maxrate", &b, "-bufsize", &buf]);
                    }
                    _ => {
                        cmd.args(["-crf", "22"]);
                    }
                }

                if v_conf.codec.contains("vp9") {
                    cmd.args(["-deadline", "good", "-cpu-used", "2"]);
                } else if !v_conf.preset.is_empty() {
                    if let Some(p) = normalize_preset(&v_conf.codec, &v_conf.preset) {
                        cmd.args(["-preset", p]);
                    }
                }
                if !v_conf.tune.is_empty() && v_conf.tune != "none" && v_conf.tune != "faststart" {
                    if let Some(t) = normalize_tune(&v_conf.codec, &v_conf.tune) {
                        cmd.args(["-tune", t]);
                    }
                }
            }

            // Pixel format: Ensure H.264 automatically uses yuv420p (8-bit) because H.264 NVENC hardware rejects 10-bit p010le
            let effective_pix_fmt = if (v_conf.codec.contains("h264") || v_conf.codec.contains("264")) && v_conf.pix_fmt == "p010le" {
                "yuv420p"
            } else if !v_conf.pix_fmt.is_empty() {
                v_conf.pix_fmt.as_str()
            } else {
                "yuv420p"
            };
            cmd.args(["-pix_fmt", effective_pix_fmt]);

            cmd.arg(&temp_vid);
            cmd.stdout(Stdio::piped());
            cmd.stderr(Stdio::piped());

            let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
            let pid = child.id();
            if let Ok(mut lock) = queue_state.active_pid.lock() {
                *lock = Some(pid);
            }

            let stderr_output = Arc::new(std::sync::Mutex::new(String::new()));
            let stderr_output_clone = Arc::clone(&stderr_output);
            if let Some(stderr) = child.stderr.take() {
                std::thread::spawn(move || {
                    let reader = BufReader::new(stderr);
                    for line in reader.lines().flatten() {
                        if let Ok(mut buf) = stderr_output_clone.lock() {
                            buf.push_str(&line);
                            buf.push('\n');
                        }
                    }
                });
            }

            let mut current_speed = "Converting".to_string();

            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                for line_res in reader.lines() {
                    // Check cancellation
                    if queue_state.cancel_requested.load(Ordering::SeqCst) {
                        #[cfg(windows)]
                        kill_process_by_pid(pid);
                        let _ = child.kill();
                        if let Ok(mut lock) = queue_state.active_pid.lock() {
                            *lock = None;
                        }
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "", "waiting", None);
                        return Err("Queue cancelled".to_string());
                    }

                    // Check skip
                    if queue_state.skip_current.load(Ordering::SeqCst) {
                        #[cfg(windows)]
                        kill_process_by_pid(pid);
                        let _ = child.kill();
                        if let Ok(mut lock) = queue_state.active_pid.lock() {
                            *lock = None;
                        }
                        queue_state.skip_current.store(false, Ordering::SeqCst);
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "Skipped", "skipped", None);
                        return Ok(());
                    }

                    // Handle pause loop
                    while queue_state.is_paused.load(Ordering::SeqCst) {
                        if queue_state.cancel_requested.load(Ordering::SeqCst) || queue_state.skip_current.load(Ordering::SeqCst) {
                            break;
                        }
                        emit_status(5.0, "Paused", "paused", None);
                        std::thread::sleep(std::time::Duration::from_millis(150));
                    }

                    if let Ok(line) = line_res {
                        if line.starts_with("speed=") {
                            let s = line.trim_start_matches("speed=").trim();
                            if !s.is_empty() && s != "N/A" {
                                current_speed = s.to_string();
                            }
                        } else if line.starts_with("out_time_us=") {
                            if let Ok(us) = line.trim_start_matches("out_time_us=").trim().parse::<u64>() {
                                if total_duration_us > 0 {
                                    let sub_ratio = (us as f64 / total_duration_us as f64).clamp(0.0, 1.0);
                                    let track_pct = (sub_ratio * 100.0) as f32;
                                    let global_scale = if convert_audio { 70.0 } else { 83.0 };
                                    let global_pct = 5.0 + (sub_ratio as f32 * global_scale);
                                    let speed_display = if current_speed.is_empty() || current_speed == "Converting" {
                                        format!("Encoding Video · {:.0}%", track_pct)
                                    } else {
                                        format!("Encoding Video · {:.0}% · {}", track_pct, current_speed)
                                    };
                                    emit_status(global_pct.clamp(0.0, 95.0), &speed_display, "running", None);
                                }
                            }
                        }
                    }
                }
            }

            let status = child.wait().map_err(|e| format!("Error waiting on ffmpeg: {}", e))?;
            if let Ok(mut lock) = queue_state.active_pid.lock() {
                *lock = None;
            }

            if !status.success() {
                if queue_state.skip_current.load(Ordering::SeqCst) {
                    queue_state.skip_current.store(false, Ordering::SeqCst);
                    cleanup_temp(&temp_dir, &out_folder);
                    emit_status(0.0, "Skipped", "skipped", None);
                    return Ok(());
                }
                if queue_state.cancel_requested.load(Ordering::SeqCst) {
                    cleanup_temp(&temp_dir, &out_folder);
                    return Err("Cancelled".to_string());
                }

                let full_err = stderr_output.lock().map(|b| b.clone()).unwrap_or_default();
                log::error!("FFmpeg video encoding failed: {}", full_err);

                let is_hw = is_nvenc || is_amf || is_qsv;
                let is_hw_unsupported = full_err.contains("No NVENC capable devices")
                    || full_err.contains("Cannot load nvcuda.dll")
                    || full_err.contains("Cannot load nvh264")
                    || full_err.contains("Cannot load nvhevc")
                    || full_err.contains("Device creation failed")
                    || full_err.contains("No capable devices found")
                    || full_err.contains("Error initializing an MFX session")
                    || full_err.contains("AMF failed to initialize")
                    || full_err.contains("driver does not support");

                if is_hw && is_hw_unsupported {
                    let cpu_codec = if v_conf.codec.contains("hevc") || v_conf.codec.contains("265") { "libx265" } else { "libx264" };
                    log::warn!("Hardware encoder error, falling back to CPU {}", cpu_codec);
                    emit_status(5.0, &format!("Encoding Video (CPU Fallback: {})", cpu_codec), "running", None);

                    let mut cmd_fallback = create_command(&tools.ffmpeg);
                    cmd_fallback.args([
                        "-hide_banner", "-nostdin", "-y",
                        "-progress", "pipe:1", "-nostats",
                        "-i", &payload.source_path,
                        "-map", &v_stream_idx,
                        "-map_metadata", "-1",
                        "-metadata:s:v:0", &format!("language={}", v_lang),
                        "-an", "-sn", "-dn",
                    ]);
                    if !filter_chain.is_empty() {
                        cmd_fallback.args(["-vf", &filter_chain.join(",")]);
                    }
                    cmd_fallback.args(["-c:v", cpu_codec]);
                    match v_conf.rate_control.as_str() {
                        "cqp" | "crf" => {
                            cmd_fallback.args(["-crf", &v_conf.quality_val]);
                        }
                        "vbr" | "cbr" => {
                            let b = if v_conf.quality_val.ends_with('k') || v_conf.quality_val.ends_with('M') {
                                v_conf.quality_val.clone()
                            } else {
                                format!("{}k", v_conf.quality_val)
                            };
                            let num_val: u64 = v_conf.quality_val.trim_end_matches(|c: char| !c.is_numeric()).parse().unwrap_or(2000);
                            let buf = format!("{}k", num_val * 2);
                            cmd_fallback.args(["-b:v", &b, "-minrate", &b, "-maxrate", &b, "-bufsize", &buf]);
                        }
                        _ => {
                            cmd_fallback.args(["-crf", "22"]);
                        }
                    }
                    if let Some(p) = normalize_preset(cpu_codec, &v_conf.preset) {
                        cmd_fallback.args(["-preset", p]);
                    }
                    if let Some(t) = normalize_tune(cpu_codec, &v_conf.tune) {
                        cmd_fallback.args(["-tune", t]);
                    }
                    if !v_conf.pix_fmt.is_empty() {
                        cmd_fallback.args(["-pix_fmt", &v_conf.pix_fmt]);
                    }
                    cmd_fallback.arg(&temp_vid);
                    cmd_fallback.stdout(Stdio::piped());
                    cmd_fallback.stderr(Stdio::null());

                    let mut child_fb = cmd_fallback.spawn().map_err(|e| format!("Failed to spawn fallback: {}", e))?;
                    let pid_fb = child_fb.id();
                    if let Ok(mut lock) = queue_state.active_pid.lock() {
                        *lock = Some(pid_fb);
                    }
                    if let Some(stdout) = child_fb.stdout.take() {
                        let reader = BufReader::new(stdout);
                        let mut fb_speed = "".to_string();
                        for line_res in reader.lines().flatten() {
                            if line_res.starts_with("speed=") {
                                let s = line_res.trim_start_matches("speed=").trim();
                                if !s.is_empty() && s != "N/A" {
                                    fb_speed = s.to_string();
                                }
                            } else if line_res.starts_with("out_time_us=") {
                                if let Ok(us) = line_res.trim_start_matches("out_time_us=").trim().parse::<u64>() {
                                    if total_duration_us > 0 {
                                        let sub_ratio = (us as f64 / total_duration_us as f64).clamp(0.0, 1.0);
                                        let track_pct = (sub_ratio * 100.0) as f32;
                                        let global_scale = if convert_audio { 70.0 } else { 83.0 };
                                        let global_pct = 5.0 + (sub_ratio as f32 * global_scale);
                                        let speed_display = if fb_speed.is_empty() {
                                            format!("Encoding Video (CPU {}) · {:.0}%", cpu_codec, track_pct)
                                        } else {
                                            format!("Encoding Video (CPU {}) · {:.0}% · {}", cpu_codec, track_pct, fb_speed)
                                        };
                                        emit_status(global_pct.clamp(0.0, 95.0), &speed_display, "running", None);
                                    }
                                }
                            }
                        }
                    }
                    let fb_status = child_fb.wait().map_err(|e| format!("Fallback error: {}", e))?;
                    if let Ok(mut lock) = queue_state.active_pid.lock() {
                        *lock = None;
                    }
                    if !fb_status.success() {
                        emit_status(0.0, "", "failed", Some("Video encoding failed on CPU".to_string()));
                        return Err("Video encoding failed on CPU".to_string());
                    }
                } else {
                    let last_err = full_err.lines().filter(|l| l.contains("Error") || l.contains("error") || l.contains("Unable")).last().unwrap_or("Encoding error");
                    emit_status(0.0, "", "failed", Some(last_err.to_string()));
                    return Err(format!("Video encoding failed: {}", last_err));
                }
            }
            temp_video_file = Some(temp_vid);
        }
    }

    // 2.5 Audio conversion if requested
    let mut converted_audios: Vec<(PathBuf, Track)> = Vec::new();

    if convert_audio {
        let default_audio_cfg = AudioEncodingSettings {
            codec: "aac".to_string(),
            channels: "original".to_string(),
            bitrate: "192k".to_string(),
            sample_rate: "original".to_string(),
        };
        let a_conf_ref = payload.audio_settings.as_ref().unwrap_or(&default_audio_cfg);
        let actual_a_conf = if a_conf_ref.codec == "copy" || a_conf_ref.codec.is_empty() {
            &default_audio_cfg
        } else {
            a_conf_ref
        };
        let a_conf = actual_a_conf;

        let kept_audios_to_convert: Vec<Track> = if has_audio_to_convert {
            sanitized_tracks.iter()
                .filter(|t| t.kind == "audio" && t.action == "convert")
                .cloned()
                .collect()
        } else {
            sanitized_tracks.iter()
                .filter(|t| t.kind == "audio" && t.action != "remove")
                .cloned()
                .collect()
        };

        let num_audios = kept_audios_to_convert.len();
        for (a_idx, at) in kept_audios_to_convert.into_iter().enumerate() {
            if queue_state.cancel_requested.load(Ordering::SeqCst) {
                cleanup_temp(&temp_dir, &out_folder);
                emit_status(0.0, "", "waiting", None);
                return Err("Queue cancelled".to_string());
            }

            let temp_audio = temp_dir.join(format!("encoded_audio_{}.mka", a_idx));
            let src = if at.origin == "container" {
                &payload.source_path
            } else {
                &at.source_path
            };
            let container_audios: Vec<&Track> = sanitized_tracks.iter()
                .filter(|t| t.kind == "audio" && t.origin == "container")
                .collect();
            let a_sub_idx = container_audios.iter().position(|t| t.id == at.id).unwrap_or(0);
            let stream_idx = if at.origin == "container" {
                format!("0:a:{}", a_sub_idx)
            } else {
                "0:a:0".to_string()
            };

            let mut cmd_a = create_command(&tools.ffmpeg);
            cmd_a.args([
                "-hide_banner", "-nostdin", "-y",
                "-progress", "pipe:1", "-nostats",
                "-i", src,
                "-map", &stream_idx,
                "-vn", "-sn", "-dn",
            ]);

            let lower_codec = a_conf.codec.to_lowercase();
            let ffmpeg_acodec = match lower_codec.as_str() {
                "aac" => "aac",
                "ac3" => "ac3",
                "eac3" => "eac3",
                "opus" => "libopus",
                "flac" => "flac",
                "mp3" => "libmp3lame",
                other => other,
            };
            cmd_a.args(["-c:a", ffmpeg_acodec]);

            if a_conf.channels != "original" && !a_conf.channels.is_empty() {
                let channels_arg = match a_conf.channels.as_str() {
                    "stereo" | "2" => "2",
                    "mono" | "1" => "1",
                    "5.1" | "6" => "6",
                    "7.1" | "8" => "8",
                    other => other,
                };
                if channels_arg == "6" {
                    cmd_a.args(["-ac", "6", "-channel_layout", "5.1"]);
                } else if channels_arg == "8" {
                    cmd_a.args(["-ac", "8", "-channel_layout", "7.1"]);
                } else {
                    cmd_a.args(["-ac", channels_arg]);
                }
            }

            if a_conf.codec != "flac" && a_conf.bitrate != "copy" && !a_conf.bitrate.is_empty() {
                let b = if a_conf.bitrate.ends_with('k') || a_conf.bitrate.ends_with('K') || a_conf.bitrate.ends_with('M') {
                    a_conf.bitrate.clone()
                } else {
                    format!("{}k", a_conf.bitrate)
                };
                cmd_a.args(["-b:a", &b]);
            }

            if a_conf.sample_rate != "original" && !a_conf.sample_rate.is_empty() {
                cmd_a.args(["-ar", &a_conf.sample_rate]);
            }

            cmd_a.arg(&temp_audio);
            cmd_a.stdout(Stdio::piped());
            cmd_a.stderr(Stdio::null());

            let audio_base_pct = if temp_video_file.is_some() {
                75.0 + (a_idx as f32 / num_audios as f32) * 13.0
            } else {
                5.0 + (a_idx as f32 / num_audios as f32) * 80.0
            };
            let audio_slot_pct = if temp_video_file.is_some() {
                13.0 / num_audios as f32
            } else {
                80.0 / num_audios as f32
            };

            let init_status = format!("Encoding Audio ({}/{}) · {}", a_idx + 1, num_audios, a_conf.codec.to_uppercase());
            emit_status(audio_base_pct, &init_status, "running", None);

            let mut child_a = cmd_a.spawn().map_err(|e| format!("Failed to spawn ffmpeg audio: {}", e))?;
            let pid_a = child_a.id();
            if let Ok(mut lock) = queue_state.active_pid.lock() {
                *lock = Some(pid_a);
            }

            let mut a_speed = "".to_string();
            if let Some(stdout) = child_a.stdout.take() {
                let reader = BufReader::new(stdout);
                for line_res in reader.lines() {
                    if queue_state.cancel_requested.load(Ordering::SeqCst) {
                        #[cfg(windows)]
                        kill_process_by_pid(pid_a);
                        let _ = child_a.kill();
                        if let Ok(mut lock) = queue_state.active_pid.lock() {
                            *lock = None;
                        }
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "", "waiting", None);
                        return Err("Queue cancelled".to_string());
                    }

                    if queue_state.skip_current.load(Ordering::SeqCst) {
                        #[cfg(windows)]
                        kill_process_by_pid(pid_a);
                        let _ = child_a.kill();
                        if let Ok(mut lock) = queue_state.active_pid.lock() {
                            *lock = None;
                        }
                        queue_state.skip_current.store(false, Ordering::SeqCst);
                        cleanup_temp(&temp_dir, &out_folder);
                        emit_status(0.0, "Skipped", "skipped", None);
                        return Ok(());
                    }

                    while queue_state.is_paused.load(Ordering::SeqCst) {
                        if queue_state.cancel_requested.load(Ordering::SeqCst) || queue_state.skip_current.load(Ordering::SeqCst) {
                            break;
                        }
                        emit_status(audio_base_pct, "Paused", "paused", None);
                        std::thread::sleep(std::time::Duration::from_millis(150));
                    }

                    if let Ok(line) = line_res {
                        if line.starts_with("speed=") {
                            let s = line.trim_start_matches("speed=").trim();
                            if !s.is_empty() && s != "N/A" {
                                a_speed = s.to_string();
                            }
                        } else if line.starts_with("out_time_us=") {
                            if let Ok(us) = line.trim_start_matches("out_time_us=").trim().parse::<u64>() {
                                if total_duration_us > 0 {
                                    let sub_ratio = (us as f64 / total_duration_us as f64).clamp(0.0, 1.0) as f32;
                                    let global_pct = audio_base_pct + (sub_ratio * audio_slot_pct);
                                    let track_pct = (sub_ratio * 100.0).clamp(0.0, 100.0);
                                    let speed_display = if a_speed.is_empty() {
                                        format!("Encoding Audio ({}/{}) · {} · {:.0}%", a_idx + 1, num_audios, a_conf.codec.to_uppercase(), track_pct)
                                    } else {
                                        format!("Encoding Audio ({}/{}) · {} · {:.0}% · {}", a_idx + 1, num_audios, a_conf.codec.to_uppercase(), track_pct, a_speed)
                                    };
                                    emit_status(global_pct.clamp(0.0, 95.0), &speed_display, "running", None);
                                }
                            }
                        }
                    }
                }
            }

            let status_a = child_a.wait().map_err(|e| format!("Audio encode error: {}", e))?;
            if let Ok(mut lock) = queue_state.active_pid.lock() {
                *lock = None;
            }

            if !status_a.success() {
                // If libopus failed, try fallback to opus
                if ffmpeg_acodec == "libopus" {
                    log::warn!("libopus failed, retrying with built-in opus encoder");
                    let mut cmd_retry = create_command(&tools.ffmpeg);
                    cmd_retry.args([
                        "-hide_banner", "-nostdin", "-y",
                        "-i", src,
                        "-map", &stream_idx,
                        "-vn", "-sn", "-dn",
                        "-c:a", "opus",
                    ]);
                    if a_conf.channels != "original" && !a_conf.channels.is_empty() {
                        let channels_arg = match a_conf.channels.as_str() {
                            "stereo" | "2" => "2",
                            "mono" | "1" => "1",
                            "5.1" | "6" => "6",
                            "7.1" | "8" => "8",
                            other => other,
                        };
                        if channels_arg == "6" {
                            cmd_retry.args(["-ac", "6", "-channel_layout", "5.1"]);
                        } else if channels_arg == "8" {
                            cmd_retry.args(["-ac", "8", "-channel_layout", "7.1"]);
                        } else {
                            cmd_retry.args(["-ac", channels_arg]);
                        }
                    }
                    if a_conf.bitrate != "copy" && !a_conf.bitrate.is_empty() {
                        let b = if a_conf.bitrate.ends_with('k') || a_conf.bitrate.ends_with('K') { a_conf.bitrate.clone() } else { format!("{}k", a_conf.bitrate) };
                        cmd_retry.args(["-b:a", &b]);
                    }
                    cmd_retry.arg(&temp_audio);
                    let retry_res = cmd_retry.status();
                    if retry_res.is_err() || !retry_res.unwrap().success() {
                        emit_status(0.0, "", "failed", Some("Audio encoding failed".to_string()));
                        return Err("Audio encoding failed".to_string());
                    }
                } else {
                    emit_status(0.0, "", "failed", Some("Audio encoding failed".to_string()));
                    return Err("Audio encoding failed".to_string());
                }
            }

            log::info!("Encoded audio track {} with codec {} to {}", at.name, a_conf.codec, temp_audio.display());
            converted_audios.push((temp_audio, at));
        }
    }

    let base_mkv_pct = if temp_video_file.is_some() || convert_audio { 88.0 } else { 5.0 };
    let mkv_pct_scale = (100.0 - base_mkv_pct) / 100.0;
    emit_status(base_mkv_pct, "Muxing", "running", None);

    // 3. Final mkvmerge assembly
    let mut mkv_cmd = create_command(&tools.mkvmerge);
    mkv_cmd.args(["--gui-mode", "-o"]).arg(&part_mkv);
    // Automatically strip old container title from output MKV file
    mkv_cmd.args(["--title", ""]);

    // If a clean/re-encoded video file exists, add it first so Video is always Track 0
    if let Some(ref tv) = temp_video_file {
        let v_lang = if let Some(vt) = video_track {
            sanitize_lang_code(&vt.lang)
        } else {
            "und".to_string()
        };
        let v_name = if let Some(vt) = video_track {
            if vt.name.trim().starts_with("Track ") || vt.name.trim().is_empty() {
                ""
            } else {
                vt.name.trim()
            }
        } else {
            ""
        };
        mkv_cmd.args([
            "--track-name", &format!("0:{}", v_name),
            "--language", &format!("0:{}", v_lang),
            "--default-track-flag", "0:yes"
        ]).arg(tv);
    }

    let kept_subs: Vec<String> = sanitized_tracks.iter()
        .filter(|t| t.kind == "subtitle" && t.origin == "container" && t.action != "remove" && t.action != "burn")
        .map(|t| t.source_index.to_string())
        .collect();

    if temp_video_file.is_some() {
        mkv_cmd.arg("--no-video");
    }

    let converted_ids: Vec<String> = converted_audios.iter().map(|(_, t)| t.id.clone()).collect();
    let kept_container_audios: Vec<String> = sanitized_tracks.iter()
        .filter(|t| t.kind == "audio" && t.origin == "container" && t.action != "remove" && !converted_ids.contains(&t.id))
        .map(|t| t.source_index.to_string())
        .collect();

    if kept_container_audios.is_empty() {
        mkv_cmd.arg("--no-audio");
    } else {
        mkv_cmd.args(["--audio-tracks", &kept_container_audios.join(",")]);
    }

    if kept_subs.is_empty() {
        mkv_cmd.arg("--no-subtitles");
    } else {
        mkv_cmd.args(["--subtitle-tracks", &kept_subs.join(",")]);
    }

    if payload.remove_old_attachments {
        mkv_cmd.arg("--no-attachments");
    }

    // Set properties for kept container tracks (skipping re-encoded video and audio, and skipping chapters)
    for t in &sanitized_tracks {
        if t.origin == "container" && t.action != "remove" && t.action != "burn" {
            if t.kind == "video" && temp_video_file.is_some() {
                continue;
            }
            if t.kind == "audio" && converted_ids.contains(&t.id) {
                continue;
            }
            if t.kind == "chapters" {
                continue;
            }

            let tid = t.source_index;
            let lang = sanitize_lang_code(&t.lang);
            let clean_name = if t.name.trim().starts_with("Track ") || t.name.trim().is_empty() {
                ""
            } else {
                t.name.trim()
            };
            mkv_cmd.args([
                "--track-name", &format!("{}:{}", tid, clean_name),
                "--language", &format!("{}:{}", tid, lang),
                "--default-track-flag", &format!("{}:{}", tid, if t.is_default { "yes" } else { "no" }),
                "--forced-display-flag", &format!("{}:{}", tid, if t.is_forced { "yes" } else { "no" }),
            ]);
            if t.delay != 0 {
                mkv_cmd.args(["--sync", &format!("{}:{}", tid, t.delay)]);
            }
        }
    }

    // Source container file
    mkv_cmd.arg(src_path);

    // Append converted audios if present
    if convert_audio {
        for (temp_audio_file, at) in &converted_audios {
            let a_lang = sanitize_lang_code(&at.lang);
            let a_name = if at.name.trim().starts_with("Track ") || at.name.trim().is_empty() {
                ""
            } else {
                at.name.trim()
            };
            mkv_cmd.args([
                "--track-name", &format!("0:{}", a_name),
                "--language", &format!("0:{}", a_lang),
                "--default-track-flag", &format!("0:{}", if at.is_default { "yes" } else { "no" }),
                "--forced-display-flag", &format!("0:{}", if at.is_forced { "yes" } else { "no" }),
            ]);
            if at.delay != 0 {
                mkv_cmd.args(["--sync", &format!("0:{}", at.delay)]);
            }
            mkv_cmd.arg(temp_audio_file);
        }
    }

    // Append external audio/subs
    for t in &sanitized_tracks {
        if t.origin == "external" && (t.action == "add" || t.action == "keep") {
            if t.kind == "audio" && converted_ids.contains(&t.id) {
                continue; // Already converted and appended above
            }
            let ext_lang = sanitize_lang_code(&t.lang);
            let ext_name = if t.name.trim().starts_with("Track ") || t.name.trim().is_empty() {
                ""
            } else {
                t.name.trim()
            };
            mkv_cmd.args([
                "--track-name", &format!("0:{}", ext_name),
                "--language", &format!("0:{}", ext_lang),
                "--default-track-flag", &format!("0:{}", if t.is_default { "yes" } else { "no" }),
                "--forced-display-flag", &format!("0:{}", if t.is_forced { "yes" } else { "no" }),
            ]);
            if t.delay != 0 {
                mkv_cmd.args(["--sync", &format!("0:{}", t.delay)]);
            }
            mkv_cmd.arg(&t.source_path);
        }
    }

    // Shared attachments
    for att in &payload.shared_attachments {
        let p = Path::new(att);
        if p.is_file() {
            mkv_cmd.args(["--attach-file", att]);
        }
    }

    // Cover image attachment (Matroska cover.jpg standard)
    if let Some(ref cover_str) = payload.cover_image_path {
        let cp = Path::new(cover_str);
        if cp.is_file() {
            let mime = if cover_str.to_lowercase().ends_with(".png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            mkv_cmd.args([
                "--attach-file", cover_str,
                "--attachment-name", "cover.jpg",
                "--attachment-mime-type", mime,
            ]);
        }
    }

    mkv_cmd.stdout(Stdio::piped());
    mkv_cmd.stderr(Stdio::piped());

    let mut mkv_child = mkv_cmd.spawn().map_err(|e| format!("Failed to spawn mkvmerge: {}", e))?;
    let mkv_pid = mkv_child.id();
    if let Ok(mut lock) = queue_state.active_pid.lock() {
        *lock = Some(mkv_pid);
    }

    let mkv_err_buf = Arc::new(std::sync::Mutex::new(String::new()));
    let mkv_err_clone = Arc::clone(&mkv_err_buf);
    if let Some(stderr) = mkv_child.stderr.take() {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                if let Ok(mut buf) = mkv_err_clone.lock() {
                    buf.push_str(&line);
                    buf.push('\n');
                }
            }
        });
    }

    if let Some(stdout) = mkv_child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line_res in reader.lines() {
            if queue_state.cancel_requested.load(Ordering::SeqCst) {
                #[cfg(windows)]
                kill_process_by_pid(mkv_pid);
                let _ = mkv_child.kill();
                if let Ok(mut lock) = queue_state.active_pid.lock() {
                    *lock = None;
                }
                cleanup_temp(&temp_dir, &out_folder);
                emit_status(0.0, "", "waiting", None);
                return Err("Queue cancelled".to_string());
            }

            if queue_state.skip_current.load(Ordering::SeqCst) {
                #[cfg(windows)]
                kill_process_by_pid(mkv_pid);
                let _ = mkv_child.kill();
                if let Ok(mut lock) = queue_state.active_pid.lock() {
                    *lock = None;
                }
                queue_state.skip_current.store(false, Ordering::SeqCst);
                cleanup_temp(&temp_dir, &out_folder);
                emit_status(0.0, "Skipped", "skipped", None);
                return Ok(());
            }

            while queue_state.is_paused.load(Ordering::SeqCst) {
                if queue_state.cancel_requested.load(Ordering::SeqCst) || queue_state.skip_current.load(Ordering::SeqCst) {
                    break;
                }
                emit_status(base_mkv_pct, "Paused", "paused", None);
                std::thread::sleep(std::time::Duration::from_millis(150));
            }

            if let Ok(line) = line_res {
                if line.starts_with("#GUI#progress ") {
                    let pct_part = line.trim_start_matches("#GUI#progress ").trim().trim_end_matches('%');
                    if let Ok(p) = pct_part.parse::<f32>() {
                        let final_pct = base_mkv_pct + (p * mkv_pct_scale);
                        let mux_str = format!("Muxing Final MKV · {:.0}%", p);
                        emit_status(final_pct, &mux_str, "running", None);
                    }
                } else if line.starts_with("Error:") || line.starts_with("Warning:") {
                    if let Ok(mut buf) = mkv_err_buf.lock() {
                        buf.push_str(&line);
                        buf.push('\n');
                    }
                }
            }
        }
    }

    let mkv_status = mkv_child.wait().map_err(|e| format!("mkvmerge failed: {}", e))?;
    if let Ok(mut lock) = queue_state.active_pid.lock() {
        *lock = None;
    }

    let exit_code = mkv_status.code().unwrap_or(0);
    let captured_err = mkv_err_buf.lock().map(|b| b.clone()).unwrap_or_default();

    // In mkvmerge: 0 = success, 1 = success with warnings, 2 = fatal error
    let is_successful = (exit_code == 0 || exit_code == 1)
        && part_mkv.is_file()
        && fs::metadata(&part_mkv).map(|m| m.len()).unwrap_or(0) > 0;

    if !is_successful {
        let err_detail = if !captured_err.trim().is_empty() {
            captured_err.trim().to_string()
        } else {
            format!("mkvmerge exit code {}", exit_code)
        };
        log::error!("mkvmerge assembly failed: {}", err_detail);
        emit_status(0.0, "", "failed", Some(format!("mkvmerge assembly failed: {}", err_detail)));
        return Err(format!("mkvmerge assembly failed: {}", err_detail));
    }

    // 4. Validate and rename part file
    if !part_mkv.is_file() || fs::metadata(&part_mkv).map(|m| m.len()).unwrap_or(0) == 0 {
        emit_status(0.0, "", "failed", Some("Output file empty or missing".to_string()));
        return Err("Output file empty".to_string());
    }

    if final_mkv.is_file() {
        let _ = fs::remove_file(&final_mkv);
    }
    fs::rename(&part_mkv, &final_mkv).map_err(|e| e.to_string())?;

    // 5. Delete original if requested (Recycle Bin)
    if payload.delete_originals && src_path.is_file() {
        let _ = trash::delete(src_path);
    }

    // 6. Cleanup temp directory for this job
    cleanup_temp(&temp_dir, &out_folder);

    emit_status(100.0, "Done", "done", None);
    Ok(())
}
