use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

#[derive(Default)]
pub struct QueueState {
    pub is_paused: AtomicBool,
    pub skip_current: AtomicBool,
    pub cancel_requested: AtomicBool,
    pub active_pid: Mutex<Option<u32>>,
}

impl QueueState {
    pub fn reset(&self) {
        self.is_paused.store(false, Ordering::SeqCst);
        self.skip_current.store(false, Ordering::SeqCst);
        self.cancel_requested.store(false, Ordering::SeqCst);
        if let Ok(mut pid) = self.active_pid.lock() {
            *pid = None;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub kind: String, // "video", "audio", "subtitle", "chapters", "font", "img", "attachment"
    pub name: String,
    pub origin: String, // "container", "external"
    pub source_path: String,
    pub source_index: usize,
    pub codec: String,
    pub lang: String,
    pub is_default: bool,
    pub is_forced: bool,
    pub delay: i32,
    pub action: String, // "keep", "convert", "remove", "add"
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub hdr: Option<String>,
    #[serde(default)]
    pub dovi_profile: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoGroup {
    pub key: String,
    pub filename: String,
    pub filepath: String,
    pub show: Option<String>,
    pub season: Option<u32>,
    pub episode: Option<u32>,
    pub tracks: Vec<Track>,
    pub badges: Vec<String>,
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub hdr: Option<String>,
    #[serde(default)]
    pub dovi_profile: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportStats {
    pub videos: usize,
    pub audios: usize,
    pub subtitles: usize,
    pub chapters: usize,
    pub groups: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<VideoGroup>,
    pub stats: ImportStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoEncodingSettings {
    pub resolution: String,   // "original", "3840x2160", "2560x1440", "1920x1080", "1280x720", "854x480"
    pub codec: String,        // "hevc_nvenc", "h264_nvenc", "av1_nvenc", "libx265", "libx264", "copy"
    pub rate_control: String, // "cqp", "vbr", "cbr"
    pub quality_val: String,  // "22" for cqp, "6000k" for vbr/cbr
    pub preset: String,       // "p5", "medium", etc.
    pub tune: String,         // "hq", "film", "none", etc.
    pub pix_fmt: String,      // "p010le", "yuv420p"
    #[serde(default)]
    pub fps: Option<String>,
    #[serde(default)]
    pub profile: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub multipass: Option<String>,
    #[serde(default)]
    pub aq: Option<String>,
    #[serde(default)]
    pub dovi_action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioEncodingSettings {
    pub codec: String,        // "copy", "aac", "ac3", "eac3", "opus", "flac", "mp3"
    pub channels: String,     // "original", "2", "6", "8", "1"
    pub bitrate: String,      // "192k", "256k", "320k", "448k", "640k"
    pub sample_rate: String,  // "original", "48000", "44100", "96000"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueJobPayload {
    pub key: String,
    pub source_path: String,
    pub output_folder: String,
    pub file_pattern: String,
    #[serde(default)]
    pub output_filename: Option<String>,
    #[serde(default)]
    pub cover_image_path: Option<String>,
    pub if_exists: String,
    pub delete_originals: bool,
    pub tracks: Vec<Track>,
    pub shared_attachments: Vec<String>,
    pub remove_old_attachments: bool,
    pub video_settings: Option<VideoEncodingSettings>,
    pub audio_settings: Option<AudioEncodingSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressEvent {
    pub key: String,
    pub progress: f32,
    pub speed: String,
    pub status: String, // "waiting", "running", "paused", "skipped", "done", "failed"
    pub error: Option<String>,
}
