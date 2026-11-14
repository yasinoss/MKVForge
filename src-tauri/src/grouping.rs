use std::path::Path;
use regex::Regex;
use crate::models::{Track, VideoGroup};
use crate::probe::probe_video_tracks;
use crate::tools::Tools;

pub struct KeyInfo {
    pub raw_key: String,
    pub show: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
}

pub fn extract_key_info(path: &Path) -> KeyInfo {
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

    let clean_show_name = |s: &str| -> String {
        let prefix_re = Regex::new(r"^\[[^\]]+\]\s*").unwrap();
        let cleaned = prefix_re.replace(s, "").to_string();
        cleaned.replace('.', " ").replace('_', " ").trim().to_string()
    };

    // Pattern 1: S01E02, S01.E02, Season 1 Episode 2
    let re1 = Regex::new(r"(?i)^(.*?)[ ._\-]+(?:Season|S)[ ._\-]?(\d{1,2})[ ._\-]*(?:Episode|Ep|E)[ ._\-]?(\d{1,3})").unwrap();
    if let Some(caps) = re1.captures(stem) {
        let show = caps.get(1).map(|m| clean_show_name(m.as_str()));
        let s: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(1);
        let e: u32 = caps.get(3).unwrap().as_str().parse().unwrap_or(1);
        let key = if let Some(ref sh) = show {
            format!("{} S{:02}E{:02}", sh, s, e)
        } else {
            format!("S{:02}E{:02}", s, e)
        };
        return KeyInfo { raw_key: key, show, season: Some(s), episode: Some(e) };
    }

    // Pattern 2: 1x02, 01x02
    let re2 = Regex::new(r"(?i)^(.*?)[ ._\-]+(\d{1,2})[xX](\d{2,3})").unwrap();
    if let Some(caps) = re2.captures(stem) {
        let show = caps.get(1).map(|m| clean_show_name(m.as_str()));
        let s: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(1);
        let e: u32 = caps.get(3).unwrap().as_str().parse().unwrap_or(1);
        let key = if let Some(ref sh) = show {
            format!("{} S{:02}E{:02}", sh, s, e)
        } else {
            format!("S{:02}E{:02}", s, e)
        };
        return KeyInfo { raw_key: key, show, season: Some(s), episode: Some(e) };
    }

    // Pattern 3: Episode only (E01, EP01, Episode 01) -> default season 1
    let re3 = Regex::new(r"(?i)^(.*?)[ ._\-]+(?:Episode|Ep|E)[ ._\-]?(\d{1,3})(?:[ ._\-\]]|$)").unwrap();
    if let Some(caps) = re3.captures(stem) {
        let show = caps.get(1).map(|m| clean_show_name(m.as_str()));
        let s: u32 = 1;
        let e: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(1);
        let key = if let Some(ref sh) = show {
            format!("{} S{:02}E{:02}", sh, s, e)
        } else {
            format!("S{:02}E{:02}", s, e)
        };
        return KeyInfo { raw_key: key, show, season: Some(s), episode: Some(e) };
    }

    // Pattern 4: Anime style (Show - 01) -> default season 1
    let re4 = Regex::new(r"(?i)^(.*?)[ ._\-]+(?:-\s*|#\s*)(\d{1,3})(?:[ ._\-\]]|$)").unwrap();
    if let Some(caps) = re4.captures(stem) {
        let show = caps.get(1).map(|m| clean_show_name(m.as_str()));
        let s: u32 = 1;
        let e: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(1);
        let key = if let Some(ref sh) = show {
            format!("{} S{:02}E{:02}", sh, s, e)
        } else {
            format!("S{:02}E{:02}", s, e)
        };
        return KeyInfo { raw_key: key, show, season: Some(s), episode: Some(e) };
    }

    // Fallback: cleaned stem (Movie or General Video)
    let clean_stem = clean_show_name(stem);
    KeyInfo {
        raw_key: clean_stem.clone(),
        show: Some(clean_stem),
        season: None,
        episode: None,
    }
}

pub fn guess_external_lang(filename: &str) -> (String, bool) {
    let lower = filename.to_lowercase();
    let is_forced = lower.contains("forced") || lower.contains(".force.");
    (crate::subtitles::guess_lang_from_name(&lower), is_forced)
}

pub fn group_and_probe_files(
    video_paths: &[String],
    other_paths: &[String],
    tools: &Tools,
) -> Vec<VideoGroup> {
    let mut groups = Vec::new();

    for v_str in video_paths {
        let v_path = Path::new(v_str);
        let k_info = extract_key_info(v_path);
        let mut tracks = probe_video_tracks(v_path, tools);

        // Find matching external files
        let filename_no_ext = v_path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
        let clean_v_key = k_info.raw_key.to_lowercase().replace([' ', '.', '_', '-'], "");

        for other_str in other_paths {
            let o_path = Path::new(other_str);
            let o_name = o_path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            let clean_o_name = o_name.to_lowercase().replace([' ', '.', '_', '-'], "");

            // Match if other filename contains video key or stem
            let matches = clean_o_name.contains(&clean_v_key)
                || clean_o_name.contains(&filename_no_ext.to_lowercase().replace([' ', '.', '_', '-'], ""));

            if matches || video_paths.len() == 1 {
                let ext = o_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                let kind = match ext.as_str() {
                    "srt" | "ass" | "ssa" | "vtt" | "sub" => "subtitle",
                    "ac3" | "eac3" | "aac" | "flac" | "mp3" | "opus" => "audio",
                    "xml" if o_name.to_lowercase().contains("chapter") => "chapters",
                    _ => continue,
                };

                let (lang, is_forced) = if kind == "subtitle" {
                    crate::subtitles::detect_subtitle_language(o_path)
                } else {
                    guess_external_lang(o_name)
                };
                tracks.push(Track {
                    id: format!("ext:{}", o_name),
                    kind: kind.to_string(),
                    name: o_name.to_string(),
                    origin: "external".to_string(),
                    source_path: other_str.clone(),
                    source_index: 0,
                    codec: ext.to_uppercase(),
                    lang,
                    is_default: false,
                    is_forced,
                    delay: 0,
                    action: "add".to_string(),
                    width: None,
                    height: None,
                    hdr: None,
                    dovi_profile: None,
                });
            }
        }

        let filename_str = v_path.file_name().and_then(|s| s.to_str()).unwrap_or("");
        let video_track = tracks.iter().find(|t| t.kind == "video");
        let g_w = video_track.and_then(|t| t.width);
        let g_h = video_track.and_then(|t| t.height);
        // HDR is strictly read from the video file's stream metadata, never from filename
        let g_hdr = video_track.and_then(|t| t.hdr.clone());
        let g_dovi = video_track.and_then(|t| t.dovi_profile);

        let mut badges = Vec::new();
        if let Some(ref h) = g_hdr {
            badges.push(h.clone());
        }

        groups.push(VideoGroup {
            key: k_info.raw_key,
            filename: filename_str.to_string(),
            filepath: v_str.clone(),
            show: k_info.show,
            season: k_info.season,
            episode: k_info.episode,
            tracks,
            badges,
            width: g_w,
            height: g_h,
            hdr: g_hdr,
            dovi_profile: g_dovi,
        });
    }

    // Sort by season, episode
    groups.sort_by_key(|g| (g.season.unwrap_or(0), g.episode.unwrap_or(0), g.key.clone()));
    groups
}
