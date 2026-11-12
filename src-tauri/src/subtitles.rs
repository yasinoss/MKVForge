use std::fs;
use std::path::{Path, PathBuf};

pub fn guess_lang_from_name(lower: &str) -> String {
    let re = regex::Regex::new(r"(?i)(?:^|[._\-\[\( ])(ar|ara|arabic|عربي|en|eng|english|fr|fra|fre|french|es|spa|spanish|de|deu|ger|german|it|ita|italian|ru|rus|russian|ja|jpn|japanese)(?:$|[._\-\]\) ])").unwrap();
    if let Some(caps) = re.captures(lower) {
        if let Some(m) = caps.get(1) {
            match m.as_str().to_lowercase().as_str() {
                "ar" | "ara" | "arabic" | "عربي" => return "ara".to_string(),
                "en" | "eng" | "english" => return "eng".to_string(),
                "fr" | "fra" | "fre" | "french" => return "fra".to_string(),
                "es" | "spa" | "spanish" => return "spa".to_string(),
                "de" | "deu" | "ger" | "german" => return "deu".to_string(),
                "it" | "ita" | "italian" => return "ita".to_string(),
                "ru" | "rus" | "russian" => return "rus".to_string(),
                "ja" | "jpn" | "japanese" => return "jpn".to_string(),
                _ => {}
            }
        }
    }
    "und".to_string()
}

pub fn detect_subtitle_language(source_path: &Path) -> (String, bool) {
    let filename = source_path.file_name().and_then(|s| s.to_str()).unwrap_or("");
    let lower_fname = filename.to_lowercase();
    let is_forced = lower_fname.contains("forced") || lower_fname.contains(".force.");

    // 1. Read initial chunk (up to 32 KB) to examine dialogue lines
    let raw = match fs::read(source_path) {
        Ok(bytes) => bytes,
        Err(_) => return (guess_lang_from_name(&lower_fname), is_forced),
    };

    if raw.is_empty() {
        return (guess_lang_from_name(&lower_fname), is_forced);
    }

    let chunk = if raw.len() > 32768 { &raw[..32768] } else { &raw[..] };

    // Decode properly
    let decoded_text: String = if chunk.starts_with(b"\xef\xbb\xbf") {
        String::from_utf8_lossy(&chunk[3..]).into_owned()
    } else if let Ok(s) = std::str::from_utf8(chunk) {
        s.to_string()
    } else {
        let (dec_1256, _, _) = encoding_rs::WINDOWS_1256.decode(chunk);
        if dec_1256.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c)) {
            dec_1256.into_owned()
        } else {
            let (dec_1252, _, _) = encoding_rs::WINDOWS_1252.decode(chunk);
            dec_1252.into_owned()
        }
    };

    // Extract dialogue content lines (at least 20 lines)
    let mut dialogue_chars = 0;
    let mut arabic_chars = 0;
    let mut japanese_chars = 0;
    let mut cyrillic_chars = 0;
    let mut latin_chars = 0;
    let mut sample_lines = 0;
    let mut french_markers = 0;
    let mut english_words = 0;

    for line in decoded_text.lines() {
        let trimmed = line.trim();
        // Skip empty lines, timestamps, numeric counter lines, and ASS styling headers
        if trimmed.is_empty()
            || trimmed.parse::<u32>().is_ok()
            || trimmed.contains("-->")
            || trimmed.starts_with('[')
            || trimmed.starts_with("Format:")
            || trimmed.starts_with("Style:")
        {
            continue;
        }

        // Clean ASS tags like {\an8}
        let clean_line = if trimmed.starts_with("Dialogue:") {
            let parts: Vec<&str> = trimmed.splitn(10, ',').collect();
            if parts.len() == 10 { parts[9] } else { trimmed }
        } else {
            trimmed
        };

        sample_lines += 1;

        // Check language words / characters
        let lower_line = clean_line.to_lowercase();
        for word in lower_line.split_whitespace() {
            let clean_word = word.trim_matches(|c: char| !c.is_alphanumeric());
            if ["the", "and", "you", "that", "was", "for", "are", "with", "have", "this", "what", "from"].contains(&clean_word) {
                english_words += 1;
            } else if ["les", "des", "pour", "dans", "avec", "est", "une", "que", "vous", "nous", "pas", "elle"].contains(&clean_word) {
                french_markers += 1;
            }
        }

        for c in clean_line.chars() {
            if c.is_alphabetic() {
                dialogue_chars += 1;
                if ('\u{0600}'..='\u{06FF}').contains(&c)
                    || ('\u{0750}'..='\u{077F}').contains(&c)
                    || ('\u{FB50}'..='\u{FDFF}').contains(&c)
                    || ('\u{FE70}'..='\u{FEFF}').contains(&c)
                {
                    arabic_chars += 1;
                } else if ('\u{3040}'..='\u{309F}').contains(&c)
                    || ('\u{30A0}'..='\u{30FF}').contains(&c)
                    || ('\u{4E00}'..='\u{9FFF}').contains(&c)
                {
                    japanese_chars += 1;
                } else if ('\u{0400}'..='\u{04FF}').contains(&c) {
                    cyrillic_chars += 1;
                } else if c.is_ascii_alphabetic() || "éèêàçùôîïëüœæÉÈÊÀÇÙÔÎÏ".contains(c) {
                    latin_chars += 1;
                    if "éèêàçùôîïëœæ".contains(c) {
                        french_markers += 1;
                    }
                }
            }
        }

        if sample_lines >= 50 {
            break;
        }
    }

    // Percentage evaluation (at least 20 lines sampled or 10+ letters)
    if dialogue_chars >= 10 {
        let ar_pct = arabic_chars as f64 / dialogue_chars as f64;
        let jp_pct = japanese_chars as f64 / dialogue_chars as f64;
        let ru_pct = cyrillic_chars as f64 / dialogue_chars as f64;

        if ar_pct >= 0.15 || arabic_chars >= 15 {
            return ("ara".to_string(), is_forced);
        }
        if jp_pct >= 0.15 || japanese_chars >= 15 {
            return ("jpn".to_string(), is_forced);
        }
        if ru_pct >= 0.15 || cyrillic_chars >= 15 {
            return ("rus".to_string(), is_forced);
        }
    }

    // If not detected by script characters, check filename
    let fname_lang = guess_lang_from_name(&lower_fname);
    if fname_lang != "und" {
        return (fname_lang, is_forced);
    }

    // If Latin script: check French markers vs English words
    if latin_chars >= 15 {
        if french_markers > english_words && french_markers >= 2 {
            return ("fra".to_string(), is_forced);
        }
        if english_words >= 2 {
            return ("eng".to_string(), is_forced);
        }
    }

    ("und".to_string(), is_forced)
}

pub fn sanitize_subtitle_text(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            // Replace non-breaking, ideographic, and unusual spaces with standard ASCII space
            '\u{00A0}' | '\u{202F}' | '\u{2007}' | '\u{205F}' | '\u{3000}'
            | '\u{1680}' | '\u{180E}' | '\u{2000}'..='\u{200A}' => {
                out.push(' ');
            }
            // Line and paragraph separators -> convert to newline
            '\u{2028}' | '\u{2029}' => {
                out.push('\n');
            }
            // Strip invisible zero-width spaces, marks, bidi embeddings, isolates, overrides, BOM, and replacement characters
            '\u{200B}' | '\u{200C}' | '\u{200D}' | '\u{200E}' | '\u{200F}'
            | '\u{061C}' | '\u{2060}' | '\u{2061}'..='\u{2064}'
            | '\u{FEFF}' | '\u{00AD}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}'
            | '\u{FFF9}'..='\u{FFFB}' | '\u{FFFC}' | '\u{FFFD}' => {
                // Drop without rendering to prevent square box (tofu) artifacts
            }
            // Strip stray non-printable control characters (preserve '\n', '\r', '\t')
            c if c.is_control() && c != '\n' && c != '\r' && c != '\t' => {
                // Drop
            }
            _ => {
                out.push(c);
            }
        }
    }

    // Replace literal HTML non-breaking space entities and strip bidi marks
    let mut s = out;
    if s.contains("&nbsp;") { s = s.replace("&nbsp;", " "); }
    if s.contains("&#160;") { s = s.replace("&#160;", " "); }
    if s.contains("&#xA0;") { s = s.replace("&#xA0;", " "); }
    if s.contains("&#xa0;") { s = s.replace("&#xa0;", " "); }
    if s.contains("&#8239;") { s = s.replace("&#8239;", " "); }
    if s.contains("&rlm;") { s = s.replace("&rlm;", ""); }
    if s.contains("&lrm;") { s = s.replace("&lrm;", ""); }
    if s.contains("&zwnj;") { s = s.replace("&zwnj;", ""); }
    if s.contains("&zwj;") { s = s.replace("&zwj;", ""); }
    if s.contains("&shy;") { s = s.replace("&shy;", ""); }
    if s.contains("&#8206;") { s = s.replace("&#8206;", ""); }
    if s.contains("&#8207;") { s = s.replace("&#8207;", ""); }
    if s.contains("&#8204;") { s = s.replace("&#8204;", ""); }
    if s.contains("&#8205;") { s = s.replace("&#8205;", ""); }
    if s.contains("&#x200E;") || s.contains("&#x200e;") { s = s.replace("&#x200E;", "").replace("&#x200e;", ""); }
    if s.contains("&#x200F;") || s.contains("&#x200f;") { s = s.replace("&#x200F;", "").replace("&#x200f;", ""); }
    if s.contains("&#x061C;") || s.contains("&#x061c;") { s = s.replace("&#x061C;", "").replace("&#x061c;", ""); }
    if s.contains("\\h") { s = s.replace("\\h", " "); }

    // Normalize multiple consecutive spaces to a single space
    let mut normalized = String::with_capacity(s.len());
    let mut prev_is_space = false;
    for c in s.chars() {
        if c == ' ' {
            if !prev_is_space {
                normalized.push(c);
                prev_is_space = true;
            }
        } else {
            prev_is_space = false;
            normalized.push(c);
        }
    }

    normalized
}

fn decode_raw_subtitle(raw: &[u8]) -> String {
    if raw.is_empty() {
        return String::new();
    }
    if raw.starts_with(b"\xef\xbb\xbf") {
        // UTF-8 BOM
        String::from_utf8_lossy(&raw[3..]).into_owned()
    } else if raw.starts_with(b"\xff\xfe") {
        // UTF-16 LE
        let u16_data: Vec<u16> = raw[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&u16_data)
    } else if raw.starts_with(b"\xfe\xff") {
        // UTF-16 BE
        let u16_data: Vec<u16> = raw[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        String::from_utf16_lossy(&u16_data)
    } else if let Ok(s) = std::str::from_utf8(raw) {
        s.to_string()
    } else {
        // Fallback: check Windows-1256 for Arabic
        let (dec_1256, _, _) = encoding_rs::WINDOWS_1256.decode(raw);
        if dec_1256.chars().any(|c| ('\u{0600}'..='\u{06FF}').contains(&c)) {
            dec_1256.into_owned()
        } else {
            let (dec_1252, _, _) = encoding_rs::WINDOWS_1252.decode(raw);
            dec_1252.into_owned()
        }
    }
}

pub fn sanitize_subtitle_file(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let raw = fs::read(input_path).map_err(|e| format!("Read error: {}", e))?;
    if raw.is_empty() {
        if let Some(p) = output_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        return fs::write(output_path, b"").map_err(|e| e.to_string());
    }

    let decoded_text = decode_raw_subtitle(&raw);
    let cleaned = sanitize_subtitle_text(&decoded_text);
    if let Some(p) = output_path.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(output_path, cleaned.as_bytes()).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}

pub fn ensure_clean_utf8_subtitle(source_path: &Path, temp_dir: &Path) -> Result<(PathBuf, bool), String> {
    let raw = fs::read(source_path).map_err(|e| e.to_string())?;
    if raw.is_empty() {
        return Ok((source_path.to_path_buf(), false));
    }

    let decoded_text = decode_raw_subtitle(&raw);
    let cleaned = sanitize_subtitle_text(&decoded_text);
    let target = temp_dir.join(source_path.file_name().unwrap());
    fs::create_dir_all(temp_dir).map_err(|e| e.to_string())?;
    fs::write(&target, cleaned.as_bytes()).map_err(|e| e.to_string())?;
    Ok((target, true))
}

fn srt_time_to_ass(t: &str) -> String {
    let t = t.trim().replace(',', ".");
    let parts: Vec<&str> = t.split(':').collect();
    if parts.len() == 3 {
        let h: u32 = parts[0].parse().unwrap_or(0);
        let m: u32 = parts[1].parse().unwrap_or(0);
        let sec_cs = parts[2];
        let sec_parts: Vec<&str> = sec_cs.split('.').collect();
        let s: u32 = sec_parts.first().and_then(|v| v.parse().ok()).unwrap_or(0);
        let ms = sec_parts.get(1).unwrap_or(&"000");
        let cs = if ms.len() >= 2 { &ms[..2] } else { "00" };
        format!("{}:{:02}:{:02}.{}", h, m, s, cs)
    } else {
        "0:00:00.00".to_string()
    }
}

pub fn convert_srt_to_mpc_ass(srt_text: &str) -> String {
    let mut ass = String::from(
r#"[Script Info]
Title: MovieConverter MPC-HC Calibrated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Times New Roman,52,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,3,2,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"#
    );

    let normalized = srt_text.replace("\r\n", "\n").replace('\r', "\n");
    let blocks: Vec<&str> = normalized.split("\n\n").collect();

    for block in blocks {
        let lines: Vec<&str> = block.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        if lines.len() < 2 {
            continue;
        }

        let time_line_idx = if lines[0].contains("-->") {
            0
        } else if lines.len() > 1 && lines[1].contains("-->") {
            1
        } else {
            continue;
        };

        let times: Vec<&str> = lines[time_line_idx].split("-->").collect();
        if times.len() != 2 {
            continue;
        }
        let start = srt_time_to_ass(times[0]);
        let end = srt_time_to_ass(times[1]);

        let dialogue_lines: Vec<&str> = lines[(time_line_idx + 1)..].to_vec();
        if dialogue_lines.is_empty() {
            continue;
        }

        let mut joined_dialogue = dialogue_lines.join("\\N");
        // Convert basic formatting tags to ASS tags
        joined_dialogue = joined_dialogue
            .replace("<i>", "{\\i1}").replace("</i>", "{\\i0}")
            .replace("<b>", "{\\b1}").replace("</b>", "{\\b0}")
            .replace("<u>", "{\\u1}").replace("</u>", "{\\u0}");

        // Sanitize every dialogue to strip square-box causing bidi marks and invisible zero-width chars
        let clean_dialogue = sanitize_subtitle_text(&joined_dialogue);
        if clean_dialogue.is_empty() {
            continue;
        }

        ass.push_str(&format!("Dialogue: 0,{},{},Default,,0,0,0,,{}\n", start, end, clean_dialogue));
    }

    ass
}

pub fn prepare_ass_for_burn(input_path: &Path, output_ass_path: &Path) -> Result<(), String> {
    let raw = fs::read(input_path).map_err(|e| format!("Read error: {}", e))?;
    if raw.is_empty() {
        if let Some(p) = output_ass_path.parent() {
            let _ = fs::create_dir_all(p);
        }
        return fs::write(output_ass_path, b"").map_err(|e| e.to_string());
    }

    let decoded = decode_raw_subtitle(&raw);
    let is_already_ass = decoded.contains("[V4+ Styles]") || decoded.contains("[Script Info]");

    let final_ass = if is_already_ass {
        // Sanitize dialogue lines in existing ASS file
        let mut cleaned_ass = String::with_capacity(decoded.len());
        for line in decoded.lines() {
            if line.starts_with("Dialogue:") {
                let parts: Vec<&str> = line.splitn(10, ',').collect();
                if parts.len() == 10 {
                    let sanitized_text = sanitize_subtitle_text(parts[9]);
                    cleaned_ass.push_str(&format!("{},{}\n", parts[..9].join(","), sanitized_text));
                } else {
                    cleaned_ass.push_str(&format!("{}\n", sanitize_subtitle_text(line)));
                }
            } else if line.starts_with("PlayResX:") || line.starts_with("PlayResY:") {
                cleaned_ass.push_str(&format!("{}\n", line));
            } else {
                cleaned_ass.push_str(&format!("{}\n", line));
            }
        }
        cleaned_ass
    } else {
        convert_srt_to_mpc_ass(&decoded)
    };

    if let Some(p) = output_ass_path.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(output_ass_path, final_ass.as_bytes()).map_err(|e| format!("Write error: {}", e))?;
    Ok(())
}
