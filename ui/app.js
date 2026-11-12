/**
 * Movie Converter UI Controller - Fully Functional Engine
 * Version: 1.24
 */

// Application State
const state = {
  currentStep: 1,
  theme: "dark",
  accent: "blue", // Original Version 1.00 Classic Blue Accent
  groups: [],
  selectedGroupIndex: 0,
  sharedAttachments: [],
  removeOldAttachments: false,
  isQueueRunning: false,
  isQueuePaused: false,
  quickSettings: {
    preset: "default",
    keepAudios: new Set(),
    keepSubs: new Set(),
    userTouchedAudios: false,
    userTouchedSubs: false,
    defAudio: "keep",
    defSub: "ara",
    burnSub: "none"
  },
  videoSettings: {
    resolution: "original",
    codec: "hevc_nvenc",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "p5",
    tune: "hq",
    pixFmt: "p010le",
    multipass: "disabled",
    profile: "auto",
    level: "auto",
    aq: "enabled"
  },
  audioSettings: {
    codec: "copy",
    channels: "original",
    bitrate: "copy",
    sampleRate: "original"
  },
  globalSettings: {
    theme: "dark",
    accent: "blue",
    defAudioLang: "ara",
    defSubLang: "ara",
    clearTrackNames: true,
    naming: {
      enabled: true,
      tag: "yasinoss",
      seriesPattern: "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
      moviePattern: "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
      metadataEnabled: true,
      animeTitlePref: "english",
      embedCover: true,
      tmdbApiKey: ""
    }
  },
  metadataCache: {},
  exportSettings: {
    folderMode: "same",
    folder: "D:\\Output",
    pattern: "smart",
    ifExists: "ask",
    deleteOriginals: false,
    shutdown: false
  },
  queueJobs: [],
  quickToolsFiles: []
};

// Resilient Tauri IPC Invocation
async function invoke(cmd, args = {}) {
  try {
    if (window.__TAURI__) {
      if (window.__TAURI__.core && typeof window.__TAURI__.core.invoke === "function") {
        return await window.__TAURI__.core.invoke(cmd, args);
      }
      if (typeof window.__TAURI__.invoke === "function") {
        return await window.__TAURI__.invoke(cmd, args);
      }
    }
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === "function") {
      return await window.__TAURI_INTERNALS__.invoke(cmd, args);
    }
  } catch (err) {
    console.error(`Tauri invoke error [${cmd}]:`, err);
    throw err;
  }
  console.warn("Tauri environment not detected for command:", cmd);
  return null;
}

// Language Code Name Mapping
const LANG_MAP = {
  ara: "Arabic (ara)",
  ar: "Arabic (ar)",
  eng: "English (eng)",
  en: "English (en)",
  fra: "French (fra)",
  fre: "French (fre)",
  fr: "French (fr)",
  deu: "German (deu)",
  ger: "German (ger)",
  de: "German (de)",
  spa: "Spanish (spa)",
  es: "Spanish (es)",
  jpn: "Japanese (jpn)",
  ja: "Japanese (ja)",
  ita: "Italian (ita)",
  it: "Italian (it)",
  rus: "Russian (rus)",
  ru: "Russian (ru)",
  kor: "Korean (kor)",
  ko: "Korean (ko)",
  und: "Undetermined (und)"
};

function formatLang(code) {
  if (!code) return "Undetermined (und)";
  const lower = code.toLowerCase();
  return LANG_MAP[lower] || `${code.toUpperCase()} (${code})`;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// HandBrake & FFmpeg Presets Definitions
const PRESET_MAP = {
  // General Presets
  "h264_vf_1080p30": {
    label: "H264 Very Fast 1080p30",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "22",
    preset: "veryfast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_vf_720p30": {
    label: "H264 Very Fast 720p30",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "22",
    preset: "veryfast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_vf_480p30": {
    label: "H264 Very Fast 480p30",
    codec: "libx264",
    resolution: "854x480",
    rateControl: "crf",
    qualityVal: "22",
    preset: "veryfast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_f_1080p30": {
    label: "H264 Fast 1080p30",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "22",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_f_720p30": {
    label: "H264 Fast 720p30",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "22",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_f_480p30": {
    label: "H264 Fast 480p30",
    codec: "libx264",
    resolution: "854x480",
    rateControl: "crf",
    qualityVal: "22",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p",
    fps: "30"
  },
  "h264_high_6000k_1080p": {
    label: "H264 High Profile Level 4.2 6000K 1080p",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "vbr",
    qualityVal: "6000k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p",
    profile: "high",
    level: "4.2"
  },
  "h264_main_3000k_720p": {
    label: "H264 Main Profile Level 4.0 3000K 720p",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "vbr",
    qualityVal: "3000k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p",
    profile: "main",
    level: "4.0"
  },
  "h264_main_1000k_480p": {
    label: "H264 Main Profile Level 3.1 1000K 480p",
    codec: "libx264",
    resolution: "854x480",
    rateControl: "vbr",
    qualityVal: "1000k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p",
    profile: "main",
    level: "3.1"
  },
  "h264_base_600k_360p": {
    label: "H264 Baseline Profile Level 3.0 600K 360p",
    codec: "libx264",
    resolution: "640x360",
    rateControl: "vbr",
    qualityVal: "600k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p",
    profile: "baseline",
    level: "3.0"
  },
  "vp9_3000k_1080p": {
    label: "VP9 3000K 1080p",
    codec: "libvpx-vp9",
    resolution: "1920x1080",
    rateControl: "vbr",
    qualityVal: "3000k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "vp9_1500k_720p": {
    label: "VP9 1500K 720p",
    codec: "libvpx-vp9",
    resolution: "1280x720",
    rateControl: "vbr",
    qualityVal: "1500k",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },

  // Web & Streaming Presets
  "web_mp4_1080p": {
    label: "Web MP4 1080p (H264 Fast)",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "22",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "web_mp4_720p": {
    label: "Web MP4 720p (H264 Fast)",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "23",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "hevc_mp4_1080p": {
    label: "HEVC MP4 1080p (smaller files)",
    codec: "libx265",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "26",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "vp9_webm_1080p": {
    label: "VP9 WebM 1080p (constant quality)",
    codec: "libvpx-vp9",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "30",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "av1_mp4_1080p": {
    label: "AV1 MP4 1080p (slow, smallest)",
    codec: "libsvtav1",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "30",
    preset: "6",
    tune: "none",
    pixFmt: "yuv420p"
  }
};

// DOM Elements Cache
let el = {};

function cacheElements() {
  el = {
    html: document.documentElement,
    appHeader: document.getElementById("appHeader"),
    btnSettings: document.getElementById("btnSettings"),
    btnWinMin: document.getElementById("btnWinMin"),
    btnWinMax: document.getElementById("btnWinMax"),
    btnWinClose: document.getElementById("btnWinClose"),

    // Settings Modal
    settingsModal: document.getElementById("settingsModal"),
    settingsTabs: document.getElementById("settingsTabs"),
    btnCloseSettings: document.getElementById("btnCloseSettings"),
    btnSaveSettings: document.getElementById("btnSaveSettings"),
    btnResetSettings: document.getElementById("btnResetSettings"),
    settingTheme: document.getElementById("settingTheme"),
    settingAccent: document.getElementById("settingAccent"),
    settingDefAudio: document.getElementById("settingDefAudio"),
    settingDefSub: document.getElementById("settingDefSub"),
    settingClearTrackNames: document.getElementById("settingClearTrackNames"),
    lblSettingTrackNamesHeader: document.getElementById("lblSettingTrackNamesHeader"),
    lblSettingClearTrackNames: document.getElementById("lblSettingClearTrackNames"),
    lblSettingClearTrackNamesDesc: document.getElementById("lblSettingClearTrackNamesDesc"),
    settingNamingEnabled: document.getElementById("settingNamingEnabled"),
    settingNamingTag: document.getElementById("settingNamingTag"),
    settingNamingSeriesPattern: document.getElementById("settingNamingSeriesPattern"),
    settingNamingMoviePattern: document.getElementById("settingNamingMoviePattern"),
    settingMetadataEnabled: document.getElementById("settingMetadataEnabled"),
    settingAnimeTitlePref: document.getElementById("settingAnimeTitlePref"),
    settingEmbedCover: document.getElementById("settingEmbedCover"),
    settingTmdbApiKey: document.getElementById("settingTmdbApiKey"),
    chkEmbedCover: document.getElementById("chkEmbedCover"),
    mediaCoverContainer: document.getElementById("mediaCoverContainer"),
    mediaCoverImg: document.getElementById("mediaCoverImg"),
    selectedVideoOnlineBadge: document.getElementById("selectedVideoOnlineBadge"),
    btnOpenIdentifyModal: document.getElementById("btnOpenIdentifyModal"),
    btnClearTrackNames: document.getElementById("btnClearTrackNames"),
    metadataModal: document.getElementById("metadataModal"),
    btnCloseMetadataModal: document.getElementById("btnCloseMetadataModal"),
    btnCancelMetaModal: document.getElementById("btnCancelMetaModal"),
    metaSearchInput: document.getElementById("metaSearchInput"),
    metaSearchYearInput: document.getElementById("metaSearchYearInput"),
    metaCandidatesContainer: document.getElementById("metaCandidatesContainer"),
    metaCandidatesList: document.getElementById("metaCandidatesList"),
    btnExecuteMetaSearch: document.getElementById("btnExecuteMetaSearch"),
    btnPickCustomCover: document.getElementById("btnPickCustomCover"),
    btnPickCustomCoverPoster: document.getElementById("btnPickCustomCoverPoster"),
    metaResultCard: document.getElementById("metaResultCard"),
    metaResultPoster: document.getElementById("metaResultPoster"),
    metaResultSourceBadge: document.getElementById("metaResultSourceBadge"),
    metaResultYearBadge: document.getElementById("metaResultYearBadge"),
    metaResultTitleInput: document.getElementById("metaResultTitleInput"),
    metaResultYearInput: document.getElementById("metaResultYearInput"),
    metaResultOutputPreview: document.getElementById("metaResultOutputPreview"),
    metaStatusIndicator: document.getElementById("metaStatusIndicator"),
    btnClearMediaInfo: document.getElementById("btnClearMediaInfo"),
    btnApplyMetaThisVideo: document.getElementById("btnApplyMetaThisVideo"),
    btnApplyMetaAllEpisodes: document.getElementById("btnApplyMetaAllEpisodes"),
    previewSeriesWithQt: document.getElementById("previewSeriesWithQt"),
    previewSeriesNoQt: document.getElementById("previewSeriesNoQt"),
    previewMovie: document.getElementById("previewMovie"),

    vCfgResolution: document.getElementById("vCfgResolution"),
    vCfgCodec: document.getElementById("vCfgCodec"),
    vCfgRateControl: document.getElementById("vCfgRateControl"),
    vCfgQualityVal: document.getElementById("vCfgQualityVal"),
    lblQualityVal: document.getElementById("lblQualityVal"),
    hintQualityVal: document.getElementById("hintQualityVal"),
    vCfgPreset: document.getElementById("vCfgPreset"),
    vCfgTune: document.getElementById("vCfgTune"),
    vCfgPixFmt: document.getElementById("vCfgPixFmt"),
    vCfgMultipass: document.getElementById("vCfgMultipass"),
    vCfgProfile: document.getElementById("vCfgProfile"),
    vCfgLevel: document.getElementById("vCfgLevel"),
    vCfgAq: document.getElementById("vCfgAq"),

    aCfgCodec: document.getElementById("aCfgCodec"),
    aCfgChannels: document.getElementById("aCfgChannels"),
    aCfgBitrate: document.getElementById("aCfgBitrate"),
    aCfgSampleRate: document.getElementById("aCfgSampleRate"),

    stepper: document.getElementById("stepper"),
    stageImport: document.getElementById("stageImport"),
    stageReview: document.getElementById("stageReview"),
    stageExport: document.getElementById("stageExport"),
    stageQuickTools: document.getElementById("stageQuickTools"),
    btnNavQuickTools: document.getElementById("btnNavQuickTools"),
    lblNavQuickTools: document.getElementById("lblNavQuickTools"),
    btnQuickAddFiles: document.getElementById("btnQuickAddFiles"),
    btnQuickBatchRename: document.getElementById("btnQuickBatchRename"),
    btnQuickBatchCover: document.getElementById("btnQuickBatchCover"),
    btnQuickClearAll: document.getElementById("btnQuickClearAll"),
    lblQuickClearAll: document.getElementById("lblQuickClearAll"),
    quickEmptyState: document.getElementById("quickEmptyState"),
    quickTableWrapper: document.getElementById("quickTableWrapper"),
    quickTableBody: document.getElementById("quickTableBody"),
    btnQuickEmptyImportExisting: document.getElementById("btnQuickEmptyImportExisting"),

    dropzone: document.getElementById("dropzone"),
    btnAddFiles: document.getElementById("btnAddFiles"),
    btnAddFolder: document.getElementById("btnAddFolder"),
    btnNextToReview: document.getElementById("btnNextToReview"),

    statVideos: document.getElementById("statVideos"),
    statAudios: document.getElementById("statAudios"),
    statSubs: document.getElementById("statSubs"),
    statChapters: document.getElementById("statChapters"),
    statGroups: document.getElementById("statGroups"),

    quickPreset: document.getElementById("quickPreset"),
    btnKeepAudioTrigger: document.getElementById("btnKeepAudioTrigger"),
    keepAudioSummary: document.getElementById("keepAudioSummary"),
    keepAudioPanel: document.getElementById("keepAudioPanel"),
    chkKeepAllAudio: document.getElementById("chkKeepAllAudio"),
    keepAudioOptionsList: document.getElementById("keepAudioOptionsList"),

    btnKeepSubTrigger: document.getElementById("btnKeepSubTrigger"),
    keepSubSummary: document.getElementById("keepSubSummary"),
    keepSubPanel: document.getElementById("keepSubPanel"),
    chkKeepAllSub: document.getElementById("chkKeepAllSub"),
    keepSubOptionsList: document.getElementById("keepSubOptionsList"),

    quickDefAudio: document.getElementById("quickDefAudio"),
    quickDefSub: document.getElementById("quickDefSub"),
    quickBurnSub: document.getElementById("quickBurnSub"),
    groupBurnSub: document.getElementById("groupBurnSub"),
    burnBadge: document.getElementById("burnBadge"),
    quickAppliedCount: document.getElementById("quickAppliedCount"),

    videoSidebar: document.getElementById("videoSidebar"),
    btnClearAllVideos: document.getElementById("btnClearAllVideos"),
    btnBackToImport: document.getElementById("btnBackToImport"),
    btnBackToReview: document.getElementById("btnBackToReview"),

    selectedVideoTitle: document.getElementById("selectedVideoTitle"),
    selectedVideoDesc: document.getElementById("selectedVideoDesc"),
    tracksTableBody: document.getElementById("tracksTableBody"),
    btnAddAttachmentToGroup: document.getElementById("btnAddAttachmentToGroup"),
    btnNextToExport: document.getElementById("btnNextToExport"),
    reviewStatusLine: document.getElementById("reviewStatusLine"),

    exportFolderMode: document.getElementById("exportFolderMode"),
    customFolderRow: document.getElementById("customFolderRow"),
    exportOutputFolder: document.getElementById("exportOutputFolder"),
    btnBrowseOutputFolder: document.getElementById("btnBrowseOutputFolder"),
    exportPattern: document.getElementById("exportPattern"),
    exportIfExists: document.getElementById("exportIfExists"),
    chkDeleteOriginals: document.getElementById("chkDeleteOriginals"),
    chkShutdown: document.getElementById("chkShutdown"),
    btnAddSharedAttachment: document.getElementById("btnAddSharedAttachment"),
    chkRemoveOldAttachments: document.getElementById("chkRemoveOldAttachments"),
    sharedAttachmentsList: document.getElementById("sharedAttachmentsList"),

    queueTitle: document.getElementById("queueTitle"),
    queueProgressSummary: document.getElementById("queueProgressSummary"),
    queueTableBody: document.getElementById("queueTableBody"),
    btnStartQueue: document.getElementById("btnStartQueue"),
    btnQueuePause: document.getElementById("btnQueuePause"),
    btnQueueSkip: document.getElementById("btnQueueSkip"),
    btnQueueCancel: document.getElementById("btnQueueCancel"),
    btnOpenOutputFolder: document.getElementById("btnOpenOutputFolder"),

    settingAppLanguage: document.getElementById("settingAppLanguage"),
    lblSettingLanguageHeader: document.getElementById("lblSettingLanguageHeader"),
    lblSettingAppLanguage: document.getElementById("lblSettingAppLanguage"),
    lblLiveOutputPreview: document.getElementById("lblLiveOutputPreview"),
    lblAvailableVariables: document.getElementById("lblAvailableVariables"),
    lblCoverArtGallery: document.getElementById("lblCoverArtGallery"),
    lblCtxCut: document.getElementById("lblCtxCut"),
    lblCtxCopy: document.getElementById("lblCtxCopy"),
    lblCtxPaste: document.getElementById("lblCtxPaste"),
    lblCtxDelete: document.getElementById("lblCtxDelete"),
    lblCtxSelectAll: document.getElementById("lblCtxSelectAll"),
    customConfirmModal: document.getElementById("customConfirmModal"),
    confirmModalTitle: document.getElementById("confirmModalTitle"),
    confirmModalMessage: document.getElementById("confirmModalMessage"),
    btnConfirmOk: document.getElementById("btnConfirmOk"),
    btnConfirmCancel: document.getElementById("btnConfirmCancel"),
    confirmIcon: document.getElementById("confirmIcon")
  };
}

// -------------------------------------------------------------
// 5 Languages Internationalization (i18n) Engine
// -------------------------------------------------------------
const I18N_TRANSLATIONS = {
  ar: {
    brand_title: "MKVForge",
    step_import: "استيراد",
    step_review: "مراجعة",
    step_export: "تصدير",
    btn_settings: "الإعدادات",
    drop_title: "اسحب وأفلت الملفات أو المجلدات هنا",
    drop_subtitle: "يدعم جميع صيغ الفيديو الرئيسية (.mkv, .mp4, .avi, .ts, .mov, .webm...)",
    btn_browse_files: "تصفح ملفات",
    btn_browse_folder: "تصفح مجلد",
    stat_videos: "فيديوهات",
    stat_audios: "ملفات صوتية",
    stat_subtitles: "ترجمات",
    stat_chapters: "فصول",
    btn_next_review: "التالي: مراجعة المسارات والإعدادات ←",
    sidebar_videos: "قائمة الفيديوهات",
    btn_clear_all: "حذف الكل",
    btn_preview_info: "معاينة الغلاف والبيانات",
    btn_clear_track_names: "مسح أسماء المسارات",
    confirm_clear_tracks_msg: "هل تريد مسح أسماء مسارات الفيديو والصوت لجميع الملفات أم للملف الحالي فقط؟",
    btn_clear_all_files: "جميع الملفات",
    btn_clear_current_only: "الملف الحالي فقط",
    btn_clear_track_name: "مسح اسم هذا المسار",
    btn_pick_custom_cover: "إضافة صورة مخصصة",
    btn_change_cover: "تغيير الصورة",
    btn_search_meta: "بحث",
    quick_settings_title: "إعدادات سريعة (لكل الفيديوهات)",
    lbl_video_preset: "إعداد الفيديو المسبق",
    lbl_default_audio: "الصوت الافتراضي",
    lbl_default_sub: "الترجمة الافتراضية",
    lbl_keep_subtitles: "الإبقاء على الترجمات",
    lbl_burn_sub: "حرق الترجمة داخل الصورة (Hardsub)",
    th_type: "النوع",
    th_name: "الاسم / المسار",
    th_codec: "الترميز",
    th_channels_lang: "القنوات / اللغة",
    th_default: "افتراضي",
    th_forced: "إجباري",
    th_delay: "تأخير (مللي ثانية)",
    th_action: "الإجراء",
    btn_add_attachment: "+ مرفق لهذا الفيديو",
    btn_next_export: "التالي: التصدير وقائمة الانتظار ←",
    lbl_output_location: "موقع حفظ الملفات المصدرة",
    opt_out_same: "نفس مجلد الملف الأصلي (تلقائياً Converted عند تطابق الاسم)",
    opt_out_converted: "مجلد فرعي باسم 'Converted' (داخل مجلد المصدر)",
    opt_out_custom: "مجلد مخصص آخر...",
    lbl_filename_pattern: "نمط التسمية",
    lbl_if_exists: "في حال وجود الملف مسبقاً",
    opt_ask: "اسألني",
    opt_overwrite: "استبدال",
    opt_skip: "تخطي",
    lbl_delete_originals: "حذف الملفات الأصلية بعد اكتمال التحويل بنجاح",
    lbl_shutdown: "إيقاف تشغيل الكمبيوتر بعد انتهاء جميع العمليات",
    lbl_shared_attachments: "مرفقات مشتركة (تُطبق على جميع الفيديوهات)",
    btn_add_shared_attachment: "+ إضافة مرفق مشترك",
    lbl_remove_old_attachments: "إزالة المرفقات القديمة من الحاوية الأصلية",
    queue_title: "قائمة مهام التحويل (Queue)",
    th_video_name: "اسم الفيديو",
    th_plan: "خطة المعالجة",
    th_progress: "التقدم",
    th_status: "الحالة",
    btn_start_queue: "بدء التحويل",
    btn_queue_pause: "إيقاف مؤقت",
    btn_queue_resume: "استئناف",
    btn_queue_skip: "تخطي الحالي",
    btn_queue_cancel: "إلغاء القائمة",
    btn_open_folder: "فتح مجلد الحفظ",
    settings_modal_title: "الإعدادات",
    tab_general: "عام والمظهر",
    tab_video: "الفيديو المتقدم",
    tab_audio: "الصوت المتقدم",
    tab_naming: "التسميات والوسوم",
    tab_about: "حول البرنامج",
    lbl_about_app_desc: "البرنامج المتكامل لإدارة ومعالجة حاويات Matroska (MKV): استخراج وتضمين البوسترات، التحكم بالمسارات، التحويل فائق السرعة، حرق الترجمات، والأدوات الفورية الذكية بدون إنشاء ملفات مكررة.",
    lbl_about_dev_title: "برمجة وتطوير:",
    lbl_about_rights: "جميع الحقوق محفوظة للمطور © 2026 yasinoss",
    lbl_about_contact_header: "قنوات التواصل والدعم الفني",
    btn_reset_settings: "استعادة الافتراضي",
    btn_save_settings: "حفظ الإعدادات",
    confirm_delete_title: "حذف الفيديو",
    confirm_delete_msg: "هل أنت متأكد من رغبتك في حذف هذا الفيديو من القائمة؟",
    confirm_clear_all_title: "إفراغ القائمة",
    confirm_clear_all_msg: "هل أنت متأكد من رغبتك في حذف جميع الفيديوهات المستوردة؟",
    confirm_cancel_queue_title: "إلغاء التحويل",
    confirm_cancel_queue_msg: "هل أنت متأكد من رغبتك في إيقاف وإلغاء معالجة قائمة التحويل الحالية؟",
    btn_confirm: "تأكيد",
    btn_cancel: "إلغاء",
    btn_delete: "حذف",
    btn_ok: "حسناً",
    lbl_language_header: "اللغة",
    lbl_app_language: "لغة واجهة البرنامج",
    lbl_live_preview: "معاينة حية ومباشرة",
    lbl_available_vars: "المتغيرات المتاحة:",
    lbl_cover_gallery: "معرض الملصقات والأغلفة",
    lbl_setting_track_names_header: "تسميات وعناوين المسارات",
    lbl_setting_clear_track_names: "حذف تسميات المسارات تلقائياً (فيديو وصوت)",
    lbl_setting_clear_track_names_desc: "تجريد أسماء وعناوين المسارات المضمنة تلقائياً من ملف الفيديو النهائي (مفعل افتراضياً).",
    ctx_cut: "قص",
    ctx_copy: "نسخ",
    ctx_paste: "لصق",
    ctx_delete: "حذف",
    ctx_select_all: "تحديد الكل",
    lbl_nav_quick_tools: "أدوات فورية (مكان الملف)",
    lbl_quick_tools_title: "أدوات التعديل الفوري في مكان الملف",
    lbl_quick_tools_desc: "إعادة تسمية الملفات وحقن البوستر في حاوية MKV في أقل من ثانية واحدة دون إنشاء ملف جديد.",
    lbl_quick_add_files: "إضافة ملفات",
    lbl_quick_batch_rename: "تسمية الكل",
    lbl_quick_batch_cover: "تحديث الكوفر فقط (MKV)",
    lbl_quick_clear_all: "حذف الكل",
    lbl_quick_empty_title: "لم تتم إضافة ملفات إلى الأدوات الفورية",
    lbl_quick_empty_desc: "اسحب ملفات الفيديو إلى هنا أو استورد الفيديوهات المحملة في البرنامج لتعديل أسمائها أو حقن الكوفر فورياً.",
    lbl_quick_import_existing: "تحميل الفيديوهات من المسار العام",
    th_quick_cover: "الكوفر",
    th_quick_original: "الملف الحالي",
    th_quick_proposed: "الاسم الذكي المقترح",
    th_quick_specs: "المواصفات",
    lbl_mkv_only: "خاص بـ MKV",
    lbl_remove_item: "حذف من القائمة",
    lbl_cover_click_tooltip: "معاينة وبحث عن بوستر أونلاين أو اختيار صورة من جهازك",
    btn_quick_applied: "تم بنجاح"
  },
  en: {
    brand_title: "MKVForge",
    step_import: "Import",
    step_review: "Review",
    step_export: "Export",
    btn_settings: "Settings",
    drop_title: "Drag & drop files or folders here",
    drop_subtitle: "Supports all major video formats (.mkv, .mp4, .avi, .ts, .mov, .webm...)",
    btn_browse_files: "Browse Files",
    btn_browse_folder: "Browse Folder",
    stat_videos: "Videos",
    stat_audios: "Audios",
    stat_subtitles: "Subtitles",
    stat_chapters: "Chapters",
    btn_next_review: "Next: Review Tracks & Settings →",
    sidebar_videos: "Videos",
    btn_clear_all: "Clear All",
    btn_preview_info: "Preview Info & Cover",
    btn_clear_track_names: "Clear Track Names",
    confirm_clear_tracks_msg: "Do you want to clear video and audio track names for all files or only the current one?",
    btn_clear_all_files: "All Files",
    btn_clear_current_only: "Current File Only",
    btn_clear_track_name: "Clear track name",
    btn_pick_custom_cover: "Choose Custom Image",
    btn_change_cover: "Change Image",
    btn_search_meta: "Search",
    quick_settings_title: "Quick Settings (All Videos)",
    lbl_video_preset: "Video Preset",
    lbl_default_audio: "Default audio",
    lbl_default_sub: "Default subtitle",
    lbl_keep_subtitles: "Keep Subtitles",
    lbl_burn_sub: "Burn Subtitle (Hardsub)",
    th_type: "Type",
    th_name: "Name / Track",
    th_codec: "Codec",
    th_channels_lang: "Channels / Lang",
    th_default: "Default",
    th_forced: "Forced",
    th_delay: "Delay (ms)",
    th_action: "Action",
    btn_add_attachment: "+ Attachment to Video",
    btn_next_export: "Next: Export & Queue →",
    lbl_output_location: "Output Location",
    opt_out_same: "Same folder as source (Auto-creates 'Converted' if name matches)",
    opt_out_converted: "Subfolder 'Converted' (inside source folder)",
    opt_out_custom: "Custom folder...",
    lbl_filename_pattern: "File name",
    lbl_if_exists: "If exists",
    opt_ask: "Ask me",
    opt_overwrite: "Overwrite",
    opt_skip: "Skip",
    lbl_delete_originals: "Delete original files after successful conversion",
    lbl_shutdown: "Shutdown computer after queue completes",
    lbl_shared_attachments: "Shared Attachments (Applied to all videos)",
    btn_add_shared_attachment: "+ Add Shared Attachment",
    lbl_remove_old_attachments: "Remove old attachments from source container",
    queue_title: "Conversion Queue",
    th_video_name: "Video Name",
    th_plan: "Plan",
    th_progress: "Progress",
    th_status: "Status",
    btn_start_queue: "Start Queue",
    btn_queue_pause: "Pause",
    btn_queue_resume: "Resume",
    btn_queue_skip: "Skip Current",
    btn_queue_cancel: "Cancel Queue",
    btn_open_folder: "Open Output Folder",
    settings_modal_title: "Settings",
    tab_general: "General",
    tab_video: "Advanced Video",
    tab_audio: "Advanced Audio",
    tab_naming: "Naming & Tags",
    tab_about: "About",
    lbl_about_app_desc: "The complete desktop suite for Matroska (MKV) container management: cover art injection, track control, ultra-fast transcoding, hardsub burning, and instant in-place tools without file duplication.",
    lbl_about_dev_title: "Developed & Crafted by:",
    lbl_about_rights: "All Rights Reserved © 2026 yasinoss",
    lbl_about_contact_header: "Developer & Support Channels",
    btn_reset_settings: "Reset",
    btn_save_settings: "Save Settings",
    confirm_delete_title: "Remove Video",
    confirm_delete_msg: "Are you sure you want to remove this video from the list?",
    confirm_clear_all_title: "Clear All Videos",
    confirm_clear_all_msg: "Are you sure you want to remove all imported videos?",
    confirm_cancel_queue_title: "Cancel Queue",
    confirm_cancel_queue_msg: "Are you sure you want to cancel the conversion queue?",
    btn_confirm: "Confirm",
    btn_cancel: "Cancel",
    btn_delete: "Delete",
    btn_ok: "OK",
    lbl_language_header: "Language",
    lbl_app_language: "Application Interface Language",
    lbl_live_preview: "Live Output Preview",
    lbl_available_vars: "Available Variables:",
    lbl_cover_gallery: "Cover Art Gallery",
    lbl_setting_track_names_header: "Track Names & Titles",
    lbl_setting_clear_track_names: "Clear Track Names (Strip titles for video & audio)",
    lbl_setting_clear_track_names_desc: "Automatically remove embedded title tags from video and audio tracks in the final output file (active by default).",
    ctx_cut: "Cut",
    ctx_copy: "Copy",
    ctx_paste: "Paste",
    ctx_delete: "Delete",
    ctx_select_all: "Select All",
    lbl_nav_quick_tools: "Instant Tools",
    lbl_quick_tools_title: "Instant In-Place File Tools",
    lbl_quick_tools_desc: "Rename files and inject MKV container covers in less than 1 second without creating duplicate files.",
    lbl_quick_add_files: "Add Files",
    lbl_quick_batch_rename: "Rename All",
    lbl_quick_batch_cover: "Update Covers Only (MKV)",
    lbl_quick_clear_all: "Clear All",
    lbl_quick_empty_title: "No files added to Instant Tools",
    lbl_quick_empty_desc: "Drop MKV, MP4 video files here or import existing scanned media to rename them or embed covers directly in-place.",
    lbl_quick_import_existing: "Load Loaded Videos from Workflow",
    th_quick_cover: "Cover",
    th_quick_original: "Current File",
    th_quick_proposed: "Smart Proposed Name",
    th_quick_specs: "Specs",
    lbl_mkv_only: "MKV only",
    lbl_remove_item: "Remove from list",
    lbl_cover_click_tooltip: "Preview, search online or choose a custom cover",
    btn_quick_applied: "Done"
  },
  fr: {
    brand_title: "MKVForge",
    step_import: "Importer",
    step_review: "Vérifier",
    step_export: "Exporter",
    btn_settings: "Paramètres",
    drop_title: "Glissez-déposez des fichiers ou dossiers ici",
    drop_subtitle: "Prend en charge tous les principaux formats vidéo (.mkv, .mp4, .avi, .ts...)",
    btn_browse_files: "Parcourir fichiers",
    btn_browse_folder: "Parcourir dossier",
    stat_videos: "Vidéos",
    stat_audios: "Audios",
    stat_subtitles: "Sous-titres",
    stat_chapters: "Chapitres",
    btn_next_review: "Suivant : Vérifier pistes & réglages →",
    sidebar_videos: "Vidéos",
    btn_clear_all: "Tout effacer",
    btn_preview_info: "Aperçu Infos & Jaquette",
    btn_clear_track_names: "Effacer les noms des pistes",
    confirm_clear_tracks_msg: "Voulez-vous effacer les noms des pistes pour tous les fichiers ou seulement le fichier actuel ?",
    btn_clear_all_files: "Tous les fichiers",
    btn_clear_current_only: "Fichier actuel uniquement",
    btn_clear_track_name: "Effacer le nom de la piste",
    btn_pick_custom_cover: "Choisir image perso",
    btn_change_cover: "Changer l'image",
    btn_search_meta: "Rechercher",
    quick_settings_title: "Paramètres rapides (toutes les vidéos)",
    lbl_video_preset: "Préréglage vidéo",
    lbl_default_audio: "Audio par défaut",
    lbl_default_sub: "Sous-titre par défaut",
    lbl_keep_subtitles: "Garder les sous-titres",
    lbl_burn_sub: "Incruster sous-titre (Hardsub)",
    th_type: "Type",
    th_name: "Nom / Piste",
    th_codec: "Codec",
    th_channels_lang: "Canaux / Langue",
    th_default: "Par défaut",
    th_forced: "Forcé",
    th_delay: "Délai (ms)",
    th_action: "Action",
    btn_add_attachment: "+ Pièce jointe à la vidéo",
    btn_next_export: "Suivant : Exporter & File d'attente →",
    lbl_output_location: "Emplacement de sortie",
    opt_out_same: "Même dossier que la source (crée 'Converted' si le nom correspond)",
    opt_out_converted: "Sous-dossier 'Converted' (dans le dossier source)",
    opt_out_custom: "Dossier personnalisé...",
    lbl_filename_pattern: "Nom de fichier",
    lbl_if_exists: "Si existe",
    opt_ask: "Me demander",
    opt_overwrite: "Écraser",
    opt_skip: "Ignorer",
    lbl_delete_originals: "Supprimer les originaux après conversion",
    lbl_shutdown: "Éteindre l'ordinateur à la fin de la file",
    lbl_shared_attachments: "Pièces jointes partagées (toutes vidéos)",
    btn_add_shared_attachment: "+ Ajouter pièce jointe partagée",
    lbl_remove_old_attachments: "Supprimer les anciennes pièces jointes",
    queue_title: "File d'attente de conversion",
    th_video_name: "Nom de la vidéo",
    th_plan: "Plan",
    th_progress: "Progression",
    th_status: "État",
    btn_start_queue: "Démarrer la file",
    btn_queue_pause: "Pause",
    btn_queue_resume: "Reprendre",
    btn_queue_skip: "Ignorer",
    btn_queue_cancel: "Annuler",
    btn_open_folder: "Ouvrir dossier de sortie",
    settings_modal_title: "Paramètres",
    tab_general: "Général",
    tab_video: "Vidéo avancée",
    tab_audio: "Audio avancé",
    tab_naming: "Noms & Balises",
    tab_about: "À propos",
    lbl_about_app_desc: "Suite complète pour la gestion des conteneurs Matroska (MKV) : injection de jaquettes, gestion des pistes, transcodage ultra-rapide et outils instantanés.",
    lbl_about_dev_title: "Développé et conçu par :",
    lbl_about_rights: "Tous droits réservés © 2026 yasinoss",
    lbl_about_contact_header: "Canaux de contact et support",
    btn_reset_settings: "Réinitialiser",
    btn_save_settings: "Enregistrer",
    confirm_delete_title: "Supprimer la vidéo",
    confirm_delete_msg: "Êtes-vous sûr de vouloir supprimer cette vidéo de la liste ?",
    confirm_clear_all_title: "Tout effacer",
    confirm_clear_all_msg: "Êtes-vous sûr de vouloir supprimer toutes les vidéos importées ?",
    confirm_cancel_queue_title: "Annuler la file",
    confirm_cancel_queue_msg: "Êtes-vous sûr de vouloir annuler la file d'attente de conversion ?",
    btn_confirm: "Confirmer",
    btn_cancel: "Annuler",
    btn_delete: "Supprimer",
    btn_ok: "D'accord",
    lbl_language_header: "Langue",
    lbl_app_language: "Langue de l'interface",
    lbl_live_preview: "Aperçu en direct du nom de sortie",
    lbl_available_vars: "Variables disponibles :",
    lbl_cover_gallery: "Galerie d'affiches et de jaquettes",
    lbl_setting_track_names_header: "Noms et titres des pistes",
    lbl_setting_clear_track_names: "Effacer automatiquement les noms des pistes (vidéo & audio)",
    lbl_setting_clear_track_names_desc: "Supprimer automatiquement les titres intégrés des pistes vidéo et audio dans le fichier final (activé par défaut).",
    ctx_cut: "Couper",
    ctx_copy: "Copier",
    ctx_paste: "Coller",
    ctx_delete: "Supprimer",
    ctx_select_all: "Tout sélectionner"
  },
  es: {
    brand_title: "MKVForge",
    step_import: "Importar",
    step_review: "Revisar",
    step_export: "Exportar",
    btn_settings: "Configuración",
    drop_title: "Arrastra y suelta archivos o carpetas aquí",
    drop_subtitle: "Compatible con todos los formatos (.mkv, .mp4, .avi, .ts, .mov...)",
    btn_browse_files: "Explorar archivos",
    btn_browse_folder: "Explorar carpeta",
    stat_videos: "Vídeos",
    stat_audios: "Audios",
    stat_subtitles: "Subtítulos",
    stat_chapters: "Capítulos",
    btn_next_review: "Siguiente: Revisar pistas y ajustes →",
    sidebar_videos: "Vídeos",
    btn_clear_all: "Borrar todo",
    btn_preview_info: "Vista previa y portada",
    btn_clear_track_names: "Borrar nombres de pistas",
    confirm_clear_tracks_msg: "¿Desea borrar los nombres de pista para todos los archivos o solo el actual?",
    btn_clear_all_files: "Todos los archivos",
    btn_clear_current_only: "Solo archivo actual",
    btn_clear_track_name: "Borrar nombre de pista",
    btn_pick_custom_cover: "Elegir imagen propia",
    btn_change_cover: "Cambiar imagen",
    btn_search_meta: "Buscar",
    quick_settings_title: "Ajustes rápidos (todos los vídeos)",
    lbl_video_preset: "Perfil de vídeo",
    lbl_default_audio: "Audio predeterminado",
    lbl_default_sub: "Subtítulo predeterminado",
    lbl_keep_subtitles: "Conservar subtítulos",
    lbl_burn_sub: "Grabar subtítulo (Hardsub)",
    th_type: "Tipo",
    th_name: "Nombre / Pista",
    th_codec: "Códec",
    th_channels_lang: "Canales / Idioma",
    th_default: "Predeterminado",
    th_forced: "Forzado",
    th_delay: "Retardo (ms)",
    th_action: "Acción",
    btn_add_attachment: "+ Adjunto al vídeo",
    btn_next_export: "Siguiente: Exportar y cola →",
    lbl_output_location: "Ubicación de salida",
    opt_out_same: "Misma carpeta de origen (crea 'Converted' si el nombre coincide)",
    opt_out_converted: "Subcarpeta 'Converted' (dentro de la carpeta de origen)",
    opt_out_custom: "Carpeta personalizada...",
    lbl_filename_pattern: "Nombre de archivo",
    lbl_if_exists: "Si existe",
    opt_ask: "Preguntarme",
    opt_overwrite: "Sobrescribir",
    opt_skip: "Omitir",
    lbl_delete_originals: "Eliminar archivos originales tras conversión",
    lbl_shutdown: "Apagar el equipo al completar la cola",
    lbl_shared_attachments: "Adjuntos compartidos (aplicados a todos los vídeos)",
    btn_add_shared_attachment: "+ Añadir adjunto compartido",
    lbl_remove_old_attachments: "Eliminar adjuntos anteriores del contenedor de origen",
    queue_title: "Cola de conversión",
    th_video_name: "Nombre del vídeo",
    th_plan: "Plan",
    th_progress: "Progreso",
    th_status: "Estado",
    btn_start_queue: "Iniciar cola",
    btn_queue_pause: "Pausar",
    btn_queue_resume: "Reanudar",
    btn_queue_skip: "Omitir actual",
    btn_queue_cancel: "Cancelar cola",
    btn_open_folder: "Abrir carpeta de salida",
    settings_modal_title: "Configuración",
    tab_general: "General",
    tab_video: "Vídeo avanzado",
    tab_audio: "Audio avanzado",
    tab_naming: "Nombres y etiquetas",
    tab_about: "Acerca de",
    lbl_about_app_desc: "Herramienta completa para la gestión de contenedores Matroska (MKV): inyección de portadas, control de pistas, transcodificación y herramientas instantáneas.",
    lbl_about_dev_title: "Desarrollado y programado por:",
    lbl_about_rights: "Todos los derechos reservados © 2026 yasinoss",
    lbl_about_contact_header: "Canales de contacto y soporte",
    btn_reset_settings: "Restablecer",
    btn_save_settings: "Guardar ajustes",
    confirm_delete_title: "Eliminar vídeo",
    confirm_delete_msg: "¿Seguro que deseas eliminar este vídeo de la lista?",
    confirm_clear_all_title: "Borrar todos los vídeos",
    confirm_clear_all_msg: "¿Seguro que deseas eliminar todos los vídeos importados?",
    confirm_cancel_queue_title: "Cancelar cola",
    confirm_cancel_queue_msg: "¿Seguro que deseas cancelar la cola de conversión?",
    btn_confirm: "Confirmar",
    btn_cancel: "Cancelar",
    btn_delete: "Eliminar",
    btn_ok: "Aceptar",
    lbl_language_header: "Idioma",
    lbl_app_language: "Idioma de la interfaz",
    lbl_live_preview: "Vista previa en vivo del nombre de salida",
    lbl_available_vars: "Variables disponibles:",
    lbl_cover_gallery: "Galería de carátulas y pósteres",
    lbl_setting_track_names_header: "Nombres y títulos de pistas",
    lbl_setting_clear_track_names: "Borrar nombres de pistas automáticamente (vídeo y audio)",
    lbl_setting_clear_track_names_desc: "Eliminar automáticamente las etiquetas de título de las pistas de vídeo y audio en el archivo final (activo por defecto).",
    ctx_cut: "Cortar",
    ctx_copy: "Copiar",
    ctx_paste: "Pegar",
    ctx_delete: "Eliminar",
    ctx_select_all: "Seleccionar todo"
  },
  tr: {
    brand_title: "MKVForge",
    step_import: "İçe Aktar",
    step_review: "İncele",
    step_export: "Dışa Aktar",
    btn_settings: "Ayarlar",
    drop_title: "Dosyaları veya klasörleri buraya sürükleyip bırakın",
    drop_subtitle: "Tüm popüler video formatlarını destekler (.mkv, .mp4, .avi, .ts, .mov...)",
    btn_browse_files: "Dosyaları Seç",
    btn_browse_folder: "Klasörü Seç",
    stat_videos: "Videolar",
    stat_audios: "Sesler",
    stat_subtitles: "Altyazılar",
    stat_chapters: "Bölümler",
    btn_next_review: "İleri: Parçaları ve Ayarları İncele →",
    sidebar_videos: "Videolar",
    btn_clear_all: "Tümünü Temizle",
    btn_preview_info: "Bilgi ve Kapak Önizleme",
    btn_clear_track_names: "Parça Adlarını Temizle",
    confirm_clear_tracks_msg: "Parça adlarını tüm dosyalar için mi yoksa yalnızca geçerli dosya için mi temizlemek istiyorsunuz?",
    btn_clear_all_files: "Tüm Dosyalar",
    btn_clear_current_only: "Yalnızca Geçerli Dosya",
    btn_clear_track_name: "Parça adını temizle",
    btn_pick_custom_cover: "Özel Resim Seç",
    btn_change_cover: "Resmi Değiştir",
    btn_search_meta: "Ara",
    quick_settings_title: "Hızlı Ayarlar (Tüm Videolar)",
    lbl_video_preset: "Video Önayarı",
    lbl_default_audio: "Varsayılan Ses",
    lbl_default_sub: "Varsayılan Altyazı",
    lbl_keep_subtitles: "Altyazıları Koru",
    lbl_burn_sub: "Altyazıyı Göm (Hardsub)",
    th_type: "Tür",
    th_name: "Ad / Parça",
    th_codec: "Kolek",
    th_channels_lang: "Kanallar / Dil",
    th_default: "Varsayılan",
    th_forced: "Zorunlu",
    th_delay: "Gecikme (ms)",
    th_action: "İşlem",
    btn_add_attachment: "+ Videoya Ek Dosya",
    btn_next_export: "İleri: Dışa Aktar ve Kuyruk →",
    lbl_output_location: "Çıktı Konumu",
    opt_out_same: "Kaynakla aynı klasör (isim eşleşirse otomatik 'Converted' oluşturur)",
    opt_out_converted: "Kaynak klasör içinde 'Converted' alt klasörü",
    opt_out_custom: "Özel klasör...",
    lbl_filename_pattern: "Dosya adı",
    lbl_if_exists: "Mevcutsa",
    opt_ask: "Bana sor",
    opt_overwrite: "Üzerine yaz",
    opt_skip: "Atla",
    lbl_delete_originals: "Başarılı dönüştürmeden sonra orijinal dosyaları sil",
    lbl_shutdown: "Kuyruk tamamlandığında bilgisayarı kapat",
    lbl_shared_attachments: "Paylaşılan Ekler (Tüm videolara uygulanır)",
    btn_add_shared_attachment: "+ Paylaşılan Ek Dosya Ekle",
    lbl_remove_old_attachments: "Kaynak kapsayıcıdaki eski ekleri kaldır",
    queue_title: "Dönüştürme Kuyruğu",
    th_video_name: "Video Adı",
    th_plan: "İşlem Planı",
    th_progress: "İlerleme",
    th_status: "Durum",
    btn_start_queue: "Kuyruğu Başlat",
    btn_queue_pause: "Duraklat",
    btn_queue_resume: "Devam Et",
    btn_queue_skip: "Geçerliyi Atla",
    btn_queue_cancel: "Kuyruğu İptal Et",
    btn_open_folder: "Çıktı Klasörünü Aç",
    settings_modal_title: "Ayarlar",
    tab_general: "Genel",
    tab_video: "Gelişmiş Video",
    tab_audio: "Gelişmiş Ses",
    tab_naming: "Adlandırma ve Etiketler",
    tab_about: "Hakkında",
    lbl_about_app_desc: "Matroska (MKV) konteyner yönetimi için eksiksiz masaüstü paketi: kapak ekleme, parça kontrolü, hızlı kodlama ve anında yerinde araçlar.",
    lbl_about_dev_title: "Geliştiren ve Programlayan:",
    lbl_about_rights: "Tüm Hakları Saklıdır © 2026 yasinoss",
    lbl_about_contact_header: "İletişim ve Destek Kanalları",
    btn_reset_settings: "Sıfırla",
    btn_save_settings: "Ayarları Kaydet",
    confirm_delete_title: "Videoyu Kaldır",
    confirm_delete_msg: "Bu videoyu listeden kaldırmak istediğinizden emin misiniz?",
    confirm_clear_all_title: "Tüm Videoları Temizle",
    confirm_clear_all_msg: "İçe aktarılan tüm videoları kaldırmak istediğinizden emin misiniz?",
    confirm_cancel_queue_title: "Kuyruğu İptal Et",
    confirm_cancel_queue_msg: "Dönüştürme kuyruğunu iptal etmek istediğinizden emin misiniz?",
    btn_confirm: "Onayla",
    btn_cancel: "İptal",
    btn_delete: "Sil",
    btn_ok: "Tamam",
    lbl_language_header: "Dil",
    lbl_app_language: "Uygulama Arayüz Dili",
    lbl_live_preview: "Canlı Çıktı Önizlemesi",
    lbl_available_vars: "Kullanılabilir Değişkenler:",
    lbl_cover_gallery: "Afiş ve Kapak Galerisi",
    lbl_setting_track_names_header: "Parça Adları ve Başlıkları",
    lbl_setting_clear_track_names: "Parça Adlarını Otomatik Temizle (video ve ses)",
    lbl_setting_clear_track_names_desc: "Nihai çıktı dosyasındaki video ve ses parçalarından gömülü başlık etiketlerini otomatik olarak kaldırır (varsayılan olarak etkindir).",
    ctx_cut: "Kes",
    ctx_copy: "Kopyala",
    ctx_paste: "Yapıştır",
    ctx_delete: "Sil",
    ctx_select_all: "Tümünü Seç"
  }
};

function t(key) {
  const lang = state.globalSettings.language || "en";
  const dict = I18N_TRANSLATIONS[lang] || I18N_TRANSLATIONS["en"];
  return dict[key] || (I18N_TRANSLATIONS["en"][key] || key);
}

function detectInitialLanguage() {
  const saved = localStorage.getItem("mc_app_language");
  if (saved && ["ar", "en", "fr", "es", "tr"].includes(saved)) {
    return saved;
  }
  const sys = (navigator.language || navigator.userLanguage || "en").toLowerCase();
  if (sys.startsWith("ar")) return "ar";
  if (sys.startsWith("fr")) return "fr";
  if (sys.startsWith("es")) return "es";
  if (sys.startsWith("tr")) return "tr";
  return "en";
}

function applyLanguage(lang) {
  if (!["ar", "en", "fr", "es", "tr"].includes(lang)) lang = "en";
  state.globalSettings.language = lang;
  localStorage.setItem("mc_app_language", lang);

  document.documentElement.setAttribute("lang", lang);
  if (lang === "ar") {
    document.documentElement.setAttribute("dir", "rtl");
  } else {
    document.documentElement.setAttribute("dir", "ltr");
  }

  if (el.settingAppLanguage) el.settingAppLanguage.value = lang;

  // Translate Stepper
  const stepItems = document.querySelectorAll("#stepper .step-item span");
  if (stepItems.length >= 3) {
    stepItems[0].textContent = t("step_import");
    stepItems[1].textContent = t("step_review");
    stepItems[2].textContent = t("step_export");
  }

  // Top Bar
  const brandTitleEl = document.getElementById("brandTitle") || document.querySelector(".brand span");
  if (brandTitleEl) brandTitleEl.textContent = t("brand_title");
  if (document.getElementById("lblBtnSettings")) {
    document.getElementById("lblBtnSettings").textContent = t("btn_settings");
  } else if (el.btnSettings) {
    el.btnSettings.textContent = t("btn_settings");
  }

  // Stage 1: Import
  const dzTitle = document.querySelector("#dropzone .dropzone-title");
  if (dzTitle) dzTitle.textContent = t("drop_title");
  const dzSub = document.querySelector("#dropzone .dropzone-subtitle");
  if (dzSub) dzSub.textContent = t("drop_subtitle");
  if (el.btnBrowseFiles) el.btnBrowseFiles.textContent = t("btn_browse_files");
  if (el.btnBrowseFolder) el.btnBrowseFolder.textContent = t("btn_browse_folder");
  if (el.btnNextToReview) el.btnNextToReview.textContent = t("btn_next_review");

  // Stat labels
  const statLabels = document.querySelectorAll(".stat-label");
  if (statLabels.length >= 4) {
    statLabels[0].textContent = t("stat_videos");
    statLabels[1].textContent = t("stat_audios");
    statLabels[2].textContent = t("stat_subtitles");
    statLabels[3].textContent = t("stat_chapters");
  }

  // Stage 2: Review
  const sbTitle = document.querySelector(".sidebar-header h3");
  if (sbTitle) sbTitle.textContent = t("sidebar_videos");
  if (document.getElementById("lblBtnClearAll")) {
    document.getElementById("lblBtnClearAll").textContent = t("btn_clear_all");
  } else if (el.btnClearAllVideos) {
    el.btnClearAllVideos.textContent = t("btn_clear_all");
  }
  const btnIdText = document.getElementById("lblBtnPreviewInfo") || document.querySelector("#btnOpenIdentifyModal span:last-child");
  if (btnIdText) btnIdText.textContent = t("btn_preview_info");
  const btnClearTrackText = document.getElementById("lblBtnClearTrackNames");
  if (btnClearTrackText) btnClearTrackText.textContent = t("btn_clear_track_names");
  const qsTitle = document.querySelector(".quick-settings-header span");
  if (qsTitle) qsTitle.textContent = t("quick_settings_title");
  if (el.btnAddAttachmentToGroup) el.btnAddAttachmentToGroup.textContent = t("btn_add_attachment");
  if (el.btnNextToExport) el.btnNextToExport.textContent = t("btn_next_export");

  // Stage 3: Export
  if (el.exportFolderMode && el.exportFolderMode.options.length >= 3) {
    el.exportFolderMode.options[0].text = t("opt_out_same");
    el.exportFolderMode.options[1].text = t("opt_out_converted");
    el.exportFolderMode.options[2].text = t("opt_out_custom");
  }
  if (el.btnBrowseOutputFolder) el.btnBrowseOutputFolder.textContent = t("btn_browse_folder");
  if (document.getElementById("lblStartQueue")) {
    document.getElementById("lblStartQueue").textContent = t("btn_start_queue");
  } else if (el.btnStartQueue) {
    el.btnStartQueue.textContent = t("btn_start_queue");
  }

  if (document.getElementById("lblQueuePause")) {
    document.getElementById("lblQueuePause").textContent = state.isQueuePaused ? t("btn_queue_resume") : t("btn_queue_pause");
  } else if (el.btnQueuePause) {
    el.btnQueuePause.textContent = t("btn_queue_pause");
  }

  if (document.getElementById("lblQueueSkip")) {
    document.getElementById("lblQueueSkip").textContent = t("btn_queue_skip");
  } else if (el.btnQueueSkip) {
    el.btnQueueSkip.textContent = t("btn_queue_skip");
  }

  if (document.getElementById("lblQueueCancel")) {
    document.getElementById("lblQueueCancel").textContent = t("btn_queue_cancel");
  } else if (el.btnQueueCancel) {
    el.btnQueueCancel.textContent = t("btn_queue_cancel");
  }

  if (document.getElementById("lblOpenOutputFolder")) {
    document.getElementById("lblOpenOutputFolder").textContent = t("btn_open_folder");
  } else if (el.btnOpenOutputFolder) {
    el.btnOpenOutputFolder.textContent = t("btn_open_folder");
  }

  // Settings Modal Tabs & Buttons
  if (document.getElementById("lblResetSettings")) {
    document.getElementById("lblResetSettings").textContent = t("btn_reset_settings");
  } else if (el.btnResetSettings) {
    el.btnResetSettings.textContent = t("btn_reset_settings");
  }

  if (document.getElementById("lblSaveSettings")) {
    document.getElementById("lblSaveSettings").textContent = t("btn_save_settings");
  } else if (el.btnSaveSettings) {
    el.btnSaveSettings.textContent = t("btn_save_settings");
  }
  const modalTabBtns = document.querySelectorAll("#settingsTabs .modal-tab-btn");
  if (modalTabBtns.length >= 4) {
    modalTabBtns[0].textContent = t("tab_general");
    modalTabBtns[1].textContent = t("tab_video");
    modalTabBtns[2].textContent = t("tab_audio");
    modalTabBtns[3].textContent = t("tab_naming");
    if (modalTabBtns.length >= 5) {
      modalTabBtns[4].textContent = t("tab_about");
    }
  }

  // Dynamic UI Labels & Context Menu
  if (document.getElementById("lblAboutAppDesc")) document.getElementById("lblAboutAppDesc").textContent = t("lbl_about_app_desc");
  if (document.getElementById("lblAboutDevTitle")) document.getElementById("lblAboutDevTitle").textContent = t("lbl_about_dev_title");
  if (document.getElementById("lblAboutRights")) document.getElementById("lblAboutRights").textContent = t("lbl_about_rights");
  if (document.getElementById("lblAboutContactHeader")) document.getElementById("lblAboutContactHeader").textContent = t("lbl_about_contact_header");

  if (el.lblSettingLanguageHeader) el.lblSettingLanguageHeader.textContent = t("lbl_language_header");
  if (el.lblSettingAppLanguage) el.lblSettingAppLanguage.textContent = t("lbl_app_language");
  if (el.lblSettingTrackNamesHeader) el.lblSettingTrackNamesHeader.textContent = t("lbl_setting_track_names_header");
  if (el.lblSettingClearTrackNames) el.lblSettingClearTrackNames.textContent = t("lbl_setting_clear_track_names");
  if (el.lblSettingClearTrackNamesDesc) el.lblSettingClearTrackNamesDesc.textContent = t("lbl_setting_clear_track_names_desc");
  if (el.lblLiveOutputPreview) el.lblLiveOutputPreview.textContent = t("lbl_live_preview");
  if (el.lblAvailableVariables) el.lblAvailableVariables.textContent = t("lbl_available_vars");
  if (el.lblCoverArtGallery) el.lblCoverArtGallery.textContent = t("lbl_cover_gallery");
  if (document.getElementById("lblBtnSearchMeta")) document.getElementById("lblBtnSearchMeta").textContent = t("btn_search_meta");
  if (document.getElementById("lblBtnPickCustomCover")) document.getElementById("lblBtnPickCustomCover").textContent = t("btn_pick_custom_cover");
  if (document.getElementById("lblBtnPickCustomCoverPoster")) document.getElementById("lblBtnPickCustomCoverPoster").textContent = t("btn_change_cover");
  if (el.lblCtxCut) el.lblCtxCut.textContent = t("ctx_cut");
  if (el.lblCtxCopy) el.lblCtxCopy.textContent = t("ctx_copy");
  if (el.lblCtxPaste) el.lblCtxPaste.textContent = t("ctx_paste");
  if (el.lblCtxDelete) el.lblCtxDelete.textContent = t("ctx_delete");
  if (el.lblCtxSelectAll) el.lblCtxSelectAll.textContent = t("ctx_select_all");

  // Stage 4: Quick In-Place Tools
  if (el.lblNavQuickTools) el.lblNavQuickTools.textContent = t("lbl_nav_quick_tools");
  if (document.getElementById("lblQuickToolsTitle")) document.getElementById("lblQuickToolsTitle").textContent = t("lbl_quick_tools_title");
  if (document.getElementById("lblQuickToolsDesc")) document.getElementById("lblQuickToolsDesc").textContent = t("lbl_quick_tools_desc");
  if (document.getElementById("lblQuickAddFiles")) document.getElementById("lblQuickAddFiles").textContent = t("lbl_quick_add_files");
  if (document.getElementById("lblQuickBatchRename")) document.getElementById("lblQuickBatchRename").textContent = t("lbl_quick_batch_rename");
  if (document.getElementById("lblQuickBatchCover")) document.getElementById("lblQuickBatchCover").textContent = t("lbl_quick_batch_cover");
  if (document.getElementById("lblQuickClearAll")) document.getElementById("lblQuickClearAll").textContent = t("lbl_quick_clear_all");
  if (document.getElementById("lblQuickEmptyTitle")) document.getElementById("lblQuickEmptyTitle").textContent = t("lbl_quick_empty_title");
  if (document.getElementById("lblQuickEmptyDesc")) document.getElementById("lblQuickEmptyDesc").textContent = t("lbl_quick_empty_desc");
  if (document.getElementById("lblQuickImportExisting")) document.getElementById("lblQuickImportExisting").textContent = t("lbl_quick_import_existing");
  if (document.getElementById("thQuickCover")) document.getElementById("thQuickCover").textContent = t("th_quick_cover");
  if (document.getElementById("thQuickOriginal")) document.getElementById("thQuickOriginal").textContent = t("th_quick_original");
  if (document.getElementById("thQuickProposed")) document.getElementById("thQuickProposed").textContent = t("th_quick_proposed");
  if (document.getElementById("thQuickSpecs")) document.getElementById("thQuickSpecs").textContent = t("th_quick_specs");

  // Update Review table and queue headers if currently displayed
  if (state.currentStep === 2 && state.groups[state.selectedGroupIndex]) {
    renderTracksTable(state.groups[state.selectedGroupIndex]);
  } else if (state.currentStep === 3) {
    renderQueueTable();
  }
}

// -------------------------------------------------------------
// Custom Modal Dialogs (Replaces native browser alert & confirm)
// -------------------------------------------------------------
function showConfirmDialog({ title = "Confirm", message = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", isDanger = false, icon = "⚠️" }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const okBtn = document.getElementById("btnConfirmOk");
    const cancelBtn = document.getElementById("btnConfirmCancel");
    const iconEl = document.getElementById("confirmIcon");

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.style.background = isDanger ? "#ef4444" : "var(--accent)";
      okBtn.style.borderColor = isDanger ? "#ef4444" : "var(--accent)";
    }
    if (cancelBtn) {
      cancelBtn.textContent = cancelText;
      cancelBtn.style.display = "inline-flex";
    }
    if (iconEl) {
      if (icon === "🗑️" || icon === "trash") {
        iconEl.innerHTML = '<svg class="ui-icon" style="width:22px;height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
      } else if (icon === "⏹️" || icon === "stop") {
        iconEl.innerHTML = '<svg class="ui-icon" style="width:22px;height:22px;" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>';
      } else if (icon === "⚠️" || icon === "warning") {
        iconEl.innerHTML = '<svg class="ui-icon" style="width:22px;height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else if (icon.startsWith("<svg")) {
        iconEl.innerHTML = icon;
      } else {
        iconEl.textContent = icon;
      }
      iconEl.style.background = isDanger ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)";
      iconEl.style.color = isDanger ? "#ef4444" : "var(--accent)";
    }

    modal.style.display = "flex";

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const cleanup = () => {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.style.display = "none";
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
  });
}

function showAlertDialog({ title = "Alert", message = "", buttonText = "OK", icon = "ℹ️" }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("customConfirmModal");
    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const okBtn = document.getElementById("btnConfirmOk");
    const cancelBtn = document.getElementById("btnConfirmCancel");
    const iconEl = document.getElementById("confirmIcon");

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) {
      okBtn.textContent = buttonText;
      okBtn.style.background = "var(--accent)";
      okBtn.style.borderColor = "var(--accent)";
    }
    if (cancelBtn) cancelBtn.style.display = "none";
    if (iconEl) {
      if (icon === "ℹ️" || icon === "info") {
        iconEl.innerHTML = '<svg class="ui-icon" style="width:22px;height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      } else if (icon === "⚠️" || icon === "warning") {
        iconEl.innerHTML = '<svg class="ui-icon" style="width:22px;height:22px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      } else if (icon.startsWith("<svg")) {
        iconEl.innerHTML = icon;
      } else {
        iconEl.textContent = icon;
      }
      iconEl.style.background = "rgba(59, 130, 246, 0.15)";
      iconEl.style.color = "var(--accent)";
    }

    modal.style.display = "flex";

    const onOk = () => {
      okBtn.removeEventListener("click", onOk);
      modal.style.display = "none";
      resolve();
    };
    okBtn.addEventListener("click", onOk);
  });
}

// -------------------------------------------------------------
// Safe Filename Sanitizer (Replaces : with - and strips illegal Windows chars)
// -------------------------------------------------------------
function sanitizeWindowsFilename(str) {
  if (!str) return "";
  return str
    .replace(/\s*:\s*/g, " - ")
    .replace(/[/\\]+/g, " - ")
    .replace(/[*?"<>|]/g, "")
    .replace(/\s*-\s*-+\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// -------------------------------------------------------------
// Settings Persistence & Rate Control UI
// -------------------------------------------------------------
const SETTINGS_STORAGE_KEY = "movie_converter_persistent_settings_v1";

async function loadSavedSettings() {
  let settings = null;

  // 1. Try localStorage
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) settings = JSON.parse(raw);
  } catch (e) {
    console.warn("localStorage read error:", e);
  }

  // 2. Try native disk via Tauri command if localStorage was empty
  if (!settings) {
    try {
      const diskJson = await invoke("load_settings");
      if (diskJson) settings = JSON.parse(diskJson);
    } catch (_) {}
  }

  if (settings) {
    if (settings.theme) state.theme = settings.theme;
    if (settings.accent) state.accent = settings.accent;
    if (settings.globalSettings) {
      state.globalSettings = { ...state.globalSettings, ...settings.globalSettings };
      if (!state.globalSettings.naming) state.globalSettings.naming = {};
      if (state.globalSettings.naming.enabled === undefined) {
        state.globalSettings.naming.enabled = true;
      }
      if (!state.globalSettings.naming.seriesPattern) {
        state.globalSettings.naming.seriesPattern = "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      }
      if (!state.globalSettings.naming.moviePattern) {
        state.globalSettings.naming.moviePattern = "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      }
    }
    if (settings.videoSettings) state.videoSettings = { ...state.videoSettings, ...settings.videoSettings };
    if (settings.audioSettings) state.audioSettings = { ...state.audioSettings, ...settings.audioSettings };
    if (settings.exportSettings) {
      state.exportSettings = { ...state.exportSettings, ...settings.exportSettings };
      if (el.exportFolderMode && settings.exportSettings.folderMode) {
        el.exportFolderMode.value = settings.exportSettings.folderMode;
        if (el.customFolderRow) el.customFolderRow.style.display = (settings.exportSettings.folderMode === "custom") ? "block" : "none";
        if (el.btnBrowseOutputFolder) el.btnBrowseOutputFolder.style.display = (settings.exportSettings.folderMode === "custom") ? "inline-flex" : "none";
      }
      if (el.exportOutputFolder && settings.exportSettings.folder) el.exportOutputFolder.value = settings.exportSettings.folder;
      if (el.exportPattern && settings.exportSettings.pattern) el.exportPattern.value = settings.exportSettings.pattern;
      if (el.exportIfExists && settings.exportSettings.ifExists) el.exportIfExists.value = settings.exportSettings.ifExists;
      if (el.chkDeleteOriginals && typeof settings.exportSettings.deleteOriginals === "boolean") {
        el.chkDeleteOriginals.checked = settings.exportSettings.deleteOriginals;
      }
      if (el.chkShutdown && typeof settings.exportSettings.shutdown === "boolean") {
        el.chkShutdown.checked = settings.exportSettings.shutdown;
      }
    }
  }

  const targetLang = (settings && settings.globalSettings && settings.globalSettings.language)
    ? settings.globalSettings.language
    : detectInitialLanguage();
  applyLanguage(targetLang);

  syncSettingsModalInputs();
}

function syncSettingsModalInputs() {
  if (el.settingAppLanguage) el.settingAppLanguage.value = state.globalSettings.language || "en";
  if (el.settingTheme) el.settingTheme.value = state.theme;
  if (el.settingAccent) el.settingAccent.value = state.accent;
  if (el.settingDefAudio) el.settingDefAudio.value = state.globalSettings.defAudioLang;
  if (el.settingDefSub) el.settingDefSub.value = state.globalSettings.defSubLang;
  if (el.settingClearTrackNames) el.settingClearTrackNames.checked = (state.globalSettings.clearTrackNames !== false);

  // Sync naming settings
  const namingCfg = state.globalSettings.naming || {};
  if (el.settingNamingEnabled) el.settingNamingEnabled.checked = (namingCfg.enabled !== false);
  if (el.settingNamingTag) el.settingNamingTag.value = namingCfg.tag || "yasinoss";
  if (el.settingNamingSeriesPattern) el.settingNamingSeriesPattern.value = namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
  if (el.settingNamingMoviePattern) el.settingNamingMoviePattern.value = namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
  if (el.settingMetadataEnabled) el.settingMetadataEnabled.checked = (namingCfg.metadataEnabled !== false);
  if (el.settingAnimeTitlePref) el.settingAnimeTitlePref.value = namingCfg.animeTitlePref || "english";
  if (el.settingEmbedCover) el.settingEmbedCover.checked = (namingCfg.embedCover !== false);
  if (el.settingTmdbApiKey) el.settingTmdbApiKey.value = namingCfg.tmdbApiKey || "";
  updateNamingLivePreview();

  if (el.vCfgResolution) el.vCfgResolution.value = state.videoSettings.resolution;
  if (el.vCfgCodec) el.vCfgCodec.value = state.videoSettings.codec;
  if (el.vCfgRateControl) el.vCfgRateControl.value = state.videoSettings.rateControl;
  if (el.vCfgQualityVal) el.vCfgQualityVal.value = state.videoSettings.qualityVal;
  if (el.vCfgPreset) el.vCfgPreset.value = state.videoSettings.preset;
  if (el.vCfgTune) el.vCfgTune.value = state.videoSettings.tune;
  if (el.vCfgPixFmt) el.vCfgPixFmt.value = state.videoSettings.pixFmt;
  if (el.vCfgMultipass) el.vCfgMultipass.value = state.videoSettings.multipass || "disabled";
  if (el.vCfgProfile) el.vCfgProfile.value = state.videoSettings.profile || "auto";
  if (el.vCfgLevel) el.vCfgLevel.value = state.videoSettings.level || "auto";
  if (el.vCfgAq) el.vCfgAq.value = state.videoSettings.aq || "enabled";

  if (el.aCfgCodec) el.aCfgCodec.value = state.audioSettings.codec;
  if (el.aCfgChannels) el.aCfgChannels.value = state.audioSettings.channels;
  if (el.aCfgBitrate) el.aCfgBitrate.value = state.audioSettings.bitrate;
  if (el.aCfgSampleRate) el.aCfgSampleRate.value = state.audioSettings.sampleRate;

  updateRateControlUI();
}

async function persistAllSettings() {
  const payload = {
    theme: state.theme,
    accent: state.accent,
    globalSettings: state.globalSettings,
    videoSettings: state.videoSettings,
    audioSettings: state.audioSettings,
    exportSettings: {
      folderMode: el.exportFolderMode ? el.exportFolderMode.value : (state.exportSettings.folderMode || "same"),
      folder: el.exportOutputFolder ? el.exportOutputFolder.value : state.exportSettings.folder,
      pattern: el.exportPattern ? el.exportPattern.value : state.exportSettings.pattern,
      ifExists: el.exportIfExists ? el.exportIfExists.value : state.exportSettings.ifExists,
      deleteOriginals: el.chkDeleteOriginals ? el.chkDeleteOriginals.checked : false,
      shutdown: el.chkShutdown ? el.chkShutdown.checked : false
    }
  };

  const json = JSON.stringify(payload);
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, json);
  } catch (e) {
    console.warn("localStorage write error:", e);
  }

  try {
    await invoke("save_settings", { settingsJson: json });
  } catch (_) {}
}

function updateRateControlUI() {
  const isVideoCopy = el.vCfgCodec && el.vCfgCodec.value === "copy";
  [el.vCfgResolution, el.vCfgRateControl, el.vCfgQualityVal, el.vCfgPreset, el.vCfgTune, el.vCfgPixFmt, el.vCfgMultipass, el.vCfgProfile, el.vCfgLevel, el.vCfgAq].forEach(input => {
    if (input) {
      input.disabled = isVideoCopy;
      input.style.opacity = isVideoCopy ? "0.45" : "1";
    }
  });

  const mode = el.vCfgRateControl ? el.vCfgRateControl.value : "cqp";
  if (!el.lblQualityVal || !el.vCfgQualityVal) return;

  if (mode === "vbr") {
    el.lblQualityVal.textContent = "Target Bitrate (Kb/s)";
    el.vCfgQualityVal.placeholder = "6000";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = "Target video bitrate in Kb/s (e.g. 6000 for 1080p, 12000 for 4K, 2500 for 720p)";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal <= 51) {
      el.vCfgQualityVal.value = "6000";
    }
  } else if (mode === "cbr") {
    el.lblQualityVal.textContent = "Constant Bitrate (Kb/s)";
    el.vCfgQualityVal.placeholder = "6000";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = "Constant video bitrate in Kb/s (e.g. 6000 for 1080p)";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal <= 51) {
      el.vCfgQualityVal.value = "6000";
    }
  } else {
    // CQP / CRF
    el.lblQualityVal.textContent = "Quality (CQ / CRF: 0 - 51)";
    el.vCfgQualityVal.placeholder = "22";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = "Lower value = Higher visual quality (Recommended: 18 - 28)";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal > 51) {
      el.vCfgQualityVal.value = "22";
    }
  }
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
async function init() {
  cacheElements();
  try {
    await invoke("center_window");
  } catch (_) {}
  await loadSavedSettings();
  
  // Native-feeling Right-Click Context Menu (Cut, Copy, Paste, Delete, Select All)
  let activeContextTarget = null;
  const ctxMenu = document.getElementById("customContextMenu");
  const ctxCut = document.getElementById("ctxCut");
  const ctxCopy = document.getElementById("ctxCopy");
  const ctxPaste = document.getElementById("ctxPaste");
  const ctxDelete = document.getElementById("ctxDelete");
  const ctxSelectAll = document.getElementById("ctxSelectAll");

  const hideContextMenu = () => {
    if (ctxMenu) ctxMenu.style.display = "none";
    activeContextTarget = null;
  };

  document.addEventListener("contextmenu", (e) => {
    const target = e.target;
    const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

    // Right-click should ONLY trigger in text typing / editable areas
    if (!isInput) {
      e.preventDefault();
      hideContextMenu();
      return;
    }

    e.preventDefault();
    activeContextTarget = target;

    if (!ctxMenu) return;

    const isReadOnly = target.readOnly || target.disabled;
    const val = target.value || "";
    const selLen = (typeof target.selectionStart === "number") ? (target.selectionEnd - target.selectionStart) : 0;

    if (ctxCut) ctxCut.classList.toggle("disabled", isReadOnly || selLen === 0);
    if (ctxCopy) ctxCopy.classList.toggle("disabled", selLen === 0);
    if (ctxPaste) ctxPaste.classList.toggle("disabled", isReadOnly);
    if (ctxDelete) ctxDelete.classList.toggle("disabled", isReadOnly || (selLen === 0 && val.length === 0));
    if (ctxSelectAll) ctxSelectAll.classList.toggle("disabled", val.length === 0);

    ctxMenu.style.display = "flex";
    const menuWidth = 185;
    const menuHeight = 180;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) posX = Math.max(10, window.innerWidth - menuWidth - 10);
    if (posY + menuHeight > window.innerHeight) posY = Math.max(10, window.innerHeight - menuHeight - 10);

    ctxMenu.style.left = `${posX}px`;
    ctxMenu.style.top = `${posY}px`;
  });

  document.addEventListener("click", (e) => {
    if (ctxMenu && !ctxMenu.contains(e.target)) {
      hideContextMenu();
    }
  });

  window.addEventListener("blur", hideContextMenu);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideContextMenu();
  });

  if (ctxCut) {
    ctxCut.addEventListener("click", () => {
      if (activeContextTarget && !activeContextTarget.readOnly && !activeContextTarget.disabled) {
        activeContextTarget.focus();
        document.execCommand("cut");
        activeContextTarget.dispatchEvent(new Event("input", { bubbles: true }));
        activeContextTarget.dispatchEvent(new Event("change", { bubbles: true }));
      }
      hideContextMenu();
    });
  }

  if (ctxCopy) {
    ctxCopy.addEventListener("click", async () => {
      if (activeContextTarget) {
        activeContextTarget.focus();
        document.execCommand("copy");
      } else {
        const text = window.getSelection().toString();
        if (text && navigator.clipboard) {
          try { await navigator.clipboard.writeText(text); } catch (_) {}
        } else {
          document.execCommand("copy");
        }
      }
      hideContextMenu();
    });
  }

  if (ctxPaste) {
    ctxPaste.addEventListener("click", async () => {
      if (activeContextTarget && !activeContextTarget.readOnly && !activeContextTarget.disabled) {
        activeContextTarget.focus();
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const clipText = await navigator.clipboard.readText();
            if (clipText) {
              const start = activeContextTarget.selectionStart;
              const end = activeContextTarget.selectionEnd;
              const val = activeContextTarget.value;
              activeContextTarget.value = val.substring(0, start) + clipText + val.substring(end);
              activeContextTarget.selectionStart = activeContextTarget.selectionEnd = start + clipText.length;
              activeContextTarget.dispatchEvent(new Event("input", { bubbles: true }));
              activeContextTarget.dispatchEvent(new Event("change", { bubbles: true }));
            }
          } else {
            document.execCommand("paste");
          }
        } catch (_) {
          document.execCommand("paste");
        }
      }
      hideContextMenu();
    });
  }

  if (ctxDelete) {
    ctxDelete.addEventListener("click", () => {
      if (activeContextTarget && !activeContextTarget.readOnly && !activeContextTarget.disabled) {
        activeContextTarget.focus();
        const start = activeContextTarget.selectionStart;
        const end = activeContextTarget.selectionEnd;
        if (start !== end) {
          const val = activeContextTarget.value;
          activeContextTarget.value = val.substring(0, start) + val.substring(end);
          activeContextTarget.selectionStart = activeContextTarget.selectionEnd = start;
        } else {
          activeContextTarget.value = "";
        }
        activeContextTarget.dispatchEvent(new Event("input", { bubbles: true }));
        activeContextTarget.dispatchEvent(new Event("change", { bubbles: true }));
      }
      hideContextMenu();
    });
  }

  if (ctxSelectAll) {
    ctxSelectAll.addEventListener("click", () => {
      if (activeContextTarget) {
        activeContextTarget.focus();
        activeContextTarget.select();
      } else {
        document.execCommand("selectAll");
      }
      hideContextMenu();
    });
  }

  // 2. Disable Browser Keyboard Shortcuts (F5, F3, F7, F12, Ctrl+P, Ctrl+R, Ctrl+S, Ctrl+U, Ctrl+F, Ctrl+O, DevTools, etc.)
  window.addEventListener("keydown", (e) => {
    const key = e.key;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    // Block F-keys (F5 reload, F3 search, F7 caret, F12 devtools)
    if (key === "F5" || key === "F3" || key === "F12" || key === "F7") {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block Ctrl/Cmd browser shortcuts
    if (ctrlOrMeta) {
      const k = key.toLowerCase();
      // p: print, r: reload, s: save web page, u: view source, f: find, g: find next,
      // o: open file, h: history, j: downloads, n: new window, t: new tab, w: close tab
      if (['p', 'r', 's', 'u', 'f', 'g', 'o', 'h', 'j', 'n', 't', 'w'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I / J / C (DevTools)
      if (e.shiftKey && ['i', 'j', 'c'].includes(k)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }

    // Block Alt+Left / Alt+Right browser page history navigation
    if (e.altKey && (key === "ArrowLeft" || key === "ArrowRight")) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block Backspace navigation outside inputs
    if (key === "Backspace") {
      const tag = (e.target && e.target.tagName) ? e.target.tagName : "";
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);

  applyTheme(state.theme, state.accent);
  setupWindowDragging();
  setupEventListeners();
  setupSettingsModal();
  setupMetadataModal();
  setupTauriEventListeners();
  goToStep(1);
}

function applyTheme(theme, accent) {
  state.theme = theme;
  state.accent = accent;
  el.html.setAttribute("data-theme", theme);
  el.html.setAttribute("data-accent", accent);
  if (el.settingTheme) el.settingTheme.value = theme;
  if (el.settingAccent) el.settingAccent.value = accent;
}

// -------------------------------------------------------------
// Reliable Native Window Dragging
// -------------------------------------------------------------
function setupWindowDragging() {
  const header = el.appHeader || document.querySelector(".top-bar");
  if (header) {
    header.addEventListener("mousedown", async (e) => {
      // Left click only, not on buttons, links, inputs, selects, or stepper items
      if (e.button === 0 && !e.target.closest("button, a, input, select, .step-item")) {
        try {
          if (window.__TAURI__ && window.__TAURI__.window) {
            const current = window.__TAURI__.window.getCurrentWindow();
            if (current && typeof current.startDragging === "function") {
              await current.startDragging();
              return;
            }
          }
        } catch (err) {
          console.warn("startDragging error:", err);
        }
        invoke("start_drag");
      }
    });

    header.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button, a, input, select, .step-item")) {
        invoke("toggle_maximize");
      }
    });
  }
}

// -------------------------------------------------------------
// Smart Output Naming Engine (FileBot style)
// -------------------------------------------------------------
function parseMediaInfo(filename, group, videoSettings, audioSettings = state.audioSettings) {
  // Strip path & extension
  let stem = filename.split(/[/\\]/).pop().replace(/\.[^/.]+$/, "");
  // Strip leading release tags like [YTS.MX], [SubsPlease], [Erai-raws], etc.
  const cleanStem = stem.replace(/^\[[^\]]+\]\s*/, "");

  // 1. Detect Source Rip Quality ({Qt})
  // Match keywords: BluRay, Blu-Ray, BRRip, BDRip, WEB-DL, WEBRip, WEB, HDTV, DVDRip, REMUX
  let qt = "";
  const qtRegex = /(?:^|[ ._\-\[])(Blu-?Ray|BRRip|BDRip|WEB-?DL|WEBRip|WEB|HDTV|DVDRip|REMUX)(?:[ ._\-\]]|$)/i;
  const qtMatch = cleanStem.match(qtRegex);
  if (qtMatch) {
    const rawQt = qtMatch[1].toUpperCase();
    if (rawQt.includes("BLU")) qt = "BluRay";
    else if (rawQt === "BRRIP") qt = "BRRip";
    else if (rawQt === "BDRIP") qt = "BDRip";
    else if (rawQt.includes("WEB-DL") || rawQt === "WEBDL") qt = "WEB-DL";
    else if (rawQt.includes("WEB")) qt = "WEBRip";
    else if (rawQt === "HDTV") qt = "HDTV";
    else if (rawQt.includes("DVD")) qt = "DVDRip";
    else if (rawQt === "REMUX") qt = "REMUX";
    else qt = qtMatch[1];
  }

  // 2. Detect Season & Episode (Multi-pattern support)
  let season = null;
  let episode = null;
  if (group && typeof group.season === "number") season = group.season;
  if (group && typeof group.episode === "number") episode = group.episode;

  const seRegex1 = /(?:^|[ ._\-\[])(?:Season|S)[ ._\-]?(\d{1,2})[ ._\-]*(?:Episode|Ep|E)[ ._\-]?(\d{1,3})/i;
  const seRegex2 = /(?:^|[ ._\-\[])(\d{1,2})[xX](\d{2,3})/i;
  const epRegex = /(?:^|[ ._\-\[])(?:Episode|Ep|E)[ ._\-]?(\d{1,3})(?:[ ._\-\]]|$)/i;
  const animeEpRegex = /(?:^|[ ._\-\[])(?:-\s*|#\s*)(\d{1,3})(?:[ ._\-\]]|$)/i;

  let seMatch = cleanStem.match(seRegex1) || cleanStem.match(seRegex2);
  if (seMatch) {
    if (season === null) season = parseInt(seMatch[1], 10);
    if (episode === null) episode = parseInt(seMatch[2], 10);
  } else {
    const epMatch = cleanStem.match(epRegex) || cleanStem.match(animeEpRegex);
    if (epMatch) {
      if (season === null) season = 1;
      if (episode === null) episode = parseInt(epMatch[1], 10);
      seMatch = epMatch;
    }
  }

  // 3. Detect Year
  let year = "";
  const yearMatch = cleanStem.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    year = yearMatch[1];
  }

  // 4. Extract Clean Title
  let title = "";
  if (seMatch) {
    const idx = cleanStem.indexOf(seMatch[0]);
    if (idx > 0) {
      title = cleanStem.substring(0, idx);
    }
  } else if (yearMatch) {
    const idx = cleanStem.indexOf(yearMatch[0]);
    if (idx > 0) {
      title = cleanStem.substring(0, idx);
    }
  }

  if (!title) {
    const noiseMatch = cleanStem.match(/(?:^|[ ._\-])(1080p|720p|2160p|4k|480p|bluray|web-?dl|webrip|hdtv|x264|x265|hevc|aac|dts)/i);
    if (noiseMatch && noiseMatch.index > 0) {
      title = cleanStem.substring(0, noiseMatch.index);
    } else {
      title = cleanStem;
    }
  }

  // Remove release formatting artifacts: replace dots, underscores, brackets with natural spaces
  title = title
    .replace(/[\[\]\(\)]/g, " ")
    .replace(/[._]+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Prioritize verified online metadata from TVmaze, TMDB, Wikipedia, or AniList
  if (group && group.metadata) {
    if (group.metadata.title) {
      title = group.metadata.title.trim();
    }
    // Check if season-specific year exists (e.g. TVmaze season premiered year)
    const sNum = season !== null ? season : (group.season || 1);
    if (group.metadata.seasons && group.metadata.seasons[sNum] && group.metadata.seasons[sNum].year) {
      year = group.metadata.seasons[sNum].year;
    } else if (group.metadata.year) {
      year = group.metadata.year;
    }
  }

  // 5. Detect Video Resolution
  let resolution = "1080p";
  let resNumber = "1080";
  if (videoSettings && videoSettings.resolution && videoSettings.resolution !== "original") {
    if (videoSettings.resolution.includes("3840") || videoSettings.resolution.includes("2160")) {
      resolution = "2160p";
      resNumber = "2160";
    } else if (videoSettings.resolution.includes("2560") || videoSettings.resolution.includes("1440")) {
      resolution = "1440p";
      resNumber = "1440";
    } else if (videoSettings.resolution.includes("1920") || videoSettings.resolution.includes("1080")) {
      resolution = "1080p";
      resNumber = "1080";
    } else if (videoSettings.resolution.includes("1280") || videoSettings.resolution.includes("720")) {
      resolution = "720p";
      resNumber = "720";
    } else if (videoSettings.resolution.includes("854") || videoSettings.resolution.includes("480")) {
      resolution = "480p";
      resNumber = "480";
    }
  } else {
    // Horizontal dimension rule (Width takes absolute precedence):
    // >= 3800 -> 2160p (e.g. 3840x1600 or 3840x2160)
    // >= 2500 -> 1440p (e.g. 2560)
    // >= 1900 -> 1080p (e.g. 1920x800 or 1920x1080)
    // >= 1260 -> 720p (e.g. 1280)
    // >= 940  -> 540p
    // >= 700  -> 480p
    let vidWidth = null;
    let vidHeight = null;
    if (group) {
      if (typeof group.width === "number" && group.width > 0) {
        vidWidth = group.width;
        vidHeight = group.height || 0;
      } else if (group.tracks) {
        const vt = group.tracks.find(t => t.kind === "video");
        if (vt && typeof vt.width === "number" && vt.width > 0) {
          vidWidth = vt.width;
          vidHeight = vt.height || 0;
        }
      }
    }

    if (vidWidth) {
      if (vidWidth >= 3800) {
        resolution = "2160p";
        resNumber = "2160";
      } else if (vidWidth >= 2500) {
        resolution = "1440p";
        resNumber = "1440";
      } else if (vidWidth >= 1900) {
        resolution = "1080p";
        resNumber = "1080";
      } else if (vidWidth >= 1260) {
        resolution = "720p";
        resNumber = "720";
      } else if (vidWidth >= 940) {
        resolution = "540p";
        resNumber = "540";
      } else if (vidWidth >= 700) {
        resolution = "480p";
        resNumber = "480";
      } else {
        resolution = (vidHeight && vidHeight >= 700) ? "720p" : "480p";
        resNumber = (vidHeight && vidHeight >= 700) ? "720" : "480";
      }
    } else {
      const resMatch = cleanStem.match(/\b(2160p|4k|1440p|1080p|720p|480p|576p)\b/i);
      if (resMatch) {
        const lower = resMatch[1].toLowerCase();
        if (lower === "4k" || lower === "2160p") {
          resolution = "2160p";
          resNumber = "2160";
        } else if (lower === "1440p") {
          resolution = "1440p";
          resNumber = "1440";
        } else if (lower === "1080p") {
          resolution = "1080p";
          resNumber = "1080";
        } else if (lower === "720p") {
          resolution = "720p";
          resNumber = "720";
        } else {
          resolution = lower;
          resNumber = lower.replace(/\D/g, "");
        }
      }
    }
  }

  // 6. Detect Video Codec
  let vc = "H264";
  const codecVal = videoSettings ? (videoSettings.codec || "copy").toLowerCase() : "copy";
  if (codecVal.includes("hevc") || codecVal.includes("265")) {
    vc = "HEVC";
  } else if (codecVal.includes("av1")) {
    vc = "AV1";
  } else if (codecVal.includes("264") || codecVal.includes("avc")) {
    vc = "H264";
  } else if (codecVal === "copy") {
    let origCodec = "";
    if (group && group.tracks) {
      const vTrack = group.tracks.find(t => t.kind === "video");
      if (vTrack && vTrack.codec) origCodec = vTrack.codec.toUpperCase();
    }
    if (origCodec.includes("HEVC") || origCodec.includes("265")) vc = "HEVC";
    else if (origCodec.includes("AV1")) vc = "AV1";
    else if (cleanStem.match(/\b(hevc|x265|h\.?265)\b/i)) vc = "HEVC";
    else if (cleanStem.match(/\b(av1)\b/i)) vc = "AV1";
    else vc = "H264";
  }

  // 7. Detect Audio Codec ({ac})
  let ac = "AAC";
  const aSettings = audioSettings || state.audioSettings;
  const aCodecVal = aSettings ? (aSettings.codec || "copy").toLowerCase() : "copy";
  if (aCodecVal !== "copy" && aCodecVal !== "") {
    if (aCodecVal === "eac3") ac = "EAC3";
    else if (aCodecVal === "ac3") ac = "AC3";
    else if (aCodecVal === "opus") ac = "Opus";
    else if (aCodecVal === "flac") ac = "FLAC";
    else if (aCodecVal === "mp3") ac = "MP3";
    else ac = aCodecVal.toUpperCase();
  } else {
    let origAudioCodec = "";
    if (group && group.tracks) {
      const aTrack = group.tracks.find(t => t.kind === "audio");
      if (aTrack) {
        origAudioCodec = (aTrack.codec || aTrack.name || "").toUpperCase();
      }
    }
    if (origAudioCodec.includes("E-AC-3") || origAudioCodec.includes("EAC3") || origAudioCodec.includes("DDP") || origAudioCodec.includes("ATMOS")) {
      ac = "EAC3";
    } else if (origAudioCodec.includes("AC-3") || origAudioCodec.includes("AC3") || origAudioCodec.includes("DOLBY DIGITAL")) {
      ac = "AC3";
    } else if (origAudioCodec.includes("DTS-HD") || origAudioCodec.includes("DTS-HD MA") || origAudioCodec.includes("DTS:X")) {
      ac = "DTS-HD";
    } else if (origAudioCodec.includes("DTS")) {
      ac = "DTS";
    } else if (origAudioCodec.includes("TRUEHD")) {
      ac = "TrueHD";
    } else if (origAudioCodec.includes("FLAC")) {
      ac = "FLAC";
    } else if (origAudioCodec.includes("OPUS")) {
      ac = "Opus";
    } else if (origAudioCodec.includes("AAC")) {
      ac = "AAC";
    } else {
      const lowerStem = cleanStem.toLowerCase();
      if (lowerStem.match(/\b(ddp\+?|eac3|dd\+|atmos)\b/)) ac = "EAC3";
      else if (lowerStem.match(/\b(dts-hd|dts-x)\b/)) ac = "DTS-HD";
      else if (lowerStem.match(/\b(dts)\b/)) ac = "DTS";
      else if (lowerStem.match(/\b(truehd)\b/)) ac = "TrueHD";
      else if (lowerStem.match(/\b(ac3|dd5\.1|dd2\.0)\b/)) ac = "AC3";
      else if (lowerStem.match(/\b(flac)\b/)) ac = "FLAC";
      else if (lowerStem.match(/\b(opus)\b/)) ac = "Opus";
      else if (lowerStem.match(/\b(aac)\b/)) ac = "AAC";
      else ac = "AAC";
    }
  }

  // 8. Detect HDR strictly from video file stream metadata (Never from filename!)
  let hdr = "";
  if (group && group.hdr) {
    hdr = group.hdr;
  } else if (group && group.tracks) {
    const vt = group.tracks.find(t => t.kind === "video");
    if (vt && vt.hdr) hdr = vt.hdr;
  }

  // A file is definitely a series if season/episode numbers are detected, or if group has them
  const isSeries = (season !== null && episode !== null) || (group && (group.season !== undefined && group.season !== null && group.episode !== undefined && group.episode !== null)) || (group && group.metadata && group.metadata.isSeries === true);

  return {
    cleanTitle: sanitizeWindowsFilename(title) || "Video",
    season,
    episode,
    year,
    sourceQuality: qt,
    resolution,
    resNumber: resNumber || "1080",
    hdr: hdr || "",
    videoCodec: vc,
    audioCodec: ac,
    isSeries
  };
}

function formatFilename(pattern, info, customTag) {
  if (!pattern) return sanitizeWindowsFilename(info.cleanTitle);

  const ss = info.season !== null && info.season !== undefined ? String(info.season).padStart(2, "0") : "01";
  const s = info.season !== null && info.season !== undefined ? String(info.season) : "1";
  const ee = info.episode !== null && info.episode !== undefined ? String(info.episode).padStart(2, "0") : "01";
  const e = info.episode !== null && info.episode !== undefined ? String(info.episode) : "1";
  const tag = (customTag || "").trim();

  let res = pattern
    .replace(/\{Title\}/gi, sanitizeWindowsFilename(info.cleanTitle))
    .replace(/\{SS\}/g, ss)
    .replace(/\{S\}/g, s)
    .replace(/\{EE\}/g, ee)
    .replace(/\{E\}/g, e)
    .replace(/\{res\}/gi, info.resNumber || "1080")
    .replace(/\{VideoCodec\}/gi, info.videoCodec || "H264")
    .replace(/\{AudioCodec\}/gi, info.audioCodec || "AAC")
    .replace(/\{acodec\}/gi, info.audioCodec || "AAC")
    .replace(/\{Tag\}/gi, tag);

  // Replace {ac} (with optional (audio) badge text e.g. {ac} (Audio) or {ac})
  const hasAcPlaceholder = /\{ac(?:\s*\(audio\))?\}/i.test(res);
  if (hasAcPlaceholder) {
    res = res.replace(/\{ac(?:\s*\(audio\))?\}/gi, info.audioCodec || "AAC");
  } else {
    // If {ac} was NOT in pattern, automatically ensure audio codec is included right after video codec:
    if (/\{vc\}/i.test(res)) {
      res = res.replace(/\{vc\}/gi, `${info.videoCodec || "H264"}.${info.audioCodec || "AAC"}`);
    } else {
      res = `${res}.${info.audioCodec || "AAC"}`;
    }
  }

  // Handle remaining {vc} if not already handled
  res = res.replace(/\{vc\}/gi, info.videoCodec || "H264");

  // Handle {hdr} and guarantee HDR inclusion if video supports HDR / HDR10+
  const hasHdrPlaceholder = /\{hdr\}/i.test(res);
  if (info.hdr) {
    if (hasHdrPlaceholder) {
      res = res.replace(/\{hdr\}/gi, info.hdr);
    } else {
      // If video supports HDR / HDR10+ and {hdr} was omitted in pattern, automatically include it with Resolution
      if (/\{Resolution\}/i.test(res)) {
        res = res.replace(/\{Resolution\}/gi, `${info.resolution || "1080p"}.${info.hdr}`);
      } else if (/\{Qt\}/i.test(res)) {
        res = res.replace(/\{Qt\}/gi, `${info.hdr}.${info.sourceQuality || ""}`);
      } else {
        res = `${res}.${info.hdr}`;
      }
    }
  } else {
    // SDR: cleanly remove {hdr} placeholder without residual dots or separators
    res = res.replace(/[._\- ]?\{hdr\}[._\- ]?/gi, ".");
  }

  // Handle {Resolution} (if not already handled by HDR auto-attachment above)
  res = res.replace(/\{Resolution\}/gi, info.resolution || "1080p");

  // Handle {Year}
  if (info.year) {
    res = res.replace(/\{Year\}/gi, info.year);
  } else {
    res = res.replace(/[._\- ]?\{Year\}[._\- ]?/gi, ".");
  }

  // Handle {Qt} cleanly - if not found, omit completely without residual dots
  if (info.sourceQuality) {
    res = res.replace(/\{Qt\}/gi, info.sourceQuality);
  } else {
    res = res.replace(/[._\- ]?\{Qt\}[._\- ]?/gi, ".");
  }

  // Final clean up of redundant separators, preserving spaces in title and sanitizing illegal characters
  res = sanitizeWindowsFilename(res)
    .replace(/\.{2,}/g, ".")
    .replace(/_{2,}/g, "_")
    .replace(/-{2,}/g, "-")
    .replace(/\s{2,}/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "")
    .trim();

  return res;
}

function updateNamingLivePreview() {
  const isEnabled = el.settingNamingEnabled ? el.settingNamingEnabled.checked : true;
  const tag = el.settingNamingTag ? el.settingNamingTag.value.trim() : "yasinoss";
  const sPattern = el.settingNamingSeriesPattern ? el.settingNamingSeriesPattern.value.trim() : "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
  const mPattern = el.settingNamingMoviePattern ? el.settingNamingMoviePattern.value.trim() : "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";

  if (!isEnabled) {
    if (el.previewSeriesWithQt) el.previewSeriesWithQt.textContent = "Original Filename (Smart Naming Disabled)";
    if (el.previewSeriesNoQt) el.previewSeriesNoQt.textContent = "Original Filename (Smart Naming Disabled)";
    if (el.previewMovie) el.previewMovie.textContent = "Original Filename (Smart Naming Disabled)";
    return;
  }

  const s1Info = parseMediaInfo("Game.of.Thrones.S01E01.mkv", { season: 1, episode: 1, hdr: "HDR10+", tracks: [{ kind: "video", hdr: "HDR10+" }, { kind: "audio", codec: "EAC3" }] }, state.videoSettings);
  s1Info.sourceQuality = "WEB-DL";
  if (el.previewSeriesWithQt) {
    el.previewSeriesWithQt.textContent = formatFilename(sPattern, s1Info, tag) + ".mkv";
  }

  const s2Info = parseMediaInfo("Game.of.Thrones.S01E01.mkv", { season: 1, episode: 1, tracks: [{ kind: "video" }, { kind: "audio", codec: "AAC" }] }, state.videoSettings);
  if (el.previewSeriesNoQt) {
    el.previewSeriesNoQt.textContent = formatFilename(sPattern, s2Info, tag) + ".mkv";
  }

  const mInfo = parseMediaInfo("Inception.2010.mkv", { tracks: [{ kind: "video" }, { kind: "audio", codec: "DTS" }] }, state.videoSettings);
  mInfo.sourceQuality = "BluRay";
  mInfo.year = "2010";
  if (el.previewMovie) {
    el.previewMovie.textContent = formatFilename(mPattern, mInfo, tag) + ".mkv";
  }
}

// -------------------------------------------------------------
// Online Metadata & Cover Engine (AniList, TVmaze, TMDB)
// -------------------------------------------------------------
async function fetchAnimeMetadata(cleanTitle, pref = "english") {
  const query = `query ($search: String) {
    Page(page: 1, perPage: 12) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english native }
        seasonYear
        startDate { year }
        coverImage { extraLarge large medium }
        episodes
        format
      }
    }
  }`;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query, variables: { search: cleanTitle } })
    });
    if (!res.ok) return null;
    const json = await res.json();
    const mediaList = json.data?.Page?.media || [];
    if (mediaList.length > 0) {
      const candidates = mediaList.map(m => {
        let chosenTitle = m.title.english || m.title.romaji || m.title.native;
        if (pref === "romaji" && m.title.romaji) chosenTitle = m.title.romaji;
        else if (pref === "native" && m.title.native) chosenTitle = m.title.native;
        const year = String(m.seasonYear || (m.startDate ? m.startDate.year : "") || "");
        const poster = m.coverImage ? (m.coverImage.extraLarge || m.coverImage.large || m.coverImage.medium) : null;
        return {
          title: chosenTitle,
          year: year,
          posterUrl: poster,
          source: "AniList (Anime)",
          isSeries: true
        };
      });

      candidates[0]._candidates = candidates;
      return candidates[0];
    }
  } catch (e) {
    console.warn("AniList fetch error:", e);
  }
  return null;
}

async function fetchTVmazeMetadata(cleanTitle) {
  try {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanTitle)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (Array.isArray(json) && json.length > 0) {
      const candidates = [];
      for (const item of json) {
        const show = item.show;
        if (!show || !show.name) continue;
        const year = show.premiered ? show.premiered.substring(0, 4) : "";
        const poster = show.image ? (show.image.original || show.image.medium) : null;
        candidates.push({
          id: show.id,
          title: show.name,
          year: year,
          posterUrl: poster,
          source: "TVmaze",
          isSeries: true
        });
      }

      if (candidates.length > 0) {
        // Embed seasons info for top candidate if available
        try {
          const detailRes = await fetch(`https://api.tvmaze.com/shows/${candidates[0].id}?embed=seasons`);
          if (detailRes.ok) {
            const detailJson = await detailRes.json();
            if (detailJson._embedded && Array.isArray(detailJson._embedded.seasons)) {
              const seasonsInfo = {};
              detailJson._embedded.seasons.forEach(s => {
                seasonsInfo[s.number] = {
                  year: s.premiereDate ? s.premiereDate.substring(0, 4) : candidates[0].year,
                  posterUrl: s.image ? (s.image.original || s.image.medium) : candidates[0].posterUrl
                };
              });
              candidates[0].seasons = seasonsInfo;
            }
          }
        } catch (_) {}

        candidates[0]._candidates = candidates;
        return candidates[0];
      }
    }
  } catch (e) {
    console.warn("TVmaze fetch error:", e);
  }
  return null;
}

async function fetchTmdbMetadata(cleanTitle, apiKey) {
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(cleanTitle)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.results && json.results.length > 0) {
      const candidates = [];
      for (const top of json.results) {
        const title = top.title || top.name || "";
        if (!title) continue;
        const dateStr = top.release_date || top.first_air_date || "";
        const year = dateStr.length >= 4 ? dateStr.substring(0, 4) : "";
        const poster = top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : null;
        candidates.push({
          title: title,
          year: year,
          posterUrl: poster,
          source: "TMDB",
          isSeries: top.media_type === "tv"
        });
      }

      if (candidates.length > 0) {
        candidates[0]._candidates = candidates;
        return candidates[0];
      }
    }
  } catch (e) {
    console.warn("TMDB fetch error:", e);
  }
  return null;
}

async function fetchWikipediaMovieMetadata(cleanTitle, searchYear = "", isSeries = false) {
  try {
    let queryStr = cleanTitle;
    if (isSeries) {
      queryStr = `${cleanTitle} ${searchYear ? searchYear + ' ' : ''}TV series`;
    } else {
      queryStr = `${cleanTitle} ${searchYear ? searchYear + ' ' : ''}film`;
    }

    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryStr)}&utf8=&format=json&origin=*`;
    const sRes = await fetch(searchUrl);
    if (!sRes.ok) return null;
    const sData = await sRes.json();
    let hits = sData?.query?.search || [];

    if (hits.length === 0) {
      const altUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanTitle + (searchYear ? " " + searchYear : ""))}&utf8=&format=json&origin=*`;
      const altRes = await fetch(altUrl);
      if (altRes.ok) {
        const altData = await altRes.json();
        hits = altData?.query?.search || [];
      }
    }
    if (hits.length === 0) return null;

    const topHits = hits.slice(0, 5);
    const pageIds = topHits.map(h => h.pageid).join("|");

    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageprops|extracts&exintro=&explaintext=&format=json&origin=*`;
    const dRes = await fetch(detailUrl);
    if (!dRes.ok) return null;
    const dData = await dRes.json();
    const pages = dData?.query?.pages || {};

    const candidates = [];
    for (const hit of topHits) {
      const page = pages[hit.pageid];
      if (!page) continue;
      let displayTitle = page.title.replace(/\s*\([^)]*\)\s*$/, "").trim();

      let year = "";
      const titleYearMatch = page.title.match(/\b(19\d\d|20\d\d)\b/);
      if (titleYearMatch) {
        year = titleYearMatch[1];
      } else if (searchYear && /^\d{4}$/.test(searchYear)) {
        year = searchYear;
      } else if (page.extract) {
        const extYear = page.extract.match(/\b(19\d\d|20\d\d)\b/);
        if (extYear) year = extYear[1];
      }

      let posterUrl = null;
      const imgFileName = page.pageprops?.page_image_free || page.pageprops?.page_image;
      if (imgFileName) {
        try {
          const imgInfoUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(imgFileName)}&prop=imageinfo&iiprop=url&iiurlwidth=600&format=json&origin=*`;
          const imgRes = await fetch(imgInfoUrl);
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            const imgPages = imgData?.query?.pages;
            if (imgPages) {
              const firstImgKey = Object.keys(imgPages)[0];
              const ii = imgPages[firstImgKey]?.imageinfo?.[0];
              posterUrl = ii?.thumburl || ii?.url || null;
            }
          }
        } catch (e) {
          console.warn("Wikipedia image error:", e);
        }
      }

      const isSeriesDetected = isSeries || /\b(TV series|television series)\b/i.test(page.title) || /\b(TV series|television series)\b/i.test(page.extract || "");

      candidates.push({
        title: displayTitle,
        year: year,
        posterUrl: posterUrl,
        source: "Wikipedia",
        isSeries: isSeriesDetected
      });
    }

    if (candidates.length === 0) return null;

    if (searchYear) {
      const exact = candidates.find(c => c.year === searchYear);
      if (exact) {
        exact._candidates = candidates;
        return exact;
      }
    }

    candidates[0]._candidates = candidates;
    return candidates[0];
  } catch (e) {
    console.warn("Wikipedia fetch error:", e);
    return null;
  }
}

async function fetchOnlineMediaInfo(rawTitle, isSeries, rawStem, searchYear = "") {
  if (!state.globalSettings.naming?.metadataEnabled) return null;

  // Clean rawTitle for search: remove dots, underscores, brackets
  const searchTitle = rawTitle.replace(/[\[\]\(\)\-_.]/g, " ").replace(/\s+/g, " ").trim();
  if (!searchTitle || searchTitle.length < 2) return null;

  const pref = state.globalSettings.naming?.animeTitlePref || "english";
  const apiKey = state.globalSettings.naming?.tmdbApiKey || "";
  const cacheKey = `${searchTitle.toLowerCase()}_${isSeries ? 's' : 'm'}_${searchYear}_${pref}`;

  if (state.metadataCache[cacheKey]) {
    return state.metadataCache[cacheKey];
  }

  // Detect if likely anime
  const isLikelyAnime = /subsplease|erai-raws|horriblesubs|judas|asw|ember|tokyo|charlotte|naruto|bleach|one piece|jujutsu|kimetsu|shingeki|hero academia|chainsaw|frieren|dandadan/i.test(rawStem || rawTitle)
    || (!String(rawStem).match(/[Ss]\d{1,2}/) && String(rawStem).match(/(?:^|[ ._\-])(\d{2,3})(?:[ ._\-]|$)/));

  let match = null;
  if (isLikelyAnime) {
    match = await fetchAnimeMetadata(searchTitle, pref);
  }

  if (!match && isSeries) {
    match = await fetchTVmazeMetadata(searchTitle);
  }

  if (!match && apiKey) {
    match = await fetchTmdbMetadata(searchTitle, apiKey);
  }

  // Wikipedia search with isSeries context
  if (!match) {
    match = await fetchWikipediaMovieMetadata(searchTitle, searchYear, isSeries);
  }

  // Fallbacks if not matched yet
  if (!match && !isSeries) {
    match = await fetchTVmazeMetadata(searchTitle);
  }
  if (!match) {
    match = await fetchAnimeMetadata(searchTitle, pref);
  }

  if (match) {
    state.metadataCache[cacheKey] = match;
  }

  return match;
}

async function enrichGroupWithMetadata(g) {
  if (!state.globalSettings.naming?.metadataEnabled) return;
  const initialInfo = parseMediaInfo(g.filename, g, state.videoSettings);
  const meta = await fetchOnlineMediaInfo(initialInfo.cleanTitle, initialInfo.isSeries, g.filename, initialInfo.year);
  if (meta) {
    g.metadata = meta;
    if (state.groups[state.selectedGroupIndex] && state.groups[state.selectedGroupIndex].key === g.key) {
      updateSelectedGroupCoverUI(g);
    }
  }
}

function updateSelectedGroupCoverUI(g) {
  if (!el.mediaCoverContainer || !el.mediaCoverImg || !el.selectedVideoOnlineBadge) return;
  if (g && g.metadata) {
    const sNum = g.season || 1;
    const seasonCover = (g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].posterUrl)
      ? g.metadata.seasons[sNum].posterUrl
      : g.metadata.posterUrl;
    const seasonYear = (g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].year)
      ? g.metadata.seasons[sNum].year
      : (g.metadata.year || "");

    if (seasonCover) {
      el.mediaCoverImg.src = seasonCover;
      el.mediaCoverContainer.style.display = "block";
      el.selectedVideoOnlineBadge.style.display = "inline-flex";
      el.selectedVideoOnlineBadge.textContent = `${g.metadata.source}${seasonYear ? ` (${seasonYear})` : ""}${g.season ? ` · S${g.season}` : ""}`;
      return;
    }
  }
  el.mediaCoverContainer.style.display = "none";
  el.selectedVideoOnlineBadge.style.display = "none";
}

// -------------------------------------------------------------
// Interactive Metadata & Cover Preview Modal
// -------------------------------------------------------------
let currentPreviewMeta = null;
let metaModalContext = { mode: "workflow", quickIndex: -1 };

function setupMetadataModal() {
  if (el.btnOpenIdentifyModal) {
    el.btnOpenIdentifyModal.addEventListener("click", openMetadataModal);
  }
  if (el.btnClearTrackNames) {
    el.btnClearTrackNames.addEventListener("click", async () => {
      if (!state.groups || state.groups.length === 0) return;
      const curGroup = state.groups[state.selectedGroupIndex];
      let targetGroups = [curGroup];

      if (state.groups.length > 1) {
        const ok = await showConfirmDialog({
          title: t("btn_clear_track_names"),
          message: t("confirm_clear_tracks_msg"),
          confirmText: t("btn_clear_all_files"),
          cancelText: t("btn_clear_current_only"),
          isDanger: false,
          icon: "✏️"
        });
        if (ok) {
          targetGroups = state.groups;
        }
      }

      targetGroups.forEach(g => {
        if (g && g.tracks) {
          g.tracks.forEach(t => {
            if (t.kind === "video" || t.kind === "audio") {
              t.name = "";
            }
          });
        }
      });

      if (curGroup) {
        renderTracksTable(curGroup);
      }
    });
  }
  if (el.mediaCoverContainer) {
    el.mediaCoverContainer.addEventListener("click", openMetadataModal);
  }
  if (el.btnCloseMetadataModal) {
    el.btnCloseMetadataModal.addEventListener("click", () => el.metadataModal.classList.remove("open"));
  }
  if (el.btnCancelMetaModal) {
    el.btnCancelMetaModal.addEventListener("click", () => el.metadataModal.classList.remove("open"));
  }

  if (el.btnExecuteMetaSearch) {
    el.btnExecuteMetaSearch.addEventListener("click", executeManualMetaSearch);
  }

  const handlePickCustomCover = async () => {
    try {
      const filePath = await invoke("pick_image_file");
      if (!filePath) return;
      const dataUrl = await invoke("read_image_data_url", { path: filePath });
      if (!dataUrl) return;

      const target = (metaModalContext.mode === "quick")
        ? state.quickToolsFiles[metaModalContext.quickIndex]
        : state.groups[state.selectedGroupIndex];
      const initialInfo = target ? parseMediaInfo(target.filename, target, state.videoSettings) : {};
      const curTitle = (el.metaResultTitleInput && el.metaResultTitleInput.value.trim()) 
        || (target ? (target.show || target.key || initialInfo.cleanTitle || target.filename) : "");
      const curYear = (el.metaResultYearInput && el.metaResultYearInput.value.trim()) 
        || (target && target.year ? String(target.year) : (initialInfo.year || ""));

      currentPreviewMeta = {
        title: curTitle,
        year: curYear,
        posterUrl: dataUrl,
        localPosterPath: filePath,
        source: "Custom (PC)",
        isSeries: target ? (!!target.show || !!initialInfo.isSeries) : false
      };

      if (el.metaResultPoster) el.metaResultPoster.src = dataUrl;
      if (el.metaResultSourceBadge) el.metaResultSourceBadge.textContent = "Custom (PC)";
      if (el.metaResultYearBadge) el.metaResultYearBadge.textContent = curYear ? `Year ${curYear}` : "Custom Image";
      if (el.metaResultTitleInput) el.metaResultTitleInput.value = curTitle;
      if (el.metaResultYearInput) el.metaResultYearInput.value = curYear;
      if (el.metaResultCard) el.metaResultCard.style.display = "block";

      updateModalOutputPreview();
    } catch (err) {
      console.error("Custom cover pick error:", err);
    }
  };

  if (el.btnPickCustomCover) el.btnPickCustomCover.addEventListener("click", handlePickCustomCover);
  if (el.btnPickCustomCoverPoster) el.btnPickCustomCoverPoster.addEventListener("click", handlePickCustomCover);

  if (el.metaSearchInput) {
    el.metaSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeManualMetaSearch();
      }
    });
  }
  if (el.metaSearchYearInput) {
    el.metaSearchYearInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeManualMetaSearch();
      }
    });
  }

  // Live preview updates when editing title or year in modal
  const updateModalOutputPreview = () => {
    const target = (metaModalContext.mode === "quick")
      ? state.quickToolsFiles[metaModalContext.quickIndex]
      : state.groups[state.selectedGroupIndex];
    if (!target) return;
    const tempMeta = {
      title: el.metaResultTitleInput ? el.metaResultTitleInput.value.trim() : "",
      year: el.metaResultYearInput ? el.metaResultYearInput.value.trim() : "",
      isSeries: currentPreviewMeta ? currentPreviewMeta.isSeries : (target.metadata ? target.metadata.isSeries : undefined),
      seasons: currentPreviewMeta ? currentPreviewMeta.seasons : (target.metadata ? target.metadata.seasons : undefined)
    };
    const info = parseMediaInfo(target.filename, { ...target, metadata: tempMeta }, state.videoSettings);
    const namingCfg = state.globalSettings.naming || {};
    const pattern = info.isSeries ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}") : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
    const outName = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";
    if (el.metaResultOutputPreview) el.metaResultOutputPreview.textContent = outName;
  };

  if (el.metaResultTitleInput) el.metaResultTitleInput.addEventListener("input", updateModalOutputPreview);
  if (el.metaResultYearInput) el.metaResultYearInput.addEventListener("input", updateModalOutputPreview);

  // Apply to this video
  if (el.btnApplyMetaThisVideo) {
    el.btnApplyMetaThisVideo.addEventListener("click", async () => {
      if (metaModalContext.mode === "quick") {
        const item = state.quickToolsFiles[metaModalContext.quickIndex];
        if (!item) return;

        const newTitle = el.metaResultTitleInput ? el.metaResultTitleInput.value.trim() : "";
        const newYear = el.metaResultYearInput ? el.metaResultYearInput.value.trim() : "";

        item.coverUrl = currentPreviewMeta ? currentPreviewMeta.posterUrl : null;
        item.coverPath = currentPreviewMeta ? currentPreviewMeta.localPosterPath : null;
        item.matchedSource = currentPreviewMeta ? (currentPreviewMeta.source || "Manual") : "Manual";

        if (currentPreviewMeta && currentPreviewMeta.posterUrl) {
          if (currentPreviewMeta.posterUrl.startsWith("data:")) {
            item.coverDataUrl = currentPreviewMeta.posterUrl;
          } else if (item.coverPath) {
            try {
              item.coverDataUrl = await invoke("read_image_data_url", { path: item.coverPath });
            } catch (_) {}
          } else {
            // Online URL - trigger download & convert to dataUrl
            const safeKey = (item.filename || "item").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 20);
            invoke("download_cover_image", { key: `quick_${safeKey}`, url: currentPreviewMeta.posterUrl })
              .then(localP => {
                if (localP) {
                  item.coverPath = localP;
                  return invoke("read_image_data_url", { path: localP });
                }
              })
              .then(dataUrl => {
                if (dataUrl) {
                  item.coverDataUrl = dataUrl;
                  renderQuickToolsStage();
                }
              })
              .catch(e => console.warn("Cover download error:", e));
          }
        } else {
          item.coverDataUrl = null;
        }

        // Recompute proposed name based on new title / year
        const info = parseMediaInfo(item.filename, { metadata: { title: newTitle, year: newYear } }, state.videoSettings);
        const namingCfg = state.globalSettings.naming || {};
        const pattern = info.isSeries
          ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
          : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
        item.proposedName = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";

        renderQuickToolsStage();
        el.metadataModal.classList.remove("open");
        return;
      }

      const curGroup = state.groups[state.selectedGroupIndex];
      if (!curGroup) return;
      curGroup.metadata = {
        title: el.metaResultTitleInput.value.trim(),
        year: el.metaResultYearInput.value.trim(),
        posterUrl: currentPreviewMeta ? currentPreviewMeta.posterUrl : null,
        localPosterPath: currentPreviewMeta ? currentPreviewMeta.localPosterPath : null,
        source: currentPreviewMeta ? currentPreviewMeta.source : "Manual",
        isSeries: currentPreviewMeta ? currentPreviewMeta.isSeries : undefined,
        seasons: currentPreviewMeta ? currentPreviewMeta.seasons : undefined
      };
      updateSelectedGroupCoverUI(curGroup);
      el.metadataModal.classList.remove("open");
      if (state.currentStep === 3) renderExportStage();
    });
  }

  // Apply to all episodes of this show
  if (el.btnApplyMetaAllEpisodes) {
    el.btnApplyMetaAllEpisodes.addEventListener("click", () => {
      const curGroup = state.groups[state.selectedGroupIndex];
      if (!curGroup) return;
      const meta = {
        title: el.metaResultTitleInput.value.trim(),
        year: el.metaResultYearInput.value.trim(),
        posterUrl: currentPreviewMeta ? currentPreviewMeta.posterUrl : null,
        localPosterPath: currentPreviewMeta ? currentPreviewMeta.localPosterPath : null,
        source: currentPreviewMeta ? currentPreviewMeta.source : "Manual",
        isSeries: currentPreviewMeta ? currentPreviewMeta.isSeries : undefined,
        seasons: currentPreviewMeta ? currentPreviewMeta.seasons : undefined
      };
      state.groups.forEach(g => {
        if (state.groups.length === 1 || g.show === curGroup.show || g.key.split(' S0')[0] === curGroup.key.split(' S0')[0]) {
          g.metadata = { ...meta };
        }
      });
      updateSelectedGroupCoverUI(curGroup);
      el.metadataModal.classList.remove("open");
      if (state.currentStep === 3) renderExportStage();
    });
  }

  // Clear metadata
  if (el.btnClearMediaInfo) {
    el.btnClearMediaInfo.addEventListener("click", () => {
      if (metaModalContext.mode === "quick") {
        const item = state.quickToolsFiles[metaModalContext.quickIndex];
        if (!item) return;
        item.coverUrl = null;
        item.coverPath = null;
        item.coverDataUrl = null;
        item.matchedSource = null;
        const initialInfo = parseMediaInfo(item.filename, {}, state.videoSettings);
        const namingCfg = state.globalSettings.naming || {};
        const pattern = initialInfo.isSeries
          ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
          : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
        item.proposedName = formatFilename(pattern, initialInfo, namingCfg.tag || "yasinoss") + ".mkv";
        renderQuickToolsStage();
        el.metadataModal.classList.remove("open");
        return;
      }

      const curGroup = state.groups[state.selectedGroupIndex];
      if (!curGroup) return;
      curGroup.metadata = null;
      updateSelectedGroupCoverUI(curGroup);
      el.metadataModal.classList.remove("open");
      if (state.currentStep === 3) renderExportStage();
    });
  }
}

function openMetadataModal() {
  const curGroup = state.groups[state.selectedGroupIndex];
  if (!curGroup) return;
  metaModalContext = { mode: "workflow", quickIndex: -1 };

  if (el.btnApplyMetaAllEpisodes) {
    el.btnApplyMetaAllEpisodes.style.display = (curGroup.show || state.groups.length > 1) ? "inline-flex" : "none";
  }

  const initialInfo = parseMediaInfo(curGroup.filename, curGroup, state.videoSettings);
  const currentTitle = (curGroup.metadata && curGroup.metadata.title) ? curGroup.metadata.title : initialInfo.cleanTitle;
  const currentYear = (curGroup.metadata && curGroup.metadata.year) ? curGroup.metadata.year : (initialInfo.year || "");
  
  if (el.metaSearchInput) el.metaSearchInput.value = currentTitle;
  if (el.metaSearchYearInput) el.metaSearchYearInput.value = currentYear;
  if (el.metaCandidatesContainer) el.metaCandidatesContainer.style.display = "none";

  if (curGroup.metadata) {
    currentPreviewMeta = { ...curGroup.metadata };
    displayMetaResult(currentPreviewMeta, curGroup);
  } else {
    executeManualMetaSearch();
  }

  el.metadataModal.classList.add("open");
}

function openQuickMetadataModal(idx) {
  if (!state.quickToolsFiles || !state.quickToolsFiles[idx]) return;
  const item = state.quickToolsFiles[idx];
  metaModalContext = { mode: "quick", quickIndex: idx };

  if (el.btnApplyMetaAllEpisodes) {
    el.btnApplyMetaAllEpisodes.style.display = "none";
  }

  const initialInfo = parseMediaInfo(item.filename, {}, state.videoSettings);
  const currentTitle = initialInfo.cleanTitle || item.filename.replace(/\.[^/.]+$/, "");
  const currentYear = initialInfo.year || "";

  if (el.metaSearchInput) el.metaSearchInput.value = currentTitle;
  if (el.metaSearchYearInput) el.metaSearchYearInput.value = currentYear;
  if (el.metaCandidatesContainer) el.metaCandidatesContainer.style.display = "none";

  if (item.coverDataUrl || item.coverPath || item.coverUrl) {
    currentPreviewMeta = {
      title: currentTitle,
      year: currentYear,
      posterUrl: item.coverDataUrl || item.coverUrl,
      localPosterPath: item.coverPath,
      source: item.matchedSource || "Current Cover",
      isSeries: initialInfo.isSeries
    };
    displayMetaResult(currentPreviewMeta, item);
  } else {
    executeManualMetaSearch();
  }

  el.metadataModal.classList.add("open");
}

async function executeManualMetaSearch() {
  const target = (metaModalContext.mode === "quick")
    ? state.quickToolsFiles[metaModalContext.quickIndex]
    : state.groups[state.selectedGroupIndex];
  if (!target) return;

  const query = el.metaSearchInput ? el.metaSearchInput.value.trim() : "";
  const searchYear = el.metaSearchYearInput ? el.metaSearchYearInput.value.trim() : "";
  if (!query) return;

  const providerRadio = document.querySelector('input[name="metaProvider"]:checked');
  const provider = providerRadio ? providerRadio.value : "auto";

  if (el.metaStatusIndicator) {
    el.metaStatusIndicator.style.display = "block";
    el.metaStatusIndicator.textContent = `⏳ Searching online for "${query}"${searchYear ? ` (${searchYear})` : ""}...`;
  }
  if (el.metaResultCard) el.metaResultCard.style.display = "none";
  if (el.metaCandidatesContainer) el.metaCandidatesContainer.style.display = "none";

  const initialInfo = parseMediaInfo(target.filename, target, state.videoSettings);
  let result = null;

  try {
    const pref = state.globalSettings.naming?.animeTitlePref || "english";
    const apiKey = state.globalSettings.naming?.tmdbApiKey || "";

    if (provider === "anilist") {
      result = await fetchAnimeMetadata(query, pref);
    } else if (provider === "tvmaze") {
      result = await fetchTVmazeMetadata(query);
    } else if (provider === "wikipedia") {
      result = await fetchWikipediaMovieMetadata(query, searchYear);
    } else if (provider === "tmdb") {
      result = await fetchTmdbMetadata(query, apiKey);
    } else {
      result = await fetchOnlineMediaInfo(query, initialInfo.isSeries, target.filename, searchYear);
    }
  } catch (err) {
    console.warn("Search error:", err);
  }

  if (el.metaStatusIndicator) el.metaStatusIndicator.style.display = "none";

  if (result) {
    currentPreviewMeta = result;
    displayMetaResult(result, target);

    if (result._candidates && result._candidates.length > 1) {
      renderCandidatesSelector(result._candidates, target);
    }
  } else {
    if (el.metaStatusIndicator) {
      el.metaStatusIndicator.style.display = "block";
      el.metaStatusIndicator.textContent = `❌ No results found for "${query}"${searchYear ? ` (${searchYear})` : ""}. Try refining the title or year.`;
    }
  }
}

function renderCandidatesSelector(candidates, curGroup) {
  if (!el.metaCandidatesContainer || !el.metaCandidatesList) return;
  el.metaCandidatesList.innerHTML = "";

  if (!candidates || candidates.length === 0) {
    el.metaCandidatesContainer.style.display = "none";
    return;
  }

  candidates.forEach((cand, idx) => {
    const card = document.createElement("div");
    card.className = "meta-gallery-card" + (idx === 0 ? " selected" : "");

    const posterHtml = cand.posterUrl
      ? `<img src="${cand.posterUrl}" class="gallery-poster-img" alt="${cand.title}" loading="lazy" />`
      : `<div class="gallery-no-img"><span>🎬</span><span style="margin-top:4px;">No Poster</span></div>`;

    card.innerHTML = `
      <div class="gallery-poster-wrap">
        ${posterHtml}
        <span class="gallery-selected-badge">✓ SELECTED</span>
      </div>
      <div class="gallery-info-wrap">
        <div class="gallery-title" title="${cand.title}">${cand.title}</div>
        <div class="gallery-meta-row">
          ${cand.year ? `<span class="gallery-year-badge">${cand.year}</span>` : `<span></span>`}
          <span class="gallery-source-pill">${cand.source || "Online"}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      el.metaCandidatesList.querySelectorAll(".meta-gallery-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      currentPreviewMeta = cand;
      displayMetaResult(cand, curGroup);
    });

    el.metaCandidatesList.appendChild(card);
  });

  el.metaCandidatesContainer.style.display = "block";
}

function displayMetaResult(result, group) {
  if (!result || !el.metaResultCard) return;

  const sNum = (group && typeof group.season === "number") ? group.season : null;
  const seasonPoster = (sNum && result.seasons && result.seasons[sNum] && result.seasons[sNum].posterUrl)
    ? result.seasons[sNum].posterUrl
    : (result.posterUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='150' fill='%23333'%3E%3Crect width='100%25' height='100%25'/%3E%3Ctext x='50%25' y='50%25' fill='%23666' dominant-baseline='middle' text-anchor='middle' font-size='12'%3ENo Cover%3C/text%3E%3C/svg%3E");

  const seasonYear = (sNum && result.seasons && result.seasons[sNum] && result.seasons[sNum].year)
    ? result.seasons[sNum].year
    : (result.year || "");

  if (el.metaResultPoster) {
    el.metaResultPoster.src = seasonPoster;
  }

  if (el.metaResultSourceBadge) {
    el.metaResultSourceBadge.textContent = result.source || "Online";
  }
  if (el.metaResultYearBadge) {
    el.metaResultYearBadge.textContent = seasonYear ? (sNum ? `Season ${sNum} (${seasonYear})` : `Year ${seasonYear}`) : "Unknown Year";
  }

  if (el.metaResultTitleInput) el.metaResultTitleInput.value = result.title || "";
  if (el.metaResultYearInput) el.metaResultYearInput.value = seasonYear;

  // Output preview
  const info = parseMediaInfo(group ? group.filename : "", { ...(group || {}), metadata: result }, state.videoSettings);
  const namingCfg = state.globalSettings.naming || {};
  const pattern = info.isSeries ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}") : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
  const outName = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";

  if (el.metaResultOutputPreview) el.metaResultOutputPreview.textContent = outName;

  el.metaResultCard.style.display = "block";
}

// -------------------------------------------------------------
// Settings Modal with Tabs
// -------------------------------------------------------------
function setupSettingsModal() {
  if (el.settingsTabs) {
    el.settingsTabs.querySelectorAll(".modal-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        el.settingsTabs.querySelectorAll(".modal-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        document.querySelectorAll(".settings-tab-pane").forEach(pane => {
          pane.classList.toggle("active", pane.id === targetTab);
        });

        if (targetTab === "tabNaming") {
          updateNamingLivePreview();
        }
      });
    });
  }

  if (el.vCfgCodec) {
    el.vCfgCodec.addEventListener("change", () => {
      if (el.vCfgCodec.value.includes("h264") || el.vCfgCodec.value.includes("264")) {
        if (el.vCfgPixFmt && el.vCfgPixFmt.value === "p010le") {
          el.vCfgPixFmt.value = "yuv420p";
          state.videoSettings.pixFmt = "yuv420p";
        }
      }
      updateRateControlUI();
    });
  }

  // Clickable variable badge pills under Naming Settings patterns
  document.querySelectorAll(".pattern-pills .chip").forEach(chip => {
    chip.addEventListener("mousedown", (e) => {
      // Prevent focus loss so cursor position in pattern input remains intact
      e.preventDefault();
    });

    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const tag = chip.getAttribute("data-tag") || chip.textContent.trim();
      if (!tag) return;
      const pillsContainer = chip.closest(".pattern-pills");
      const targetId = pillsContainer ? pillsContainer.getAttribute("data-target") : null;
      let targetInput = targetId ? document.getElementById(targetId) : null;
      if (!targetInput) {
        const group = chip.closest(".control-group") || chip.closest(".form-group");
        if (group) targetInput = group.querySelector("input[type='text']");
      }
      if (targetInput) {
        let start = targetInput.selectionStart;
        let end = targetInput.selectionEnd;
        if (start === null || start === undefined || (start === 0 && end === 0 && document.activeElement !== targetInput)) {
          start = targetInput.value.length;
          end = targetInput.value.length;
        }
        const current = targetInput.value;
        targetInput.value = current.substring(0, start) + tag + current.substring(end);
        targetInput.focus();
        const newPos = start + tag.length;
        targetInput.setSelectionRange(newPos, newPos);
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
        updateNamingLivePreview();
      }
    });
  });
  if (el.vCfgRateControl) {
    el.vCfgRateControl.addEventListener("change", updateRateControlUI);
  }

  // Live input events to keep state.videoSettings and state.audioSettings in sync instantly
  const liveSyncModalToState = () => {
    if (el.vCfgResolution) state.videoSettings.resolution = el.vCfgResolution.value;
    if (el.vCfgCodec) state.videoSettings.codec = el.vCfgCodec.value;
    if (el.vCfgRateControl) state.videoSettings.rateControl = el.vCfgRateControl.value;
    if (el.vCfgQualityVal && el.vCfgQualityVal.value) state.videoSettings.qualityVal = el.vCfgQualityVal.value;
    if (el.vCfgPreset) state.videoSettings.preset = el.vCfgPreset.value;
    if (el.vCfgTune) state.videoSettings.tune = el.vCfgTune.value;
    if (el.vCfgPixFmt) state.videoSettings.pixFmt = el.vCfgPixFmt.value;
    if (el.vCfgMultipass) state.videoSettings.multipass = el.vCfgMultipass.value;
    if (el.vCfgProfile) state.videoSettings.profile = el.vCfgProfile.value;
    if (el.vCfgLevel) state.videoSettings.level = el.vCfgLevel.value;
    if (el.vCfgAq) state.videoSettings.aq = el.vCfgAq.value;

    if (el.aCfgCodec) state.audioSettings.codec = el.aCfgCodec.value;
    if (el.aCfgChannels) state.audioSettings.channels = el.aCfgChannels.value;
    if (el.aCfgBitrate) state.audioSettings.bitrate = el.aCfgBitrate.value;
    if (el.aCfgSampleRate) state.audioSettings.sampleRate = el.aCfgSampleRate.value;
  };

  [
    el.vCfgResolution, el.vCfgCodec, el.vCfgRateControl, el.vCfgQualityVal, el.vCfgPreset, el.vCfgTune, el.vCfgPixFmt,
    el.vCfgMultipass, el.vCfgProfile, el.vCfgLevel, el.vCfgAq,
    el.aCfgCodec, el.aCfgChannels, el.aCfgBitrate, el.aCfgSampleRate
  ].forEach(input => {
    if (input) {
      input.addEventListener("change", liveSyncModalToState);
      if (input.tagName === "INPUT") input.addEventListener("input", liveSyncModalToState);
    }
  });

  // Live input events for naming preview
  const previewUpdater = () => updateNamingLivePreview();
  if (el.settingNamingEnabled) el.settingNamingEnabled.addEventListener("change", previewUpdater);
  if (el.settingNamingTag) el.settingNamingTag.addEventListener("input", previewUpdater);
  if (el.settingNamingSeriesPattern) el.settingNamingSeriesPattern.addEventListener("input", previewUpdater);
  if (el.settingNamingMoviePattern) el.settingNamingMoviePattern.addEventListener("input", previewUpdater);

  let modalBackupTheme = state.theme;
  let modalBackupAccent = state.accent;

  // Live View preview on Theme / Accent dropdown change (Without saving until 'Save Settings' is clicked)
  const applyLiveThemePreview = () => {
    const liveTheme = el.settingTheme ? el.settingTheme.value : modalBackupTheme;
    const liveAccent = el.settingAccent ? el.settingAccent.value : modalBackupAccent;
    el.html.setAttribute("data-theme", liveTheme);
    el.html.setAttribute("data-accent", liveAccent);
  };
  if (el.settingTheme) el.settingTheme.addEventListener("change", applyLiveThemePreview);
  if (el.settingAccent) el.settingAccent.addEventListener("change", applyLiveThemePreview);

  const cancelAndCloseSettings = () => {
    // Revert Live Preview back to persisted saved settings
    applyTheme(modalBackupTheme, modalBackupAccent);
    if (el.settingTheme) el.settingTheme.value = modalBackupTheme;
    if (el.settingAccent) el.settingAccent.value = modalBackupAccent;
    el.settingsModal.classList.remove("open");
  };

  if (el.btnSettings) {
    el.btnSettings.addEventListener("click", () => {
      modalBackupTheme = state.theme;
      modalBackupAccent = state.accent;

      // Populate fields from current state
      if (el.settingAppLanguage) el.settingAppLanguage.value = state.globalSettings.language || "en";
      if (el.settingTheme) el.settingTheme.value = state.theme;
      if (el.settingAccent) el.settingAccent.value = state.accent;
      if (el.settingDefAudio) el.settingDefAudio.value = state.globalSettings.defAudioLang;
      if (el.settingDefSub) el.settingDefSub.value = state.globalSettings.defSubLang;
      if (el.settingClearTrackNames) el.settingClearTrackNames.checked = (state.globalSettings.clearTrackNames !== false);

      // Populate naming settings
      const namingCfg = state.globalSettings.naming || {
        enabled: true,
        tag: "yasinoss",
        seriesPattern: "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
        moviePattern: "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}"
      };
      if (el.settingNamingEnabled) el.settingNamingEnabled.checked = (namingCfg.enabled !== false);
      if (el.settingNamingTag) el.settingNamingTag.value = namingCfg.tag || "yasinoss";
      if (el.settingNamingSeriesPattern) el.settingNamingSeriesPattern.value = namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      if (el.settingNamingMoviePattern) el.settingNamingMoviePattern.value = namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      if (el.settingMetadataEnabled) el.settingMetadataEnabled.checked = (namingCfg.metadataEnabled !== false);
      if (el.settingAnimeTitlePref) el.settingAnimeTitlePref.value = namingCfg.animeTitlePref || "english";
      if (el.settingEmbedCover) el.settingEmbedCover.checked = (namingCfg.embedCover !== false);
      if (el.settingTmdbApiKey) el.settingTmdbApiKey.value = namingCfg.tmdbApiKey || "";
      updateNamingLivePreview();

      if (el.vCfgResolution) el.vCfgResolution.value = state.videoSettings.resolution;
      if (el.vCfgCodec) el.vCfgCodec.value = state.videoSettings.codec;
      if (el.vCfgRateControl) el.vCfgRateControl.value = state.videoSettings.rateControl;
      if (el.vCfgQualityVal) el.vCfgQualityVal.value = state.videoSettings.qualityVal;
      if (el.vCfgPreset) el.vCfgPreset.value = state.videoSettings.preset;
      if (el.vCfgTune) el.vCfgTune.value = state.videoSettings.tune;
      if (el.vCfgPixFmt) el.vCfgPixFmt.value = state.videoSettings.pixFmt;
      if (el.vCfgMultipass) el.vCfgMultipass.value = state.videoSettings.multipass || "disabled";
      if (el.vCfgProfile) el.vCfgProfile.value = state.videoSettings.profile || "auto";
      if (el.vCfgLevel) el.vCfgLevel.value = state.videoSettings.level || "auto";
      if (el.vCfgAq) el.vCfgAq.value = state.videoSettings.aq || "enabled";

      if (el.aCfgCodec) el.aCfgCodec.value = state.audioSettings.codec;
      if (el.aCfgChannels) el.aCfgChannels.value = state.audioSettings.channels;
      if (el.aCfgBitrate) el.aCfgBitrate.value = state.audioSettings.bitrate;
      if (el.aCfgSampleRate) el.aCfgSampleRate.value = state.audioSettings.sampleRate;

      updateRateControlUI();
      el.settingsModal.classList.add("open");
    });
  }

  if (el.btnCloseSettings) {
    el.btnCloseSettings.addEventListener("click", cancelAndCloseSettings);
  }

  if (el.settingsModal) {
    el.settingsModal.addEventListener("click", (e) => {
      if (e.target === el.settingsModal) {
        cancelAndCloseSettings();
      }
    });
  }

  if (el.btnSaveSettings) {
    el.btnSaveSettings.addEventListener("click", async () => {
      state.theme = el.settingTheme.value;
      state.accent = el.settingAccent.value;
      modalBackupTheme = state.theme;
      modalBackupAccent = state.accent;

      state.globalSettings.theme = state.theme;
      state.globalSettings.accent = state.accent;
      if (el.settingAppLanguage) {
        state.globalSettings.language = el.settingAppLanguage.value;
        applyLanguage(el.settingAppLanguage.value);
      }
      state.globalSettings.defAudioLang = el.settingDefAudio.value;
      state.globalSettings.defSubLang = el.settingDefSub.value;
      state.globalSettings.clearTrackNames = el.settingClearTrackNames ? el.settingClearTrackNames.checked : true;

      state.globalSettings.naming = {
        enabled: el.settingNamingEnabled ? el.settingNamingEnabled.checked : true,
        tag: el.settingNamingTag ? el.settingNamingTag.value.trim() : "yasinoss",
        seriesPattern: el.settingNamingSeriesPattern ? el.settingNamingSeriesPattern.value.trim() : "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
        moviePattern: el.settingNamingMoviePattern ? el.settingNamingMoviePattern.value.trim() : "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
        metadataEnabled: el.settingMetadataEnabled ? el.settingMetadataEnabled.checked : true,
        animeTitlePref: el.settingAnimeTitlePref ? el.settingAnimeTitlePref.value : "english",
        embedCover: el.settingEmbedCover ? el.settingEmbedCover.checked : true,
        tmdbApiKey: el.settingTmdbApiKey ? el.settingTmdbApiKey.value.trim() : ""
      };
      if (el.chkEmbedCover) el.chkEmbedCover.checked = state.globalSettings.naming.embedCover;

      state.videoSettings = {
        resolution: el.vCfgResolution.value,
        codec: el.vCfgCodec.value,
        rateControl: el.vCfgRateControl.value,
        qualityVal: el.vCfgQualityVal.value || (el.vCfgRateControl.value === "cqp" ? "22" : "6000"),
        preset: el.vCfgPreset.value,
        tune: el.vCfgTune.value,
        pixFmt: el.vCfgPixFmt.value,
        multipass: el.vCfgMultipass ? el.vCfgMultipass.value : "disabled",
        profile: el.vCfgProfile ? el.vCfgProfile.value : "auto",
        level: el.vCfgLevel ? el.vCfgLevel.value : "auto",
        aq: el.vCfgAq ? el.vCfgAq.value : "enabled"
      };

      state.audioSettings = {
        codec: el.aCfgCodec.value,
        channels: el.aCfgChannels.value,
        bitrate: el.aCfgBitrate.value,
        sampleRate: el.aCfgSampleRate.value
      };

      applyTheme(state.theme, state.accent);
      await persistAllSettings();
      el.settingsModal.classList.remove("open");
      applyQuickSettingsToAll();
      if (state.currentStep === 3) {
        renderExportStage();
      }
    });
  }

  if (el.btnResetSettings) {
    el.btnResetSettings.addEventListener("click", async () => {
      el.settingTheme.value = "dark";
      el.settingAccent.value = "blue";
      applyLiveThemePreview();
      state.videoSettings.rateControl = "cqp";
      state.videoSettings.qualityVal = "22";
      state.globalSettings.defAudioLang = "ara";
      state.globalSettings.defSubLang = "ara";
      state.globalSettings.clearTrackNames = true;
      if (el.settingDefAudio) el.settingDefAudio.value = "ara";
      if (el.settingDefSub) el.settingDefSub.value = "ara";
      if (el.settingClearTrackNames) el.settingClearTrackNames.checked = true;
      state.globalSettings.naming = {
        enabled: true,
        tag: "yasinoss",
        seriesPattern: "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
        moviePattern: "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
        metadataEnabled: true,
        animeTitlePref: "english",
        embedCover: true,
        tmdbApiKey: ""
      };
      if (el.settingNamingEnabled) el.settingNamingEnabled.checked = true;
      if (el.settingNamingTag) el.settingNamingTag.value = "yasinoss";
      if (el.settingNamingSeriesPattern) el.settingNamingSeriesPattern.value = "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      if (el.settingNamingMoviePattern) el.settingNamingMoviePattern.value = "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}";
      if (el.settingMetadataEnabled) el.settingMetadataEnabled.checked = true;
      if (el.settingAnimeTitlePref) el.settingAnimeTitlePref.value = "english";
      if (el.settingEmbedCover) el.settingEmbedCover.checked = true;
      if (el.settingTmdbApiKey) el.settingTmdbApiKey.value = "";
      if (el.chkEmbedCover) el.chkEmbedCover.checked = true;
      updateNamingLivePreview();
      await persistAllSettings();
    });
  }
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
function setupEventListeners() {
  // Handle external links safely via Tauri open_url
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".external-link");
    if (link) {
      e.preventDefault();
      const url = link.getAttribute("data-url") || link.getAttribute("href");
      if (url) {
        invoke("open_url", { url }).catch(err => console.warn("Failed to open URL:", err));
      }
    }
  });

  // App Language Dropdown in Settings
  if (el.settingAppLanguage) {
    el.settingAppLanguage.addEventListener("change", async (e) => {
      const lang = e.target.value;
      state.globalSettings.language = lang;
      applyLanguage(lang);
      await persistAllSettings();
    });
  }

  // Frameless Window Controls
  if (el.btnWinMin) el.btnWinMin.addEventListener("click", () => invoke("minimize_window"));
  if (el.btnWinMax) el.btnWinMax.addEventListener("click", () => invoke("toggle_maximize"));
  if (el.btnWinClose) el.btnWinClose.addEventListener("click", () => invoke("close_window"));

  // Stepper Click
  if (el.stepper) {
    el.stepper.querySelectorAll(".step-item").forEach(item => {
      item.addEventListener("click", () => {
        const step = parseInt(item.getAttribute("data-step"));
        if (step === 1 || (step === 2 && state.groups.length > 0) || (step === 3 && state.groups.length > 0)) {
          goToStep(step);
        }
      });
    });
  }

  // Opposite Side Quick Tools Nav Button
  if (el.btnNavQuickTools) {
    el.btnNavQuickTools.addEventListener("click", () => {
      goToStep(4);
    });
  }

  // Quick Tools Action Buttons
  if (el.btnQuickAddFiles) {
    el.btnQuickAddFiles.addEventListener("click", async () => {
      try {
        const paths = await invoke("pick_files");
        if (paths && paths.length > 0) {
          await processQuickToolsPaths(paths);
        }
      } catch (err) {
        console.warn(err);
      }
    });
  }

  if (el.btnQuickEmptyImportExisting) {
    el.btnQuickEmptyImportExisting.addEventListener("click", () => {
      populateQuickToolsFromWorkflow();
    });
  }

  if (el.btnQuickBatchRename) {
    el.btnQuickBatchRename.addEventListener("click", () => applyQuickBatch("rename"));
  }

  if (el.btnQuickBatchCover) {
    el.btnQuickBatchCover.addEventListener("click", () => applyQuickBatch("cover"));
  }

  if (el.btnQuickClearAll) {
    el.btnQuickClearAll.addEventListener("click", async () => {
      if (state.quickToolsFiles.length === 0) return;
      const ok = await showConfirmDialog({
        title: t("lbl_quick_clear_all"),
        message: "Are you sure you want to clear all files from Instant Tools?",
        confirmText: t("btn_clear_all"),
        cancelText: t("btn_cancel"),
        isDanger: true,
        icon: "🗑️"
      });
      if (ok) {
        state.quickToolsFiles = [];
        renderQuickToolsStage();
      }
    });
  }

  // Native File & Folder Dialogs
  if (el.btnAddFiles) {
    el.btnAddFiles.addEventListener("click", async () => {
      try {
        const paths = await invoke("pick_files");
        if (paths && paths.length > 0) {
          await processScanPaths(paths);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (el.btnAddFolder) {
    el.btnAddFolder.addEventListener("click", async () => {
      try {
        const folder = await invoke("pick_folder");
        if (folder) {
          await processScanPaths([folder]);
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // HTML5 Drag and Drop & Dropzone Click
  if (el.dropzone) {
    el.dropzone.addEventListener("click", (e) => {
      if (e.target.closest("#btnAddFolder") || e.target.closest("#btnAddFiles")) return;
      if (el.btnAddFiles) el.btnAddFiles.click();
    });

    el.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.dropzone.classList.add("dragover");
    });

    el.dropzone.addEventListener("dragleave", () => el.dropzone.classList.remove("dragover"));

    el.dropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.dropzone.classList.remove("dragover");
      const paths = [];
      if (e.dataTransfer && e.dataTransfer.files) {
        for (const f of e.dataTransfer.files) {
          if (f.path) paths.push(f.path);
        }
      }
      if (paths.length > 0) {
        await processScanPaths(paths);
      }
    });
  }

  // Navigation & Single Back Buttons
  if (el.btnNextToReview) el.btnNextToReview.addEventListener("click", () => goToStep(2));
  if (el.btnNextToExport) el.btnNextToExport.addEventListener("click", () => goToStep(3));
  if (el.btnBackToImport) el.btnBackToImport.addEventListener("click", () => goToStep(1));
  if (el.btnBackToReview) el.btnBackToReview.addEventListener("click", () => goToStep(2));

  // Clear All Videos
  if (el.btnClearAllVideos) {
    el.btnClearAllVideos.addEventListener("click", async () => {
      const ok = await showConfirmDialog({
        title: t("confirm_clear_all_title"),
        message: t("confirm_clear_all_msg"),
        confirmText: t("btn_clear_all"),
        cancelText: t("btn_cancel"),
        isDanger: true,
        icon: "🗑️"
      });
      if (ok) {
        state.groups = [];
        state.selectedGroupIndex = 0;
        updateCounters({ videos: 0, audios: 0, subtitles: 0, chapters: 0, groups: 0 });
        if (el.btnNextToReview) el.btnNextToReview.disabled = true;
        goToStep(1);
      }
    });
  }

  // Multi-select Dropdowns Toggle & Outside Click
  if (el.btnKeepAudioTrigger) {
    el.btnKeepAudioTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      el.keepAudioPanel.classList.toggle("open");
      el.keepSubPanel.classList.remove("open");
    });
  }

  if (el.btnKeepSubTrigger) {
    el.btnKeepSubTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      el.keepSubPanel.classList.toggle("open");
      el.keepAudioPanel.classList.remove("open");
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#keepAudioDropdown")) {
      if (el.keepAudioPanel) el.keepAudioPanel.classList.remove("open");
    }
    if (!e.target.closest("#keepSubDropdown")) {
      if (el.keepSubPanel) el.keepSubPanel.classList.remove("open");
    }
  });

  // Select / Deselect All Checkboxes
  if (el.chkKeepAllAudio) {
    el.chkKeepAllAudio.addEventListener("change", (e) => {
      state.quickSettings.userTouchedAudios = true;
      const checked = e.target.checked;
      el.keepAudioOptionsList.querySelectorAll("input[type='checkbox']").forEach(chk => {
        chk.checked = checked;
        if (checked) state.quickSettings.keepAudios.add(chk.value);
        else state.quickSettings.keepAudios.delete(chk.value);
      });
      updateKeepAudioSummary();
      updateDefaultAudioDropdown();
      applyQuickSettingsToAll();
    });
  }

  if (el.chkKeepAllSub) {
    el.chkKeepAllSub.addEventListener("change", (e) => {
      state.quickSettings.userTouchedSubs = true;
      const checked = e.target.checked;
      el.keepSubOptionsList.querySelectorAll("input[type='checkbox']").forEach(chk => {
        chk.checked = checked;
        if (checked) state.quickSettings.keepSubs.add(chk.value);
        else state.quickSettings.keepSubs.delete(chk.value);
      });
      updateKeepSubSummary();
      updateDefaultSubDropdown();
      applyQuickSettingsToAll();
    });
  }

  // Video Preset, Hardsub & Default Track Changes
  if (el.quickPreset) el.quickPreset.addEventListener("change", applyQuickSettingsToAll);
  if (el.quickDefAudio) el.quickDefAudio.addEventListener("change", applyQuickSettingsToAll);
  if (el.quickDefSub) el.quickDefSub.addEventListener("change", applyQuickSettingsToAll);
  if (el.quickBurnSub) {
    el.quickBurnSub.addEventListener("change", () => {
      if (el.quickBurnSub.value !== "none") {
        if (el.quickPreset && el.quickPreset.value === "copy") {
          // Hardsub requires video encoding; cannot be used with Copy preset
          el.quickPreset.value = "default";
        }
      }
      applyQuickSettingsToAll();
    });
  }

  // Output Folder Mode & Browse Listeners
  if (el.exportFolderMode) {
    el.exportFolderMode.addEventListener("change", () => {
      const mode = el.exportFolderMode.value;
      state.exportSettings.folderMode = mode;
      if (el.customFolderRow) {
        el.customFolderRow.style.display = (mode === "custom") ? "block" : "none";
      }
      if (el.btnBrowseOutputFolder) {
        el.btnBrowseOutputFolder.style.display = (mode === "custom") ? "inline-flex" : "none";
      }
      persistAllSettings();
      if (state.currentStep === 3) {
        renderExportStage();
      }
    });
  }

  if (el.btnBrowseOutputFolder) {
    el.btnBrowseOutputFolder.addEventListener("click", async () => {
      const folder = await invoke("pick_folder");
      if (folder) {
        el.exportOutputFolder.value = folder;
        state.exportSettings.folder = folder;
        persistAllSettings();
      }
    });
  }

  if (el.exportOutputFolder) {
    el.exportOutputFolder.addEventListener("change", () => {
      state.exportSettings.folder = el.exportOutputFolder.value;
      persistAllSettings();
    });
  }

  if (el.exportPattern) {
    el.exportPattern.addEventListener("change", () => {
      state.exportSettings.pattern = el.exportPattern.value;
      persistAllSettings();
      if (state.currentStep === 3) {
        renderExportStage();
      }
    });
  }

  if (el.exportIfExists) {
    el.exportIfExists.addEventListener("change", () => {
      state.exportSettings.ifExists = el.exportIfExists.value;
      persistAllSettings();
    });
  }

  if (el.chkDeleteOriginals) {
    el.chkDeleteOriginals.addEventListener("change", () => {
      state.exportSettings.deleteOriginals = el.chkDeleteOriginals.checked;
      persistAllSettings();
    });
  }

  if (el.chkShutdown) {
    el.chkShutdown.addEventListener("change", () => {
      state.exportSettings.shutdown = el.chkShutdown.checked;
      persistAllSettings();
    });
  }

  if (el.btnOpenOutputFolder) {
    el.btnOpenOutputFolder.addEventListener("click", () => {
      const folder = el.exportOutputFolder.value || state.exportSettings.folder;
      if (folder) invoke("open_folder", { path: folder });
    });
  }

  // Stage 2 Group Attachments
  if (el.btnAddAttachmentToGroup) {
    el.btnAddAttachmentToGroup.addEventListener("click", async () => {
      const files = await invoke("pick_attachment_files");
      if (files && files.length > 0 && state.groups[state.selectedGroupIndex]) {
        const g = state.groups[state.selectedGroupIndex];
        for (let idx = 0; idx < files.length; idx++) {
          const p = files[idx];
          const filename = p.split(/[\\/]/).pop();
          const ext = filename.split('.').pop().toLowerCase();
          let kind = "attachment";
          if (["ttf", "otf", "woff", "woff2"].includes(ext)) kind = "font";
          else if (["jpg", "jpeg", "png", "webp", "bmp", "gif"].includes(ext)) kind = "img";
          else if (["srt", "ass", "ssa", "vtt"].includes(ext)) kind = "subtitle";

          let detectedLang = "und";
          if (kind === "subtitle") {
            try {
              const resLang = await invoke("detect_subtitle_language", { path: p });
              if (resLang && resLang !== "und") {
                detectedLang = resLang;
              } else if (state.globalSettings && state.globalSettings.defSubLang && state.globalSettings.defSubLang !== "keep") {
                detectedLang = state.globalSettings.defSubLang;
              }
            } catch (_) {}
          }

          g.tracks.push({
            id: `att_${idx}_${Date.now()}`,
            kind: kind,
            name: filename,
            origin: "external",
            source_path: p,
            source_index: 0,
            codec: ext.toUpperCase(),
            lang: detectedLang,
            is_default: false,
            is_forced: false,
            delay: 0,
            action: "add"
          });
        }

        repopulateDynamicDropdowns();
        selectVideoGroup(state.selectedGroupIndex);
      }
    });
  }

  // Stage 3 Shared Attachments
  if (el.btnAddSharedAttachment) {
    el.btnAddSharedAttachment.addEventListener("click", async () => {
      const files = await invoke("pick_attachment_files");
      if (files && files.length > 0) {
        files.forEach(p => {
          if (!state.sharedAttachments.includes(p)) state.sharedAttachments.push(p);
        });
        renderSharedAttachments();
      }
    });
  }

  if (el.chkRemoveOldAttachments) {
    el.chkRemoveOldAttachments.addEventListener("change", (e) => {
      state.removeOldAttachments = e.target.checked;
    });
  }

  // Queue Controls (Pause, Skip, Cancel)
  if (el.btnQueuePause) {
    el.btnQueuePause.addEventListener("click", async () => {
      if (!state.isQueueRunning) return;
      if (!state.isQueuePaused) {
        state.isQueuePaused = true;
        updatePauseButtonUI(true);
        await invoke("pause_queue");
      } else {
        state.isQueuePaused = false;
        updatePauseButtonUI(false);
        await invoke("resume_queue");
      }
    });
  }

  if (el.btnQueueSkip) {
    el.btnQueueSkip.addEventListener("click", async () => {
      if (!state.isQueueRunning) return;
      await invoke("skip_job");
    });
  }

  if (el.btnQueueCancel) {
    el.btnQueueCancel.addEventListener("click", async () => {
      if (!state.isQueueRunning) return;
      const ok = await showConfirmDialog({
        title: t("confirm_cancel_queue_title"),
        message: t("confirm_cancel_queue_msg"),
        confirmText: t("btn_confirm"),
        cancelText: t("btn_cancel"),
        isDanger: true,
        icon: "⏹️"
      });
      if (ok) {
        resetQueueButtons();
        await invoke("cancel_queue");
      }
    });
  }

  // Queue Start
  if (el.btnStartQueue) el.btnStartQueue.addEventListener("click", startRealQueueProcessing);
}

const SVG_PAUSE = `<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
const SVG_PLAY = `<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;

function updatePauseButtonUI(isPaused) {
  const icon = document.getElementById("iconQueuePause");
  const lbl = document.getElementById("lblQueuePause");
  if (icon) icon.innerHTML = isPaused ? SVG_PLAY : SVG_PAUSE;
  if (lbl) lbl.textContent = isPaused ? t("btn_queue_resume") : t("btn_queue_pause");
}

function resetQueueButtons() {
  state.isQueueRunning = false;
  state.isQueuePaused = false;
  if (el.btnStartQueue) {
    el.btnStartQueue.disabled = false;
    const lbl = document.getElementById("lblStartQueue");
    if (lbl) lbl.textContent = t("btn_start_queue");
  }
  if (el.btnQueuePause) {
    el.btnQueuePause.disabled = true;
    updatePauseButtonUI(false);
  }
  if (el.btnQueueSkip) el.btnQueueSkip.disabled = true;
  if (el.btnQueueCancel) el.btnQueueCancel.disabled = true;
}

// -------------------------------------------------------------
// Tauri Event Listeners (Drag-Drop & Live Real Progress)
// -------------------------------------------------------------
async function setupTauriEventListeners() {
  if (!window.__TAURI__) {
    console.warn("Tauri global API not detected in window.__TAURI__");
    return;
  }

  // 1. Live Job Progress
  if (window.__TAURI__.event && typeof window.__TAURI__.event.listen === "function") {
    try {
      await window.__TAURI__.event.listen("job-progress", (event) => {
        const data = event.payload;
        if (!data) return;
        const job = state.queueJobs.find(j => j.key === data.key);
        if (job) {
          job.progress = Math.round(data.progress * 10) / 10;
          job.status = data.status;
          job.speed = data.speed;
          job.error = data.error;
          renderQueueTable();

          const doneCount = state.queueJobs.filter(j => j.status === "done").length;
          if (el.queueProgressSummary) {
            el.queueProgressSummary.textContent = `${doneCount} of ${state.queueJobs.length} done`;
          }
        }
      });
    } catch (e) {
      console.warn("job-progress listener error:", e);
    }

    // Legacy Tauri event fallback
    try {
      await window.__TAURI__.event.listen("tauri://drag-drop", async (event) => {
        if (el.dropzone) el.dropzone.classList.remove("dragover");
        const paths = (event.payload && event.payload.paths) ? event.payload.paths : [];
        if (paths && paths.length > 0) {
          if (state.currentStep === 4) {
            await processQuickToolsPaths(paths);
          } else {
            await processScanPaths(paths);
          }
        }
      });
      await window.__TAURI__.event.listen("tauri://drag-enter", () => {
        if (el.dropzone) el.dropzone.classList.add("dragover");
      });
      await window.__TAURI__.event.listen("tauri://drag-leave", () => {
        if (el.dropzone) el.dropzone.classList.remove("dragover");
      });
    } catch (_) {}
  }

  // 2. Tauri v2 Native Webview Drag & Drop (Official API)
  try {
    let target = null;
    if (window.__TAURI__.webviewWindow && typeof window.__TAURI__.webviewWindow.getCurrentWebviewWindow === "function") {
      target = window.__TAURI__.webviewWindow.getCurrentWebviewWindow();
    } else if (window.__TAURI__.webview && typeof window.__TAURI__.webview.getCurrentWebview === "function") {
      target = window.__TAURI__.webview.getCurrentWebview();
    } else if (window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === "function") {
      target = window.__TAURI__.window.getCurrentWindow();
    }

    if (target && typeof target.onDragDropEvent === "function") {
      await target.onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (!payload) return;
        if (payload.type === "enter" || payload.type === "over") {
          if (el.dropzone) el.dropzone.classList.add("dragover");
        } else if (payload.type === "leave") {
          if (el.dropzone) el.dropzone.classList.remove("dragover");
        } else if (payload.type === "drop") {
          if (el.dropzone) el.dropzone.classList.remove("dragover");
          const paths = payload.paths || [];
          if (paths && paths.length > 0) {
            if (state.currentStep === 4) {
              await processQuickToolsPaths(paths);
            } else {
              await processScanPaths(paths);
            }
          }
        }
      });
      console.log("Tauri v2 onDragDropEvent listener active");
    }
  } catch (err) {
    console.warn("Tauri v2 onDragDropEvent setup failed:", err);
  }
}

// -------------------------------------------------------------
// Real Scan & Probe Integration (CREATE_NO_WINDOW background)
// -------------------------------------------------------------
async function processScanPaths(paths) {
  try {
    const titleEl = el.dropzone ? el.dropzone.querySelector(".dropzone-title") : null;
    if (titleEl) titleEl.textContent = "Analyzing media files in background...";

    const res = await invoke("scan_files", { paths });
    if (res && res.groups && res.groups.length > 0) {
      state.groups = res.groups;
      disambiguateAllGroups();
      state.groups.forEach(g => {
        let subDefFound = false;
        let audioDefFound = false;
        const autoClearTrackNames = (state.globalSettings.clearTrackNames !== false);
        g.tracks.forEach(t => {
          if (autoClearTrackNames && (t.kind === "video" || t.kind === "audio")) {
            t.name = "";
          }
          if (t.kind === "subtitle" && t.is_default) {
            if (subDefFound) t.is_default = false;
            else subDefFound = true;
          }
          if (t.kind === "audio" && t.is_default) {
            if (audioDefFound) t.is_default = false;
            else audioDefFound = true;
          }
        });
      });
      state.quickSettings.userTouchedSubs = false;
      state.quickSettings.userTouchedAudios = false;

      // Asynchronously fetch online metadata & covers in background
      state.groups.forEach(g => {
        enrichGroupWithMetadata(g).catch(err => console.warn("Metadata fetch error for", g.key, err));
      });

      updateCounters(res.stats);
      if (el.btnNextToReview) el.btnNextToReview.disabled = false;

      // Set default output folder next to first video under "Converted"
      if (state.groups.length > 0) {
        const firstFile = state.groups[0].filepath;
        const lastSlash = Math.max(firstFile.lastIndexOf("\\"), firstFile.lastIndexOf("/"));
        const dir = lastSlash > 0 ? firstFile.substring(0, lastSlash) : "D:\\Output";
        if (el.exportOutputFolder) el.exportOutputFolder.value = `${dir}\\Converted`;
        state.exportSettings.folder = `${dir}\\Converted`;
      }

      // Populate dynamic tracks
      repopulateDynamicDropdowns();
      goToStep(2);
    } else {
      await showAlertDialog({
        title: t("brand_title"),
        message: "No compatible media files (.mkv, .mp4, .avi, etc.) were found in the selected location.",
        icon: "⚠️"
      });
    }
  } catch (err) {
    console.error("Scan error:", err);
    await showAlertDialog({
      title: "Scan Error",
      message: "Error scanning files: " + err,
      icon: "❌"
    });
  } finally {
    const titleEl = el.dropzone ? el.dropzone.querySelector(".dropzone-title") : null;
    if (titleEl) titleEl.textContent = "Drag media files or folders here";
  }
}

function updateCounters(stats) {
  if (el.statVideos) el.statVideos.textContent = stats.videos;
  if (el.statAudios) el.statAudios.textContent = stats.audios;
  if (el.statSubs) el.statSubs.textContent = stats.subtitles;
  if (el.statChapters) el.statChapters.textContent = stats.chapters;
  if (el.statGroups) el.statGroups.textContent = stats.groups;
}

// -------------------------------------------------------------
// Step Navigation (Strict Single View Isolation)
// -------------------------------------------------------------
function goToStep(step) {
  state.currentStep = step;
  updateStepper(step);

  // Toggle active class on stage views
  if (el.stageImport) el.stageImport.classList.toggle("active", step === 1);
  if (el.stageReview) el.stageReview.classList.toggle("active", step === 2);
  if (el.stageExport) el.stageExport.classList.toggle("active", step === 3);
  if (el.stageQuickTools) el.stageQuickTools.classList.toggle("active", step === 4);

  if (el.btnNavQuickTools) {
    el.btnNavQuickTools.classList.toggle("active-tool", step === 4);
  }

  if (step === 2) {
    renderReviewStage();
  } else if (step === 3) {
    renderExportStage();
  } else if (step === 4) {
    renderQuickToolsStage();
  }
}

function updateStepper(activeStep) {
  if (!el.stepper) return;
  el.stepper.querySelectorAll(".step-item").forEach(item => {
    const step = parseInt(item.getAttribute("data-step"));
    item.classList.remove("active", "completed");
    if (activeStep === 4) {
      // When in Quick Tools, workflow steps remain inactive
      return;
    }
    if (step === activeStep) {
      item.classList.add("active");
    } else if (step < activeStep) {
      item.classList.add("completed");
    }
  });
}

// -------------------------------------------------------------
// Dynamic Tracks Extraction & Dropdown Population
// -------------------------------------------------------------
let detectedAudioTracksMap = new Map();
let detectedSubTracksMap = new Map();

function updateDefaultAudioDropdown() {
  if (!el.quickDefAudio) return;
  const kept = Array.from(state.quickSettings.keepAudios);
  const curVal = el.quickDefAudio.value;
  el.quickDefAudio.innerHTML = "";

  if (kept.length === 1) {
    const lang = kept[0];
    const label = detectedAudioTracksMap.get(lang) || formatLang(lang);
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = label;
    opt.selected = true;
    el.quickDefAudio.appendChild(opt);
    state.quickSettings.defAudio = lang;
  } else if (kept.length === 0) {
    const opt = document.createElement("option");
    opt.value = "none";
    opt.textContent = "None";
    opt.selected = true;
    el.quickDefAudio.appendChild(opt);
    state.quickSettings.defAudio = "none";
  } else {
    const keepOpt = document.createElement("option");
    keepOpt.value = "keep";
    keepOpt.textContent = "Keep as in file";
    el.quickDefAudio.appendChild(keepOpt);

    kept.forEach(lang => {
      const label = detectedAudioTracksMap.get(lang) || formatLang(lang);
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = label;
      el.quickDefAudio.appendChild(opt);
    });

    if (kept.includes(curVal)) {
      el.quickDefAudio.value = curVal;
    } else if (curVal === "keep") {
      el.quickDefAudio.value = "keep";
    } else {
      const pref = (state.globalSettings && state.globalSettings.defAudioLang) ? state.globalSettings.defAudioLang : "jpn";
      const match = kept.find(k => k === pref || k.startsWith(`${pref}#`));
      if (match) {
        el.quickDefAudio.value = match;
      } else {
        el.quickDefAudio.value = "keep";
      }
    }
    state.quickSettings.defAudio = el.quickDefAudio.value;
  }
}

function updateDefaultSubDropdown() {
  if (!el.quickDefSub) return;
  const kept = Array.from(state.quickSettings.keepSubs);
  const curVal = el.quickDefSub.value;
  el.quickDefSub.innerHTML = "";

  if (kept.length === 1) {
    const lang = kept[0];
    const label = detectedSubTracksMap.get(lang) || formatLang(lang);
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent = label;
    opt.selected = true;
    el.quickDefSub.appendChild(opt);
    state.quickSettings.defSub = lang;
  } else if (kept.length === 0) {
    const opt = document.createElement("option");
    opt.value = "none";
    opt.textContent = "None";
    opt.selected = true;
    el.quickDefSub.appendChild(opt);
    state.quickSettings.defSub = "none";
  } else {
    const keepOpt = document.createElement("option");
    keepOpt.value = "keep";
    keepOpt.textContent = "Keep as in file";
    el.quickDefSub.appendChild(keepOpt);

    kept.forEach(lang => {
      const label = detectedSubTracksMap.get(lang) || formatLang(lang);
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = label;
      el.quickDefSub.appendChild(opt);
    });

    if (kept.includes(curVal)) {
      el.quickDefSub.value = curVal;
    } else if (curVal === "keep") {
      el.quickDefSub.value = "keep";
    } else {
      const pref = (state.globalSettings && state.globalSettings.defSubLang) ? state.globalSettings.defSubLang : "ara";
      const match = kept.find(k => k === pref || k.startsWith(`${pref}#`));
      if (match) {
        el.quickDefSub.value = match;
      } else {
        el.quickDefSub.value = "keep";
      }
    }
    state.quickSettings.defSub = el.quickDefSub.value;
  }
}

function disambiguateAllGroups() {
  state.groups.forEach(g => disambiguateGroupTracks(g));
}

function disambiguateGroupTracks(group) {
  if (!group || !group.tracks) return;

  // Disambiguate subtitles with duplicate languages (e.g., multiple Arabic tracks -> Arabic 1, Arabic 2)
  const subCounts = {};
  group.tracks.forEach(t => {
    if (t.kind === "subtitle") {
      const l = t.lang || "und";
      subCounts[l] = (subCounts[l] || 0) + 1;
    }
  });

  const subIdx = {};
  group.tracks.forEach(t => {
    if (t.kind === "subtitle") {
      const l = t.lang || "und";
      if (subCounts[l] > 1) {
        subIdx[l] = (subIdx[l] || 0) + 1;
        const idx = subIdx[l];
        t.subIndex = idx;
        t.uniqueLangKey = `${l}#${idx}`;
        t.displayLabel = `${formatLang(l)} ${idx}`;
      } else {
        t.subIndex = 1;
        t.uniqueLangKey = l;
        t.displayLabel = formatLang(l);
      }
    }
  });

  // Disambiguate audio tracks with duplicate languages
  const audioCounts = {};
  group.tracks.forEach(t => {
    if (t.kind === "audio") {
      const l = t.lang || "und";
      audioCounts[l] = (audioCounts[l] || 0) + 1;
    }
  });

  const audioIdx = {};
  group.tracks.forEach(t => {
    if (t.kind === "audio") {
      const l = t.lang || "und";
      if (audioCounts[l] > 1) {
        audioIdx[l] = (audioIdx[l] || 0) + 1;
        const idx = audioIdx[l];
        t.audioIndex = idx;
        t.uniqueLangKey = `${l}#${idx}`;
        t.displayLabel = `${formatLang(l)} ${idx}`;
      } else {
        t.audioIndex = 1;
        t.uniqueLangKey = l;
        t.displayLabel = formatLang(l);
      }
    }
  });
}

function repopulateDynamicDropdowns() {
  disambiguateAllGroups();

  detectedAudioTracksMap = new Map();
  detectedSubTracksMap = new Map();

  state.groups.forEach(g => {
    g.tracks.forEach(t => {
      if (t.kind === "audio") {
        const key = t.uniqueLangKey || t.lang || "und";
        const label = t.displayLabel || formatLang(t.lang || "und");
        detectedAudioTracksMap.set(key, label);
      }
      if (t.kind === "subtitle") {
        const key = t.uniqueLangKey || t.lang || "und";
        const label = t.displayLabel || formatLang(t.lang || "und");
        detectedSubTracksMap.set(key, label);
      }
    });
  });

  // 1. Keep Audio Panel
  if (el.keepAudioOptionsList) {
    el.keepAudioOptionsList.innerHTML = "";
    if (!state.quickSettings.userTouchedAudios) {
      state.quickSettings.keepAudios.clear();
      detectedAudioTracksMap.forEach((_, lang) => state.quickSettings.keepAudios.add(lang));
    }

    if (detectedAudioTracksMap.size === 0) {
      el.keepAudioOptionsList.innerHTML = `<span style="font-size: 12px; color: var(--muted-text); padding: 4px 8px;">No audio tracks found</span>`;
    } else {
      detectedAudioTracksMap.forEach((label, lang) => {
        const isChecked = state.quickSettings.keepAudios.has(lang);
        const item = document.createElement("div");
        item.style.padding = "4px 8px";

        if (lang === "und" || lang.startsWith("und#")) {
          item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <label class="multiselect-item" style="margin: 0; padding: 0; display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1;">
                <input type="checkbox" value="${lang}" ${isChecked ? "checked" : ""}>
                <span style="color: var(--amber); font-weight: 600;">⚠️ ${label}</span>
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; padding-left: 20px; font-size: 11.5px; color: var(--muted-text);">
              <span>Set as:</span>
              <select class="quick-assign-und-audio" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--bg-card); color: var(--text-color); border: 1px solid var(--border-color);">
                <option value="" disabled selected>Choose language...</option>
                <option value="ara">Arabic (ara)</option>
                <option value="eng">English (eng)</option>
                <option value="jpn">Japanese (jpn)</option>
                <option value="fra">French (fra)</option>
                <option value="deu">German (deu)</option>
                <option value="spa">Spanish (spa)</option>
                <option value="ita">Italian (ita)</option>
                <option value="rus">Russian (rus)</option>
              </select>
            </div>
          `;

          item.querySelector("input").addEventListener("change", (e) => {
            state.quickSettings.userTouchedAudios = true;
            if (e.target.checked) state.quickSettings.keepAudios.add(lang);
            else state.quickSettings.keepAudios.delete(lang);
            updateKeepAudioSummary();
            updateDefaultAudioDropdown();
            applyQuickSettingsToAll();
          });

          const assignSelect = item.querySelector(".quick-assign-und-audio");
          assignSelect.addEventListener("change", (e) => {
            const newLang = e.target.value;
            if (newLang) {
              state.groups.forEach(g => {
                g.tracks.forEach(t => {
                  if (t.kind === "audio" && (t.uniqueLangKey === lang || (lang === "und" && t.lang === "und"))) {
                    t.lang = newLang;
                  }
                });
              });
              repopulateDynamicDropdowns();
              if (state.groups.length > 0) selectVideoGroup(state.selectedGroupIndex);
            }
          });
        } else {
          item.innerHTML = `
            <label class="multiselect-item" style="margin: 0; padding: 0; display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" value="${lang}" ${isChecked ? "checked" : ""}>
              <span>${label}</span>
            </label>
          `;
          item.querySelector("input").addEventListener("change", (e) => {
            state.quickSettings.userTouchedAudios = true;
            if (e.target.checked) state.quickSettings.keepAudios.add(lang);
            else state.quickSettings.keepAudios.delete(lang);
            updateKeepAudioSummary();
            updateDefaultAudioDropdown();
            applyQuickSettingsToAll();
          });
        }
        el.keepAudioOptionsList.appendChild(item);
      });
    }
    updateKeepAudioSummary();
  }

  // 2. Keep Subtitles Panel
  if (el.keepSubOptionsList) {
    el.keepSubOptionsList.innerHTML = "";
    if (!state.quickSettings.userTouchedSubs) {
      state.quickSettings.keepSubs.clear();
      const preferred = (state.globalSettings && state.globalSettings.defSubLang) ? state.globalSettings.defSubLang : "ara";
      if (preferred && preferred !== "keep") {
        let matched = false;
        detectedSubTracksMap.forEach((_, key) => {
          if (key === preferred || key.startsWith(`${preferred}#`)) {
            state.quickSettings.keepSubs.add(key);
            matched = true;
          }
        });
        if (!matched) {
          detectedSubTracksMap.forEach((_, key) => state.quickSettings.keepSubs.add(key));
        }
      } else {
        detectedSubTracksMap.forEach((_, key) => state.quickSettings.keepSubs.add(key));
      }
    }

    if (detectedSubTracksMap.size === 0) {
      el.keepSubOptionsList.innerHTML = `<span style="font-size: 12px; color: var(--muted-text); padding: 4px 8px;">No subtitle tracks found</span>`;
    } else {
      detectedSubTracksMap.forEach((label, lang) => {
        const isChecked = state.quickSettings.keepSubs.has(lang);
        const item = document.createElement("div");
        item.style.padding = "4px 8px";

        if (lang === "und" || lang.startsWith("und#")) {
          item.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <label class="multiselect-item" style="margin: 0; padding: 0; display: flex; align-items: center; gap: 6px; cursor: pointer; flex: 1;">
                <input type="checkbox" value="${lang}" ${isChecked ? "checked" : ""}>
                <span style="color: var(--amber); font-weight: 600;">⚠️ ${label}</span>
              </label>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px; padding-left: 20px; font-size: 11.5px; color: var(--muted-text);">
              <span>Set as:</span>
              <select class="quick-assign-und-sub" style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--bg-card); color: var(--text-color); border: 1px solid var(--border-color);">
                <option value="" disabled selected>Choose language...</option>
                <option value="ara">Arabic (ara)</option>
                <option value="eng">English (eng)</option>
                <option value="fra">French (fra)</option>
                <option value="deu">German (deu)</option>
                <option value="spa">Spanish (spa)</option>
                <option value="ita">Italian (ita)</option>
                <option value="jpn">Japanese (jpn)</option>
                <option value="rus">Russian (rus)</option>
              </select>
            </div>
          `;

          item.querySelector("input").addEventListener("change", (e) => {
            state.quickSettings.userTouchedSubs = true;
            if (e.target.checked) state.quickSettings.keepSubs.add(lang);
            else state.quickSettings.keepSubs.delete(lang);
            updateKeepSubSummary();
            updateDefaultSubDropdown();
            applyQuickSettingsToAll();
          });

          const assignSelect = item.querySelector(".quick-assign-und-sub");
          assignSelect.addEventListener("change", (e) => {
            const newLang = e.target.value;
            if (newLang) {
              state.groups.forEach(g => {
                g.tracks.forEach(t => {
                  if (t.kind === "subtitle" && (t.uniqueLangKey === lang || (lang === "und" && t.lang === "und"))) {
                    t.lang = newLang;
                  }
                });
              });
              repopulateDynamicDropdowns();
              if (state.groups.length > 0) selectVideoGroup(state.selectedGroupIndex);
            }
          });
        } else {
          item.innerHTML = `
            <label class="multiselect-item" style="margin: 0; padding: 0; display: flex; align-items: center; gap: 6px; cursor: pointer;">
              <input type="checkbox" value="${lang}" ${isChecked ? "checked" : ""}>
              <span>${label}</span>
            </label>
          `;
          item.querySelector("input").addEventListener("change", (e) => {
            state.quickSettings.userTouchedSubs = true;
            if (e.target.checked) state.quickSettings.keepSubs.add(lang);
            else state.quickSettings.keepSubs.delete(lang);
            updateKeepSubSummary();
            updateDefaultSubDropdown();
            applyQuickSettingsToAll();
          });
        }
        el.keepSubOptionsList.appendChild(item);
      });
    }
    updateKeepSubSummary();
  }

  // 3. Populate default track dropdowns matching kept options
  updateDefaultAudioDropdown();
  updateDefaultSubDropdown();

  // 5. Burn Subtitle Dropdown (Only actual present sub tracks + default)
  if (el.quickBurnSub) {
    const curVal = el.quickBurnSub.value || "none";
    el.quickBurnSub.innerHTML = `
      <option value="none">None (Soft subtitles)</option>
      <option value="default">Burn default subtitle</option>
    `;
    detectedSubTracksMap.forEach((label, lang) => {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = `Burn ${label}`;
      el.quickBurnSub.appendChild(opt);
    });
    if (Array.from(el.quickBurnSub.options).some(o => o.value === curVal)) {
      el.quickBurnSub.value = curVal;
    } else {
      el.quickBurnSub.value = "none";
    }
  }
}

function updateKeepAudioSummary() {
  if (!el.keepAudioSummary) return;
  const count = state.quickSettings.keepAudios.size;
  const allCheckboxes = el.keepAudioOptionsList ? el.keepAudioOptionsList.querySelectorAll("input[type='checkbox']") : [];
  if (count === allCheckboxes.length && count > 0) {
    el.keepAudioSummary.textContent = `All tracks (${count})`;
    if (el.chkKeepAllAudio) el.chkKeepAllAudio.checked = true;
  } else if (count === 0) {
    el.keepAudioSummary.textContent = "None selected";
    if (el.chkKeepAllAudio) el.chkKeepAllAudio.checked = false;
  } else {
    el.keepAudioSummary.textContent = `${count} selected`;
    if (el.chkKeepAllAudio) el.chkKeepAllAudio.checked = false;
  }
}

function updateKeepSubSummary() {
  if (!el.keepSubSummary) return;
  const count = state.quickSettings.keepSubs.size;
  const allCheckboxes = el.keepSubOptionsList ? el.keepSubOptionsList.querySelectorAll("input[type='checkbox']") : [];
  if (count === allCheckboxes.length && count > 0) {
    el.keepSubSummary.textContent = `All tracks (${count})`;
    if (el.chkKeepAllSub) el.chkKeepAllSub.checked = true;
  } else if (count === 0) {
    el.keepSubSummary.textContent = "None selected";
    if (el.chkKeepAllSub) el.chkKeepAllSub.checked = false;
  } else {
    el.keepSubSummary.textContent = `${count} selected`;
    if (el.chkKeepAllSub) el.chkKeepAllSub.checked = false;
  }
}

// -------------------------------------------------------------
// Stage 2: Review Logic
// -------------------------------------------------------------
function renderReviewStage() {
  if (el.quickAppliedCount) el.quickAppliedCount.textContent = `Applied to all ${state.groups.length} videos`;
  applyQuickSettingsToAll();
  renderVideoSidebar();
  if (state.groups.length > 0) {
    if (state.selectedGroupIndex >= state.groups.length) state.selectedGroupIndex = 0;
    selectVideoGroup(state.selectedGroupIndex);
  }
}

function renderVideoSidebar() {
  if (!el.videoSidebar) return;
  el.videoSidebar.innerHTML = "";

  state.groups.forEach((g, idx) => {
    const item = document.createElement("div");
    item.className = `video-card-item ${idx === state.selectedGroupIndex ? "selected" : ""}`;

    const audioCnt = g.tracks.filter(t => t.kind === "audio" && t.action !== "remove").length;
    const subCnt = g.tracks.filter(t => t.kind === "subtitle" && t.action !== "remove").length;
    const attCnt = g.tracks.filter(t => ["font", "img", "attachment"].includes(t.kind)).length;

    item.innerHTML = `
      <div class="video-card-content">
        <div class="video-item-top" title="${g.key}">${g.key}</div>
        <div class="video-item-meta">${audioCnt} audio · ${subCnt} subs ${attCnt > 0 ? `· +${attCnt} att` : ""}</div>
      </div>
      <button class="video-delete-btn" title="Remove this video">✕</button>
    `;

    item.querySelector(".video-card-content").addEventListener("click", () => selectVideoGroup(idx));

    item.querySelector(".video-delete-btn").addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteVideoGroup(idx);
    });

    el.videoSidebar.appendChild(item);
  });
}

async function deleteVideoGroup(index) {
  state.groups.splice(index, 1);
  if (state.groups.length === 0) {
    updateCounters({ videos: 0, audios: 0, subtitles: 0, chapters: 0, groups: 0 });
    if (el.btnNextToReview) el.btnNextToReview.disabled = true;
    goToStep(1);
    return;
  }

  if (state.selectedGroupIndex >= state.groups.length) {
    state.selectedGroupIndex = state.groups.length - 1;
  }
  repopulateDynamicDropdowns();
  renderVideoSidebar();
  selectVideoGroup(state.selectedGroupIndex);
}

function selectVideoGroup(index) {
  state.selectedGroupIndex = index;
  const group = state.groups[index];
  if (!group) return;

  renderVideoSidebar();
  if (el.selectedVideoTitle) el.selectedVideoTitle.textContent = group.key;
  updateSelectedGroupCoverUI(group);
  renderTracksTable(group);
}

function renderTracksTable(group) {
  if (!el.tracksTableBody) return;
  el.tracksTableBody.innerHTML = "";

  const containerTracks = group.tracks.filter(t => t.origin === "container");
  const externalTracks = group.tracks.filter(t => t.origin === "external");

  if (containerTracks.length > 0) {
    const divRow = document.createElement("tr");
    divRow.className = "group-divider";
    divRow.innerHTML = `<td colspan="6">Inside original container · ${group.filename}</td>`;
    el.tracksTableBody.appendChild(divRow);
    containerTracks.forEach(t => renderTrackRow(t, group));
  }

  if (externalTracks.length > 0) {
    const divRow = document.createElement("tr");
    divRow.className = "group-divider";
    divRow.innerHTML = `<td colspan="6">External & Added files · ${externalTracks.length} files</td>`;
    el.tracksTableBody.appendChild(divRow);
    externalTracks.forEach(t => renderTrackRow(t, group));
  }
}

function renderTrackRow(track, group) {
  const tr = document.createElement("tr");

  const langCell = (track.kind === "subtitle" || track.kind === "audio" || track.kind === "video")
    ? `
      <select class="track-lang-select" style="padding: 2px 4px; font-size: 11.5px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-color); max-width: 130px;">
        <option value="und" ${track.lang === "und" ? "selected" : ""}>Unknown (und)</option>
        <option value="ara" ${track.lang === "ara" ? "selected" : ""}>Arabic (ara)</option>
        <option value="eng" ${track.lang === "eng" ? "selected" : ""}>English (eng)</option>
        <option value="fra" ${track.lang === "fra" ? "selected" : ""}>French (fra)</option>
        <option value="deu" ${track.lang === "deu" ? "selected" : ""}>German (deu)</option>
        <option value="spa" ${track.lang === "spa" ? "selected" : ""}>Spanish (spa)</option>
        <option value="ita" ${track.lang === "ita" ? "selected" : ""}>Italian (ita)</option>
        <option value="jpn" ${track.lang === "jpn" ? "selected" : ""}>Japanese (jpn)</option>
        <option value="rus" ${track.lang === "rus" ? "selected" : ""}>Russian (rus)</option>
        ${!["und","ara","eng","fra","deu","spa","ita","jpn","rus"].includes(track.lang) ? `<option value="${track.lang}" selected>${formatLang(track.lang)}</option>` : ""}
      </select>
    `
    : `${formatLang(track.lang)}`;

  const isVideoOrAudio = (track.kind === "video" || track.kind === "audio");
  const hasCustomName = Boolean(track.name && !track.name.startsWith("Track ") && track.name.trim().length > 0);

  let trackTitle = "";
  if (track.displayLabel && track.displayLabel !== formatLang(track.lang)) {
    trackTitle = `${track.codec} · <strong>${track.displayLabel}</strong>${hasCustomName && track.name !== track.displayLabel ? ` (${escapeHtml(track.name)})` : ""}`;
  } else {
    trackTitle = `${track.codec} · ${hasCustomName ? escapeHtml(track.name) : (track.displayLabel || "")}`;
  }

  if (isVideoOrAudio && hasCustomName) {
    trackTitle += ` <button type="button" class="btn-clear-track-name" title="${t("btn_clear_track_name") || "Clear track name"}" style="background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--muted-text); cursor: pointer; padding: 0 5px; font-size: 11px; margin-inline-start: 6px; line-height: 1.2; vertical-align: middle;">✕</button>`;
  }

  tr.innerHTML = `
    <td><span class="tag ${track.kind}">${track.kind.toUpperCase()}</span></td>
    <td>${trackTitle}</td>
    <td>${langCell}</td>
    <td>
      <select class="track-default-select">
        <option value="false" ${!track.is_default ? "selected" : ""}>—</option>
        <option value="true" ${track.is_default ? "selected" : ""}>Yes</option>
      </select>
    </td>
    <td>
      <input type="number" class="track-delay-input" style="width: 80px;" value="${track.delay}" step="50">
    </td>
    <td>
      <select class="track-action-select">
        ${track.kind === "subtitle"
          ? `${track.origin === "container" ? `<option value="keep" ${track.action === "keep" ? "selected" : ""}>Keep</option>` : `<option value="add" ${track.action === "add" ? "selected" : ""}>Add</option>`}
             <option value="burn" ${track.action === "burn" ? "selected" : ""}>Burn</option>
             <option value="remove" ${track.action === "remove" ? "selected" : ""}>Remove</option>`
          : (track.origin === "container"
              ? `<option value="keep" ${track.action === "keep" ? "selected" : ""}>Keep</option>
                 ${track.kind === "video" ? `<option value="convert" ${track.action === "convert" ? "selected" : ""}>Convert</option>` : ""}
                 <option value="remove" ${track.action === "remove" ? "selected" : ""}>Remove</option>`
              : `<option value="add" ${track.action === "add" ? "selected" : ""}>Add</option>
                 <option value="remove" ${track.action === "remove" ? "selected" : ""}>Remove</option>`
            )
        }
      </select>
    </td>
  `;

  const langSelect = tr.querySelector(".track-lang-select");
  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      track.lang = e.target.value;
      disambiguateAllGroups();
      repopulateDynamicDropdowns();
      renderTracksTable(group);
    });
  }

  tr.querySelector(".track-default-select").addEventListener("change", (e) => {
    const val = e.target.value === "true";
    track.is_default = val;
    if (val && (track.kind === "subtitle" || track.kind === "audio")) {
      group.tracks.forEach(otherTrack => {
        if (otherTrack !== track && otherTrack.kind === track.kind) {
          otherTrack.is_default = false;
        }
      });
      renderTracksTable(group);
    }
  });

  tr.querySelector(".track-delay-input").addEventListener("change", (e) => {
    track.delay = parseInt(e.target.value) || 0;
  });

  tr.querySelector(".track-action-select").addEventListener("change", (e) => {
    track.action = e.target.value;
    if (track.kind === "subtitle" && track.action === "burn") {
      // Subtitle burning requires re-encoding the video
      const vt = group.tracks.find(t => t.kind === "video");
      if (vt) {
        vt.action = "convert";
      }
      selectVideoGroup(state.selectedGroupIndex);
    } else if (track.kind === "video" && track.action === "keep") {
      // In copy mode, burning is impossible; revert any burned subtitles
      let changed = false;
      group.tracks.forEach(t => {
        if (t.kind === "subtitle" && t.action === "burn") {
          t.action = t.origin === "container" ? "keep" : "add";
          changed = true;
        }
      });
      if (changed) selectVideoGroup(state.selectedGroupIndex);
    }
  });

  const btnClearName = tr.querySelector(".btn-clear-track-name");
  if (btnClearName) {
    btnClearName.addEventListener("click", (e) => {
      e.stopPropagation();
      track.name = "";
      renderTracksTable(group);
    });
  }

  el.tracksTableBody.appendChild(tr);
}

function applyQuickSettingsToAll() {
  const preset = el.quickPreset ? el.quickPreset.value : "default";
  const defAudio = el.quickDefAudio ? el.quickDefAudio.value : "keep";
  const defSub = el.quickDefSub ? el.quickDefSub.value : "keep";
  const isVideoCopy = (preset === "copy") || (preset === "default" && state.videoSettings.codec === "copy");

  let burnSub = "none";
  if (el.quickBurnSub) {
    burnSub = el.quickBurnSub.value;
    if (el.burnBadge) el.burnBadge.style.display = (burnSub !== "none") ? "inline-block" : "none";
  }

  state.groups.forEach(g => {
    let burnedTrackFound = false;

    // 1. Audio and Video preset
    let defaultAudioAssigned = false;
    g.tracks.forEach(t => {
      if (t.kind === "audio") {
        const tKey = t.uniqueLangKey || t.lang || "und";
        const tBase = t.lang || "und";
        const isKept = state.quickSettings.keepAudios.has(tKey) ||
                       state.quickSettings.keepAudios.has(tBase) ||
                       (t.audioIndex === 1 && state.quickSettings.keepAudios.has(`${tBase}#1`));

        if (state.quickSettings.userTouchedAudios || state.quickSettings.keepAudios.size > 0) {
          t.action = isKept ? "keep" : "remove";
        }
        if (defAudio !== "keep") {
          const isMatch = (tKey === defAudio) || 
                          (tBase === defAudio) || 
                          (t.audioIndex === 1 && defAudio === `${tBase}#1`);
          if (!defaultAudioAssigned && isMatch && t.action !== "remove") {
            t.is_default = true;
            defaultAudioAssigned = true;
          } else {
            t.is_default = false;
          }
        }
      }

      if (t.kind === "video") {
        t.action = isVideoCopy ? "keep" : "convert";
      }
    });

    if (defAudio === "keep") {
      let audioKeptDefaultAssigned = false;
      g.tracks.forEach(t => {
        if (t.kind === "audio" && t.action !== "remove") {
          if (t.is_default) {
            if (audioKeptDefaultAssigned) {
              t.is_default = false;
            } else {
              audioKeptDefaultAssigned = true;
            }
          }
        }
      });
    }

    // 2. Subtitle tracks & Burn logic
    let defaultSubAssigned = false;
    g.tracks.forEach(t => {
      if (t.kind === "subtitle") {
        const wasBurn = (t.action === "burn");
        const tKey = t.uniqueLangKey || t.lang || "und";
        const tBase = t.lang || "und";
        const isKept = state.quickSettings.keepSubs.has(tKey) ||
                       state.quickSettings.keepSubs.has(tBase) ||
                       (t.subIndex === 1 && state.quickSettings.keepSubs.has(`${tBase}#1`));

        if (state.quickSettings.userTouchedSubs || state.quickSettings.keepSubs.size > 0) {
          t.action = isKept ? (t.origin === "container" ? "keep" : "add") : "remove";
        }
        if (defSub !== "keep") {
          const isMatch = (tKey === defSub) || 
                          (tBase === defSub) || 
                          (t.subIndex === 1 && defSub === `${tBase}#1`);
          if (!defaultSubAssigned && isMatch && t.action !== "remove") {
            t.is_default = true;
            defaultSubAssigned = true;
          } else {
            t.is_default = false;
          }
        }

        // Apply Hardsub burning:
        // Even if all subtitles were unchecked or removed, selected burn subtitle MUST burn!
        if (burnSub !== "none") {
          let shouldBurn = false;
          if (burnSub === "default") {
            if (t.is_default || (!burnedTrackFound && (tKey === defSub || tBase === defSub))) {
              shouldBurn = true;
            }
          } else if ((burnSub === tKey || burnSub === tBase || (t.subIndex === 1 && burnSub === `${tBase}#1`)) && !burnedTrackFound) {
            shouldBurn = true;
          }
          if (shouldBurn) {
            t.action = "burn";
            burnedTrackFound = true;
          }
        } else if (wasBurn) {
          t.action = "burn";
          burnedTrackFound = true;
        }
      }
    });

    if (defSub === "keep") {
      let subKeptDefaultAssigned = false;
      g.tracks.forEach(t => {
        if (t.kind === "subtitle" && t.action !== "remove") {
          if (t.is_default) {
            if (subKeptDefaultAssigned) {
              t.is_default = false;
            } else {
              subKeptDefaultAssigned = true;
            }
          }
        }
      });
    }

    // Subtitle burn requires video to be converted
    const hasBurn = g.tracks.some(t => t.kind === "subtitle" && t.action === "burn");
    if (hasBurn) {
      const vt = g.tracks.find(t => t.kind === "video");
      if (vt) vt.action = "convert";
    }
  });

  if (state.groups.length > 0) {
    selectVideoGroup(state.selectedGroupIndex);
  }
}

// -------------------------------------------------------------
// Stage 3: Real Export Execution Logic
// -------------------------------------------------------------
function renderExportStage() {
  if (el.queueTitle) el.queueTitle.textContent = `Queue · ${state.groups.length} videos`;

  const existingJobMap = new Map();
  (state.queueJobs || []).forEach(j => {
    existingJobMap.set(j.key, j);
  });

  const presetKey = el.quickPreset ? el.quickPreset.value : "default";
  const patternType = el.exportPattern ? el.exportPattern.value : "smart";
  const namingCfg = state.globalSettings.naming || {
    enabled: true,
    tag: "yasinoss",
    seriesPattern: "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}",
    moviePattern: "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}"
  };

  const computeJobOutputName = (g) => {
    if (patternType === "{name}") {
      return g.filename.replace(/\.[^/.]+$/, "") + ".mkv";
    }
    if (patternType === "{show} - S{season}E{episode}" && g.show && g.season && g.episode) {
      const s = String(g.season).padStart(2, "0");
      const e = String(g.episode).padStart(2, "0");
      return `${g.show} - S${s}E${e}.mkv`;
    }
    if (patternType === "{show}/Season {season}/{show} - S{season}E{episode}" && g.show && g.season && g.episode) {
      const s = String(g.season).padStart(2, "0");
      const e = String(g.episode).padStart(2, "0");
      return `${g.show}/Season ${s}/${g.show} - S${s}E${e}.mkv`;
    }
    // Smart Pattern (or default)
    if (namingCfg.enabled === false) {
      return g.filename.replace(/\.[^/.]+$/, "") + ".mkv";
    }
    const info = parseMediaInfo(g.filename, g, state.videoSettings);
    const chosenPattern = info.isSeries
      ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
      : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
    const formatted = formatFilename(chosenPattern, info, namingCfg.tag || "yasinoss");
    return formatted + ".mkv";
  };

  state.queueJobs = state.groups.map(g => {
    const existing = existingJobMap.get(g.key);
    const hasBurn = g.tracks.some(t => t.kind === "subtitle" && t.action === "burn");
    const isConvert = g.tracks.some(t => t.kind === "video" && t.action === "convert");
    let plan = "";
    if (isConvert) {
      let pLabel = "";
      if (presetKey !== "default" && presetKey !== "copy" && PRESET_MAP[presetKey]) {
        pLabel = PRESET_MAP[presetKey].label;
      } else {
        pLabel = state.videoSettings.codec.toUpperCase().replace('_NVENC', '');
      }
      plan = hasBurn ? `Convert (${pLabel} + Hardsub) · Mux` : `Convert (${pLabel}) · Mux`;
    } else {
      plan = "Copy video · Mux";
    }

    const outName = computeJobOutputName(g);
    const sNum = g.season || 1;
    const posterUrl = (g.metadata && g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].posterUrl)
      ? g.metadata.seasons[sNum].posterUrl
      : (g.metadata ? g.metadata.posterUrl : null);

    if (existing) {
      return {
        key: g.key,
        plan: plan,
        outputFilename: outName,
        posterUrl: posterUrl,
        progress: existing.progress,
        speed: existing.speed,
        status: existing.status,
        error: existing.error
      };
    } else {
      return {
        key: g.key,
        plan: plan,
        outputFilename: outName,
        posterUrl: posterUrl,
        progress: 0,
        speed: "",
        status: "waiting",
        error: null
      };
    }
  });

  const doneCount = state.queueJobs.filter(j => j.status === "done").length;
  if (el.queueProgressSummary) {
    el.queueProgressSummary.textContent = `${doneCount} of ${state.groups.length} done`;
  }

  renderQueueTable();
}

function renderSharedAttachments() {
  if (!el.sharedAttachmentsList) return;
  el.sharedAttachmentsList.innerHTML = "";
  if (state.sharedAttachments.length === 0) {
    el.sharedAttachmentsList.innerHTML = `<span style="font-size: 12.5px; color: var(--muted-text);">None</span>`;
    return;
  }

  state.sharedAttachments.forEach((p, idx) => {
    const filename = p.split(/[\\/]/).pop();
    const ext = filename.split('.').pop().toLowerCase();
    let badgeClass = "neutral";
    if (["ttf", "otf", "woff"].includes(ext)) badgeClass = "blue";
    else if (["jpg", "jpeg", "png", "webp"].includes(ext)) badgeClass = "red";

    const chip = document.createElement("span");
    chip.className = `chip ${badgeClass}`;
    chip.style.cursor = "pointer";
    chip.title = "Click to remove";
    chip.textContent = `${filename} ✕`;
    chip.addEventListener("click", () => {
      state.sharedAttachments.splice(idx, 1);
      renderSharedAttachments();
    });
    el.sharedAttachmentsList.appendChild(chip);
  });
}

function renderQueueTable() {
  if (!el.queueTableBody) return;
  el.queueTableBody.innerHTML = "";

  state.queueJobs.forEach(job => {
    const tr = document.createElement("tr");

    let statusBadge = `<span class="chip neutral">Waiting</span>`;
    if (job.status === "running") {
      let speedText = job.speed ? job.speed : "Converting";
      statusBadge = `<span class="chip blue">${speedText}</span>`;
    } else if (job.status === "paused") {
      statusBadge = `<span class="chip amber">Paused</span>`;
    } else if (job.status === "skipped") {
      statusBadge = `<span class="chip neutral">Skipped</span>`;
    } else if (job.status === "done") {
      statusBadge = `<span class="chip green">Done</span>`;
    } else if (job.status === "failed") {
      statusBadge = `<span class="chip red" title="${job.error || ''}">Failed</span>`;
    }

    tr.innerHTML = `
      <td style="font-weight: 600;" title="${job.key}">
        <div style="display: flex; gap: 10px; align-items: center;">
          ${job.posterUrl ? `<img src="${job.posterUrl}" style="width: 28px; height: 40px; border-radius: 3px; object-fit: cover; flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">` : ''}
          <div style="min-width: 0;">
            <div>${job.key}</div>
            <div style="font-size: 11.5px; color: var(--accent); font-family: monospace; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
              <span style="opacity: 0.7;">📁 Output:</span>
              <span>${job.outputFilename || (job.key + '.mkv')}</span>
            </div>
          </div>
        </div>
      </td>
      <td style="font-size: 12px; color: var(--muted-text);">${job.plan}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="progress-bar-container" style="flex: 1;">
            <div class="progress-bar-fill" style="width: ${job.progress}%;"></div>
          </div>
          <span style="font-size: 11px; font-weight: 700; width: 36px; text-align: right;">${Math.round(job.progress)}%</span>
        </div>
      </td>
      <td style="text-align: center;">${statusBadge}</td>
    `;
    el.queueTableBody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// Real Queue Execution
// -------------------------------------------------------------
async function startRealQueueProcessing() {
  if (state.groups.length === 0) return;

  // Check if all jobs were already completed: if so, user wants to re-process all
  const allDone = state.queueJobs.length > 0 && state.queueJobs.every(j => j.status === "done");
  if (allDone) {
    state.queueJobs.forEach(j => {
      j.status = "waiting";
      j.progress = 0;
      j.speed = "";
      j.error = null;
    });
    renderQueueTable();
  }

  // Filter groups to only those not yet marked 'done'
  const groupsToProcess = state.groups.filter(g => {
    const job = state.queueJobs.find(j => j.key === g.key);
    return !job || job.status !== "done";
  });

  if (groupsToProcess.length === 0) {
    await showAlertDialog({
      title: t("brand_title"),
      message: "All videos in the queue have already finished processing.",
      icon: "ℹ️"
    });
    return;
  }

  state.isQueueRunning = true;
  state.isQueuePaused = false;
  if (el.btnStartQueue) {
    el.btnStartQueue.disabled = true;
    const lbl = document.getElementById("lblStartQueue");
    if (lbl) lbl.textContent = "Processing...";
    else el.btnStartQueue.textContent = "Processing...";
  }
  if (el.btnQueuePause) {
    el.btnQueuePause.disabled = false;
    updatePauseButtonUI(false);
  }
  if (el.btnQueueSkip) el.btnQueueSkip.disabled = false;
  if (el.btnQueueCancel) el.btnQueueCancel.disabled = false;

  // Always synchronize Quick Settings to all groups before dispatching to backend
  applyQuickSettingsToAll();

  const presetKey = el.quickPreset ? el.quickPreset.value : "default";
  const isCopyPreset = (presetKey === "copy");

  const isGpuPreferred = state.videoSettings.codec.includes("nvenc");
  let pCfg;
  if (presetKey === "default") {
    pCfg = {
      resolution: state.videoSettings.resolution,
      codec: state.videoSettings.codec,
      rate_control: state.videoSettings.rateControl,
      quality_val: state.videoSettings.qualityVal,
      preset: state.videoSettings.preset,
      tune: state.videoSettings.tune,
      pix_fmt: state.videoSettings.pixFmt,
      fps: null,
      profile: (state.videoSettings.profile && state.videoSettings.profile !== "auto") ? state.videoSettings.profile : null,
      level: (state.videoSettings.level && state.videoSettings.level !== "auto") ? state.videoSettings.level : null,
      multipass: state.videoSettings.multipass || "disabled",
      aq: state.videoSettings.aq || "enabled"
    };
  } else if (presetKey !== "copy" && PRESET_MAP[presetKey]) {
    const raw = PRESET_MAP[presetKey];
    let chosenCodec = raw.codec;
    if (isGpuPreferred) {
      if (raw.codec === "libx264") chosenCodec = "h264_nvenc";
      else if (raw.codec === "libx265") chosenCodec = "hevc_nvenc";
      else if (raw.codec === "libsvtav1" && state.videoSettings.codec === "av1_nvenc") chosenCodec = "av1_nvenc";
    }
    pCfg = {
      resolution: raw.resolution,
      codec: chosenCodec,
      rate_control: raw.rateControl,
      quality_val: raw.qualityVal,
      preset: raw.preset,
      tune: raw.tune || "none",
      pix_fmt: raw.pixFmt || "yuv420p",
      fps: raw.fps || null,
      profile: raw.profile || null,
      level: raw.level || null,
      multipass: raw.multipass || "disabled",
      aq: raw.aq || "enabled"
    };
  } else {
    pCfg = {
      resolution: state.videoSettings.resolution,
      codec: state.videoSettings.codec,
      rate_control: state.videoSettings.rateControl,
      quality_val: state.videoSettings.qualityVal,
      preset: state.videoSettings.preset,
      tune: state.videoSettings.tune,
      pix_fmt: state.videoSettings.pixFmt,
      fps: null,
      profile: (state.videoSettings.profile && state.videoSettings.profile !== "auto") ? state.videoSettings.profile : null,
      level: (state.videoSettings.level && state.videoSettings.level !== "auto") ? state.videoSettings.level : null,
      multipass: state.videoSettings.multipass || "disabled",
      aq: state.videoSettings.aq || "enabled"
    };
  }

  const isVideoCopyPreset = (presetKey === "copy") || (presetKey === "default" && state.videoSettings.codec === "copy");
  const isAudioCopyPreset = (presetKey === "copy") || (presetKey === "default" && state.audioSettings.codec === "copy");

  const audioSettingsPayload = isAudioCopyPreset
    ? {
        codec: "copy",
        channels: "original",
        bitrate: "copy",
        sample_rate: "original"
      }
    : {
        codec: state.audioSettings.codec,
        channels: state.audioSettings.channels,
        bitrate: state.audioSettings.bitrate,
        sample_rate: state.audioSettings.sampleRate
      };

  const shouldEmbedCover = el.chkEmbedCover ? el.chkEmbedCover.checked : (state.globalSettings.naming?.embedCover !== false);

  const payloads = await Promise.all(groupsToProcess.map(async g => {
    const job = state.queueJobs.find(j => j.key === g.key);
    let coverPath = null;
    if (shouldEmbedCover && g.metadata) {
      if (g.metadata.localPosterPath) {
        coverPath = g.metadata.localPosterPath;
      } else {
        const sNum = g.season || 1;
        const targetPoster = (g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].posterUrl)
          ? g.metadata.seasons[sNum].posterUrl
          : g.metadata.posterUrl;
        if (targetPoster) {
          try {
            coverPath = await invoke("download_cover_image", { key: g.key, url: targetPoster });
            if (coverPath) g.metadata.localPosterPath = coverPath;
          } catch (err) {
            console.warn("Cover download skipped for", g.key, err);
          }
        }
      }
    }

    const hasBurnSub = g.tracks.some(t => t.kind === "subtitle" && t.action === "burn");
    const finalTracks = g.tracks.map(t => {
      const cloned = { ...t };
      if (cloned.kind === "video") {
        if (hasBurnSub) {
          cloned.action = "convert";
        } else if (isVideoCopyPreset) {
          cloned.action = "keep";
        }
      }
      if (cloned.kind === "audio") {
        if (isAudioCopyPreset && cloned.action !== "remove") {
          cloned.action = "keep";
        }
      }
      return cloned;
    });

    const folderMode = el.exportFolderMode ? el.exportFolderMode.value : (state.exportSettings.folderMode || "same");
    let resolvedOutFolder = "same";
    if (folderMode === "converted") {
      resolvedOutFolder = "converted";
    } else if (folderMode === "custom") {
      resolvedOutFolder = (el.exportOutputFolder && el.exportOutputFolder.value) ? el.exportOutputFolder.value : (state.exportSettings.folder || "same");
    } else {
      resolvedOutFolder = "same";
    }

    return {
      key: g.key,
      source_path: g.filepath,
      output_folder: resolvedOutFolder,
      file_pattern: el.exportPattern.value || "smart",
      output_filename: job && job.outputFilename ? job.outputFilename : null,
      cover_image_path: coverPath,
      if_exists: el.exportIfExists.value || "ask",
      delete_originals: el.chkDeleteOriginals.checked,
      tracks: finalTracks,
      shared_attachments: state.sharedAttachments,
      remove_old_attachments: state.removeOldAttachments,
      video_settings: pCfg,
      audio_settings: audioSettingsPayload
    };
  }));

  try {
    await invoke("run_queue", { jobs: payloads });
  } catch (err) {
    console.error("Queue execution error:", err);
    await showAlertDialog({
      title: "Queue Error",
      message: "Queue error: " + err,
      icon: "❌"
    });
  } finally {
    resetQueueButtons();
  }
}

// =============================================================
// STAGE 4: QUICK IN-PLACE TOOLS (Rename & In-Place Cover)
// =============================================================

function populateQuickToolsFromWorkflow() {
  if (state.groups.length === 0) return;
  const namingCfg = state.globalSettings.naming || {};

  state.quickToolsFiles = state.groups.map(g => {
    const info = parseMediaInfo(g.filename, g, state.videoSettings);
    const pattern = info.isSeries
      ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
      : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
    const proposed = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";

    const sNum = g.season || 1;
    const posterUrl = (g.metadata && g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].posterUrl)
      ? g.metadata.seasons[sNum].posterUrl
      : (g.metadata ? g.metadata.posterUrl : null);

    let specs = [];
    if (info.resolution) specs.push(info.resolution);
    if (info.videoCodec) specs.push(info.videoCodec);
    if (info.hdr) specs.push(info.hdr);
    if (info.audioCodec) specs.push(info.audioCodec);

    const item = {
      id: g.key,
      filepath: g.filepath,
      filename: g.filename,
      isMkv: g.filename.toLowerCase().endsWith(".mkv"),
      proposedName: proposed,
      coverPath: g.localPosterPath || null,
      coverUrl: posterUrl,
      coverDataUrl: null,
      specs: specs,
      matchedSource: g.metadata ? (g.metadata.source || "Matched") : null,
      status: "idle",
      error: null
    };

    if (item.coverPath) {
      invoke("read_image_data_url", { path: item.coverPath }).then(dataUrl => {
        if (dataUrl) {
          item.coverDataUrl = dataUrl;
          renderQuickToolsStage();
        }
      }).catch(() => {});
    }

    return item;
  });

  renderQuickToolsStage();
}

async function processQuickToolsPaths(paths) {
  if (!paths || paths.length === 0) return;
  try {
    const res = await invoke("scan_files", { paths });
    if (res && res.groups && res.groups.length > 0) {
      const namingCfg = state.globalSettings.naming || {};
      const newItems = res.groups.map(g => {
        const info = parseMediaInfo(g.filename, g, state.videoSettings);
        const pattern = info.isSeries
          ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
          : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
        const proposed = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";

        let specs = [];
        if (info.resolution) specs.push(info.resolution);
        if (info.videoCodec) specs.push(info.videoCodec);
        if (info.hdr) specs.push(info.hdr);
        if (info.audioCodec) specs.push(info.audioCodec);

        return {
          id: g.key,
          filepath: g.filepath,
          filename: g.filename,
          isMkv: g.filename.toLowerCase().endsWith(".mkv"),
          proposedName: proposed,
          coverPath: null,
          coverUrl: null,
          coverDataUrl: null,
          specs: specs,
          matchedSource: null,
          status: "idle",
          error: null
        };
      });

      newItems.forEach(item => {
        if (!state.quickToolsFiles.some(f => f.filepath === item.filepath)) {
          state.quickToolsFiles.push(item);
        }
      });

      res.groups.forEach((g) => {
        enrichGroupWithMetadata(g).then(() => {
          const target = state.quickToolsFiles.find(f => f.filepath === g.filepath);
          if (target && g.metadata) {
            const sNum = g.season || 1;
            target.coverUrl = (g.metadata.seasons && g.metadata.seasons[sNum] && g.metadata.seasons[sNum].posterUrl)
              ? g.metadata.seasons[sNum].posterUrl
              : g.metadata.posterUrl;
            target.matchedSource = g.metadata.source || "Online";

            // Recompute smart proposed name when metadata is enriched
            const info = parseMediaInfo(g.filename, g, state.videoSettings);
            const namingCfg = state.globalSettings.naming || {};
            const pattern = info.isSeries
              ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
              : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
            target.proposedName = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";

            if (target.coverUrl) {
              const safeKey = (g.filename || g.key || "quick").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 20);
              invoke("download_cover_image", { key: `thumb_${safeKey}`, url: target.coverUrl })
                .then(localP => {
                  if (localP) {
                    target.coverPath = localP;
                    return invoke("read_image_data_url", { path: localP });
                  }
                })
                .then(dataUrl => {
                  if (dataUrl) {
                    target.coverDataUrl = dataUrl;
                    renderQuickToolsStage();
                  }
                })
                .catch(() => {});
            }

            renderQuickToolsStage();
          }
        }).catch(() => {});
      });

      renderQuickToolsStage();
    }
  } catch (err) {
    console.error("Quick tools scan error:", err);
  }
}

function renderQuickToolsStage() {
  if (!el.quickEmptyState || !el.quickTableWrapper || !el.quickTableBody) return;

  if (state.quickToolsFiles.length === 0) {
    el.quickEmptyState.style.display = "flex";
    el.quickTableWrapper.style.display = "none";
    if (el.btnQuickEmptyImportExisting) {
      el.btnQuickEmptyImportExisting.style.display = state.groups.length > 0 ? "inline-flex" : "none";
    }
    if (el.btnQuickBatchRename) el.btnQuickBatchRename.disabled = true;
    if (el.btnQuickBatchCover) el.btnQuickBatchCover.disabled = true;
    if (el.btnQuickClearAll) el.btnQuickClearAll.disabled = true;
    return;
  }

  el.quickEmptyState.style.display = "none";
  el.quickTableWrapper.style.display = "block";
  el.quickTableBody.innerHTML = "";

  if (el.btnQuickBatchRename) el.btnQuickBatchRename.disabled = false;
  if (el.btnQuickClearAll) el.btnQuickClearAll.disabled = false;

  const hasMkv = state.quickToolsFiles.some(f => f.isMkv);
  if (el.btnQuickBatchCover) {
    el.btnQuickBatchCover.disabled = !hasMkv;
    el.btnQuickBatchCover.style.opacity = hasMkv ? "1" : "0.5";
    el.btnQuickBatchCover.title = hasMkv ? "" : "In-place cover injection requires Matroska (.mkv) files";
  }

  state.quickToolsFiles.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.id = `quick-row-${idx}`;
    tr.className = "quick-table-row";

    const lastSlash = Math.max(item.filepath.lastIndexOf("\\"), item.filepath.lastIndexOf("/"));
    const folderPath = lastSlash > 0 ? item.filepath.substring(0, lastSlash) : "";

    const specsHtml = (item.specs || []).map(s => {
      let chipClass = "neutral";
      if (s.includes("p") || s.includes("4K") || s.includes("1080")) chipClass = "blue";
      else if (s.includes("HDR")) chipClass = "amber";
      else if (s.includes("AAC") || s.includes("AC3") || s.includes("DTS")) chipClass = "purple";
      return `<span class="chip ${chipClass}" style="font-size: 10.5px; padding: 2px 6px;">${escapeHtml(s)}</span>`;
    }).join(" ");

    let coverCellHtml = "";
    if (!item.isMkv) {
      coverCellHtml = `
        <span class="chip neutral" style="font-size: 10px; padding: 3px 5px; opacity: 0.7;" title="In-place cover is only supported for MKV container">
          ${t("lbl_mkv_only") || "MKV only"}
        </span>
      `;
    } else {
      const displaySrc = item.coverDataUrl || "";
      coverCellHtml = `
        <div style="position: relative; width: 38px; height: 52px; border-radius: 4px; overflow: hidden; background: rgba(0,0,0,0.25); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; margin: 0 auto;" class="quick-cover-box" data-idx="${idx}" title="${t("lbl_cover_click_tooltip") || "Click to search online, preview or choose custom cover"}">
          ${displaySrc
            ? `<img src="${displaySrc}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">
               <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;"><svg style="width: 18px; height: 18px; color: var(--muted-text);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></div>`
            : (item.coverUrl
                ? `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; color: var(--muted-text); font-size: 13px;" title="Downloading cover...">⏳</div>`
                : `<svg style="width: 18px; height: 18px; color: var(--muted-text);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`)}
          <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;" class="quick-cover-overlay">
            <svg style="width: 16px; height: 16px; color: #fff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align: center; vertical-align: middle; padding: 8px 4px;">
        ${coverCellHtml}
      </td>
      <td style="vertical-align: middle; padding: 8px 12px; font-family: monospace;">
        <div style="font-weight: 600; font-size: 12.5px; color: var(--text); word-break: break-all;">${escapeHtml(item.filename)}</div>
        <div style="font-size: 11px; color: var(--muted-text); margin-top: 2px; opacity: 0.8; word-break: break-all;">${escapeHtml(folderPath)}</div>
      </td>
      <td style="vertical-align: middle; padding: 8px 12px;">
        <input type="text" class="quick-proposed-name-input" data-idx="${idx}" value="${escapeHtml(item.proposedName)}" style="width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 12px; font-family: monospace; color: var(--text); outline: none;">
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
          ${item.matchedSource ? `<span class="chip green" style="font-size: 10px; padding: 1px 5px;">✓ ${escapeHtml(item.matchedSource)}</span>` : ''}
          <span style="font-size: 10.5px; color: var(--muted-text);">Smart Output Pattern</span>
        </div>
      </td>
      <td style="text-align: center; vertical-align: middle; padding: 8px;">
        <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">
          ${specsHtml || '<span style="font-size: 11px; color: var(--muted-text);">-</span>'}
        </div>
      </td>
      <td style="text-align: center; vertical-align: middle; padding: 8px 4px;">
        <button class="btn btn-sm btn-quick-remove-row" data-idx="${idx}" title="${t("lbl_remove_item") || "Remove"}" style="padding: 5px 8px; color: var(--muted-text); background: transparent; border: 1px solid transparent; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </td>
    `;

    const nameInput = tr.querySelector(".quick-proposed-name-input");
    if (nameInput) {
      nameInput.addEventListener("input", (e) => {
        item.proposedName = e.target.value.trim();
      });
    }

    const coverBox = tr.querySelector(".quick-cover-box");
    if (coverBox) {
      coverBox.addEventListener("click", () => {
        openQuickMetadataModal(idx);
      });
      coverBox.addEventListener("mouseenter", () => {
        const overlay = coverBox.querySelector(".quick-cover-overlay");
        if (overlay) overlay.style.opacity = "1";
      });
      coverBox.addEventListener("mouseleave", () => {
        const overlay = coverBox.querySelector(".quick-cover-overlay");
        if (overlay) overlay.style.opacity = "0";
      });
    }

    const removeBtn = tr.querySelector(".btn-quick-remove-row");
    if (removeBtn) {
      removeBtn.addEventListener("mouseenter", () => {
        removeBtn.style.color = "var(--danger, #ef4444)";
        removeBtn.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        removeBtn.style.borderColor = "rgba(239, 68, 68, 0.25)";
      });
      removeBtn.addEventListener("mouseleave", () => {
        removeBtn.style.color = "var(--muted-text)";
        removeBtn.style.backgroundColor = "transparent";
        removeBtn.style.borderColor = "transparent";
      });
      removeBtn.addEventListener("click", () => {
        state.quickToolsFiles.splice(idx, 1);
        renderQuickToolsStage();
      });
    }

    el.quickTableBody.appendChild(tr);
  });
}

async function applyQuickBatch(mode = "rename") {
  if (state.quickToolsFiles.length === 0) return;

  const batchBtn = mode === "rename" ? el.btnQuickBatchRename : el.btnQuickBatchCover;
  if (batchBtn) {
    batchBtn.disabled = true;
  }

  try {
    let targets = state.quickToolsFiles;
    if (mode === "cover") {
      targets = state.quickToolsFiles.filter(f => f.isMkv);
      if (targets.length === 0) {
        await showAlertDialog({
          title: t("brand_title"),
          message: "No Matroska (.mkv) files found in the list. In-place cover injection is exclusively supported on MKV files.",
          icon: "⚠️"
        });
        return;
      }
    }

    // Ensure all remote covers are downloaded to local path before invoking mkvpropedit
    if (mode === "cover") {
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        if (!item.coverPath && item.coverUrl) {
          try {
            const safeKey = (item.filename || `item_${i}`).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 20);
            item.coverPath = await invoke("download_cover_image", { key: `quick_${safeKey}`, url: item.coverUrl });
            if (item.coverPath) {
              item.coverDataUrl = await invoke("read_image_data_url", { path: item.coverPath });
            }
          } catch (_) {}
        }
      }
    }

    const payloads = targets.map(item => ({
      file_path: item.filepath,
      new_filename: (mode === "rename") ? item.proposedName : null,
      cover_path: (mode === "cover") ? item.coverPath : null
    }));

    const results = await invoke("batch_in_place_action", { items: payloads });
    let successCount = 0;
    let errors = [];

    if (results && results.length > 0) {
      results.forEach((res, i) => {
        const item = targets[i];
        if (res.success) {
          successCount++;
          if (res.new_path) {
            item.filepath = res.new_path;
            item.filename = res.new_path.split(/[/\\]/).pop();
          }
          item.status = "done";
          const originalIdx = state.quickToolsFiles.indexOf(item);
          if (originalIdx >= 0) {
            const row = document.getElementById(`quick-row-${originalIdx}`);
            if (row) row.classList.add("row-flash-success");
          }
        } else if (res.error) {
          errors.push(`${item.filename}: ${res.error}`);
        }
      });
    }

    renderQuickToolsStage();

    if (errors.length > 0) {
      await showAlertDialog({
        title: "Notice",
        message: `Processed with errors (${successCount} succeeded, ${errors.length} failed):\n\n` + errors.slice(0, 3).join("\n"),
        icon: "⚠️"
      });
    } else {
      await showAlertDialog({
        title: t("brand_title"),
        message: mode === "rename"
          ? `Successfully renamed ${successCount} file(s) in-place!`
          : `Successfully injected covers into ${successCount} MKV file(s) in-place!`,
        icon: "✓"
      });
    }
  } catch (err) {
    console.error("Batch quick action error:", err);
    await showAlertDialog({ title: "Error", message: String(err), icon: "❌" });
  } finally {
    if (batchBtn) {
      batchBtn.disabled = false;
    }
  }
}

// Start application
window.addEventListener("DOMContentLoaded", init);
