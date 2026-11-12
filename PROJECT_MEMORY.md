# MKVForge: Project Memory

Version 1.35 · 2026-11-12
Official Name: MKVForge (formerly Movie Converter)
Architecture: Tauri 2 (Rust Backend + Native Windows Webview Frontend). Compiles to a native standalone .exe.
Frameless UI & Native Dragging: Borderless window with reliable native dragging via `start_drag` IPC and top bar event delegation.

v1.35 Enhancements:
- Dedicated Settings "About" Tab & Developer Attribution (إضافة تبويبة حول البرنامج وحقوق المطور):
  * Added "About" tab in Settings Modal with responsive branded layout, official logo, version tag, and description.
  * Prominently displays: "برمجة وتطوير: **Yasinoss**" and "جميع الحقوق محفوظة للمطور © 2026 yasinoss" with full i18n support.
  * Direct one-click contact channel cards:
    - WhatsApp: `+216 55 331 334` (direct chat link)
    - Facebook: `fb.me/MrYasinoss`
    - GitHub: `yasinoss`
  * Added `open_url` native Tauri IPC command to safely launch links in the user's default OS browser without command prompt flashes.
- Instant Tools Workflow Reordering (تقديم تحديث الكوفر قبل إعادة التسمية):
  * Reordered Instant Tools top action buttons: `Add Files` -> `Update Covers Only (MKV)` -> `Rename All` -> `Clear All`.
  * Ensures cover art injection happens seamlessly on the original container path before files are renamed on disk.
- Cache Collision Elimination via Unique URL Hashing (إصلاح تداخل كاش صور الكوفر بين الأفلام):
  * In `src-tauri/src/lib.rs`, `download_cover_image` now generates unique filenames using a 64-bit hash of the exact image URL combined with a sanitized key (`cover_{clean_key}_{url_hash}.jpg`).
  * Prevents any possibility of an old movie's cached cover being re-applied to subsequent movies.
  * Added desktop browser `User-Agent` and connection timeouts to `curl` to guarantee reliable image downloads from Wikipedia/Wikimedia and online databases without 403 Forbidden blocks.
- Full Cover Search, Gallery & Import Modal in Instant Tools (معاينة وبحث واستيراد الكوفر في الأدوات الفورية):
  * Clicking any cover box in Instant Tools now launches the interactive `Media Metadata & Cover Art Gallery` modal (`#metadataModal`).
  * Provides live online search across Wikipedia, TVmaze, AniList, and TMDB with year filtering and provider selection.
  * Cover Art Gallery grid allows browsing and clicking multiple poster candidates with instant visual preview.
  * Dedicated "Choose Custom Image" button allows selecting any local image from PC (JPG, PNG, WebP) with instant Base64 preview.
  * Applying the chosen cover instantly updates the file in Instant Tools, dynamically re-evaluates the Smart Proposed Name if title/year changed, and renders the cover in the table.
- Instant Tools UI Refinements & Validation:
  * Synced all button color palettes with active theme accent (`var(--accent)`).
  * Removed duplicate icons and redundant per-row apply buttons.
  * MKV-only validation badge and enforcement for in-place cover injection.

v1.34 Enhancements:
- Transparent Rounded Corner App Icons (الحواف الدائرية الشفافة للأيقونة الرسمية):
  * Extracted and preserved the authentic 4-corner rounded contour transparency directly from the original artwork.
  * Generated multi-size alpha-channel PNGs and `.ico` mipmaps with crystal-clear antialiasing around the glow border across `icon.ico`, `icon.png`, `128x128.png`, `32x32.png`, `Square...Logo.png`, and header `app_logo.png`.
- Automatic Track Name Stripping Setting (تفعيل حذف تسميات المسارات افتراضياً في الإعدادات):
  * Added dedicated `settingClearTrackNames` toggle in Settings under "General" -> "Track Names & Titles".
  * Active by default (`clearTrackNames: true`): Automatically strips embedded title tags from video and audio tracks upon import/scan and multiplexing.
  * User can toggle it off anytime in Settings if they wish to retain original track titles, with full persistence to disk (`persistAllSettings`).
- Official Rebranding to MKVForge:
  * Application officially renamed to MKVForge across window title, top bar brand, Tauri configuration (`tauri.conf.json`), and i18n dictionaries (`ar`, `en`, `fr`, `es`, `tr`).
  * Converted user-uploaded official application icon into all native formats (`src-tauri/icons/icon.ico`, `icon.png`, `128x128.png`, `32x32.png`, `Square...Logo.png`) and top-bar logo (`ui/app_logo.png`).
  * Output executable compiled directly to `MKVForge.exe`.
- Standalone Minimal Distribution Folder (`MKVForge_Standalone`):
  * Created `MKVForge_Standalone/` containing strictly required operational binaries: `MKVForge.exe` and `bin/` (`ffmpeg.exe`, `ffprobe.exe`, `mkvmerge.exe`), without any redundant or temporary files.
- Track Name Stripping & Clearing for Video & Audio (مسح أسماء مسارات الفيديو والصوت):
  * Added `btnClearTrackNames` ("Clear Track Names" / "مسح أسماء المسارات") button in the Review stage header next to "Preview Info & Cover".
  * Allows one-click bulk clearing of all video and audio track names for the current video or all loaded videos.
  * Added inline `✕` clear buttons on each video and audio track row in the Review table for single-track title stripping.
  * In `executor.rs`: Configured `mkvmerge` commands to explicitly pass `--track-name {tid}:` when track names are empty or stripped. This forces `mkvmerge` to strip original container track titles from the final muxed MKV file.
- Immediate Single Video Removal (حذف فيديو واحد بدون تأكيد):
  * Deleting a single video card from the sidebar list via the `✕` button executes immediately with zero confirmation dialog popup.
  * "Delete all" (`btnClearAllVideos`) strictly preserves the confirmation modal to prevent accidental data loss.
- Metadata Source Badge Icon Clean-up (إزالة الأيقونة بجانب ويكيبيديا والمصادر):
  * Removed sparkle `✨` emoji from `selectedVideoOnlineBadge` across HTML markup and dynamic script updates. Clean textual presentation (e.g. `Wikipedia (2025)` or `AniList`).

v1.31 Enhancements:
- Theme-Adaptive Custom Confirmation Dialog (حل سواد لافتة التحذير في الثيم الفاتح):
  * Removed hardcoded dark `#1e222b` background from `#customConfirmModal .modal-window`, replacing it with dynamic `var(--panel)`.
  * In Light Theme: Confirms (such as "Clear All" / Delete All) appear in pure white (`#FFFFFF`) with dark readable text and subtle shadow (`rgba(0,0,0,0.25)`).
  * In Dark Theme: Preserves the modern deep obsidian background (`#111722`).
- Right-Click Context Menu Scope Restriction (حصر الزر الأيمن في أماكن الكتابة فقط):
  * Context menu is now strictly limited to typing fields (`<input>`, `<textarea>`, `contenteditable`).
  * Right-clicking anywhere else across the interface (buttons, cards, headers, tables, empty spaces) is completely intercepted and suppressed with zero menu popup.
- Complete Elimination of Hardcoded Arabic when non-Arabic Interface is Chosen:
  * Strict internationalization: Arabic text will NEVER appear unless the user explicitly sets the application language to Arabic (`ar`).
  * Converted remaining mixed headings and context menu labels (`Live Output Preview`, `Available Variables:`, `Cover Art Gallery`, and right-click items `Cut`, `Copy`, `Paste`, `Delete`, `Select All`) into dynamic i18n dictionary lookups across all 5 languages (ar, en, fr, es, tr).
- Live View for Themes & Accent Colors with Reversible State (معاينة حية وفورية للألوان والثيمات):
  * Selecting any Theme (Dark / Light) or Accent color in Settings immediately triggers a real-time Live View across the entire application interface.
  * Preserves save-on-demand integrity: changes remain preview-only until the user clicks "Save Settings".
  * Closing the modal via "✕" or clicking outside reverts the interface back to the previously saved theme and accent instantly.

v1.30 Enhancements:
- Spacious Poster & Cover Art Gallery Modal (معرض صور وبوسترات متكامل):
  * Redesigned the online cover art identification modal (`.meta-gallery-modal`) into a wide gallery modal (960px width, 86vh).
  * Multi-candidate retrieval: AniList GraphQL (`Page(page: 1, perPage: 12)`), TVmaze (`search/shows?q=...`), TMDB (`search/multi`), and Wikipedia now populate `_candidates` with multiple matching titles and seasons.
  * Gallery Grid (`.meta-gallery-grid`): Displays candidate posters in 2:3 aspect ratio cards with subtle hover lift (-4px), smooth zoom transitions, selection badge (`✓ SELECTED`), year badges, and source tags.
  * Interactive switching: Clicking any poster candidate instantly updates the preview card, metadata inputs, and output filename preview.
- Stepper Color Harmonization (إزالة اللون الأخضر من المراحل المكتملة):
  * Stepper stages (`.step-item.completed`) no longer turn green when transitioning to 'Review' or 'Export'.
  * Uses a subtle, harmonious theme surface (`var(--accent-surface)`) and accent border/text, keeping the workflow visual language consistent.
- Premier Harmonious Color Palettes & Contrast (تناسق الألوان والوضع الفاتح):
  * Light Mode: Refined using premier design system standards (Apple, Linear, GitHub Light) with clean slate tokens (`--bg: #F8FAFC`, `--panel: #FFFFFF`, `--border: #E2E8F0`).
  * Dark Mode: Zinc/Obsidian palette (`--bg: #0B0F17`, `--panel: #111722`, `--border: #232C3D`).
  * Expanded premier accents: Classic Blue, Electric Indigo, Nordic Cyan/Teal, Emerald Mint, Amethyst Purple, Cinematic Amber, and Sunset Rose.
  * Eliminated washed-out light green in Light Mode: Introduced `--preview-code-color` (`#15803D` in light mode, `#4ADE80` in dark mode) ensuring high-contrast, crystal-clear readability for live output filename previews.
- Interactive Pattern Pill Insertion & Unified Neutral Styling:
  * Pattern badge pills (`{Title}`, `{Year}`, `{Resolution}`, `{res}`, `{hdr}`, `{Qt}`, `{vc}`, `{ac}`, `{Tag}`) under TV Series and Movie patterns now use `mousedown` `e.preventDefault()`, preserving the exact caret/selection position in pattern inputs.
  * Clicking any pill immediately inserts the tag at the cursor or appends it, triggering live filename preview updates.
  * Harmonized `{ac}` Audio Codec chip styling to `chip neutral`, completely removing unwanted blue highlight so all pills share the same clean look.
- Complete Windows Filename Character Sanitization & Colon Replacement:
  * Colons (`:`) in movie/show titles (e.g. `Kimetsu no Yaiba: Mugenjou-hen`) are automatically converted to hyphens (` - `) preserving natural readability while being 100% compliant with Windows filesystem rules.
  * All illegal Windows filename characters (`\`, `/`, `*`, `?`, `"`, `<`, `>`, `|`) are stripped and sanitized across title extraction and output path generation.
- Expanded "Available Variables (المتغيرات المتاحة)":
  * Explicitly documented `{ac}` (Audio Codec e.g. AAC, AC3, EAC3, FLAC, DTS, Opus) and `{hdr}` (HDR, HDR10, HDR10+, DV) in the legend card.

v1.29 Enhancements:
- Pattern Chips Interactive Insertion & Unified Neutral Styling:
  * Fixed variable badge pills in Settings -> Naming & Tags. Clicking any pattern chip inserts the corresponding tag (`{Title}`, `{Year}`, `{Resolution}`, `{res}`, `{Qt}`, `{vc}`, `{ac}`, `{Tag}`) directly into the target input at the exact cursor position.
  * Harmonized the `{ac}` Audio Codec chip styling to `chip neutral` (identical to other variable chips), removing unwanted blue accent highlight and standardizing text to `{ac}`.
- Complete Windows Filename Character Sanitization & Colon Replacement:
  * Colons (`:`) in media titles (e.g. `Kimetsu no Yaiba: Mugenjou-hen`) are automatically converted to hyphens (` - `) preserving natural title readability while being 100% compliant with Windows filesystem rules.
  * All illegal Windows filename characters (`\`, `/`, `*`, `?`, `"`, `<`, `>`, `|`) are stripped and sanitized across frontend title parsing and backend executor safe stem generation.
- Expanded "Available Variables (المتغيرات المتاحة)" Documentation:
  * Updated the legend card in Naming Settings to explicitly document `{ac}` (Audio Codec e.g. AAC, AC3, EAC3, FLAC, DTS, Opus) and `{res}` (numeric resolution e.g. 1080, 2160 without 'p') alongside existing tags.
- Full 5-Language Internationalization (i18n) Engine with Auto-Detection:
  * Implemented seamless multilingual interface supporting 5 languages: Arabic (العربية with full RTL layout), English (en), French (français), Spanish (español), and Turkish (Türkçe).
  * Auto-detects the operating system/Windows language via `navigator.language` on first run. Language configuration moved exclusively to the Settings modal (under General Tab) for a cleaner main top bar.
- HDR, HDR10+, Dolby Vision & HLG Strict File-Level Stream Detection:
  * Strict video stream inspection: HDR is read 100% directly from the video file's bitstream/container metadata, with zero reliance on filename text.
  * Probes `SMPTE 2094-40` (HDR Dynamic Metadata) for HDR10+, `DOVI configuration record` for Dolby Vision, `SMPTE ST 2084 (PQ)` / `BT.2020` for HDR10, and `ARIB STD-B67` for HLG.
  * Added `{hdr}` variable badge chip and documented in Available Variables.
  * Invariant: Whenever a video supports HDR or HDR10+, it is 100% guaranteed to be included in the output filename even if `{hdr}` is missing from custom user patterns (automatically attached cleanly to Resolution, e.g. `2160p.HDR10+`), while SDR cleanly omits `{hdr}` without residual separators.
- Audio Codec `{ac}` Inclusion & Guarantee in Video Naming:
  * Updated all default naming patterns to include `{ac}`: `{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}` and `{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}`.
  * Expanded audio codec detection from stream tracks (AAC, AC3, EAC3, DTS, DTS-HD, TrueHD, FLAC, Opus, MP3, Vorbis, PCM).
  * Auto-pairing guarantee: If a user pattern contains `{vc}` but omitted `{ac}`, the audio codec is automatically appended to the video codec (e.g. `H264.AAC` or `HEVC.EAC3`), ensuring the audio codec is always present in output filenames.
- 100% Sleek Custom Modal Dialogs (Zero Native Browser Alerts/Confirms):
  * Replaced all native browser popups (`confirm()`, `alert()`) with a custom animated dark-themed modal dialog matching the app design system.
  * Added custom deletion confirmation with movie name display when removing video items from the sidebar, clearing the list, or cancelling queue runs.
v1.28 Enhancements:
- Full Real-Time Progress for Video, Audio & Muxing:
  * Video: Live display of real-time track percentage and speed: `Encoding Video · 45% · 14.2x` (CPU fallback: `Encoding Video (CPU libx264) · 45% · 3.5x`).
  * Audio: Upgraded audio encoding from static `Stdio::null()` to piped `-progress pipe:1 -nostats` reader loop. Accurately reports progress per audio track: `Encoding Audio (1/1) · AAC · 48% · 42.5x`.
  * Assembly (Muxing): Live percentage progression via mkvmerge `#GUI#progress`: `Muxing Final MKV · 50%`.
  * UI Status Display: Removed disruptive regex term replacements in `ui/app.js`, ensuring status badges display clean, descriptive status and live progress indicators without mangling text.
- Comprehensive Subtitle Square Box (Tofu `□`) Elimination:
  * Added stripping of `\u{061C}` (Arabic Letter Mark ALM - the primary cause of tofu boxes in Arabic web subtitles).
  * Converted `\u{2028}` (Line Separator) and `\u{2029}` (Paragraph Separator) to `\n` instead of letting them render as square boxes between words.
  * Stripped `\u{2060}` (Word Joiner), `\u{FFF9}`..=`\u{FFFD}` (Replacement / Object characters), and `\u{FEFF}` (BOM).
  * Expanded HTML and ASS tag sanitization (`&rlm;`, `&lrm;`, `&zwnj;`, `&zwj;`, `&#8206;`, `&#8207;`, `\h`).
  * Added native support for UTF-16 LE and UTF-16 BE subtitles, preventing corrupted decoding.
  * Guaranteed clean SRT conversion and sanitization for container-embedded subtitles before burning (`-c:s srt`).
- Crisp, High-Fidelity Hardsub Subtitle Appearance (Eliminating Graininess & Fuzzy Edges):
  * Restored MPC-HC default stroke: `Outline=2.0` and `Shadow=3.0` with `Fontsize=22` in `MPC_SUB_STYLE` (calibrated to the user's Media Player Classic configuration screenshot). The previous 1.2 stroke caused subpixel antialiasing fuzziness on Times New Roman serifs.
  * Automatically enabled Spatial & Temporal Adaptive Quantization (`-spatial-aq 1 -temporal-aq 1 -aq-strength 8`) during NVENC video encoding whenever Hardsub is active, eliminating compression macroblock noise and ringing around burned subtitles.
v1.27 Enhancements:
- Elimination of mkvmerge Assembly Failure (`failed` at Muxing step):
  * Root Cause 1 (Fatal CLI Argument Syntax): When video or audio tracks were copied or had missing language metadata (`t.lang == ""`), the assembly routine passed `--language {tid}:` with an empty string, causing mkvmerge to immediately terminate with `Error: '' is not a valid IETF BCP 47/RFC 5646 language tag`.
  * Root Cause 2 (False Failure on Warnings): mkvmerge exits with code `0` on pure success and code `1` when warnings are emitted (e.g. minor header sync shifts), which still yields a completely valid MKV. Previously `!mkv_status.success()` failed jobs that exited with code `1`.
  * Root Cause 3 (Stderr Silenced): Stderr was sent to `Stdio::null()`, preventing error diagnostics.
  * Implemented robust `sanitize_lang_code(raw: &str)` helper in `src-tauri/src/executor.rs`:
    - Normalizes all language names ("Arabic" -> "ara", "English" -> "eng", "French" -> "fre", etc.) and handles 2/3 letter ISO codes.
    - Always defaults empty, unknown, or invalid strings to `"und"`, never emitting `--language {tid}:` without a valid tag.
    - Excludes `t.kind == "chapters"` from container track property loops.
  * Enabled live stderr and stdout error stream capture into memory buffer.
  * Accurately accepts exit codes `0` and `1` (warnings) as success as long as the destination `.part` file is created and non-empty.
  * Surfaces granular, descriptive mkvmerge error output directly to the queue status if an actual fatal error (code 2) occurs.
v1.26 Enhancements:
- Independent Video Copy & Audio Re-encoding (And Vice-Versa):
  * Added `Copy (Original untouched / Passthrough - No re-encode)` directly to the `vCfgCodec` dropdown in Advanced Video Settings.
  * Allows users to independently configure Video = Copy while Audio = Convert (e.g. AAC/EAC3/Opus), or Video = Convert (e.g. NVENC/H264) while Audio = Copy.
  * Dynamically dims and disables video encoding options (bitrate, rate control, presets, multipass, aq) when `vCfgCodec == "copy"`.
- Resilient Subtitle Burning (Hardsub Unlinked from Subtitle Keeping):
  * Resolved an issue where unchecking all subtitles in `Keep subtitles` prevented Hardsub burning because `t.action` was marked `"remove"`.
  * Hardsub burning selection now takes absolute precedence: even if a subtitle is not kept as a stream in the final container, it is burned directly into the video frames if selected.
  * Burning a subtitle automatically promotes the video track to `action = "convert"` to guarantee the burned frames are encoded.
- Preferred Subtitle Isolation by Default:
  * When videos are imported or scanned, `repopulateDynamicDropdowns` automatically keeps ONLY the user's preferred subtitle language (e.g. `ara` / Arabic from Settings) by default, unchecking all other languages automatically.
  * Newly imported batches reset the selection state so preferred language filtering is automatically applied.
- Bold Subtitles with Slim Outline for Hardsub:
  * Updated `MPC_SUB_STYLE` to `Bold=1`, `Outline=1.2` (reduced from 2.0), and `Shadow=2.0`.
  * Provides crisp, easily readable Arabic text with sharp, thin outlines without heavy stroke borders.
- Audio Codec Variable `{ac}` in Smart Naming:
  * Added `{ac}`, `{AudioCodec}`, and `{acodec}` template variables to the smart naming engine.
  * Automatically detects target audio codec (AAC, AC3, EAC3, DTS, DTS-HD, TrueHD, FLAC, Opus, MP3) from settings or container tracks and embeds it into file names.
- Native Right-Click Context Menu:
  * Implemented a sleek, dark-themed context menu providing Cut (قص), Copy (نسخ), Paste (لصق), Delete (حذف), and Select All (تحديد الكل) on all input fields, textareas, and text selections throughout the entire desktop app.
v1.25 Enhancements:
- Complete & Guaranteed Temp Folder Cleanup:
  * Implemented `robust_remove_dir_all` with retry loops to bypass Windows file locking races when background child processes release handles.
  * Added `cleanup_temp(&temp_dir, &out_folder)` to ensure each job's temporary directory is deleted, and its parent `.temp_mc` folder is cleanly removed once empty.
  * Added final sweep at the end of queue processing in `src-tauri/src/lib.rs` to guarantee no `.temp_mc` remains in any output directory.
- Subtitle Character Sanitization (Elimination of Missing Character Square Boxes `□` / Tofu):
  * Identified the root cause of square boxes between words in hardsubbed Arabic/text subtitles:
    - Non-Breaking Space (`\u{00A0}`, NBSP) and special spaces (`\u{202F}`, `\u{2007}`, etc.) lack glyph definitions in standard fonts when parsed by libass / FreeType, rendering as replacement `.notdef` boxes `□`.
    - Invisible zero-width marks (`\u{200B}`, `\u{200C}`, `\u{200D}`, `\u{FEFF}`) and bidirectional control marks (`\u{200E}` LRM, `\u{200F}` RLM, `\u{202A}`-`\u{202E}`) show as missing glyph squares.
  * Implemented `sanitize_subtitle_text` and `sanitize_subtitle_file` in `src-tauri/src/subtitles.rs`:
    - Replaces all NBSP and non-standard spaces with standard ASCII space `' '`.
    - Completely strips invisible zero-width and Bidi directionality characters.
    - Automatically converts literal HTML `&nbsp;`, `&#160;`, `&#xA0;`.
  * Added automatic subtitle stream extraction and sanitization for **container-embedded subtitles** before burning, ensuring both external and container subtitles burn with zero tofu boxes.
- Advanced Video Encoding Settings Expansion:
  * Added `Multipass Encoding` selector in Settings -> Advanced Video:
    - `disabled` (Single Pass - Fast)
    - `fullres` (Two-Pass Full Resolution - Highest Quality)
    - `qres` (Two-Pass Quarter Resolution)
  * Added `Level` selector (Auto, 3.1, 4.0, 4.1, 4.2, 5.0, 5.1, 5.2, 6.0, 6.1, 6.2).
  * Added `Profile` selector (Auto, High, Main, Main 10-bit, Baseline).
  * Added `Adaptive Quantization (AQ)` (Spatial + Temporal AQ for improved dark scene fidelity).
  * Updated `models.rs`, `executor.rs`, `index.html`, and `app.js` with instant state syncing and backend command propagation.
v1.24 Enhancements:
- Complete Elimination of Silent CPU Hijacking & Discarded Video Settings:
  * In earlier versions, any minor FFmpeg syntax warning or error triggered a silent fallback executing `cmd_cpu` hardcoded with `-c:v libx265 -crf 22 -preset medium`, completely discarding the user's NVENC hardware encoder choice, dropping the CBR 1500k/1600k bitrate, and stripping away subtitle burn filters.
  * Replaced the blind silent fallback with live stderr capture. If a genuine GPU initialization failure occurs (e.g. `No NVENC capable devices` or `Cannot load nvcuda.dll`), the fallback strictly retains the user's exact bitrate, rate control (CBR 1500k), and subtitle filter chain, switching only to the corresponding CPU codec (`libx264` for H.264, `libx265` for HEVC).
- Subtitle Hardsub Syntax Resolution & Exact MPC-HC Replication:
  * Resolved FFmpeg filtergraph parse failure (`Unable to parse option value ... as image size`) caused by drive colons `D\:` being misinterpreted by FFmpeg without explicit `filename=`.
  * Escaped subtitle filter as `subtitles=filename='<path>'` without escaping square brackets inside single quotes.
  * Preserved full styling fidelity according to user's Media Player Classic configuration: `Times New Roman`, `Outline=2.0`, `Shadow=3.0`, `MarginV=20`, `Alignment=2` (Bottom Center).
- Preset & Tune Compatibility Engine:
  * Implemented `normalize_preset(codec, preset)` and `normalize_tune(codec, tune)` in `executor.rs`:
    - Automatically maps CPU speed presets (`ultrafast` to `veryslow`) to NVENC equivalents (`p1` to `p7`).
    - Filters incompatible tunes (e.g. omitting NVENC-only tunes like `hq` when running CPU encoders, and omitting CPU tunes like `film` when running NVENC).
- Instant Real-Time Settings Modal Synchronization:
  * Added `syncSettingsModalInputs()` to synchronize all modal dropdowns and inputs immediately upon app start.
  * Added live change and input event listeners so changes in Advanced Video and Advanced Audio take effect immediately without requiring modal reopen.
- Strict Rate Control Enforcement:
  * NVENC CBR: `-rc cbr -b:v {b} -minrate {b} -maxrate {b} -bufsize {2*b}`.
  * CPU CBR: `-b:v {b} -minrate {b} -maxrate {b} -bufsize {2*b}`.
  * User's constant bitrate value is strictly passed and applied.
v1.23 Enhancements:
- Strict Copy Mode Invariant (Pure Zero-Re-encoding Passthrough):
  * When `Copy (no re-encode)` preset is selected, both video and audio are guaranteed to be copied directly without re-encoding.
  * Overrides `audio_settings.codec` to `"copy"` and sets all kept audio/video tracks to `action = "keep"`, eliminating unwanted audio transcoding to AAC when using Copy mode.
- Fixed Subtitle Multi-Select Filter Reset & Deselection Retention:
  * Resolved an issue where unchecking subtitles in `Keep subtitles` did not remove them from the final MKV because `repopulateDynamicDropdowns` was resetting `keepSubs` on review renders, and `applyQuickSettingsToAll` skipped setting `remove` when size was 0.
  * Introduced user-interaction preservation flags (`userTouchedAudios` / `userTouchedSubs`) so manual user selections persist across group changes and view switches.
  * Synchronized quick settings immediately upon queue dispatch, ensuring only selected subtitles are kept and deselected ones are completely excluded by mkvmerge.
- Media Player Classic (MPC-HC) Exact Subtitle Style Replication:
  * Subtitle hardsub rendering strictly matches the user's Media Player Classic configuration screenshot:
    - Font: `Times New Roman` (Regular weight, `Bold=0`, `Fontsize=21`)
    - Border Style: Outline (`BorderStyle=1`, `Outline=2.0`)
    - Shadow: `Shadow=3.0` with 50% opacity shadow alpha (`BackColour=&H80000000`)
    - Alignment: Bottom Center (`Alignment=2`)
    - Margins: 20px Left, Right, and Bottom (`MarginL=20,MarginR=20,MarginV=20`)
- Multi-Channel Audio Optimization & Layout Standard:
  * Added recommended channel presets in the UI (`Stereo (2.0 - Recommended for 128k/192k)` and `5.1 Surround (6 ch - Recommended for 384k+)`).
  * Enforced standard `-channel_layout 5.1` in FFmpeg when 6 channels are selected, preventing non-standard layouts like `L R C Cb Lb Rb`.
- NVENC CBR Strict Rate Compliance:
  * For NVENC CBR video encoding, passed `-rc cbr -b:v {b} -minrate {b} -maxrate {b} -bufsize {2*b}` to ensure output stream strictly complies with the user's configured constant bitrate.
- Native Center Window Placement:
  * Added `center_window` Tauri command and executed it during app frontend initialization and setup, ensuring the window always opens centered on screen.
v1.22 Enhancements:
- Sequential Processing & Informative Queue Status Display:
  * Made the execution sequence strictly serial with distinct, clear status indicators in the queue table:
    1. Video Encoding: `Encoding Video · 14.5x` (5% to 75%)
    2. Audio Encoding: `Encoding Audio (1/1) · AAC` (75% to 87%)
    3. Final Assembly: `Muxing Final MKV · 50%` (88% to 100%)
    4. Completion: `Done` (100%)
  * Used standard FFmpeg stream specifiers `-map 0:v:{v_idx}` and `-map 0:a:{a_idx}` for 100% reliable stream mapping across all containers regardless of container track IDs.
- Temp Folder Preservation:
  * Strictly prevented premature deletion of `.temp_mc` on errors or during processing. Temporary files are preserved and only cleaned up once all operations have finished and the new video file is successfully assembled and verified.
v1.21 Enhancements:
- Resolved Audio Transcoding Pipe Deadlock & Progress Stalling:
  * Eliminated unread stdout pipe blocking in FFmpeg audio encoding by replacing piped stdout with `Stdio::null()` and removing `-progress pipe:1`. Audio encoding now completes in 1-2 seconds with zero hanging risk.
  * Corrected progress percentages to be strictly monotonically increasing: Video (5% -> 80%), Audio (80% -> 88%), Muxing (88% -> 100%), preventing the progress bar from jumping backwards to 76%.
- Window Center Launch: Added `"center": true` in `tauri.conf.json` and explicit `window.center()` in the native Rust app setup hook, ensuring the application always opens dead-center on the monitor.
- Exact MPC-HC User Subtitle Preset Matching:
  * Replicated the user's specific Media Player Classic configuration: `Fontname=Times New Roman`, `Fontsize=19`, `Bold=0`, `Outline=1.0` (matching Border width 2.0 on 1080p), `Shadow=1.4` (matching Shadow 3.0 on 1080p), `Alignment=2` (Bottom Center), and `MarginV=20`.
- Preset Compatibility Overhaul:
  * Fixed VP9 encoding parameters: replaced unsupported `-preset` with `-deadline good -cpu-used 2` for fast and stable VP9 multithreading.
  * Verified and tuned SVT-AV1, H264 Baseline, and Web presets.
v1.20 Enhancements:
- Full Audio Transcoding Pipeline:
  * Implemented audio transcoding in `executor.rs` using FFmpeg with intermediate `.mka` Matroska containers.
  * When `audio_settings` is set to any non-copy codec (AAC, AC3, E-AC3, Opus, FLAC, MP3), kept audio tracks are properly re-encoded with user-specified bitrate (e.g. 128 kbps), channel layout (stereo, 5.1, etc.), and sample rate (48000 Hz, etc.) instead of being copied directly as uncompressed/original bitstream.
  * Mkvmerge synchronization: Automatically sets `--no-audio` on the original container source and remuxes the converted `.mka` streams with intact track names, languages, default flags, and audio sync delays.
- Clean Video Metadata & Language Enforcement:
  * Stripped unwanted/accidental container tags (such as `Language: Spanish` from scene releases) by passing `-map_metadata -1` and `-metadata:s:v:0 language={vt.lang}` to FFmpeg, and explicitly setting `--language 0:{vt.lang}` on the video track in mkvmerge.
  * Added video track language selector dropdown in the Review stage tracks table, allowing one-click customization or defaulting to clean `und` (Undefined).
v1.19 Enhancements:
- Media Player Classic (MPC-HC) Subtitle Style Matching:
  * Fully calibrated plain text & SRT hardsub styling to match the exact default appearance of Media Player Classic (MPC-HC / xy-VSFilter).
  * Removed heavy bolding and overly thick outlines: changed `Bold=1` to `Bold=0` (clean, crisp Arial regular weight) and reduced `Outline` from 2.4 down to 1.0 (calibrated against libass 288p coordinate system to render a razor-sharp ~2.5-3.5px border on 1080p, exactly like MPC-HC).
  * Balanced font size (`Fontsize=18`), subtle drop shadow (`Shadow=1.0`), and vertical margin (`MarginV=22`) to replicate MPC-HC's clean, legible on-screen presentation without ballooning or clumping letters.
  * Preserved full native typography and styling for ASS/SSA tracks without alteration.
v1.18 Enhancements:
- Elimination of DOS/CMD Console Popups:
  * Replaced raw `Command::new("curl")` with `crate::tools::create_command("curl")` enforcing the Win32 `CREATE_NO_WINDOW` (`0x0800_0000`) flag, completely suppressing black console window flashes.
  * Added instant cache verification and short connection timeouts (`--connect-timeout 3 --max-time 6`) to eliminate delays before queue processing.
- Pixel-Perfect Hardsub Rendering (Exact Standalone Fidelity):
  * Embedded container subtitles (ASS/SSA) now read directly from the container via `subtitles='source.mkv:si=N'` with robust filtergraph character escaping. This preserves 100% of all embedded fonts (attachments), font styling, colors, positioning, and typesetting, identical to standalone playback in VLC/MPC-HC.
  * SRT / plain text subtitles now receive standard video-player high-contrast formatting (`Fontname=Arial,Fontsize=22,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.4,Shadow=1.0,MarginV=30`), preventing tiny 16pt SD unbolded washed-out text and matching standalone player appearance.
v1.13 Enhancements:
- HandBrake-Style Video Preset Catalog: Added comprehensive presets grouped under "General" and "Web & Streaming", following the HandBrake standard:
  * General: H264 Very Fast 1080p30 / 720p30 / 480p30, H264 Fast 1080p30 / 720p30 / 480p30, H264 High Profile Level 4.2 6000K 1080p, H264 Main Profile Level 4.0 3000K 720p, H264 Main Profile Level 3.1 1000K 480p, H264 Baseline Profile Level 3.0 600K 360p, VP9 3000K 1080p, VP9 1500K 720p.
  * Web & Streaming: Web MP4 1080p (H264 + faststart), Web MP4 720p (H264 + faststart), HEVC MP4 1080p (smaller files), VP9 WebM 1080p (constant quality), AV1 MP4 1080p (slow, smallest).
  * Preserved `Default (Matches Settings)` and `Copy (no re-encode)` as the primary top options.
  * Backend support: Extended `VideoEncodingSettings` with `fps`, `profile`, and `level` parameters, passed directly to FFmpeg.
  * Queue Plan Display: Queue table clearly displays the active preset name (e.g. `Convert (H264 Very Fast 1080p30) · Mux`).
v1.12 Enhancements:
- Browser Keyboard Shortcuts Completely Disabled: All web browser keyboard combinations (F5, F3, F7, F12, Ctrl+P, Ctrl+R, Ctrl+S, Ctrl+U, Ctrl+F, Ctrl+O, DevTools Ctrl+Shift+I/J/C, Alt+Left/Right navigation, and Backspace navigation outside inputs) are intercepted and prevented.
- Hardsub Subtitle Burning Feature: Added burning subtitle into video (`subtitles='...'` filterchain in FFmpeg).
  * Strictly restricted to video conversion (`action == "convert"`). Completely disabled when Video preset is set to `Copy (no re-encode)`.
  * Visual Hardsub badge indicator in the Quick Settings bar.
  * Per-track `🔥 Burn into video (Hardsub)` option in the Review stage tracks table.
  * Automatic synchronization: Selecting burn subtitle automatically switches Video preset away from Copy to Convert.
  * Mkvmerge synchronization: Burned subtitles are rendered directly into video pixels and omitted from soft subtitle streams to prevent duplicate tracks.
v1.11 Enhancements:
- Subtitle Content Language Detection (Sampled Analysis): Scans up to 50 lines / 32 KB of subtitle text (SRT, ASS, VTT) and calculates character/word percentage ratios (Arabic script `\u0600-\u06FF`, Japanese kana/kanji, Cyrillic, French markers, English keywords) to automatically identify the language even when filenames lack language indicators.
- Top-Bar Quick Submenu for Undetermined Tracks: In the Stage 2 top-bar Keep Subtitles and Keep Audio dropdowns, any `und` (Unknown) track now displays an inline submenu allowing one-click batch assignment to any language (Arabic, English, French, etc.) across all imported videos.
- Interactive Language Dropdown in Tracks Table: The language column in the Review tracks table is now an editable dropdown, enabling instant per-track language reassignment.
- Auto-Language Detection on Stage 2 Attachments: Adding subtitle attachments via `+ Add attachment` now triggers `detect_subtitle_language` automatically with a fallback to the user's default subtitle setting instead of defaulting to `und`.
v1.10 Enhancements:
- Queue Job State Preservation Across Navigation: Returning back to Stage 2 (Review) or Stage 1 (Import) and advancing again to Stage 3 (Export) now preserves the completion status (`done`, `100%`, progress, speed) of processed files without resetting them to `waiting`.
- Selective Queue Processing: Clicking "Start Processing" skips already completed (`done`) videos and only processes pending/waiting jobs. If all jobs are already done, it allows re-running all.
- Persistent Settings Across Restarts: Added dual persistence (HTML5 `localStorage` + native Windows file storage via Tauri commands `save_settings` and `load_settings` in AppData). Theme, accent color, default audio & subtitle languages, advanced video options (resolution, codec, rate control, quality/bitrate, preset, tune, pix_fmt), audio options, and export folder/pattern preferences are automatically saved on change and reloaded on startup.
- Dynamic VBR/CBR Bitrate UI in Kb/s: Video rate control now dynamically distinguishes between CRF/CQ (values 0 - 51) and VBR/CBR (bitrate in Kb/s, e.g. 6000 Kb/s). The UI dynamically adjusts labels, placeholder hints, and validation boundaries.
- Extended Audio & Subtitle Language Defaults: Added French, German, Spanish, Italian, and Russian to default preference dropdowns.
v1.09 Enhancements:
- Asynchronous Native File Pickers: Switched `pick_files`, `pick_folder`, and `pick_attachment_files` in Rust backend to `rfd::AsyncFileDialog` to eliminate COM STA threading blocking and ensure instant responsive file dialogs.
- Tauri v2 Drag-and-Drop: Integrated official `getCurrentWebviewWindow().onDragDropEvent` for full desktop file drag-and-drop support with real OS path resolution and visual dropzone feedback.
- Clickable Dropzone: Clicking anywhere inside the main import dropzone now triggers the native file selection dialog.
- Extended Media Support: Added support for `.flv`, `.wmv`, `.vob`, `.ogv`, `.m2ts`, and `.mts` container formats in file scanning.
- Root Executable: Compiled and placed `MovieConverter.exe` directly in the project root folder alongside updated `run_native_app.bat` for direct execution.
v1.08 Enhancements:
- Queue Action Buttons Working: `Pause` (toggles to `Resume`), `Skip current`, and `Cancel all` are now active during conversion. Implemented via Rust Win32 native thread control (`NtSuspendProcess`, `NtResumeProcess`) and process termination (`TerminateProcess`) on the active ffmpeg/mkvmerge child processes with atomic queue state flags.
- Queue Table Layout: Video filename column occupies at least 60% of the table width with ellipsis overflow, preventing the Plan text from squishing long titles.
- Queue Status Clarified: Replaced internal technical labels like `NVENC` in the status badge with clear user-friendly text `Converting` (e.g. `Converting · 12.3x`).
- Review Header Cleaned: Removed `#activePresetChip` ("Preset 1: Default") and cleaned attachment button label to simple `+ Add attachment`.
- Top Bar Theme Button Removed: Removed `Light`/`Dark` button from header bar; theme toggles remain accessible inside the unified Settings modal.



Purpose: single source of truth for building the app with an AI code generator. Read it fully before writing code. When this file and a chat message disagree, the newest user message wins and this file must be updated.
Versioning rule: Every subsequent user change request increments to the next decimal (1.01, 1.02, ..., 1.xx).

UI mockup (light and dark, 4 screens each): https://claude.ai/artifact/SKs27hy4tcxratF3gHd6YV

---

## 1. Summary

A desktop app for one person that prepares movie and TV-series files for a media library. It merges two things the owner currently does by hand:

1. Converting video/audio/subtitle formats with **ffmpeg** (command line, no GUI).
2. Managing **MKV** files (tracks, languages, default flags, chapters, attachments) with the open-source tool *MKV Muxing Batch GUI*, which wraps **MKVToolNix**.

The new app has one clear, three-stage interface (Import, Review, Export) plus a Settings screen, and runs both tools behind the scenes.

Reference project (inspiration only): https://github.com/yaser01/mkv-muxing-batch-gui
- Python with PySide6, licence GPL-2.0, wraps `mkvmerge` and `mkvpropedit`.
- It muxes and edits tracks; it does not re-encode video.
- Do not copy its code unless the owner accepts GPL-2.0 for the result. Ideas and UX are free to reuse.

ffmpeg: https://github.com/ffmpeg/ffmpeg (used as an external executable only; never link its libraries).

## 2. Goals and constraints

- **Personal use only**, one user, not distributed. Licensing is therefore not a blocker. If the app is ever shared, re-check: GPL builds of ffmpeg (libx264/libx265), GPL-2.0 of the reference project, HEVC/AAC patent terms.
- **Most important requirement: a smooth, clear UI.** When in doubt, simplify.
- Code is **generated by AI**, so: small modules, pure functions for logic, tests for every rule, no clever magic.
- Language of the UI: **English** (v1). Keep all strings in one place so another language can be added later.
- Target OS: **Windows 10/11** first (not yet confirmed by the owner; see section 18). Keep path and process code portable where it costs nothing.
- Output container: **MKV** only (v1).
- Original files are never modified. Output goes to a separate folder.

## 3. External tools

| Tool | Role |
|---|---|
| `ffprobe` | Reads every input file as JSON (streams, format, chapters). |
| `ffmpeg` | Re-encodes video, converts audio, converts text subtitles. Produces temporary pieces. |
| `mkvmerge` | Final assembly of the output MKV: track selection, order, language, name, default/forced flags, chapters, attachments, delays. |
| `mkvpropedit` | Optional: in-place property edits (not needed while output goes to a new folder). |

Discovery on first run and in Settings: search `PATH`, then user-configured paths. Validate with `-version`. List usable encoders with `ffmpeg -hide_banner -encoders` and cache the result so the UI only offers encoders that exist (for example `hevc_nvenc`).

Identification commands:
```
ffprobe -v quiet -print_format json -show_format -show_streams -show_chapters "<file>"
mkvmerge --identification-format json --identify "<file>"      (same as -J)
```
Always verify option names against the installed version (`mkvmerge --help`, `ffmpeg -h encoder=<name>`), because they change between releases.

## 4. Core concept: the Track Plan

Do not model "convert, then mux" as two separate programs. For each video, build a **Track Plan**: one decision per track, then generate the **fewest possible commands**.

Track kinds: video, audio, subtitle, chapters, attachment.
Track origins: inside the original MKV, or an imported external file.
Track actions:

| Kind | Possible actions |
|---|---|
| Video | Keep (copy), Convert (apply preset) |
| Audio | Keep, Convert to codec, Remove, Add (external) |
| Subtitle | Keep, Convert (text formats only), Remove, Add (external) |
| Chapters | Keep, Remove, Add/Replace (external) |
| Attachment | Keep, Remove, Add |

Pipeline choice (always finishes with an mkvmerge assembly):

1. **Nothing needs re-encoding** (video Keep, audio Keep): run `mkvmerge` only. Seconds, no quality loss.
2. **Some audio converts**: `ffmpeg` converts only those audio tracks to temp files; `mkvmerge` combines the original video, kept tracks and temp files.
3. **Video converts**: `ffmpeg` encodes the video to a temp file (video only); then `mkvmerge` combines it with everything else.

Benefits: no full-size intermediate files, minimal disk use, original streams stay untouched wherever possible.

## 5. Workflow and screens (functional spec)

Three stages shown in a top stepper: **1 Import, 2 Review, 3 Export**. Settings is separate (top-right). A Light/Dark switch is always in the top bar.

### 5.0 Global rules (decisions)

- **Movies and series use the same flow and the same screens.** A movie is a series with one video in the list. There is **no Movie/Series selector**. The app detects grouping automatically (section 7).
- **Attachments cannot be added at Import.**
  - Series: add shared attachments at **Export**; they apply to **all** videos.
  - Movies: add attachments by hand at **Review**, per video.
  - Both places exist for both cases; final attachments = old attachments kept + per-video added + shared added (de-duplicated by name).
- Nothing is written until the user presses Start.

### 5.1 Stage 1: Import

Purpose: bring in everything for the job at once.
- Big drop zone: drag files or folders, or buttons **Add files** / **Add folder**.
- Accepted kinds (tags shown): Video, Audio, Subtitles, Chapters. (Attachments are not accepted here.)
- Imported-so-far summary: counts for Videos, Audio files, Subtitles, Chapters, Groups found.
- Footer: hint text and **Next: Review**.
- Recent folders list is allowed later; not in the final mockup.

### 5.2 Stage 2: Review

Top **quick settings bar** (applies to all videos; the label says "Applied to all N videos"). Five dropdowns:
1. **Video preset**: Default (from Settings), Copy (no re-encode), H.265 CRF 22 1080p, H.264 CRF 20 1080p, H.265 NVIDIA NVENC, AV1 smallest size, Manage presets.
2. **Remove audio languages** (multi-select, for example French, Spanish).
3. **Remove subtitle languages** (multi-select).
4. **Default audio** language.
5. **Default subtitle** language.

Below: two panes.
- **Left (280 px): video list.** One row per group name (for example `Dark.S01E01`) with a meta line such as "MKV · 2 audio · 2 subs · +2 files" and an optional badge (**No sub**, **Extra**). Selected row has a blue outline.
- **Right: summary of the selected video.** Header: group name, short description, preset chip. One table, columns **Track / Language / Default / Action**, in three groups:
  1. *Inside the original MKV*: video, each audio, each subtitle, chapters.
  2. *Imported files with the same name*: external audio/subtitles/chapters.
  3. *Attachments*: old ones (Keep/Remove), new ones (Add), link **+ Add attachment**.

Semantics of the quick settings:
- Removing a language marks matching tracks as Remove. Never remove the **last** audio track silently: warn and keep one.
- Default audio/subtitle: among kept tracks of that language, exactly one gets the default flag (the first one); all other tracks of that kind lose it. "Keep as in file" leaves flags untouched.
- Manual per-track changes in the table are *overrides*; later quick-setting changes must not overwrite them (planned: small lock marker; not drawn in the mockup).

### 5.3 Stage 3: Export

- **Output settings card:** Output folder (+ Browse), File name pattern (default `{show} - S{season}E{episode}`; for movies default keeps the original name), If a file exists (Ask me / Overwrite / Skip / Rename). Options: Delete original files after success (send to Recycle Bin, never permanent), Shut down the PC when finished.
- **Attachments card (shared):** "Added to all N videos"; list of files with remove (x); **+ Add attachment**; checkbox **Remove old attachments first**.
- **Queue card:** header "Queue · N videos" with "x of N done · about M min left". Columns **Video / Plan / Progress / Status**. Plan text example: "Convert video · +audio · +sub".
- **Footer buttons:** Pause, Skip current, Cancel all, Open output folder, and the primary **Start**.
- Statuses: Waiting, Running, Done, Warning, Failed, Skipped, Cancelled.

### 5.4 Settings

Defaults for every new project (stored on disk, section 11).
- **Appearance:** Theme = Light / Dark / System.
- **Preferred languages:** default audio language (or "Keep as in file"), default subtitle language, languages to remove from audio.
- **Audio output:** codec (AAC, AC3, E-AC3, Opus, FLAC, copy), channels (keep, stereo, 5.1), bitrate, sample rate, normalize volume (off or loudnorm).
- **Video output (default preset):** hardware (CPU, NVIDIA, AMD, Intel), codec (H.264, H.265, AV1), resolution (keep, 2160p, 1440p, 1080p, 720p, custom), scaling algorithm, rate control (CRF/CQ or bitrate), quality value, speed preset, bit depth (8 or 10), frame rate (keep or custom), HDR (keep, tone-map to SDR), container (MKV).
- Tools: paths to ffmpeg, ffprobe, mkvmerge; temp folder.

### 5.5 Theme

Light and Dark with a quick switch in the top bar and a Settings option (Light/Dark/System). All colours come from tokens (section 13).

## 6. Data model (sketch)

```python
@dataclass
class Track:
    id: str                 # stable id inside the project
    kind: Literal["video","audio","subtitle","chapters","attachment"]
    origin: Literal["container","external"]
    source_path: Path       # original MKV or external file
    source_index: int       # mkvmerge track id (container) or 0 (external)
    codec: str              # e.g. "E-AC3", "SRT", "H.264"
    language: str           # ISO 639-2, "und" if unknown
    name: str
    is_default: bool
    is_forced: bool
    details: dict           # channels, bitrate, resolution, fps, hdr, size...

@dataclass
class VideoGroup:           # one row in the Review list
    key: str                # "Dark.S01E01"
    show: str | None; season: int | None; episode: int | None
    source: Path            # the video file
    tracks: list[Track]     # original + imported
    plan: dict[str, TrackAction]   # track id -> action
    overrides: set[str]     # track ids the user changed by hand
    attachments_added: list[Path]
    warnings: list[str]

@dataclass
class TrackAction:
    kind: Literal["keep","convert","remove","add"]
    target_codec: str | None
    params: dict

@dataclass
class Project:
    groups: list[VideoGroup]
    quick: QuickSettings        # the five dropdown values
    export: ExportSettings      # folder, pattern, overwrite policy, flags
    shared_attachments: list[Path]
    remove_old_attachments: bool

@dataclass
class Job:
    group: VideoGroup
    steps: list[Step]           # ffmpeg steps then one mkvmerge step
    status: Literal["waiting","running","done","warning","failed","skipped","cancelled"]
    progress: float
```

## 7. Grouping and matching rules

Goal: files that belong together are listed under one video name.

1. Key extraction, first match wins: `S(\d{1,2})E(\d{1,3})`, then `(\d{1,2})x(\d{2,3})`, then `(?:Episode|Ep|E)[ ._-]?(\d{1,3})`, then a normalised stem (remove extension, language tokens such as `.ar`, `.ara`, `.eng`, `.forced`, release/codec tags).
2. Files with the same key join the same group. Show name = common prefix of the videos.
3. If only **one** video is imported, every non-video file joins it (movie case).
4. Files that match nothing go to an "Unassigned" tray where the user drags them onto a video.
5. Language of an external file is guessed from filename tokens; the user can edit it in Review.
6. Groups with a track layout different from the majority get an **Extra** badge; groups missing a subtitle in the chosen default language get **No sub**.

## 8. Planner rules (pure functions, unit-tested)

Input: groups, quick settings, Settings defaults. Output: a plan per group.

- Video: preset "Copy" gives Keep; any other preset gives Convert. A "Default" preset resolves to the preset stored in Settings.
- Audio: remove-language list gives Remove (but keep at least one); target codec from Settings gives Convert only when the source codec/channels/bitrate differ from the target; otherwise Keep.
- Subtitles: remove-language list gives Remove; image subtitles (PGS, VobSub) can only be Keep or Remove; text subtitles may be converted.
- Default flags per section 5.2.
- Chapters: Keep unless an external chapters file is imported (then Replace).
- Attachments: old attachments Keep unless "Remove old attachments first" is on; per-video and shared additions are added.
- Output order: video, audio (default language first), subtitles (default first).
- Warnings (never block the run): no audio left, no subtitle in default language, different layout from the majority, output path equals source path.

## 9. Command generation

### 9.1 ffmpeg temp pieces

```
# video only
ffmpeg -hide_banner -nostdin -y -progress pipe:1 -nostats -i SRC \
  -map 0:v:0 -an -sn -dn -map_chapters -1 -map_metadata -1 <video args> TEMP/video.mkv

# one audio track
ffmpeg -hide_banner -nostdin -y -progress pipe:1 -nostats -i SRC \
  -map 0:a:N -vn -sn -dn -c:a aac -b:a 192k [-ac 2] [-ar 48000] TEMP/audio_N.mka
```
Text subtitle conversion uses `-c:s srt` (or `ass`) the same way.

### 9.2 mkvmerge assembly

Options before a file apply to that file; track options use `TID:value` with the track id from `mkvmerge -J` (external files use 0).

```
mkvmerge --gui-mode -o "OUT/Dark.S01E01.mkv"
  --no-video --audio-tracks 1 --subtitle-tracks 3 --no-attachments  "SRC.mkv"
  TEMP/video.mkv                                   # converted video (omit when copying)
  --language 0:ara --track-name 0:"Arabic" --default-track-flag 0:yes  "dark.01.ar.srt"
  --sub-charset 0:cp1256   (only for text subtitles that are not UTF-8)
  --attach-file "fonts.ttf" --attach-file "cover.jpg"
  --track-order 0:0,1:1,2:0
```
Delay: `--sync TID:ms`. Chapters: `--chapters file`. When copying video from the source, drop `--no-video` and select tracks with `--video-tracks`.

## 10. Settings to ffmpeg mapping (verify on the installed build)

| Choice | CPU | NVIDIA | AMD | Intel |
|---|---|---|---|---|
| H.264 | libx264 | h264_nvenc | h264_amf | h264_qsv |
| H.265 | libx265 | hevc_nvenc | hevc_amf | hevc_qsv |
| AV1 | libsvtav1 | av1_nvenc (RTX 40+) | av1_amf (RDNA 3+) | av1_qsv (Arc) |
| Quality | `-crf N` | `-rc vbr -cq N -b:v 0` | `-rc cqp -qp_i N -qp_p N` | `-global_quality N` |
| Speed | `-preset medium` | `-preset p1..p7` | `-quality speed/balanced/quality` | `-preset veryfast..veryslow` |

- 10-bit: `-pix_fmt yuv420p10le` (CPU) or `p010le` (hardware encoders); probe support first.
- Resolution: `-vf scale=-2:1080:flags=lanczos`; "Keep original" adds no filter; never upscale unless the user picks it.
- Frame rate: omit `-r` to keep the source rate.
- HDR keep: preserve colour tags and use 10-bit; warn that some static metadata may not pass through. HDR to SDR needs a zscale/tonemap filter chain and an ffmpeg build with libzimg.
- Audio: `-c:a aac|ac3|eac3|libopus|flac|copy`, `-b:a`, `-ac`, `-ar`, normalise with `-af loudnorm`.
- Offer only encoders that appear in the cached encoder list; grey out the rest with a tooltip.

## 11. Execution engine

- **Probe**: run ffprobe and mkvmerge identification per file, parse JSON, build tracks.
- **Runners**: wrap each external process; read ffmpeg progress from `-progress pipe:1` (`out_time_us` divided by duration, plus `speed`); read mkvmerge progress from `--gui-mode` lines (`#GUI#progress N%`).
- **Queue**: one job at a time by default (encoding saturates the CPU/GPU). Job states as in section 5.3. Pause = suspend the process tree (psutil); Cancel = terminate the tree and delete temp files; Skip = cancel only the current job.
- **Safety**: write to `OUT/name.mkv.part`, then rename after validation. Validation with ffprobe: duration within about 1 second or 0.5 percent of the source, expected track counts present.
- **Disk check** before starting: free space at least 1.2 times the estimated temp size.
- **Temp files** live in one temp folder per job and are removed on success, failure and cancel.
- **Overwrite policy**, output name pattern tokens: `{name} {show} {season} {episode}`.
- **Storage**: `%APPDATA%/MovieConverter/settings.json`, `presets.json`, and `logs/` (one log per run; the UI shows a collapsed technical log with Show and Copy).
- **After finish**: notification, optional delete originals (Recycle Bin), optional shutdown with a 60 second cancel window.

## 12. Architecture and stack

- Python 3.11+, **PySide6** (Qt for Python). Theming with QSS generated from the tokens in section 13.
- Use `QProcess` (or `subprocess` in worker threads) so the UI thread never blocks.
- Layers:
  1. `ui/`: screens, widgets, theme.
  2. `core/planner.py`: pure functions (plan, grouping, command building). No I/O.
  3. `core/probe.py`, `core/runners.py`, `core/queue.py`: tools and processes.
  4. `core/settings.py`, `core/presets.py`: persistence.
- Suggested tree:
```
movie_converter/
  app.py
  ui/ (main_window.py, stepper.py, import_page.py, review_page.py,
       export_page.py, settings_page.py, widgets/, theme.py, strings.py)
  core/ (models.py, grouping.py, planner.py, commands.py, probe.py,
         runners.py, queue.py, settings.py, presets.py, languages.py)
  tests/ (unit tests per core module, sample media in tests/media/)
```
- Packaging: PyInstaller (or Nuitka) for a single Windows build; ffmpeg and MKVToolNix are installed separately and discovered at runtime.
- Tests: pytest; planner and command-building tests need no media. Keep 10 to 15 tiny sample files (10 to 30 seconds) covering AVI, TS, MKV with many tracks, no chapters, PGS subtitles, Arabic filenames, a full mini-season.

## 13. Design system (from the mockup)

Canvas: each screen is 1280 x 800 px. Everything uses CSS-variable tokens; Dark is the same layout with token overrides.

### 13.1 Tokens

| Token | Light | Dark |
|---|---|---|
| background | #F6F7F9 | #101216 |
| panel / card | #FFFFFF | #181B21 |
| border | #E3E6EB | #2A2F38 |
| border strong | #C5CBD3 | #3A404A |
| text | #1B1F24 | #E8EAED |
| muted text | #5B6470 | #9AA3AF |
| accent (buttons) | #2563EB | #2F6FE4 |
| accent surface (selected) | #EFF5FF | #1B2536 |
| accent text | #1E40AF | #BFD8FF |
| group header | #F1F3F6 | #1E232B |
| warning row | #FFFBEB | #2A2414 |

Action chip colours (always with a text label, never colour alone):

| Class | Meaning | Light bg / text | Dark bg / text |
|---|---|---|---|
| neutral | Keep, Waiting | #EEF0F3 / #3A424D | #2A3038 / #C9D1DB |
| blue | Convert, Running, preset | #DBEAFE / #1E40AF | #1E3A66 / #BFD8FF |
| red | Remove, Cancel | #FEE2E2 / #991B1B | #4A2326 / #FFB4AB |
| green | Add, Done, Ready | #DCFCE7 / #166534 | #17402B / #9BE8BC |
| amber | Warning, No sub, Extra | #FEF3C7 / #92400E | #4A3A17 / #FFD98A |

Track-type tags are outlined (not filled) so they differ from action chips: Video blue (#1D4ED8 / #8DB4FF), Audio amber (#92400E / #F2C46D), Subtitle green (#166534 / #7FDDA6), Chapters and Attachment neutral.

### 13.2 Type, shape and sizes

- Font: Segoe UI (fallback system-ui), 15 px body, line-height 1.4. Page title 26 px bold. Section labels 12 to 13 px uppercase, muted. Large numbers 30 px bold.
- Radii: cards 12, buttons 8 to 10, chips 8, tags 6.
- Top bar 72 px; bottom action bar 92 px; Review quick bar 84 px; left video list 280 px; table row about 35 px; primary button 52 px high with 17 px bold text, always at the bottom right.
- Stepper: numbered circles; current = filled accent; finished = green with a check mark; connected by short lines.
- Top-right: segmented **Light | Dark** control and a **Settings** button.
- Layout rules: at most about 7 interactive items visible per area; disabled items stay visible with a tooltip; no modal dialogs except real risks (for example replacing original files).

### 13.3 Screen layouts (as drawn)

1. **Import**: title and one sentence; one large dashed drop zone with the kind tags and two buttons; "Imported so far" card with six counters; footer with hint and **Next: Review**.
2. **Review**: quick bar (label cell + five dropdowns; the preset list is shown open in the mockup), left video list, right grouped track table, footer with status line and **Next: Export**.
3. **Export**: output settings card (two columns), shared attachments strip, queue card, footer buttons with **Start** on the right.
4. **Settings**: two columns of cards. Left: Appearance, Preferred languages, Audio output. Right: Video output with the hardware segmented control (CPU, NVIDIA, AMD, Intel) at the top and about ten form rows. Save and Reset buttons top-right.

### 13.4 Mockup status

- The mockup is a static canvas (not clickable). Boards: `Main` (Import), `Review`, `Export`, `Settings`, each in Light and Dark (`MainD`, `ReviewD`, `ExportD`, `SettingsD`).
- Old boards `Film`, `Series`, `Run` come from an earlier Arabic-flow draft and should be deleted from the canvas.
- Not drawn yet: empty states, error states, the unassigned-files tray, the lock marker for manual overrides, the preset manager.

## 14. Edge cases and validation

- Missing subtitle for an episode: warn (amber), allow choosing a file; never block.
- Different track layout in one episode: show "Extra" badge and keep the per-video plan.
- Image subtitles (PGS, VobSub): copy or remove only; OCR is a later feature.
- Arabic subtitle files: detect encoding (UTF-8 with or without BOM, cp1256); convert to UTF-8 or pass `--sub-charset`.
- Unknown language: `und`; require the user to confirm only when it affects a default flag.
- Paths with Arabic or other Unicode characters and very long paths: test on Windows early.
- Frame-rate changes can desync external audio or subtitles: warn and offer the `--sync` delay.
- Disk full, tool missing, tool crash: fail the job with a readable reason and a copy-log button; continue with the next job.
- Output folder equals source folder: refuse unless the user explicitly confirms.
- Cancel at any moment must leave no half-written output and no temp files.

## 15. Decision log

| Decision | Reason |
|---|---|
| New app that orchestrates tools, not a merge of two code bases | Both tools are command-line programs; orchestration is the simplest, most robust integration. |
| Track Plan with minimal commands | Saves time and disk; avoids re-encoding what does not need it. |
| One flow for movies and series; no selector | The process is identical; the selector changed nothing. |
| Attachments not at Import; shared at Export; per-video at Review | Matches how the owner works: series share files, movies are done by hand. |
| English UI, Light and Dark themes | Owner request. |
| Python + PySide6 | Fast to generate and iterate with AI; matches the reference project's stack. |
| Output to a separate folder, originals untouched | Safety. |
| Automatic silent UTF-8 subtitle conversion | Owner request: seamlessly convert any subtitle encoding (cp1256, etc.) to clean UTF-8 without prompting. |
| Selectable accent colors in Settings | Owner request: Nordic Teal (default), Cinematic Amber, Sage Juniper, and Classic Blue. |
| Delay / Sync column in Review track table | Allows fine-tuning +/- ms audio/sub sync offsets directly in Review. |
| Subfolder pattern support ({show}/Season {season}/...) | Organizes media into standard server hierarchy. |
| Preserving HDR metadata tags with NVENC | Essential for RTX 3060 hardware encoding without washed-out colors. |

## 16. Roadmap and build order for the AI

Build in small, testable slices; each slice runs on its own.

- **M0 Core CLI**: probe, grouping, planner, command builder, runners; run on the sample files from a terminal.
- **M1 UI shell**: main window, stepper, top bar, theme tokens, Light/Dark switch.
- **M2 Import page** with grouping and counters.
- **M3 Review page**: quick bar, video list, track table, per-track actions, attachments.
- **M4 Export page**: output settings, shared attachments, queue, start/pause/cancel/skip.
- **M5 Settings and presets**: full video/audio options, hardware detection, preset manager.
- **M6 Polish**: notifications, logs, error states, packaging.
- Later: OCR for image subtitles, episode renaming from online data, resume after a crash, two-pass encoding.

Rules for the code generator:
1. Never run external tools on the UI thread.
2. Planner and command builder are pure and covered by tests.
3. Take every colour and size from section 13; no ad-hoc styling.
4. Use text labels with colour for statuses and actions.
5. Do not add features outside this file without asking.

## 17. Glossary

- **Mux**: combine tracks into one container without re-encoding.
- **Track Plan**: per-video list of decisions (keep, convert, remove, add) for every track.
- **Preset**: a saved set of video (and audio) output options.
- **Group**: one video plus all imported files that share its name key.

## 18. Smart Naming & Release Tag Engine (FileBot-style)

- **Engine added in v1.14**:
  - Tab in Settings: `Naming & Tags`.
  - Supports `{Title}`, `{Year}`, `{SS}`, `{EE}`, `{S}`, `{E}`, `{Resolution}`, `{Qt}`, `{vc}`, `{Tag}`.
  - Source rip quality `{Qt}` detection (`BluRay`, `BRRip`, `BDRip`, `WEB-DL`, `WEBRip`, `HDTV`, `DVDRip`, `REMUX`).
  - Seamless omission of `{Qt}` without extra dots if quality tag is absent from original source name.
  - Live Preview in settings for TV series (with/without `{Qt}`) and Movies.
  - Target output file name dynamically rendered in the Export Queue table and passed to the Rust execution engine.
- **Online Metadata & Cover Art Engine (v1.15)**:
  - Multi-source cascading recognition:
    - **AniList GraphQL API**: Zero-API-key anime recognition with English/Romaji/Native titles, release years, and high-res posters.
    - **TVmaze REST API**: Zero-API-key TV series recognition with official names, premiered years, and posters.
    - **TheMovieDB (TMDB)**: Optional API key for global movies and shows.
  - Automatic In-Memory Caching to avoid duplicate network calls.
  - Cover Art Extraction & Embedding:
    - Visual poster display in Review Stage detail header and Queue table.
    - Native `mkvmerge` attachment embedding: `--attach-file cover.jpg --attachment-name cover.jpg --attachment-mime-type image/jpeg`.
    - Enables native Windows Explorer thumbnails, VLC cover display, and Plex/Jellyfin metadata matching.
  - Interactive On-Demand Preview Modal:
    - Button `✨ Preview Info & Cover` in Review stage.
    - Editable search box, provider selector (Auto / AniList / TVmaze / Wikipedia / TMDB), and live high-res poster preview.
    - Year search input (`Search Year`) to accurately disambiguate movies and upcoming releases (e.g., *The Odyssey 2026*, *Heart of the Beast 2026*).
    - Wikipedia MediaWiki provider for free, keyless coverage of global and upcoming movies with official poster images.
    - Interactive candidate picker for browsing and selecting between multiple search results.
    - Editable official title and year inputs with live output filename preview.
    - Options: "Apply to This Video", "Apply to All Episodes", or "Clear Info & Cover".
- **Review Stage Polish & Usability Improvements (v1.16)**:
    - Simplified track burning action text to strictly single word **`Burn`** in the Review tracks table.
    - `Default subtitle` (`quickDefSub`) dynamically isolates and shows exclusively the single kept subtitle when only 1 subtitle is selected in `Keep Subtitles` (same applied to `Default audio` / `quickDefAudio`).
    - Removed redundant `+ Add attachment` button from the Review stage header.
- **Series/Movie Differentiation & Season Metadata (v1.17)**:
    - Robust multi-pattern series detection across Rust (`grouping.rs`) and JS (`parseMediaInfo`): supports `S01E01`, `S01.E01`, `S01 E01`, `Season 1 Episode 1`, `1x01`, `E01`, `EP01`, and anime episode numbering (`- 01`).
    - Strips leading release group brackets (`[YTS]`, `[SubsPlease]`, etc.) from title parsing.
    - Full TVmaze season embedding: extracts exact premiere release year and dedicated poster cover for each season (Season 1 = 2011 cover, Season 2 = 2012 cover, etc.).
    - Candidate search picker streamlined: removed description/snippet text, displaying exclusively the official Name and Year.
    - Strict pattern separation: Series strictly use `seriesPattern` with `{SS}`/`{EE}`, Movies strictly use `moviePattern` with `{Year}`.
- **MPC-HC Subtitle Engine, NVENC Hardware Acceleration & Export Pipeline (v1.29)**:
    - **100% MPC-HC Style Calibration & Vector Sharpness**:
      - Subtitles are now converted into native vector ASS files at `PlayResX: 1920, PlayResY: 1080` with `ScaledBorderAndShadow: yes`.
      - Rendered using Times New Roman Bold, Border width 2.0, Shadow 3.0 (50% alpha `&H80000000`), Bottom-Center alignment (`Alignment=2`), and exact margins (20, 20, 20).
      - Eliminates all pixelation/graininess and delivers razor-sharp text on 1080p and 4K displays.
      - Comprehensive sanitization completely eliminates square boxes (tofu artifacts) caused by invisible zero-width spaces (`\u{200B}`..`\u{200D}`), bidirectional marks (`\u{200E}`, `\u{200F}`, `\u{061C}`), directional embeddings/isolates, BOM (`\u{FEFF}`), and non-breaking spaces.
    - **NVENC H.264 Acceleration & Pixel Format Fix**:
      - Fixed encoder failure where `h264_nvenc` rejected `p010le` (10-bit) and fell back to slow CPU encoding; now automatically enforces `yuv420p` (8-bit) for H.264 while retaining `p010le` for HEVC/AV1.
      - Removed invalid `-tune faststart` from web presets that previously crashed FFmpeg.
      - Supported presets `0`..`12` for SVT-AV1 (`libsvtav1`).
    - **Monotonic Forward-Only Progress & Sequential Stages**:
      - Fixed progress jumping backwards (e.g. 80% to 76%) by establishing strictly non-overlapping stage slices (Video: 5-75%, Audio: 75-88%, Muxing: 88-100%).
      - Enforced monotonic `AtomicU32` tracking in Rust backend so progress never regresses.
    - **Center Window Placement**:
      - Borderless window is programmatically centered on the screen upon startup via Tauri IPC (`center_window`).
    - **Export Location Flexibility**:
      - Added 3 distinct export modes: Same folder as source (auto-creates `Converted` subfolder if filenames match), Dedicated `Converted` subfolder, or Custom folder.
    - **Audio Codec Tagging & Clean Titles**:
      - Clean title parsing without forced artificial dots, width-based resolution rule (1920 -> 1080, 3840 -> 2160), and clickable variable badges including `{ac}`.
- **Track Disambiguation, Unique Defaults, Unified Badges & UI Polish (v1.32)**:
    - **Duplicate Track Numbering & Disambiguation**:
      - Multiple tracks with the same language in the same container (e.g. two Arabic subtitle tracks) are automatically disambiguated with indexed keys (`ara#1`, `ara#2`) and clear labels (`Arabic 1`, `Arabic 2`).
      - Works seamlessly across "Keep Subtitles", "Default Subtitle", and "Burn Subtitle" dropdowns and checkboxes so each track can be individually managed, kept, deleted, or burned.
    - **Single Default Track Enforcement (No Conflicts)**:
      - Strictly guarantees that only ONE subtitle track and only ONE audio track can ever be marked default per video.
      - Enforced dynamically in the review table dropdowns (toggling one to "Yes" automatically flips all other tracks of the same kind to "—"), in `applyQuickSettingsToAll`, and in the Rust `executor.rs` backend when generating `--default-track-flag` for `mkvmerge`.
    - **Harmonized Badge Tags Matching Import Screen**:
      - Video: Blue (`var(--chip-blue-bg)` / `var(--chip-blue-text)`)
      - Audio: Amber (`var(--chip-amber-bg)` / `var(--chip-amber-text)`)
      - Subtitles: Green (`var(--chip-green-bg)` / `var(--chip-green-text)`)
      - Chapters: Neutral Slate (`var(--chip-neutral-bg)` / `var(--chip-neutral-text)`)
      - Images & Covers: Vibrant Rose/Pink (`#FCE7F3` / `#BE185D` in light; `#381320` / `#F472B6` in dark mode)
      - Other Attachments (Fonts, binaries): Clean subtle neutral gray.
    - **Button Icons & Single Preview Icon**:
      - Added intuitive icons to all queue and control buttons: `⏸️ Pause` / `▶️ Resume`, `⏭️ Skip`, `⏹️ Cancel Queue`, `📁 Open output folder`, `🚀 Start Processing`, `🗑️ Delete all`, `⚙️ Settings`, `↺ Reset`, `💾 Save Settings`.
      - Replaced duplicated `✨ ✨` icons on `btnOpenIdentifyModal` with a single elegant `🖼️` icon.
- **Custom Cover Upload, Monochrome Vector Icons & Clean Standalone App (v1.33)**:
    - **Local Custom Image Upload in Preview Info & Cover Modal**:
      - Added dedicated `Choose Custom Image` buttons inside the modal (in the search action bar and directly below the cover preview box).
      - Allows selecting any local image (`.jpg`, `.jpeg`, `.png`, `.webp`) from the user's PC via native asynchronous file picker (`pick_image_file`).
      - Image data is securely loaded into a preview Data URL (`read_image_data_url`) and stored in `localPosterPath` to embed directly into the output MKV container via `mkvmerge`.
    - **Modern Unified Monochrome Icons (Zero Emoji Colors)**:
      - All emoji icons across the application have been replaced with professional, crisp, monochrome vector SVG icons.
      - Fully adaptive: uses `currentColor` to dynamically inherit button text colors, hover transitions, and dark/light themes.
    - **Fixed Pause / Resume Icon Visibility Bug**:
      - Fixed bug where `.textContent = "Pause"` upon queue start previously wiped the child icon span element (`#iconQueuePause`).
      - Added dedicated SVG state switching (`SVG_PAUSE` & `SVG_PLAY`) preserving element references seamlessly throughout queue lifecycle.
    - **Official Rebranding to MKVForge & Native Transparent Icon**:
      - Rebranded application officially to **MKVForge**.
      - App icon uses native multi-resolution Windows ICO (256px PNG + 128/64/48/32/16px 32-bit DIB with 1-bit transparency mask) ensuring smooth, transparent rounded corners on Windows taskbar, desktop, and file explorer.
    - **Smart Output Naming Full Restoration & Track Titles Isolation**:
      - Resolved regression where Smart Output Naming was bypassed due to missing `enabled` key in settings persistence.
      - Ensured Smart Output Naming is enabled and active by default across all files.
      - Completely isolated internal track title removal (`--track-name {tid}:`) from output file naming: track stripping only clears embedded audio/video stream title tags inside the MKV container, leaving the final output filename fully generated by the Smart Output Naming engine (`{Title} ({Year}).{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}`).
    - **Standalone Clean Distribution Directory**:
      - Created `MKVForge_Standalone/` containing exclusively the essential production files:
        * `MKVForge.exe` (Optimized Release build)
        * `bin/ffmpeg.exe`
        * `bin/ffprobe.exe`
        * `bin/mkvmerge.exe`
        * `bin/mkvpropedit.exe`
      - Entirely free of development files, source code, target build folders, or temporary artifacts.
    - **Instant In-Place Tools (Opposite Tab & Modern Animations)**:
      - Added dedicated opposite-side tab `⚡ Instant Tools` (`#btnNavQuickTools` & `#stageQuickTools`) isolated from the standard 3-step workflow.
      - Integrated `mkvpropedit.exe` v83.0 to modify MKV container headers and cover attachments in-place within 0.5s without re-muxing or copying files.
      - Implemented instant filename changes via Rust `std::fs::rename` (`0.001s`).
      - Added modern CSS cubic-bezier transition animations (`viewFadeSlideIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)`) across all stages.
      - Added batch in-place commands `batch_in_place_action` with full Arabic and English localization.
      - Fixed `mkvpropedit` exit code handling: exit code 1 is a benign warning (successful modification), only code 2+ is treated as failure.
      - Fixed broken cover preview in Tauri Webview: local images are securely converted to Base64 Data URLs via `read_image_data_url` avoiding file:// protocol blocks.
      - Fixed duplicate `+` and checkmarks across buttons; removed `apply both` and per-row `apply instant` buttons.
      - Added file removal (`✕` per row and `Clear All` in header).
      - Enforced MKV-only restrictions for in-place cover updates (disabling non-MKV files from container attachment edits).
      - Synced all instant tool buttons to dynamic theme variables (`var(--accent)`).

## 19. Open questions

1. Confirm the operating system (Windows assumed).
2. Which GPU (NVIDIA, AMD, Intel) so hardware encoding can be tested first?
3. Default file-name pattern for movies and series, and the output folder layout (flat or by show/season).
4. Should the manual-override lock marker be visible in Review?
5. Is an Arabic UI wanted later (strings are kept in one file to allow it)?
6. Delete originals: Recycle Bin (suggested) or permanent?
