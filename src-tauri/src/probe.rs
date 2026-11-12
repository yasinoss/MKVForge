use std::path::Path;
use serde_json::Value;

use crate::models::Track;
use crate::tools::{create_command, Tools};

pub fn probe_video_tracks(file_path: &Path, tools: &Tools) -> Vec<Track> {
    let mut tracks = Vec::new();

    // 1. Try mkvmerge -J (best for MKV)
    if let Ok(output) = create_command(&tools.mkvmerge)
        .arg("--identification-format")
        .arg("json")
        .arg("--identify")
        .arg(file_path)
        .output()
    {
        if output.status.success() {
            if let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) {
                if let Some(track_list) = json["tracks"].as_array() {
                    for t in track_list {
                        let t_type = t["type"].as_str().unwrap_or("");
                        let kind = match t_type {
                            "video" => "video",
                            "audio" => "audio",
                            "subtitles" => "subtitle",
                            _ => continue,
                        };

                        let tid = t["id"].as_u64().unwrap_or(0) as usize;
                        let props = &t["properties"];
                        let raw_lang = props["language"].as_str().unwrap_or("und");
                        let lang = if kind == "video" { "und" } else { raw_lang };
                        let codec = t["codec"].as_str().unwrap_or(props["codec_id"].as_str().unwrap_or("Unknown"));
                        let name = props["track_name"].as_str().unwrap_or("");
                        let is_default = props["default_track"].as_bool().unwrap_or(false);
                        let is_forced = props["forced_track"].as_bool().unwrap_or(false);

                        let (w, h, hdr) = if kind == "video" {
                            let mut parsed_w = None;
                            let mut parsed_h = None;
                            if let Some(dim_str) = props["pixel_dimensions"].as_str().or_else(|| props["display_dimensions"].as_str()) {
                                let parts: Vec<&str> = dim_str.split('x').collect();
                                if parts.len() == 2 {
                                    parsed_w = parts[0].trim().parse::<u32>().ok();
                                    parsed_h = parts[1].trim().parse::<u32>().ok();
                                }
                            }
                            // Probe HDR strictly from video file stream metadata (never from filename)
                            let mut hdr_info = probe_video_stream_hdr(file_path, tools);
                            if hdr_info.is_none() {
                                hdr_info = detect_hdr_from_mkv_props(props);
                            }
                            (parsed_w, parsed_h, hdr_info)
                        } else {
                            (None, None, None)
                        };

                        tracks.push(Track {
                            id: format!("cnt:{}", tid),
                            kind: kind.to_string(),
                            name: if name.is_empty() { format!("Track {}", tid) } else { name.to_string() },
                            origin: "container".to_string(),
                            source_path: file_path.to_string_lossy().to_string(),
                            source_index: tid,
                            codec: codec.to_string(),
                            lang: lang.to_string(),
                            is_default,
                            is_forced,
                            delay: 0,
                            action: if kind == "video" { "convert".to_string() } else { "keep".to_string() },
                            width: w,
                            height: h,
                            hdr,
                        });
                    }

                    // Check chapters
                    if let Some(chaps) = json["chapters"].as_array() {
                        if !chaps.is_empty() {
                            tracks.push(Track {
                                id: "chap:0".to_string(),
                                kind: "chapters".to_string(),
                                name: format!("{} chapters", chaps.len()),
                                origin: "container".to_string(),
                                source_path: file_path.to_string_lossy().to_string(),
                                source_index: 0,
                                codec: "Chapters".to_string(),
                                lang: "und".to_string(),
                                is_default: false,
                                is_forced: false,
                                delay: 0,
                                action: "keep".to_string(),
                                width: None,
                                height: None,
                                hdr: None,
                            });
                        }
                    }

                    if !tracks.is_empty() {
                        return tracks;
                    }
                }
            }
        }
    }

    // 2. Fallback to ffprobe
    if let Ok(output) = create_command(&tools.ffprobe)
        .args(["-v", "quiet", "-print_format", "json", "-show_streams", "-show_chapters"])
        .arg(file_path)
        .output()
    {
        if output.status.success() {
            if let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) {
                if let Some(stream_list) = json["streams"].as_array() {
                    for s in stream_list {
                        let ctype = s["codec_type"].as_str().unwrap_or("");
                        let kind = match ctype {
                            "video" => "video",
                            "audio" => "audio",
                            "subtitle" => "subtitle",
                            _ => continue,
                        };

                        let idx = s["index"].as_u64().unwrap_or(0) as usize;
                        let codec = s["codec_name"].as_str().unwrap_or("unknown").to_uppercase();
                        let raw_lang = s["tags"]["language"].as_str().unwrap_or("und");
                        let lang = if kind == "video" { "und" } else { raw_lang };
                        let title = s["tags"]["title"].as_str().unwrap_or("");
                        let is_default = s["disposition"]["default"].as_i64().unwrap_or(0) == 1;
                        let is_forced = s["disposition"]["forced"].as_i64().unwrap_or(0) == 1;

                        let (w, h, hdr) = if kind == "video" {
                            let pw = s["width"].as_u64().map(|v| v as u32);
                            let ph = s["height"].as_u64().map(|v| v as u32);
                            let hdr_info = detect_hdr_from_ffprobe_stream(s);
                            (pw, ph, hdr_info)
                        } else {
                            (None, None, None)
                        };

                        tracks.push(Track {
                            id: format!("cnt:{}", idx),
                            kind: kind.to_string(),
                            name: if title.is_empty() { format!("Track {}", idx) } else { title.to_string() },
                            origin: "container".to_string(),
                            source_path: file_path.to_string_lossy().to_string(),
                            source_index: idx,
                            codec,
                            lang: lang.to_string(),
                            is_default,
                            is_forced,
                            delay: 0,
                            action: if kind == "video" { "convert".to_string() } else { "keep".to_string() },
                            width: w,
                            height: h,
                            hdr,
                        });
                    }
                }
            }
        }
    }

    tracks
}

fn probe_video_stream_hdr(file_path: &Path, tools: &Tools) -> Option<String> {
    if let Ok(output) = create_command(&tools.ffprobe)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-select_streams", "v:0"
        ])
        .arg(file_path)
        .output()
    {
        if output.status.success() {
            if let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) {
                if let Some(stream_list) = json["streams"].as_array() {
                    if let Some(s) = stream_list.first() {
                        return detect_hdr_from_ffprobe_stream(s);
                    }
                }
            }
        }
    }
    None
}

fn detect_hdr_from_mkv_props(props: &Value) -> Option<String> {
    let transfer = props["color_transfer_characteristics"].as_u64()
        .or_else(|| props["colour_transfer_characteristics"].as_u64())
        .or_else(|| props["color_transfer_characteristics"].as_str().and_then(|s| s.parse().ok()))
        .or_else(|| props["colour_transfer_characteristics"].as_str().and_then(|s| s.parse().ok()));

    let primaries = props["color_primaries"].as_u64()
        .or_else(|| props["colour_primaries"].as_u64())
        .or_else(|| props["color_primaries"].as_str().and_then(|s| s.parse().ok()))
        .or_else(|| props["colour_primaries"].as_str().and_then(|s| s.parse().ok()));

    let codec_id = props["codec_id"].as_str().unwrap_or("").to_lowercase();
    let is_dovi = codec_id.contains("dovi") || codec_id.contains("dv");

    // 16 is SMPTE ST 2084 (PQ - HDR10)
    if transfer == Some(16) {
        if is_dovi {
            Some("DV HDR".to_string())
        } else {
            Some("HDR10".to_string())
        }
    } else if primaries == Some(9) {
        Some("HDR".to_string())
    } else if transfer == Some(14) || transfer == Some(18) {
        Some("HLG".to_string())
    } else if is_dovi {
        Some("DV".to_string())
    } else {
        None
    }
}

fn detect_hdr_from_ffprobe_stream(s: &Value) -> Option<String> {
    let transfer = s["color_transfer"].as_str().unwrap_or("").to_lowercase();
    let primaries = s["color_primaries"].as_str().unwrap_or("").to_lowercase();
    let color_space = s["color_space"].as_str().unwrap_or("").to_lowercase();

    let mut is_hdr10_plus = false;
    let mut is_dovi = false;
    let mut is_hdr_mastering = false;

    if let Some(side_list) = s["side_data_list"].as_array() {
        for sd in side_list {
            let sdt = sd["side_data_type"].as_str().unwrap_or("").to_lowercase();
            // SMPTE 2094-40 is official ST specification for HDR10+ dynamic metadata
            if sdt.contains("2094-40") || sdt.contains("hdr10+") || sdt.contains("hdr dynamic metadata") {
                is_hdr10_plus = true;
            }
            // DOVI configuration record is Dolby Vision
            if sdt.contains("dovi") || sdt.contains("dolby vision") {
                is_dovi = true;
            }
            if sdt.contains("mastering display") || sdt.contains("content light") {
                is_hdr_mastering = true;
            }
        }
    }

    let is_pq = transfer == "smpte2084";
    let is_hlg = transfer == "arib-std-b67";
    let is_bt2020 = primaries == "bt2020" || color_space.starts_with("bt2020");

    if is_dovi && is_hdr10_plus {
        Some("DV HDR10+".to_string())
    } else if is_dovi && (is_pq || is_hdr_mastering || is_bt2020) {
        Some("DV HDR".to_string())
    } else if is_dovi {
        Some("DV".to_string())
    } else if is_hdr10_plus {
        Some("HDR10+".to_string())
    } else if is_pq || is_hdr_mastering {
        Some("HDR10".to_string())
    } else if is_hlg {
        Some("HLG".to_string())
    } else if is_bt2020 {
        Some("HDR".to_string())
    } else {
        None
    }
}
