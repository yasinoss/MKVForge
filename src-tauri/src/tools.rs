use std::path::PathBuf;

pub struct Tools {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub mkvmerge: PathBuf,
    pub mkvpropedit: PathBuf,
    pub dovi_tool: PathBuf,
}

impl Tools {
    pub fn locate() -> Self {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));

        let find_binary = |name: &str| -> PathBuf {
            // 1. Check relative bin/ next to executable
            let cand1 = exe_dir.join("bin").join(format!("{}.exe", name));
            if cand1.is_file() {
                return cand1;
            }

            // 2. Check project root bin/
            let cand2 = PathBuf::from("bin").join(format!("{}.exe", name));
            if cand2.is_file() {
                return cand2;
            }
            let cand3 = PathBuf::from("d:\\Projects\\MKV Convert\\bin").join(format!("{}.exe", name));
            if cand3.is_file() {
                return cand3;
            }

            // 3. Check known custom paths
            if name == "mkvmerge" {
                let mkv_path = PathBuf::from("D:\\Program\\Media\\mkvtoolnix\\mkvmerge.exe");
                if mkv_path.is_file() {
                    return mkv_path;
                }
            } else if name == "mkvpropedit" {
                let mkv_path = PathBuf::from("D:\\Program\\Media\\mkvtoolnix\\mkvpropedit.exe");
                if mkv_path.is_file() {
                    return mkv_path;
                }
            }

            // 4. Fallback to system PATH
            PathBuf::from(format!("{}.exe", name))
        };

        Tools {
            ffmpeg: find_binary("ffmpeg"),
            ffprobe: find_binary("ffprobe"),
            mkvmerge: find_binary("mkvmerge"),
            mkvpropedit: find_binary("mkvpropedit"),
            dovi_tool: find_binary("dovi_tool"),
        }
    }
}

pub fn create_command<P: AsRef<std::ffi::OsStr>>(program: P) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: suppresses black console windows
    }
    cmd
}
