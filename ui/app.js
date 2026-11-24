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
    hwAccel: "nvenc",
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
    aq: "enabled",
    doviAction: "retain"
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

// HandBrake & FFmpeg Presets Definitions (Strictly MKV Outputs)
const PRESET_MAP = {
  // NVIDIA NVENC
  "nvenc_4k_hevc": {
    label: "4K UHD 10-bit (H.265)",
    codec: "hevc_nvenc",
    resolution: "3840x2160",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "p5",
    tune: "hq",
    pixFmt: "p010le"
  },
  "nvenc_1080p_hevc": {
    label: "1080p High Quality (H.265)",
    codec: "hevc_nvenc",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "p5",
    tune: "hq",
    pixFmt: "p010le"
  },
  "nvenc_720p_hevc": {
    label: "720p Fast (H.265)",
    codec: "hevc_nvenc",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "24",
    preset: "p4",
    tune: "hq",
    pixFmt: "yuv420p"
  },
  "nvenc_1080p_h264": {
    label: "1080p Universal (H.264)",
    codec: "h264_nvenc",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "p5",
    tune: "hq",
    pixFmt: "yuv420p"
  },
  "nvenc_720p_h264": {
    label: "720p Universal (H.264)",
    codec: "h264_nvenc",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "23",
    preset: "p4",
    tune: "hq",
    pixFmt: "yuv420p"
  },

  // AMD AMF
  "amf_1080p_hevc": {
    label: "1080p High Quality (H.265)",
    codec: "hevc_amf",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "quality",
    tune: "none",
    pixFmt: "p010le"
  },
  "amf_720p_hevc": {
    label: "720p Balanced (H.265)",
    codec: "hevc_amf",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "24",
    preset: "balanced",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "amf_1080p_h264": {
    label: "1080p Universal (H.264)",
    codec: "h264_amf",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "quality",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "amf_720p_h264": {
    label: "720p Universal (H.264)",
    codec: "h264_amf",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "24",
    preset: "balanced",
    tune: "none",
    pixFmt: "yuv420p"
  },

  // Intel QSV
  "qsv_1080p_hevc": {
    label: "1080p Balanced (H.265)",
    codec: "hevc_qsv",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "medium",
    tune: "none",
    pixFmt: "p010le"
  },
  "qsv_720p_hevc": {
    label: "720p Fast (H.265)",
    codec: "hevc_qsv",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "24",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "qsv_1080p_h264": {
    label: "1080p Universal (H.264)",
    codec: "h264_qsv",
    resolution: "1920x1080",
    rateControl: "cqp",
    qualityVal: "22",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "qsv_720p_h264": {
    label: "720p Universal (H.264)",
    codec: "h264_qsv",
    resolution: "1280x720",
    rateControl: "cqp",
    qualityVal: "24",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },

  // CPU Archive
  "cpu_1080p_h265": {
    label: "1080p H.265 CRF 22",
    codec: "libx265",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "22",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "cpu_720p_h265": {
    label: "720p H.265 CRF 23",
    codec: "libx265",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "23",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "cpu_1080p_h264": {
    label: "1080p H.264 CRF 20",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "20",
    preset: "medium",
    tune: "none",
    pixFmt: "yuv420p"
  },
  "cpu_720p_h264": {
    label: "720p H.264 CRF 22",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "22",
    preset: "fast",
    tune: "none",
    pixFmt: "yuv420p"
  },

  // Web & Mobile (MKV)
  "web_1080p_mkv": {
    label: "Web & Stream: 1080p (MKV · H.264 / AAC)",
    codec: "libx264",
    resolution: "1920x1080",
    rateControl: "crf",
    qualityVal: "21",
    preset: "faster",
    tune: "none",
    pixFmt: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "192k",
    audioChannels: "2"
  },
  "social_720p_mkv": {
    label: "Social & Chat: 720p (MKV · H.264 / AAC)",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "23",
    preset: "faster",
    tune: "none",
    pixFmt: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "128k",
    audioChannels: "2"
  },
  "mobile_720p_mkv": {
    label: "Mobile Optimized: 720p (MKV · H.264 / AAC)",
    codec: "libx264",
    resolution: "1280x720",
    rateControl: "crf",
    qualityVal: "24",
    preset: "veryfast",
    tune: "none",
    pixFmt: "yuv420p",
    audioCodec: "aac",
    audioBitrate: "128k",
    audioChannels: "2"
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

    vCfgHwAccel: document.getElementById("vCfgHwAccel"),
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
    vCfgDoviAction: document.getElementById("vCfgDoviAction"),
    lblHdrDoviHeader: document.getElementById("lblHdrDoviHeader"),
    lblDoviAction: document.getElementById("lblDoviAction"),

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
    quickDoviTooltip: document.getElementById("quickDoviTooltip"),
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
    quickDoviAction: document.getElementById("quickDoviAction"),
    groupDoviAction: document.getElementById("groupDoviAction"),
    lblQuickDovi: document.getElementById("lblQuickDovi"),
    doviBadge: document.getElementById("doviBadge"),
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
    lbl_burn_sub: "حرق الترجمة داخل الصورة",
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
    queue_title: "قائمة مهام التحويل",
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
    lbl_setting_clear_track_names: "حذف تسميات المسارات تلقائياً",
    lbl_setting_clear_track_names_desc: "تجريد أسماء وعناوين المسارات وعنوان الحاوية المضمنة تلقائياً من ملف الفيديو النهائي (مفعل افتراضياً).",
    ctx_cut: "قص",
    ctx_copy: "نسخ",
    ctx_paste: "لصق",
    ctx_delete: "حذف",
    ctx_select_all: "تحديد الكل",
    lbl_nav_quick_tools: "أدوات فورية في مكان الملف",
    lbl_quick_tools_title: "أدوات التعديل الفوري في مكان الملف",
    lbl_quick_tools_desc: "إعادة تسمية الملفات وحقن البوستر في حاوية MKV في أقل من ثانية واحدة دون إنشاء ملف جديد.",
    lbl_quick_add_files: "إضافة ملفات",
    lbl_quick_batch_rename: "تسمية الكل",
    lbl_quick_batch_cover: "تحديث الغلاف فقط",
    lbl_hdr_dovi_header: "تقنية HDR و Dolby Vision",
    lbl_dovi_action: "معالجة HDR / DV",
    lbl_quick_dovi: "HDR / DV",
    opt_dovi_retain: "إبقاء DV",
    opt_dovi_p81: "إلى Profile 8.1",
    opt_dovi_strip: "حذف DV",
    opt_dovi_sdr: "إلى SDR",
    warn_dovi_p5_title: "تنبيه Dolby Vision Profile 5",
    warn_dovi_p5_msg: "هذا الملف بتنسيق Dolby Vision Profile 5 ولا يحتوي على طبقة أساسية HDR10 متوافقة. الحذف الفوري سيؤدي إلى ظهور الألوان بدرجات بنفسجية وخضراء مشوهة.\n\nيُفضل اختيار 'تحويل الألوان إلى SDR' للحصول على أفضل جودة على الشاشات العادية.\n\nهل ترغب بالمتابعة بالحذف الفوري على أي حال؟",
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
    btn_quick_applied: "تم بنجاح",
    lbl_inside_container: "داخل الحاوية الأصلية",
    lbl_external_files: "ملفات خارجية ومضافة",
    lbl_files: "ملفات",
    opt_action_keep: "إبقاء",
    opt_action_add: "إضافة",
    opt_action_burn: "حرق",
    opt_action_remove: "حذف",
    opt_action_convert: "تحويل",
    opt_yes: "نعم",
    lbl_none: "لا يوجد",
    lbl_output: "المخرج",
    status_waiting: "في الانتظار",
    status_converting: "جاري التحويل",
    status_paused: "مؤقت",
    status_skipped: "تم التخطي",
    status_done: "اكتمل",
    status_failed: "فشل",
    lbl_about_edition: "النسخة الرسمية",
    btn_back: "رجوع",
    lbl_all_videos_ready: "جميع الفيديوهات جاهزة",
    lbl_shared_attachments_title: "المرفقات المشتركة",
    lbl_shared_attachments_sub: "تُضاف لجميع الفيديوهات المصدرة",
    lbl_remove_old_attachments_chk: "إزالة المرفقات القديمة أولاً",
    th_track: "المسار",
    th_details: "التفاصيل",
    th_lang: "اللغة",
    th_default: "افتراضي",
    th_delay: "تأخير (ms)",
    th_action: "الإجراء",
    th_video: "الفيديو",
    th_plan_col: "العملية المنجزة",
    th_progress_col: "التقدم",
    th_status_col: "الحالة",
    lbl_video_codec_section: "الدقة والترميز والجودة",
    lbl_video_codec_section_desc: "تحديد نوع مشفر الفيديو، أبعاد الصورة، ونمط التحكم بمعدل البت",
    lbl_video_codec: "ترميز الفيديو",
    hint_video_codec: "المعالجة ببطاقة الرسومات فائقة السرعة؛ بينما المعالج يمنح ضغطاً أعلى.",
    lbl_video_resolution: "دقة العرض",
    hint_video_resolution: "أبعاد إطار الفيديو؛ خيار الأصلي يحافظ على الأبعاد دون تغيير.",
    lbl_video_rate_control: "نمط التحكم بالجودة أو البت",
    hint_video_rate_control: "نمط CQP أو CRF يضمن جودة بصرية ثابتة ونقية طوال مشاهد الفيديو.",
    lbl_video_copy_notice_title: "نمط النسخ المباشر مفعل:",
    lbl_video_copy_notice_desc: "يتم نسخ مسار الفيديو من الملف الأصلي دون إعادة تشفير وبدون أي فقدان للجودة. خيارات التشفير بالأسفل يتم تجاوزها تلقائياً.",
    lbl_video_opt_section: "سرعة التشفير وضبط التوافق المتقدم",
    lbl_video_opt_section_desc: "ضبط سرعة المعالجة، عمق الألوان، وملفات التوافق مع مشغلات وشاشات العرض",
    lbl_video_preset: "سرعة المعالجة وجودة الضغط",
    hint_video_preset: "الإعداد الأعلى يمنح ضغطاً وجودة أفضل، بينما الإعداد الأسرع يقلل وقت المعالجة.",
    lbl_video_tune: "نمط التحسين",
    hint_video_tune: "توجيه خوارزمية المشفر لتناسب الأفلام السينمائية أو الرسوم المتحركة أو السرعة.",
    lbl_video_pixfmt: "عمق الألوان",
    hint_video_pixfmt: "عمق 10 بت يمنع التدرج اللوني ويدعم الألوان الديناميكية، وعمق 8 بت للشاشات القياسية.",
    lbl_video_multipass: "التشفير متعدد التمريرات",
    hint_video_multipass: "التمرير الواحد سريع؛ والتمريران يعطيان توزيعاً مثالياً لمعدل البت.",
    lbl_video_profile: "الملف التعريفي للتوافق",
    hint_video_profile: "معيار توافق المشغل؛ يُنصح بـ auto لتحديد الأنسب تلقائياً.",
    lbl_video_level: "مستوى التوافق",
    hint_video_level: "حدود العتاد وأقصى دقة مدعومة؛ يُنصح بـ auto ليطابق دقة الفيديو المحددة.",
    lbl_video_aq: "توزيع الجودة التكيفي",
    hint_video_aq: "خوارزمية ذكية تحافظ على تفاصيل المشاهد المظلمة وتمنع ظهور المربعات والتشويش.",
    lbl_hdr_dovi_desc: "التحكم في بيانات دولبي فيجن الديناميكية وتحويل نطاق الألوان للشاشات العادية",
    lbl_audio_copy_notice_title: "نمط النسخ المباشر مفعل:",
    lbl_audio_copy_notice_desc: "يتم نسخ مسارات الصوت الأصلية كما هي دون إعادة تشفير أو أي فقدان للجودة. إعدادات القنوات والبت بالأسفل يتم تجاوزها.",
    lbl_audio_section_title: "ترميز وقنوات الصوت",
    lbl_audio_section_desc: "تحديد صيغة ضغط الصوت، توزيع القنوات، ومعدل البت المناسب",
    lbl_audio_codec: "ترميز الصوت",
    hint_audio_codec: "خيار النسخ يحافظ على الصوت الأصلي؛ بينما AAC و Opus يمنحان صوتاً نقياً بحجم خفيف.",
    lbl_audio_channels: "القنوات الصوتية",
    hint_audio_channels: "ستيريو للسماعات والشاشات؛ وقنوات متعددة للصوت المحيطي والمسارح المنزلية.",
    lbl_audio_bitrate: "معدل البت الصوتي",
    hint_audio_bitrate: "معدل 192k ممتاز للستيريو؛ ومعدلات أعلى موصى بها للصوت المحيطي.",
    lbl_audio_samplerate: "تردد العينات",
    hint_audio_samplerate: "تردد 48000 Hz هو المعيار القياسي للأفلام والمسلسلات.",
    lbl_audio_guide_title: "دليل وتوصيات اختيار صيغ الصوت",
    lbl_audio_guide_copy: "نسخ فوري بدون أي فقدان، يحافظ على مسارات الماستر الأصلية بالكامل.",
    lbl_audio_guide_aac: "الخيار الأفضل للويب والأجهزة المحمولة بحجم خفيف وجودة نقية.",
    lbl_audio_guide_ac3: "معيار دولبي ديجيتال للتوافق مع أجهزة التلفاز القديمة ومكبرات الصوت.",
    lbl_audio_guide_flac: "ضغط صوتي بدون أي فقدان، يحافظ على الإشارة الصوتية الأصلية بالكامل.",
    lbl_live_video_pipeline: "معاينة إعدادات تصدير الفيديو المباشرة",
    lbl_live_audio_pipeline: "معاينة إعدادات تصدير الصوت المباشرة",
    lbl_hw_engine_title: "محرك المعالجة وكرت الشاشة",
    lbl_hw_engine_desc: "اختر بطاقة الرسومات أو المعالج المستخدم في التشفير لتوفير أقصى سرعة وأعلى توافق",
    lbl_hw_nvenc_title: "NVIDIA NVENC",
    lbl_hw_nvenc_desc: "تسريع عتادي فائق عبر كروت نفيديا جيفورس",
    lbl_hw_amf_title: "AMD AMF",
    lbl_hw_amf_desc: "تسريع عتادي عبر كروت شاشة أيه إم دي راديون",
    lbl_hw_qsv_title: "Intel QuickSync",
    lbl_hw_qsv_desc: "تسريع عتادي مدمج عبر معالجات وكروت إنتل",
    lbl_hw_cpu_title: "المعالج المركزي",
    lbl_hw_cpu_desc: "تشفير برمجي عالي الضغط والجودة عبر المعالج المركزي",
    lbl_setting_language_header: "واجهة البرنامج واللغة",
    lbl_general_ui_desc: "تخصيص لغة القوائم ونمط العرض والألوان للواجهة",
    lbl_setting_theme_title: "نمط المظهر",
    hint_setting_theme: "الوضع الليلي عالي التباين أو الوضع الفاتح الكلاسيكي",
    lbl_setting_accent_title: "اللون التمييزي",
    hint_setting_accent: "لون الأزرار وعناصر التركيز والشارات في البرنامج",
    lbl_setting_default_langs_header: "المسارات الافتراضية المفضلة",
    lbl_general_tracks_desc: "اللغات التي يتم اختيارها وتفعيلها تلقائياً عند استيراد الفيديوهات",
    lbl_setting_def_audio_title: "لغة الصوت الافتراضية",
    hint_setting_def_audio: "المسار الذي يتم تعيينه كصوت رئيسي افتراضي عند توفره",
    lbl_setting_def_sub_title: "لغة الترجمة الافتراضية",
    hint_setting_def_sub: "مسار الترجمة الذي يتم تفعيله كافتراضي وتشغيله مع الفيديو",
    hint_setting_app_language: "تغيير لغة البرنامج والقوائم والإشعارات فورياً",
    btn_apply_meta_all_episodes: "تطبيق على جميع الحلقات",
    btn_apply_meta_this_video: "تطبيق على هذا الفيديو",
    btn_clear_media_info: "مسح البيانات والغلاف",
    btn_cancel_meta: "إغلاق"
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
    lbl_setting_clear_track_names: "Clear Track Names & Titles (Video, audio & subtitles)",
    lbl_setting_clear_track_names_desc: "Automatically remove embedded title tags and container titles from video, audio, and subtitle tracks in the final output file (active by default).",
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
    lbl_hdr_dovi_header: "HDR & Dolby Vision",
    lbl_dovi_action: "HDR / DV Action",
    lbl_quick_dovi: "HDR / DV",
    opt_dovi_retain: "Keep DV",
    opt_dovi_p81: "To Profile 8.1",
    opt_dovi_strip: "Strip DV",
    opt_dovi_sdr: "To SDR",
    warn_dovi_p5_title: "Dolby Vision Profile 5 Warning",
    warn_dovi_p5_msg: "This file is Dolby Vision Profile 5 and lacks a standard HDR10 base layer. Instant stripping will cause distorted green and purple colors on normal displays.\n\nWe recommend using 'Convert to SDR (Tone-Map BT.709)' instead.\n\nDo you want to proceed with instant stripping anyway?",
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
    btn_quick_applied: "Done",
    lbl_inside_container: "Inside original container",
    lbl_external_files: "External & Added files",
    lbl_files: "files",
    opt_action_keep: "Keep",
    opt_action_add: "Add",
    opt_action_burn: "Burn",
    opt_action_remove: "Remove",
    opt_action_convert: "Convert",
    opt_yes: "Yes",
    lbl_none: "None",
    lbl_output: "Output",
    status_waiting: "Waiting",
    status_converting: "Converting",
    status_paused: "Paused",
    status_skipped: "Skipped",
    status_done: "Done",
    status_failed: "Failed",
    lbl_about_edition: "Official Edition",
    btn_back: "Back",
    lbl_all_videos_ready: "All videos ready",
    lbl_shared_attachments_title: "Shared Attachments",
    lbl_shared_attachments_sub: "Added to all exported videos",
    lbl_remove_old_attachments_chk: "Remove old attachments first",
    th_track: "Track",
    th_details: "Details",
    th_lang: "Language",
    th_default: "Default",
    th_delay: "Delay (ms)",
    th_action: "Action",
    th_video: "Video",
    th_plan_col: "Plan",
    th_progress_col: "Progress",
    th_status_col: "Status",
    lbl_video_codec_section: "Resolution & Codec",
    lbl_video_codec_section_desc: "Configure video encoder format, output dimensions, and quality rate control",
    lbl_video_codec: "Video Codec",
    hint_video_codec: "Hardware (NVIDIA NVENC) is fast; CPU offers maximum compression.",
    lbl_video_resolution: "Resolution",
    hint_video_resolution: "Output frame dimensions; Original preserves source size.",
    lbl_video_rate_control: "Rate Control Mode",
    hint_video_rate_control: "CQP/CRF delivers consistent visual quality throughout.",
    lbl_video_copy_notice_title: "Copy Mode Active:",
    lbl_video_copy_notice_desc: "Video streams are copied directly from the source without re-encoding (instant 0-loss conversion). Encoding settings below are bypassed.",
    lbl_video_opt_section: "Encoding Optimization & Compatibility",
    lbl_video_opt_section_desc: "Fine-tune encoder speed, color precision, profiles, and motion quality",
    lbl_video_preset: "Encoder Preset / Speed",
    hint_video_preset: "Higher preset = Better compression & quality; slower encoding.",
    lbl_video_tune: "Tune",
    hint_video_tune: "Tuning target tailored to movies, animation, or speed.",
    lbl_video_pixfmt: "Color Depth / Pixel Format",
    hint_video_pixfmt: "10-bit eliminates color banding in gradients and sky scenes.",
    lbl_video_multipass: "Multipass Encoding",
    hint_video_multipass: "Single pass is fast; Two-pass optimizes bitrate distribution.",
    lbl_video_profile: "Profile",
    hint_video_profile: "Decoder capability set; 'auto' chooses the best match.",
    lbl_video_level: "Level",
    hint_video_level: "Playback device hardware limits; 'auto' fits resolution.",
    lbl_video_aq: "Adaptive Quantization (AQ)",
    hint_video_aq: "Dynamic quality allocation that prevents compression artifacts in dark scenes.",
    lbl_hdr_dovi_desc: "Manage Dolby Vision dynamic metadata and HDR tone-mapping",
    lbl_audio_copy_notice_title: "Passthrough Mode Active:",
    lbl_audio_copy_notice_desc: "Original audio tracks (DTS-HD, TrueHD, AC3, FLAC, AAC, etc.) are copied untouched without quality loss or re-encoding. Channel and bitrate settings below are bypassed.",
    lbl_audio_section_title: "Audio Codec & Output Format",
    lbl_audio_section_desc: "Select audio compression format, channel arrangement, and bitrate fidelity",
    lbl_audio_codec: "Audio Codec",
    hint_audio_codec: "Copy preserves original audio streams; AAC & Opus provide great quality at low bitrates.",
    lbl_audio_channels: "Channels",
    hint_audio_channels: "Stereo for general listening; 5.1/7.1 for surround home cinema.",
    lbl_audio_bitrate: "Quality / Bitrate",
    hint_audio_bitrate: "192k for high quality stereo; 448k - 640k for crisp 5.1 surround.",
    lbl_audio_samplerate: "Sample Rate",
    hint_audio_samplerate: "48 kHz is the global standard for movie and TV audio tracks.",
    lbl_audio_guide_title: "Audio Format Recommendations",
    lbl_audio_guide_copy: "Instant 0-loss copy. Retains DTS-HD, TrueHD, Atmos & original master tracks intact.",
    lbl_audio_guide_aac: "Best choice for web, mobile, and small files. Excellent transparency at 160-192k.",
    lbl_audio_guide_ac3: "Standard Dolby Digital for maximum compatibility with older TVs and Soundbars.",
    lbl_audio_guide_flac: "Lossless PCM compression. Completely preserves original waveform without any compression loss.",
    lbl_live_video_pipeline: "Live Video Pipeline Preview",
    lbl_live_audio_pipeline: "Live Audio Pipeline Preview",
    lbl_hw_engine_title: "Hardware Processing Engine & GPU",
    lbl_hw_engine_desc: "Select the graphics card or CPU encoder engine for optimal speed and compatibility",
    lbl_hw_nvenc_title: "NVIDIA NVENC",
    lbl_hw_nvenc_desc: "Hardware encoding via NVIDIA GeForce GPU (Fast 10-bit & AV1)",
    lbl_hw_amf_title: "AMD AMF",
    lbl_hw_amf_desc: "Hardware encoding via AMD Radeon GPU & Ryzen APU",
    lbl_hw_qsv_title: "Intel QuickSync",
    lbl_hw_qsv_desc: "Hardware encoding via Intel Arc GPU & Core i-Series QuickSync",
    lbl_hw_cpu_title: "Software CPU",
    lbl_hw_cpu_desc: "Software encoding on processor (Maximum compression & compatibility)",
    lbl_setting_language_header: "Interface & Language",
    lbl_general_ui_desc: "Customize UI language, display theme mode, and accent highlights",
    lbl_setting_theme_title: "Theme Mode",
    hint_setting_theme: "Dark eye-friendly mode or classic bright light mode",
    lbl_setting_accent_title: "Accent Highlight Color",
    hint_setting_accent: "Color for interactive buttons, focus rings, and active badges",
    lbl_setting_default_langs_header: "Preferred Default Tracks",
    lbl_general_tracks_desc: "Languages automatically prioritized for playback when importing media",
    lbl_setting_def_audio_title: "Default Audio Language",
    hint_setting_def_audio: "Audio track automatically flagged as default primary track",
    lbl_setting_def_sub_title: "Default Subtitle Language",
    hint_setting_def_sub: "Subtitle stream automatically selected and enabled for playback",
    hint_setting_app_language: "Instantly change application UI menus, guides, and notifications",
    btn_apply_meta_all_episodes: "Apply to All Episodes",
    btn_apply_meta_this_video: "Apply to This Video",
    btn_clear_media_info: "Clear Info & Cover",
    btn_cancel_meta: "Close"
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
    ctx_select_all: "Tout sélectionner",
    lbl_video_codec_section: "Résolution & Codec",
    lbl_video_codec_section_desc: "Configurer le codec vidéo, la résolution et le contrôle du débit",
    lbl_video_codec: "Codec vidéo",
    hint_video_codec: "L'accélération matérielle (NVENC) est rapide ; le CPU offre une compression maximale.",
    lbl_video_resolution: "Résolution",
    hint_video_resolution: "Dimensions de sortie ; Original conserve la résolution source.",
    lbl_video_rate_control: "Mode de contrôle du débit",
    hint_video_rate_control: "CQP/CRF offre une qualité visuelle constante tout au long de la vidéo.",
    lbl_video_copy_notice_title: "Mode Copie actif :",
    lbl_video_copy_notice_desc: "Les flux vidéo sont copiés directement sans réencodage (instantané sans perte). Les options d'encodage ci-dessous sont ignorées.",
    lbl_video_opt_section: "Optimisation de l'encodage & Compatibilité",
    lbl_video_opt_section_desc: "Ajustez la vitesse de l'encodeur, la précision des couleurs et les profils",
    lbl_video_preset: "Vitesse d'encodage (Preset)",
    hint_video_preset: "Un préréglage plus élevé offre une meilleure compression mais un encodage plus lent.",
    lbl_video_tune: "Optimisation (Tune)",
    hint_video_tune: "Cible d'optimisation adaptée aux films, à l'animation ou à la vitesse.",
    lbl_video_pixfmt: "Profondeur de couleur",
    hint_video_pixfmt: "10-bit élimine les effets de bandes de couleur et prend en charge le HDR.",
    lbl_video_multipass: "Encodage multi-passes",
    hint_video_multipass: "Une seule passe est rapide ; deux passes optimisent le débit.",
    lbl_video_profile: "Profil",
    hint_video_profile: "Jeu de fonctionnalités du décodeur ; 'auto' choisit la meilleure option.",
    lbl_video_level: "Niveau (Level)",
    hint_video_level: "Limites matérielles de lecture ; 'auto' s'adapte à la résolution.",
    lbl_video_aq: "Quantification adaptative (AQ)",
    hint_video_aq: "Allocation dynamique de qualité évitant les artefacts dans les scènes sombres.",
    lbl_hdr_dovi_desc: "Gérer les métadonnées dynamiques Dolby Vision et le mappage HDR",
    lbl_audio_copy_notice_title: "Mode Copie audio actif :",
    lbl_audio_copy_notice_desc: "Les pistes audio d'origine (DTS-HD, TrueHD, AC3, FLAC, AAC) sont conservées sans réencodage ni perte. Les paramètres de canaux et débit ci-dessous sont ignorés.",
    lbl_audio_section_title: "Codec audio & Format de sortie",
    lbl_audio_section_desc: "Sélectionnez le format audio, la disposition des canaux et le débit",
    lbl_audio_codec: "Codec audio",
    hint_audio_codec: "Copy conserve les pistes d'origine ; AAC et Opus offrent une excellente qualité avec des fichiers légers.",
    lbl_audio_channels: "Canaux",
    hint_audio_channels: "Stéréo (2.0) pour casques et TV ; 5.1/7.1 pour son surround home cinéma.",
    lbl_audio_bitrate: "Débit audio (Bitrate)",
    hint_audio_bitrate: "192k pour une stéréo haute fidélité ; 384k - 640k recommandé pour le surround 5.1.",
    lbl_audio_samplerate: "Fréquence d'échantillonnage",
    hint_audio_samplerate: "48 kHz est la norme standard pour les films et séries.",
    lbl_audio_guide_title: "Recommandations pour les formats audio",
    lbl_audio_guide_copy: "Copie instantanée sans perte. Conserve les masters DTS-HD MA et Atmos intacts.",
    lbl_audio_guide_aac: "Meilleur choix pour le streaming et mobile. Excellente clarté à 160-192k.",
    lbl_audio_guide_ac3: "Dolby Digital standard pour une compatibilité maximale avec les TV anciennes.",
    lbl_audio_guide_flac: "Compression PCM sans perte. Préserve l'onde audio à 100%.",
    lbl_live_video_pipeline: "Aperçu en direct du profil vidéo",
    lbl_live_audio_pipeline: "Aperçu en direct du profil audio",
    lbl_hw_engine_title: "Moteur de traitement & Accélération GPU",
    lbl_hw_engine_desc: "Choisissez le processeur ou la carte graphique pour un encodage optimal",
    lbl_hw_nvenc_title: "NVIDIA NVENC",
    lbl_hw_nvenc_desc: "Accélération matérielle ultra-rapide (GeForce RTX / GTX)",
    lbl_hw_amf_title: "AMD AMF",
    lbl_hw_amf_desc: "Accélération matérielle via Radeon (RX Series)",
    lbl_hw_qsv_title: "Intel QuickSync",
    lbl_hw_qsv_desc: "Accélération processeur Intel et cartes Intel Arc",
    lbl_hw_cpu_title: "CPU Logiciel",
    lbl_hw_cpu_desc: "Encodage logiciel haute compression par le processeur",
    lbl_setting_language_header: "Interface & Langue",
    lbl_general_ui_desc: "Personnalisez la langue de l'interface, le thème et les couleurs",
    lbl_setting_theme_title: "Mode de thème",
    hint_setting_theme: "Thème sombre reposant pour les yeux ou thème clair",
    lbl_setting_accent_title: "Couleur d'accentuation",
    hint_setting_accent: "Couleur des boutons, anneaux de focus et badges actifs",
    lbl_setting_default_langs_header: "Pistes par défaut préférées",
    lbl_general_tracks_desc: "Langues automatiquement sélectionnées lors de l'importation",
    lbl_setting_def_audio_title: "Langue audio par défaut",
    hint_setting_def_audio: "Piste audio définie automatiquement par défaut à l'ouverture",
    lbl_setting_def_sub_title: "Langue de sous-titres par défaut",
    hint_setting_def_sub: "Sous-titres automatiquement activés pour la lecture",
    hint_setting_app_language: "Changez instantanément la langue des menus et de l'interface",
    btn_apply_meta_all_episodes: "Appliquer à tous les épisodes",
    btn_apply_meta_this_video: "Appliquer à cette vidéo",
    btn_clear_media_info: "Effacer les infos et la couverture",
    btn_cancel_meta: "Fermer"
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
    ctx_select_all: "Seleccionar todo",
    lbl_video_codec_section: "Resolución y Códec",
    lbl_video_codec_section_desc: "Configura el formato del codificador de vídeo, resolución y control de tasa",
    lbl_video_codec: "Códec de vídeo",
    hint_video_codec: "La aceleración por hardware (NVENC) es rápida; la CPU ofrece máxima compresión.",
    lbl_video_resolution: "Resolución",
    hint_video_resolution: "Dimensiones de salida; Original conserva el tamaño original.",
    lbl_video_rate_control: "Modo de control de tasa",
    hint_video_rate_control: "CQP/CRF ofrece una calidad visual constante en todo el vídeo.",
    lbl_video_copy_notice_title: "Modo Copia activo:",
    lbl_video_copy_notice_desc: "El vídeo se copia directamente sin recodificar (instantáneo y sin pérdida). Los ajustes inferiores se omiten.",
    lbl_video_opt_section: "Optimización de codificación y Compatibilidad",
    lbl_video_opt_section_desc: "Ajusta la velocidad del codificador, profundidad de color y perfiles",
    lbl_video_preset: "Velocidad de codificación (Preset)",
    hint_video_preset: "Un preajuste más alto ofrece mejor compresión y calidad; codificación más lenta.",
    lbl_video_tune: "Ajuste (Tune)",
    hint_video_tune: "Optimización para películas, animación o velocidad en tiempo real.",
    lbl_video_pixfmt: "Profundidad de color",
    hint_video_pixfmt: "10-bit elimina el efecto de bandas de color y admite HDR nativo.",
    lbl_video_multipass: "Codificación multipaso",
    hint_video_multipass: "Un solo paso es rápido; dos pasos optimizan la distribución de tasa de bits.",
    lbl_video_profile: "Perfil",
    hint_video_profile: "Conjunto de compatibilidad; 'auto' elige la mejor opción.",
    lbl_video_level: "Nivel (Level)",
    hint_video_level: "Límites del reproductor; 'auto' se ajusta a la resolución.",
    lbl_video_aq: "Cuantización adaptativa (AQ)",
    hint_video_aq: "Asignación inteligente de calidad que evita artefactos en escenas oscuras.",
    lbl_hdr_dovi_desc: "Administra los metadatos dinámicos de Dolby Vision y el mapeo HDR",
    lbl_audio_copy_notice_title: "Modo Copia de audio activo:",
    lbl_audio_copy_notice_desc: "Las pistas de audio originales (DTS-HD, TrueHD, AC3, FLAC, AAC) se copian sin pérdida ni recodificación.",
    lbl_audio_section_title: "Códec y formato de audio",
    lbl_audio_section_desc: "Selecciona el formato de audio, distribución de canales y tasa de bits",
    lbl_audio_codec: "Códec de audio",
    hint_audio_codec: "Copy conserva el audio original; AAC y Opus ofrecen gran calidad en tamaños reducidos.",
    lbl_audio_channels: "Canales",
    hint_audio_channels: "Estéreo (2.0) para auriculares y TV; 5.1/7.1 para cine en casa envolvente.",
    lbl_audio_bitrate: "Tasa de bits (Bitrate)",
    hint_audio_bitrate: "192k para estéreo de alta calidad; 384k - 640k recomendado para 5.1 envolvente.",
    lbl_audio_samplerate: "Frecuencia de muestreo",
    hint_audio_samplerate: "48 kHz es el estándar para películas y series.",
    lbl_audio_guide_title: "Recomendaciones de formatos de audio",
    lbl_audio_guide_copy: "Copia instantánea sin pérdida. Mantiene intactas las pistas máster DTS-HD MA y Atmos.",
    lbl_audio_guide_aac: "Mejor opción para web y móviles. Gran claridad a 160-192k.",
    lbl_audio_guide_ac3: "Dolby Digital estándar para máxima compatibilidad con televisores antiguos.",
    lbl_audio_guide_flac: "Compresión PCM sin pérdida. Conserva el 100% de la señal original.",
    lbl_live_video_pipeline: "Vista previa en directo del perfil de vídeo",
    lbl_live_audio_pipeline: "Vista previa en directo del perfil de audio",
    lbl_hw_engine_title: "Motor de procesamiento y Aceleración GPU",
    lbl_hw_engine_desc: "Seleccione la tarjeta gráfica o CPU para una velocidad y compatibilidad óptimas",
    lbl_hw_nvenc_title: "NVIDIA NVENC",
    lbl_hw_nvenc_desc: "Aceleración de alta velocidad por hardware (GeForce RTX / GTX)",
    lbl_hw_amf_title: "AMD AMF",
    lbl_hw_amf_desc: "Aceleración por hardware mediante Radeon (RX Series)",
    lbl_hw_qsv_title: "Intel QuickSync",
    lbl_hw_qsv_desc: "Aceleración integrada de Intel y tarjetas Intel Arc",
    lbl_hw_cpu_title: "CPU Software",
    lbl_hw_cpu_desc: "Codificación por software de alta compresión mediante CPU",
    lbl_setting_language_header: "Interfaz e Idioma",
    lbl_general_ui_desc: "Personalice el idioma de la interfaz, el tema y los colores",
    lbl_setting_theme_title: "Modo de tema",
    hint_setting_theme: "Modo oscuro cómodo para la vista o modo claro clásico",
    lbl_setting_accent_title: "Color de énfasis",
    hint_setting_accent: "Color para botones, bordes activos y elementos destacados",
    lbl_setting_default_langs_header: "Pistas predeterminadas preferidas",
    lbl_general_tracks_desc: "Idiomas seleccionados automáticamente al importar vídeos",
    lbl_setting_def_audio_title: "Idioma de audio predeterminado",
    hint_setting_def_audio: "Pista de audio marcada automáticamente como principal",
    lbl_setting_def_sub_title: "Idioma de subtítulos predeterminado",
    hint_setting_def_sub: "Flujo de subtítulos activado automáticamente para reproducción",
    hint_setting_app_language: "Cambie al instante el idioma de menús y avisos",
    btn_apply_meta_all_episodes: "Aplicar a todos los episodios",
    btn_apply_meta_this_video: "Aplicar a este video",
    btn_clear_media_info: "Borrar info y portada",
    btn_cancel_meta: "Cerrar"
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
    ctx_select_all: "Tümünü Seç",
    lbl_video_codec_section: "Çözünürlük ve Kodek",
    lbl_video_codec_section_desc: "Video kodlayıcı biçimini, çözünürlüğü ve kalite oran kontrolünü yapılandırın",
    lbl_video_codec: "Video Kodeği",
    hint_video_codec: "Donanım hızlandırma (NVENC) çok hızlıdır; CPU en yüksek sıkıştırmayı sunar.",
    lbl_video_resolution: "Çözünürlük",
    hint_video_resolution: "Çıkış video boyutları; Original kaynak boyutunu korur.",
    lbl_video_rate_control: "Oran Kontrol Modu",
    hint_video_rate_control: "CQP/CRF video boyunca tutarlı görsel kalite sağlar.",
    lbl_video_copy_notice_title: "Kopya Modu Etkin:",
    lbl_video_copy_notice_desc: "Video akışları yeniden kodlanmadan doğrudan kaynaktan kopyalanır (kayıpsız ve anında). Aşağıdaki kodlama ayarları atlanır.",
    lbl_video_opt_section: "Kodlama Optimizasyonu ve Uyumluluk",
    lbl_video_opt_section_desc: "Kodlayıcı hızını, renk derinliğini ve uyumluluk profillerini ayarlayın",
    lbl_video_preset: "Kodlayıcı Hızı (Preset)",
    hint_video_preset: "Daha yüksek ön ayar daha iyi sıkıştırma sağlar; kodlama süresi uzar.",
    lbl_video_tune: "Ayar (Tune)",
    hint_video_tune: "Filmler, animasyon veya hız için özel hedef ayarı.",
    lbl_video_pixfmt: "Renk Derinliği",
    hint_video_pixfmt: "10-bit renk geçişlerindeki bantlanmayı önler ve HDR destekler.",
    lbl_video_multipass: "Çok Geçişli Kodlama",
    hint_video_multipass: "Tek geçiş hızlıdır; iki geçiş veri hızını en iyi şekilde dağıtır.",
    lbl_video_profile: "Profil",
    hint_video_profile: "Oynatıcı uyumluluk seviyesi; 'auto' en iyi seçimi yapar.",
    lbl_video_level: "Seviye (Level)",
    hint_video_level: "Donanım sınırları; 'auto' çözünürlüğe göre ayarlanır.",
    lbl_video_aq: "Uyarlanabilir Kuantalama (AQ)",
    hint_video_aq: "Karanlık sahnelerde bozulmaları önleyen akıllı kalite dağıtımı.",
    lbl_hdr_dovi_desc: "Dolby Vision dinamik meta verilerini ve HDR ton eşlemesini yönetin",
    lbl_audio_copy_notice_title: "Ses Doğrudan Kopyalama Etkin:",
    lbl_audio_copy_notice_desc: "Orijinal ses parçaları (DTS-HD, TrueHD, AC3, FLAC, AAC) yeniden kodlanmadan kayıpsız kopyalanır.",
    lbl_audio_section_title: "Ses Kodeği ve Çıkış Biçimi",
    lbl_audio_section_desc: "Ses sıkıştırma biçimini, kanal düzenini ve bit hızını seçin",
    lbl_audio_codec: "Ses Kodeği",
    hint_audio_codec: "Copy orijinal ses parçalarını korur; AAC ve Opus düşük boyutta yüksek netlik sunar.",
    lbl_audio_channels: "Kanallar",
    hint_audio_channels: "Kulaklık ve TV için Stereo (2.0); ev sineması için 5.1/7.1 Surround.",
    lbl_audio_bitrate: "Bit Hızı (Bitrate)",
    hint_audio_bitrate: "Yüksek kaliteli stereo için 192k; 5.1 surround için 384k - 640k önerilir.",
    lbl_audio_samplerate: "Örnekleme Hızı",
    hint_audio_samplerate: "48 kHz film ve diziler için küresel standarttır.",
    lbl_audio_guide_title: "Ses Biçimi Önerileri",
    lbl_audio_guide_copy: "Anında 0 kayıplı kopya. Orijinal DTS-HD MA ve Atmos master parçalarını korur.",
    lbl_audio_guide_aac: "Web ve mobil için en iyi seçim. 160-192k hızında üstün netlik.",
    lbl_audio_guide_ac3: "Eski TV'ler ve Soundbar'lar ile maksimum uyumluluk için standart Dolby Digital.",
    lbl_audio_guide_flac: "Kayıpsız PCM sıkıştırma. Orijinal ses dalgasını %100 korur.",
    lbl_live_video_pipeline: "Canlı Video Çıktı Önizlemesi",
    lbl_live_audio_pipeline: "Canlı Ses Çıktı Önizlemesi",
    lbl_hw_engine_title: "Donanım İşleme Motoru & GPU Hızlandırma",
    lbl_hw_engine_desc: "Maksimum hız ve uyumluluk için grafik kartınızı veya işlemcinizi seçin",
    lbl_hw_nvenc_title: "NVIDIA NVENC",
    lbl_hw_nvenc_desc: "GeForce RTX / GTX kartları için yüksek hızlı donanım hızlandırma",
    lbl_hw_amf_title: "AMD AMF",
    lbl_hw_amf_desc: "Radeon (RX Serisi) kartları için donanım hızlandırma",
    lbl_hw_qsv_title: "Intel QuickSync",
    lbl_hw_qsv_desc: "Entegre Intel ve Intel Arc GPU hızlandırma desteği",
    lbl_hw_cpu_title: "İşlemci (CPU)",
    lbl_hw_cpu_desc: "İşlemci ile yüksek sıkıştırma ve görüntü kalitesi",
    lbl_setting_language_header: "Arayüz ve Dil",
    lbl_general_ui_desc: "Arayüz dilini, ekran temasını ve vurgu renklerini özelleştirin",
    lbl_setting_theme_title: "Tema Modu",
    hint_setting_theme: "Göz dostu koyu mod veya klasik aydınlık tema",
    lbl_setting_accent_title: "Vurgu Rengi",
    hint_setting_accent: "Düğmeler, odak çerçeveleri ve aktif rozetler için vurgu rengi",
    lbl_setting_default_langs_header: "Tercih Edilen Varsayılan Parçalar",
    lbl_general_tracks_desc: "Videolar içe aktarılırken otomatik olarak önceliklendirilen diller",
    lbl_setting_def_audio_title: "Varsayılan Ses Dili",
    hint_setting_def_audio: "Kayıttan yürütme için otomatik olarak birincil seçilen ses parçası",
    lbl_setting_def_sub_title: "Varsayılan Altyazı Dili",
    hint_setting_def_sub: "Kayıttan yürütme için otomatik olarak etkinleştirilen altyazı",
    hint_setting_app_language: "Menü ve bildirim dillerini anında değiştirin",
    btn_apply_meta_all_episodes: "Tüm Bölümlere Uygula",
    btn_apply_meta_this_video: "Bu Videoya Uygula",
    btn_clear_media_info: "Bilgileri ve Kapağı Temizle",
    btn_cancel_meta: "Kapat"
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
  if (document.getElementById("lblAboutEdition")) document.getElementById("lblAboutEdition").textContent = t("lbl_about_edition");

  // Stage 2 Review Table Headers & Back button
  if (document.getElementById("thTrack")) document.getElementById("thTrack").textContent = t("th_track");
  if (document.getElementById("thDetails")) document.getElementById("thDetails").textContent = t("th_details");
  if (document.getElementById("thLang")) document.getElementById("thLang").textContent = t("th_lang");
  if (document.getElementById("thDefault")) document.getElementById("thDefault").textContent = t("th_default");
  if (document.getElementById("thDelay")) document.getElementById("thDelay").textContent = t("th_delay");
  if (document.getElementById("thAction")) document.getElementById("thAction").textContent = t("th_action");
  if (document.getElementById("lblBackToImport")) document.getElementById("lblBackToImport").textContent = `← ${t("btn_back") || "Back"}`;
  if (document.getElementById("reviewStatusLine")) document.getElementById("reviewStatusLine").textContent = t("lbl_all_videos_ready") || "All videos ready";

  // Stage 3 Export / Queue Headers & Attachments
  if (document.getElementById("lblSharedAttachmentsTitle")) document.getElementById("lblSharedAttachmentsTitle").textContent = t("lbl_shared_attachments_title");
  if (document.getElementById("lblSharedAttachmentsSubtitle")) document.getElementById("lblSharedAttachmentsSubtitle").textContent = t("lbl_shared_attachments_sub");
  if (document.getElementById("lblSharedAttachmentsNone")) document.getElementById("lblSharedAttachmentsNone").textContent = t("lbl_none");
  if (document.getElementById("btnAddSharedAttachment")) document.getElementById("btnAddSharedAttachment").textContent = t("btn_add_shared_attachment") || "+ Add attachment";
  if (document.getElementById("lblRemoveOldAttachments")) document.getElementById("lblRemoveOldAttachments").textContent = t("lbl_remove_old_attachments_chk");
  if (document.getElementById("thQueueVideo")) document.getElementById("thQueueVideo").textContent = t("th_video");
  if (document.getElementById("thQueuePlan")) document.getElementById("thQueuePlan").textContent = t("th_plan_col");
  if (document.getElementById("thQueueProgress")) document.getElementById("thQueueProgress").textContent = t("th_progress_col");
  if (document.getElementById("thQueueStatus")) document.getElementById("thQueueStatus").textContent = t("th_status_col");
  if (document.getElementById("lblBackToReview")) document.getElementById("lblBackToReview").textContent = `← ${t("btn_back") || "Back"}`;

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
  if (document.getElementById("lblHdrDoviHeader")) document.getElementById("lblHdrDoviHeader").textContent = t("lbl_hdr_dovi_header");
  if (document.getElementById("lblDoviAction")) document.getElementById("lblDoviAction").textContent = t("lbl_dovi_action");
  if (document.getElementById("lblQuickDovi")) document.getElementById("lblQuickDovi").textContent = t("lbl_quick_dovi");
  if (el.quickDoviAction) {
    for (const opt of el.quickDoviAction.options) {
      if (opt.value === "retain") opt.textContent = t("opt_dovi_retain") || "Keep DV";
      else if (opt.value === "convert_p81") opt.textContent = t("opt_dovi_p81") || "To Profile 8.1";
      else if (opt.value === "strip_hdr10") opt.textContent = t("opt_dovi_strip") || "Strip DV";
      else if (opt.value === "convert_sdr") opt.textContent = t("opt_dovi_sdr") || "To SDR";
    }
    el.quickDoviAction.value = state.videoSettings.doviAction || "retain";
  }

  // Quick Preset Dropdown Localization
  if (el.quickPreset) {
    const isAr = (lang === "ar");
    const optgroups = el.quickPreset.querySelectorAll("optgroup");
    if (isAr) {
      if (el.quickPreset.options[0]) el.quickPreset.options[0].textContent = "1. الافتراضي (يطابق الإعدادات)";
      if (el.quickPreset.options[1]) el.quickPreset.options[1].textContent = "2. نسخ (بدون إعادة تشفير)";
      if (optgroups[0]) optgroups[0].label = "معالجة NVIDIA NVENC";
      if (optgroups[1]) optgroups[1].label = "معالجة AMD AMF";
      if (optgroups[2]) optgroups[2].label = "معالجة Intel QSV";
      if (optgroups[3]) optgroups[3].label = "أرشفة المعالج CPU";
      if (optgroups[4]) optgroups[4].label = "الويب والأجهزة المحمولة (MKV)";

      const optMapAr = {
        "nvenc_4k_hevc": "4K UHD 10-بت (H.265)",
        "nvenc_1080p_hevc": "1080p جودة فائقة (H.265)",
        "nvenc_720p_hevc": "720p سريع (H.265)",
        "nvenc_1080p_h264": "1080p متوافق (H.264)",
        "nvenc_720p_h264": "720p متوافق (H.264)",
        "amf_1080p_hevc": "1080p جودة فائقة (H.265)",
        "amf_720p_hevc": "720p متوازن (H.265)",
        "amf_1080p_h264": "1080p متوافق (H.264)",
        "amf_720p_h264": "720p متوافق (H.264)",
        "qsv_1080p_hevc": "1080p متوازن (H.265)",
        "qsv_720p_hevc": "720p سريع (H.265)",
        "qsv_1080p_h264": "1080p متوافق (H.264)",
        "qsv_720p_h264": "720p متوافق (H.264)",
        "cpu_1080p_h265": "1080p كوديك H.265 (CRF 22)",
        "cpu_720p_h265": "720p كوديك H.265 (CRF 23)",
        "cpu_1080p_h264": "1080p كوديك H.264 (CRF 20)",
        "cpu_720p_h264": "720p كوديك H.264 (CRF 22)",
        "web_1080p_mkv": "ويب وبث: 1080p (MKV · H.264 / AAC)",
        "social_720p_mkv": "تواصل ودردشة: 720p (MKV · H.264 / AAC)",
        "mobile_720p_mkv": "مخصص للهواتف: 720p (MKV · H.264 / AAC)"
      };
      Array.from(el.quickPreset.options).forEach(opt => {
        if (optMapAr[opt.value]) opt.textContent = optMapAr[opt.value];
      });
    } else {
      if (el.quickPreset.options[0]) el.quickPreset.options[0].textContent = "1. Default (Matches Settings)";
      if (el.quickPreset.options[1]) el.quickPreset.options[1].textContent = "2. Copy (no re-encode)";
      if (optgroups[0]) optgroups[0].label = "NVIDIA NVENC";
      if (optgroups[1]) optgroups[1].label = "AMD AMF";
      if (optgroups[2]) optgroups[2].label = "Intel QSV";
      if (optgroups[3]) optgroups[3].label = "CPU Archive";
      if (optgroups[4]) optgroups[4].label = "Web & Mobile (MKV)";

      const optMapEn = {
        "nvenc_4k_hevc": "4K UHD 10-bit (H.265)",
        "nvenc_1080p_hevc": "1080p High Quality (H.265)",
        "nvenc_720p_hevc": "720p Fast (H.265)",
        "nvenc_1080p_h264": "1080p Universal (H.264)",
        "nvenc_720p_h264": "720p Universal (H.264)",
        "amf_1080p_hevc": "1080p High Quality (H.265)",
        "amf_720p_hevc": "720p Balanced (H.265)",
        "amf_1080p_h264": "1080p Universal (H.264)",
        "amf_720p_h264": "720p Universal (H.264)",
        "qsv_1080p_hevc": "1080p Balanced (H.265)",
        "qsv_720p_hevc": "720p Fast (H.265)",
        "qsv_1080p_h264": "1080p Universal (H.264)",
        "qsv_720p_h264": "720p Universal (H.264)",
        "cpu_1080p_h265": "1080p H.265 CRF 22",
        "cpu_720p_h265": "720p H.265 CRF 23",
        "cpu_1080p_h264": "1080p H.264 CRF 20",
        "cpu_720p_h264": "720p H.264 CRF 22",
        "web_1080p_mkv": "Web & Stream: 1080p (MKV · H.264 / AAC)",
        "social_720p_mkv": "Social & Chat: 720p (MKV · H.264 / AAC)",
        "mobile_720p_mkv": "Mobile Optimized: 720p (MKV · H.264 / AAC)"
      };
      Array.from(el.quickPreset.options).forEach(opt => {
        if (optMapEn[opt.value]) opt.textContent = optMapEn[opt.value];
      });
    }
  }
  if (document.getElementById("lblQuickClearAll")) document.getElementById("lblQuickClearAll").textContent = t("lbl_quick_clear_all");
  if (document.getElementById("lblQuickEmptyTitle")) document.getElementById("lblQuickEmptyTitle").textContent = t("lbl_quick_empty_title");
  if (document.getElementById("lblQuickEmptyDesc")) document.getElementById("lblQuickEmptyDesc").textContent = t("lbl_quick_empty_desc");
  if (document.getElementById("lblQuickImportExisting")) document.getElementById("lblQuickImportExisting").textContent = t("lbl_quick_import_existing");
  if (document.getElementById("thQuickCover")) document.getElementById("thQuickCover").textContent = t("th_quick_cover");
  if (document.getElementById("thQuickOriginal")) document.getElementById("thQuickOriginal").textContent = t("th_quick_original");
  if (document.getElementById("thQuickProposed")) document.getElementById("thQuickProposed").textContent = t("th_quick_proposed");
  if (document.getElementById("thQuickSpecs")) document.getElementById("thQuickSpecs").textContent = t("th_quick_specs");

  // Advanced Video & Audio Settings Localization
  const setTxt = (id, key) => {
    const el = document.getElementById(id);
    if (el && t(key)) el.textContent = t(key);
  };

  setTxt("lblVideoSectionCodecTitle", "lbl_video_codec_section");
  setTxt("lblVideoSectionCodecDesc", "lbl_video_codec_section_desc");
  setTxt("lblVideoCodec", "lbl_video_codec");
  setTxt("hintVideoCodec", "hint_video_codec");
  setTxt("lblVideoResolution", "lbl_video_resolution");
  setTxt("hintVideoResolution", "hint_video_resolution");
  setTxt("lblVideoRateControl", "lbl_video_rate_control");
  setTxt("hintVideoRateControl", "hint_video_rate_control");
  setTxt("lblVideoCopyNoticeTitle", "lbl_video_copy_notice_title");
  setTxt("lblVideoCopyNoticeDesc", "lbl_video_copy_notice_desc");

  setTxt("lblVideoSectionOptTitle", "lbl_video_opt_section");
  setTxt("lblVideoSectionOptDesc", "lbl_video_opt_section_desc");
  setTxt("lblVideoPreset", "lbl_video_preset");
  setTxt("hintVideoPreset", "hint_video_preset");
  setTxt("lblVideoTune", "lbl_video_tune");
  setTxt("hintVideoTune", "hint_video_tune");
  setTxt("lblVideoPixFmt", "lbl_video_pixfmt");
  setTxt("hintVideoPixFmt", "hint_video_pixfmt");
  setTxt("lblVideoMultipass", "lbl_video_multipass");
  setTxt("hintVideoMultipass", "hint_video_multipass");
  setTxt("lblVideoProfile", "lbl_video_profile");
  setTxt("hintVideoProfile", "hint_video_profile");
  setTxt("lblVideoLevel", "lbl_video_level");
  setTxt("hintVideoLevel", "hint_video_level");
  setTxt("lblVideoAq", "lbl_video_aq");
  setTxt("hintVideoAq", "hint_video_aq");
  setTxt("lblHdrDoviHeader", "lbl_hdr_dovi_header");
  setTxt("lblHdrDoviDesc", "lbl_hdr_dovi_desc");
  setTxt("lblDoviAction", "lbl_dovi_action");

  setTxt("lblAudioCopyNoticeTitle", "lbl_audio_copy_notice_title");
  setTxt("lblAudioCopyNoticeDesc", "lbl_audio_copy_notice_desc");
  setTxt("lblAudioSectionTitle", "lbl_audio_section_title");
  setTxt("lblAudioSectionDesc", "lbl_audio_section_desc");
  setTxt("lblAudioCodec", "lbl_audio_codec");
  setTxt("hintAudioCodec", "hint_audio_codec");
  setTxt("lblAudioChannels", "lbl_audio_channels");
  setTxt("hintAudioChannels", "hint_audio_channels");
  setTxt("lblAudioBitrate", "lbl_audio_bitrate");
  setTxt("hintAudioBitrate", "hint_audio_bitrate");
  setTxt("lblAudioSampleRate", "lbl_audio_samplerate");
  setTxt("hintAudioSampleRate", "hint_audio_samplerate");
  setTxt("lblAudioGuideTitle", "lbl_audio_guide_title");
  setTxt("lblAudioGuideCopy", "lbl_audio_guide_copy");
  setTxt("lblAudioGuideAac", "lbl_audio_guide_aac");
  setTxt("lblAudioGuideAc3", "lbl_audio_guide_ac3");
  setTxt("lblAudioGuideFlac", "lbl_audio_guide_flac");
  setTxt("lblLiveVideoPipeline", "lbl_live_video_pipeline");
  setTxt("lblLiveAudioPipeline", "lbl_live_audio_pipeline");
  setTxt("lblHwEngineTitle", "lbl_hw_engine_title");
  setTxt("lblHwEngineDesc", "lbl_hw_engine_desc");
  setTxt("lblHwNvencTitle", "lbl_hw_nvenc_title");
  setTxt("lblHwNvencDesc", "lbl_hw_nvenc_desc");
  setTxt("lblHwAmfTitle", "lbl_hw_amf_title");
  setTxt("lblHwAmfDesc", "lbl_hw_amf_desc");
  setTxt("lblHwQsvTitle", "lbl_hw_qsv_title");
  setTxt("lblHwQsvDesc", "lbl_hw_qsv_desc");
  setTxt("lblHwCpuTitle", "lbl_hw_cpu_title");
  setTxt("lblHwCpuDesc", "lbl_hw_cpu_desc");

  // General Settings Localization
  setTxt("lblSettingLanguageHeader", "lbl_setting_language_header");
  setTxt("lblGeneralUiDesc", "lbl_general_ui_desc");
  setTxt("lblSettingThemeTitle", "lbl_setting_theme_title");
  setTxt("hintSettingTheme", "hint_setting_theme");
  setTxt("lblSettingAccentTitle", "lbl_setting_accent_title");
  setTxt("hintSettingAccent", "hint_setting_accent");
  setTxt("lblSettingDefaultLangsHeader", "lbl_setting_default_langs_header");
  setTxt("lblGeneralTracksDesc", "lbl_general_tracks_desc");
  setTxt("lblSettingDefAudioTitle", "lbl_setting_def_audio_title");
  setTxt("hintSettingDefAudio", "hint_setting_def_audio");
  setTxt("lblSettingDefSubTitle", "lbl_setting_def_sub_title");
  setTxt("hintSettingDefSub", "hint_setting_def_sub");
  setTxt("hintSettingAppLanguage", "hint_setting_app_language");

  // Metadata Modal Buttons Localization
  setTxt("btnClearMediaInfo", "btn_clear_media_info");
  setTxt("btnCancelMetaModal", "btn_cancel_meta");
  setTxt("btnApplyMetaAllEpisodes", "btn_apply_meta_all_episodes");
  setTxt("btnApplyMetaThisVideo", "btn_apply_meta_this_video");

  // Pure language localization for General Settings Dropdowns & Chips (NO mixed languages or parentheses)
  const badgeClear = document.getElementById("badgeSettingClearTrackNames");
  if (badgeClear) {
    const badgeMap = { ar: "مستحسن", en: "Recommended", fr: "Recommandé", es: "Recomendado", tr: "Önerilen" };
    badgeClear.textContent = badgeMap[lang] || "Recommended";
  }

  const themeMap = {
    ar: { dark: "الوضع الداكن", light: "الوضع الفاتح" },
    en: { dark: "Dark Theme", light: "Light Theme" },
    fr: { dark: "Thème sombre", light: "Thème clair" },
    es: { dark: "Tema oscuro", light: "Tema claro" },
    tr: { dark: "Koyu Tema", light: "Açık Tema" }
  };
  if (el.settingTheme) {
    const tMap = themeMap[lang] || themeMap.en;
    for (const opt of el.settingTheme.options) {
      if (tMap[opt.value]) opt.textContent = tMap[opt.value];
    }
  }

  const langNamesMap = {
    ar: {
      keep: "إبقاء كما في الملف الأصلي",
      ara: "العربية",
      eng: "الإنجليزية",
      jpn: "اليابانية",
      fra: "الفرنسية",
      deu: "الألمانية",
      spa: "الإسبانية",
      ita: "الإيطالية",
      rus: "الروسية"
    },
    en: {
      keep: "Keep source track",
      ara: "Arabic",
      eng: "English",
      jpn: "Japanese",
      fra: "French",
      deu: "German",
      spa: "Spanish",
      ita: "Italian",
      rus: "Russian"
    },
    fr: {
      keep: "Conserver du fichier source",
      ara: "Arabe",
      eng: "Anglais",
      jpn: "Japonais",
      fra: "Français",
      deu: "Allemand",
      spa: "Espagnol",
      ita: "Italien",
      rus: "Russe"
    },
    es: {
      keep: "Mantener de origen",
      ara: "Árabe",
      eng: "Inglés",
      jpn: "Japonés",
      fra: "Francés",
      deu: "Alemán",
      spa: "Español",
      ita: "Italiano",
      rus: "Ruso"
    },
    tr: {
      keep: "Kaynaktaki gibi koru",
      ara: "Arapça",
      eng: "İngilizce",
      jpn: "Japonca",
      fra: "Fransızca",
      deu: "Almanca",
      spa: "İspanyolca",
      ita: "İtalyanca",
      rus: "Rusça"
    }
  };
  const lMap = langNamesMap[lang] || langNamesMap.en;
  if (el.settingDefAudio) {
    for (const opt of el.settingDefAudio.options) {
      if (lMap[opt.value]) opt.textContent = lMap[opt.value];
    }
  }
  if (el.settingDefSub) {
    for (const opt of el.settingDefSub.options) {
      if (lMap[opt.value]) opt.textContent = lMap[opt.value];
    }
  }

  document.querySelectorAll('#tabGeneral .quick-preset-chips .chip').forEach(chip => {
    const val = chip.getAttribute('data-val');
    if (lMap[val]) {
      chip.textContent = lMap[val];
    }
  });

  const isArLang = (lang === "ar");

  if (el.vCfgResolution) {
    const resMap = {
      "original": isArLang ? "الأبعاد الأصلية للملف" : "Original (No resize)",
      "3840x2160": isArLang ? "3840x2160 فائقة الوضوح 4K" : "3840x2160 (4K UHD)",
      "2560x1440": isArLang ? "2560x1440 عالية الوضوح 2K" : "2560x1440 (2K QHD)",
      "1920x1080": isArLang ? "1920x1080 عالية الدقة الكاملة" : "1920x1080 (1080p FHD)",
      "1280x720": isArLang ? "1280x720 عالية الدقة" : "1280x720 (720p HD)",
      "854x480": isArLang ? "854x480 الدقة القياسية" : "854x480 (480p SD)"
    };
    for (const opt of el.vCfgResolution.options) {
      if (resMap[opt.value]) opt.textContent = resMap[opt.value];
    }
  }

  if (el.vCfgDoviAction) {
    const doviMap = {
      "retain": isArLang ? "إبقاء دولبي فيجن دون تعديل" : "Retain Dolby Vision (Default / Passthrough)",
      "strip_hdr10": isArLang ? "استخراج طبقة HDR10 القياسية" : "Strip Dolby Vision (Instant Lossless HDR10 Fallback)",
      "convert_sdr": isArLang ? "تحويل الألوان إلى النطاق القياسي SDR" : "Convert & Tone-Map to SDR (BT.709 - Re-encode)"
    };
    for (const opt of el.vCfgDoviAction.options) {
      if (doviMap[opt.value]) opt.textContent = doviMap[opt.value];
    }
  }

  if (el.aCfgChannels) {
    const chMap = {
      "original": isArLang ? "القنوات الأصلية للمصدر" : "Original (Keep source channels)",
      "2": isArLang ? "ستيريو ثنائي 2.0" : "Stereo (2.0 - Recommended for 128k/192k)",
      "6": isArLang ? "محيطي 5.1" : "5.1 Surround (6 ch - Recommended for 384k+)",
      "8": isArLang ? "محيطي 7.1" : "7.1 Surround (8 ch)",
      "1": isArLang ? "أحادي 1.0" : "Mono (1.0)"
    };
    for (const opt of el.aCfgChannels.options) {
      if (chMap[opt.value]) opt.textContent = chMap[opt.value];
    }
  }

  if (el.aCfgBitrate) {
    const brMap = {
      "copy": isArLang ? "معدل بت المصدر الأصلي" : "Source Bitrate",
      "128k": isArLang ? "128 كيلوبت/ثانية" : "128 kbps",
      "192k": isArLang ? "192 كيلوبت/ثانية - جودة عالية قياسية" : "192 kbps (Standard High Quality)",
      "256k": isArLang ? "256 كيلوبت/ثانية" : "256 kbps",
      "320k": isArLang ? "320 كيلوبت/ثانية - أعلى جودة ستيريو" : "320 kbps (Max Stereo)",
      "448k": isArLang ? "448 كيلوبت/ثانية - قياسي للمحيطي 5.1" : "448 kbps (Standard 5.1)",
      "640k": isArLang ? "640 كيلوبت/ثانية - أعلى جودة للمحيطي 5.1" : "640 kbps (High Bitrate 5.1)"
    };
    for (const opt of el.aCfgBitrate.options) {
      if (brMap[opt.value]) opt.textContent = brMap[opt.value];
    }
  }

  if (el.aCfgSampleRate) {
    const srMap = {
      "original": isArLang ? "تردد المصدر الأصلي" : "Original (Keep source rate)",
      "48000": isArLang ? "48000 هرتز - المعيار القياسي للأفلام" : "48000 Hz (48 kHz - Video Standard)",
      "44100": isArLang ? "44100 هرتز - المعيار القياسي للصوتيات" : "44100 Hz (44.1 kHz - CD Standard)",
      "96000": isArLang ? "96000 هرتز - دقة فائقة" : "96000 Hz (96 kHz - Hi-Res)"
    };
    for (const opt of el.aCfgSampleRate.options) {
      if (srMap[opt.value]) opt.textContent = srMap[opt.value];
    }
  }

  document.querySelectorAll('#tabVideo .quick-preset-chips .chip').forEach(chip => {
    const val = chip.getAttribute('data-val');
    if (val === "original") chip.textContent = isArLang ? "الأصلية" : "Original";
  });
  document.querySelectorAll('#tabAudio .quick-preset-chips .chip').forEach(chip => {
    const val = chip.getAttribute('data-val');
    if (val === "original") chip.textContent = isArLang ? "الأصلية" : "Original";
    else if (val === "copy") chip.textContent = isArLang ? "المصدر" : "Source";
    else if (val === "2") chip.textContent = isArLang ? "ستيريو 2.0" : "Stereo (2.0)";
    else if (val === "6") chip.textContent = isArLang ? "محيطي 5.1" : "5.1 Surround";
    else if (val === "192k") chip.textContent = isArLang ? "192k قياسي" : "192k (HQ)";
    else if (val === "320k") chip.textContent = isArLang ? "320k أقصى" : "320k (Max)";
    else if (val === "448k") chip.textContent = isArLang ? "448k محيطي" : "448k (5.1)";
    else if (val === "640k") chip.textContent = isArLang ? "640k أقصى 5.1" : "640k (Max 5.1)";
  });

  if (typeof updateHwAccelUI === "function") {
    updateHwAccelUI();
  } else {
    updateRateControlUI();
  }

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

  if (el.vCfgHwAccel) {
    el.vCfgHwAccel.value = state.videoSettings.hwAccel || "nvenc";
  }
  updateHwAccelUI();

  if (el.vCfgResolution) el.vCfgResolution.value = state.videoSettings.resolution;
  if (el.vCfgCodec) el.vCfgCodec.value = state.videoSettings.codec;
  if (el.vCfgRateControl) el.vCfgRateControl.value = state.videoSettings.rateControl;
  if (el.vCfgQualityVal) {
    el.vCfgQualityVal.value = state.videoSettings.qualityVal;
    if (el.vCfgQualitySlider) {
      const qNum = parseInt(state.videoSettings.qualityVal, 10);
      if (!isNaN(qNum) && qNum >= 16 && qNum <= 32) {
        el.vCfgQualitySlider.value = qNum;
      }
    }
  }
  if (el.vCfgPreset) el.vCfgPreset.value = state.videoSettings.preset;
  if (el.vCfgTune) el.vCfgTune.value = state.videoSettings.tune;
  if (el.vCfgPixFmt) el.vCfgPixFmt.value = state.videoSettings.pixFmt;
  if (el.vCfgMultipass) el.vCfgMultipass.value = state.videoSettings.multipass || "disabled";
  if (el.vCfgProfile) el.vCfgProfile.value = state.videoSettings.profile || "auto";
  if (el.vCfgLevel) el.vCfgLevel.value = state.videoSettings.level || "auto";
  if (el.vCfgAq) el.vCfgAq.value = state.videoSettings.aq || "enabled";
  if (el.vCfgDoviAction) el.vCfgDoviAction.value = state.videoSettings.doviAction || "retain";
  if (el.quickDoviAction) el.quickDoviAction.value = state.videoSettings.doviAction || "retain";

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

function updateHwAccelUI() {
  const currentEngine = el.vCfgHwAccel ? (el.vCfgHwAccel.value || "nvenc") : (state.videoSettings.hwAccel || "nvenc");

  // 1. Highlight active hardware card
  document.querySelectorAll(".hw-engine-card").forEach(card => {
    const eng = card.getAttribute("data-engine");
    if (eng === currentEngine) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });

  const lang = state.globalSettings.language || "en";
  const isAr = (lang === "ar");

  // 2. Populate codecs based on engine
  if (el.vCfgCodec) {
    const currentCodec = el.vCfgCodec.value || state.videoSettings.codec || "hevc_nvenc";
    let codecs = [];

    if (currentEngine === "nvenc") {
      codecs = [
        { value: "hevc_nvenc", text: isAr ? "H.265 / HEVC (فائق السرعة ومثالي لـ 4K)" : "H.265 / HEVC (Recommended)" },
        { value: "h264_nvenc", text: isAr ? "H.264 / AVC (توافق شامل مع جميع الأجهزة)" : "H.264 / AVC (Universal Compatibility)" },
        { value: "av1_nvenc", text: isAr ? "AV1 (ضغط متطور لبطاقات الجيل الحديث)" : "AV1 (RTX 40 Series)" },
        { value: "copy", text: isAr ? "نسخ مباشر دون إعادة تشفير" : "Copy (Stream Passthrough)" }
      ];
    } else if (currentEngine === "amf") {
      codecs = [
        { value: "hevc_amf", text: isAr ? "H.265 / HEVC (كروت راديون)" : "H.265 / HEVC (Radeon RX)" },
        { value: "h264_amf", text: isAr ? "H.264 / AVC (توافق شامل)" : "H.264 / AVC (Universal Compatibility)" },
        { value: "av1_amf", text: isAr ? "AV1 (كروت الجيل الحديث)" : "AV1 (Radeon RX 7000)" },
        { value: "copy", text: isAr ? "نسخ مباشر دون إعادة تشفير" : "Copy (Stream Passthrough)" }
      ];
    } else if (currentEngine === "qsv") {
      codecs = [
        { value: "hevc_qsv", text: isAr ? "H.265 / HEVC (معالجات وكروت إنتل)" : "H.265 / HEVC (Intel Arc & Core)" },
        { value: "h264_qsv", text: isAr ? "H.264 / AVC (توافق شامل)" : "H.264 / AVC (Universal Compatibility)" },
        { value: "av1_qsv", text: isAr ? "AV1 (كروت إنتل الحديثة)" : "AV1 (Intel Arc & Ultra)" },
        { value: "copy", text: isAr ? "نسخ مباشر دون إعادة تشفير" : "Copy (Stream Passthrough)" }
      ];
    } else {
      // Software CPU
      codecs = [
        { value: "libx265", text: isAr ? "H.265 / HEVC (ضغط سينمائي فائق الجودة)" : "H.265 / HEVC (High Compression)" },
        { value: "libx264", text: isAr ? "H.264 / AVC (المعيار القياسي المتوافق عالمياً)" : "H.264 / AVC (Universal Standard)" },
        { value: "libsvtav1", text: isAr ? "AV1 (الجيل الجديد مفتوح المصدر)" : "AV1 (SVT-AV1 Open Codec)" },
        { value: "copy", text: isAr ? "نسخ مباشر دون إعادة تشفير" : "Copy (Stream Passthrough)" }
      ];
    }

    el.vCfgCodec.innerHTML = codecs.map(c => `<option value="${c.value}">${c.text}</option>`).join("");

    const hasCurrent = codecs.some(c => c.value === currentCodec);
    if (hasCurrent) {
      el.vCfgCodec.value = currentCodec;
    } else if (currentCodec === "copy") {
      el.vCfgCodec.value = "copy";
    } else if (currentCodec.includes("264")) {
      const match264 = codecs.find(c => c.value.includes("264") || c.value.includes("h264"));
      el.vCfgCodec.value = match264 ? match264.value : codecs[0].value;
    } else if (currentCodec.includes("av1")) {
      const matchAv1 = codecs.find(c => c.value.includes("av1"));
      el.vCfgCodec.value = matchAv1 ? matchAv1.value : codecs[0].value;
    } else {
      el.vCfgCodec.value = codecs[0].value;
    }
  }

  // 3. Populate presets based on engine
  if (el.vCfgPreset) {
    const currentPreset = el.vCfgPreset.value || state.videoSettings.preset;
    let presets = [];
    if (currentEngine === "nvenc") {
      presets = [
        { value: "p1", text: isAr ? "أسرع أداء" : "p1 (Fastest)" },
        { value: "p2", text: isAr ? "سريع جداً" : "p2 (Faster)" },
        { value: "p3", text: isAr ? "سريع" : "p3 (Fast)" },
        { value: "p4", text: isAr ? "متوسط" : "p4 (Medium)" },
        { value: "p5", text: isAr ? "متوازن - موصى به" : "p5 (Slow - Recommended)" },
        { value: "p6", text: isAr ? "جودة أفضل" : "p6 (Slower)" },
        { value: "p7", text: isAr ? "أعلى جودة" : "p7 (Slowest)" }
      ];
    } else if (currentEngine === "amf") {
      presets = [
        { value: "speed", text: isAr ? "أسرع أداء" : "Speed (Fastest)" },
        { value: "balanced", text: isAr ? "متوازن - موصى به" : "Balanced (Recommended)" },
        { value: "quality", text: isAr ? "أعلى جودة ضغط" : "Quality (Best Quality)" }
      ];
    } else if (currentEngine === "qsv") {
      presets = [
        { value: "veryfast", text: isAr ? "سريع جداً" : "Very Fast (Fastest)" },
        { value: "faster", text: isAr ? "سريع" : "Faster" },
        { value: "fast", text: isAr ? "جيد" : "Fast" },
        { value: "medium", text: isAr ? "متوازن - موصى به" : "Medium (Recommended)" },
        { value: "slow", text: isAr ? "جودة عالية" : "Slow (High Quality)" },
        { value: "slower", text: isAr ? "جودة أفضل" : "Slower" },
        { value: "veryslow", text: isAr ? "أعلى جودة" : "Very Slow (Best Quality)" }
      ];
    } else {
      // CPU
      presets = [
        { value: "ultrafast", text: isAr ? "فائق السرعة" : "Ultrafast" },
        { value: "superfast", text: isAr ? "سريع للغاية" : "Superfast" },
        { value: "veryfast", text: isAr ? "سريع جداً" : "Very Fast" },
        { value: "faster", text: isAr ? "سريع" : "Faster" },
        { value: "fast", text: isAr ? "جيد" : "Fast" },
        { value: "medium", text: isAr ? "متوازن" : "Medium (Default)" },
        { value: "slow", text: isAr ? "جودة عالية - موصى به" : "Slow (Recommended)" },
        { value: "slower", text: isAr ? "ضغط أكبر" : "Slower" },
        { value: "veryslow", text: isAr ? "أقصى ضغط ممكن" : "Very Slow (Placebo)" }
      ];
    }

    el.vCfgPreset.innerHTML = presets.map(p => `<option value="${p.value}">${p.text}</option>`).join("");
    const hasPreset = presets.some(p => p.value === currentPreset);
    if (hasPreset) {
      el.vCfgPreset.value = currentPreset;
    } else {
      if (currentEngine === "nvenc") el.vCfgPreset.value = "p5";
      else if (currentEngine === "amf") el.vCfgPreset.value = "balanced";
      else if (currentEngine === "qsv") el.vCfgPreset.value = "medium";
      else el.vCfgPreset.value = "slow";
    }
  }

  // 4. Populate tunes based on engine
  if (el.vCfgTune) {
    const currentTune = el.vCfgTune.value || state.videoSettings.tune;
    let tunes = [];
    if (currentEngine === "nvenc") {
      tunes = [
        { value: "hq", text: isAr ? "جودة عالية قياسية" : "High Quality (HQ)" },
        { value: "ll", text: isAr ? "تأخير منخفض" : "Low Latency" },
        { value: "ull", text: isAr ? "تأخير فائق الانخفاض" : "Ultra Low Latency" },
        { value: "lossless", text: isAr ? "بدون أي فقدان" : "Lossless" }
      ];
    } else if (currentEngine === "cpu") {
      tunes = [
        { value: "none", text: isAr ? "افتراضي عام" : "None (Default)" },
        { value: "film", text: isAr ? "أفلام ومشاهد حية" : "Film (Live Action)" },
        { value: "animation", text: isAr ? "رسوم متحركة وأنمي" : "Animation (Anime)" },
        { value: "grain", text: isAr ? "الحفاظ على الحبيبات السينمائية" : "Grain (Preserve Film Grain)" },
        { value: "fastdecode", text: isAr ? "فك تشفير سريع" : "Fast Decode" },
        { value: "zerolatency", text: isAr ? "بث مباشر فوري" : "Zero Latency" }
      ];
    } else {
      // AMF / QSV rely on auto driver tuning
      tunes = [
        { value: "none", text: isAr ? "تلقائي من المشغل" : "Driver Default" }
      ];
    }

    el.vCfgTune.innerHTML = tunes.map(t => `<option value="${t.value}">${t.text}</option>`).join("");
    const hasTune = tunes.some(t => t.value === currentTune);
    if (hasTune) {
      el.vCfgTune.value = currentTune;
    } else {
      el.vCfgTune.value = (currentEngine === "nvenc") ? "hq" : "none";
    }
  }

  // 5. Populate rateControl options (CQP vs CRF vs VBR vs CBR)
  if (el.vCfgRateControl) {
    const currentRc = el.vCfgRateControl.value || state.videoSettings.rateControl;
    let rcOptions = [
      { value: "cqp", text: isAr ? "جودة بصرية ثابتة" : (currentEngine === "cpu" ? "Constant Quality (CRF)" : "Constant Quality (CQP)") },
      { value: "vbr", text: isAr ? "معدل بت متغير" : "Variable Bitrate (VBR)" },
      { value: "cbr", text: isAr ? "معدل بت ثابت" : "Constant Bitrate (CBR)" }
    ];

    el.vCfgRateControl.innerHTML = rcOptions.map(r => `<option value="${r.value}">${r.text}</option>`).join("");
    const hasRc = rcOptions.some(r => r.value === currentRc);
    el.vCfgRateControl.value = hasRc ? currentRc : "cqp";
  }

  updateRateControlUI();
}

function updateRateControlUI() {
  const isVideoCopy = el.vCfgCodec && el.vCfgCodec.value === "copy";
  [el.vCfgResolution, el.vCfgRateControl, el.vCfgQualityVal, el.vCfgPreset, el.vCfgTune, el.vCfgPixFmt, el.vCfgMultipass, el.vCfgProfile, el.vCfgLevel, el.vCfgAq].forEach(input => {
    if (input) {
      input.disabled = isVideoCopy;
      input.style.opacity = isVideoCopy ? "0.45" : "1";
    }
  });

  const vNotice = document.getElementById("videoCopyNotice");
  if (vNotice) {
    vNotice.style.display = isVideoCopy ? "flex" : "none";
  }

  const isAudioCopy = el.aCfgCodec && el.aCfgCodec.value === "copy";
  [el.aCfgChannels, el.aCfgBitrate, el.aCfgSampleRate].forEach(input => {
    if (input) {
      input.disabled = isAudioCopy;
      input.style.opacity = isAudioCopy ? "0.45" : "1";
    }
  });

  const aNotice = document.getElementById("audioCopyNotice");
  if (aNotice) {
    aNotice.style.display = isAudioCopy ? "flex" : "none";
  }

  const mode = el.vCfgRateControl ? el.vCfgRateControl.value : "cqp";
  if (!el.lblQualityVal || !el.vCfgQualityVal) return;

  const currentLang = state.globalSettings.language || "en";
  const isAr = (currentLang === "ar");

  if (mode === "vbr") {
    el.lblQualityVal.textContent = isAr ? "معدل البت المستهدف" : "Target Bitrate (Kb/s)";
    el.vCfgQualityVal.placeholder = "6000";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = isAr
        ? "معدل بت الفيديو بـ Kb/s (مثال: 6000 لدقة 1080p، و 12000 لدقة 4K)"
        : "Target video bitrate in Kb/s (e.g. 6000 for 1080p, 12000 for 4K)";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal <= 51) {
      el.vCfgQualityVal.value = "6000";
    }
  } else if (mode === "cbr") {
    el.lblQualityVal.textContent = isAr ? "معدل البت الثابت" : "Constant Bitrate (Kb/s)";
    el.vCfgQualityVal.placeholder = "6000";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = isAr
        ? "معدل بت ثابت طوال الفيديو بـ Kb/s (مثال: 6000 لدقة 1080p)"
        : "Constant video bitrate in Kb/s (e.g. 6000 for 1080p)";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal <= 51) {
      el.vCfgQualityVal.value = "6000";
    }
  } else {
    // CQP / CRF
    const isCpu = el.vCfgHwAccel && el.vCfgHwAccel.value === "cpu";
    el.lblQualityVal.textContent = isAr 
      ? "قيمة الجودة (0 - 51)"
      : (isCpu ? "Quality Factor (CRF: 0 - 51)" : "Quantization (CQ: 0 - 51)");
    el.vCfgQualityVal.placeholder = "22";
    if (el.hintQualityVal) {
      el.hintQualityVal.textContent = isAr
        ? "الرقم الأصغر يمنح جودة أعلى وتفاصيل أكثر نقاءً"
        : "Lower value = Higher visual quality";
    }
    const currentVal = parseInt(el.vCfgQualityVal.value, 10);
    if (!isNaN(currentVal) && currentVal > 51) {
      el.vCfgQualityVal.value = "22";
    }
  }

  updateVideoLivePipeline();
  updateAudioLivePipeline();
  highlightActivePresetChips();
}

function updateVideoLivePipeline() {
  const box = document.getElementById("videoLivePipelineBox");
  if (!box) return;

  const lang = state.globalSettings.language || "en";
  const isAr = (lang === "ar");

  const currentEngine = el.vCfgHwAccel ? (el.vCfgHwAccel.value || "nvenc") : (state.videoSettings.hwAccel || "nvenc");
  let engineBadge = `<span class="chip green" style="font-size: 11px; font-weight: 700;">NVIDIA NVENC</span>`;
  if (currentEngine === "amf") {
    engineBadge = `<span class="chip red" style="font-size: 11px; font-weight: 700;">AMD AMF</span>`;
  } else if (currentEngine === "qsv") {
    engineBadge = `<span class="chip blue" style="font-size: 11px; font-weight: 700;">Intel QuickSync</span>`;
  } else if (currentEngine === "cpu") {
    engineBadge = `<span class="chip amber" style="font-size: 11px; font-weight: 700;">${isAr ? "المعالج المركزي" : "Software CPU"}</span>`;
  }

  const isCopy = el.vCfgCodec && el.vCfgCodec.value === "copy";
  if (isCopy) {
    box.innerHTML = `
      ${engineBadge}
      <span class="chip blue" style="font-size: 11px; font-weight: 700;">${isAr ? "نسخ مباشر" : "Copy"}</span>
      <span style="color: var(--muted-text); font-size: 11px;">· ${isAr ? "نسخ المسار الأصلي دون إعادة تشفير وبدون أي فقدان للجودة" : "Original video stream untouched (lossless copy)"}</span>
    `;
    return;
  }

  const codecVal = el.vCfgCodec ? el.vCfgCodec.value : (state.videoSettings.codec || "hevc_nvenc");
  let codecText = "H.265 / HEVC";
  if (codecVal.includes("264") || codecVal.includes("h264")) {
    codecText = "H.264 / AVC";
  } else if (codecVal.includes("av1")) {
    codecText = "AV1";
  }

  const res = el.vCfgResolution ? el.vCfgResolution.value : (state.videoSettings.resolution || "original");
  const resMapAr = {
    "original": "الأبعاد الأصلية",
    "3840x2160": "4K",
    "2560x1440": "1440p",
    "1920x1080": "1080p",
    "1280x720": "720p",
    "854x480": "480p"
  };
  const resMapEn = {
    "original": "Original Res",
    "3840x2160": "4K (2160p)",
    "2560x1440": "1440p (2K)",
    "1920x1080": "1080p",
    "1280x720": "720p",
    "854x480": "480p"
  };
  const resLabel = (isAr ? resMapAr[res] : resMapEn[res]) || res;

  const rc = el.vCfgRateControl ? el.vCfgRateControl.value : (state.videoSettings.rateControl || "cqp");
  const qVal = (el.vCfgQualityVal && el.vCfgQualityVal.value) ? el.vCfgQualityVal.value : (state.videoSettings.qualityVal || (rc === "cqp" ? "22" : "6000"));
  let rcBadgeText = "";
  if (rc === "vbr") {
    rcBadgeText = isAr ? `معدل متغير ${qVal}k` : `VBR ${qVal}k`;
  } else if (rc === "cbr") {
    rcBadgeText = isAr ? `معدل ثابت ${qVal}k` : `CBR ${qVal}k`;
  } else {
    const isCpu = currentEngine === "cpu";
    rcBadgeText = isAr ? `جودة ${qVal}` : `${isCpu ? "CRF" : "CQ"} ${qVal}`;
  }

  const presetVal = el.vCfgPreset ? el.vCfgPreset.value : (state.videoSettings.preset || "p5");
  const presetMapAr = {
    "p1": "أسرع أداء", "p2": "سريع جداً", "p3": "سريع", "p4": "متوسط", "p5": "متوازن", "p6": "جودة أفضل", "p7": "أعلى جودة",
    "speed": "أسرع أداء", "balanced": "متوازن", "quality": "أعلى جودة",
    "ultrafast": "فائق السرعة", "superfast": "سريع للغاية", "veryfast": "سريع جداً", "faster": "سريع", "fast": "جيد", "medium": "متوسط", "slow": "جودة عالية", "slower": "ضغط أكبر", "veryslow": "أقصى ضغط"
  };
  const presetMapEn = {
    "p1": "p1 (Fastest)", "p2": "p2 (Faster)", "p3": "p3 (Fast)", "p4": "p4 (Medium)", "p5": "p5 (Slow)", "p6": "p6 (Slower)", "p7": "p7 (Slowest)",
    "speed": "Speed", "balanced": "Balanced", "quality": "Quality",
    "ultrafast": "Ultrafast", "superfast": "Superfast", "veryfast": "Very Fast", "faster": "Faster", "fast": "Fast", "medium": "Medium", "slow": "Slow", "slower": "Slower", "veryslow": "Very Slow"
  };
  const presetLabel = (isAr ? presetMapAr[presetVal] : presetMapEn[presetVal]) || presetVal;

  const pixFmtVal = el.vCfgPixFmt ? el.vCfgPixFmt.value : (state.videoSettings.pixFmt || "p010le");
  let pixFmtLabel = "10-bit HDR";
  if (pixFmtVal === "p010le") {
    pixFmtLabel = isAr ? "10 بت عالي النطاق" : "10-bit HDR";
  } else {
    pixFmtLabel = isAr ? "8 بت قياسي" : "8-bit SDR";
  }

  const dovi = el.vCfgDoviAction ? el.vCfgDoviAction.value : (state.videoSettings.doviAction || "retain");
  let doviBadge = `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${isAr ? "إبقاء دولبي فيجن" : "Keep Dolby Vision"}</span>`;
  if (dovi === "strip_hdr10") {
    doviBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${isAr ? "استخراج HDR10" : "HDR10 Fallback"}</span>`;
  } else if (dovi === "convert_sdr") {
    doviBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${isAr ? "تحويل إلى SDR" : "Convert to SDR"}</span>`;
  }

  box.innerHTML = `
    ${engineBadge}
    <span class="chip blue" style="font-size: 11px; font-weight: 700;">${codecText}</span>
    <span class="chip neutral" style="font-size: 11px;">${resLabel}</span>
    <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${rcBadgeText}</span>
    <span class="chip neutral" style="font-size: 11px;">${presetLabel}</span>
    <span class="chip neutral" style="font-size: 11px;">${pixFmtLabel}</span>
    ${doviBadge}
  `;
}

function updateAudioLivePipeline() {
  const box = document.getElementById("audioLivePipelineBox");
  if (!box) return;

  const lang = state.globalSettings.language || "en";
  const isAr = (lang === "ar");

  const isCopy = el.aCfgCodec && el.aCfgCodec.value === "copy";
  if (isCopy) {
    box.innerHTML = `
      <span class="chip amber" style="font-size: 11px; font-weight: 700;">${isAr ? "نسخ مباشر" : "Copy"}</span>
      <span style="color: var(--muted-text); font-size: 11px;">· ${isAr ? "الحفاظ على مسارات الصوت الأصلية دون إعادة تشفير" : "Master audio tracks preserved (lossless copy)"}</span>
    `;
    return;
  }

  const rawCodec = el.aCfgCodec ? el.aCfgCodec.value : (state.audioSettings.codec || "aac");
  let codecBadge = rawCodec.toUpperCase();
  if (rawCodec === "eac3") codecBadge = "E-AC3";
  else if (rawCodec === "opus") codecBadge = "Opus";

  const rawCh = el.aCfgChannels ? el.aCfgChannels.value : (state.audioSettings.channels || "2");
  let chLabel = "Stereo 2.0";
  if (rawCh === "2") {
    chLabel = isAr ? "ستيريو 2.0" : "Stereo 2.0";
  } else if (rawCh === "6") {
    chLabel = isAr ? "محيطي 5.1" : "5.1 Surround";
  } else if (rawCh === "8") {
    chLabel = isAr ? "محيطي 7.1" : "7.1 Surround";
  } else if (rawCh === "1") {
    chLabel = isAr ? "أحادي 1.0" : "Mono 1.0";
  } else {
    chLabel = isAr ? "القنوات الأصلية" : "Source Channels";
  }

  const rawBr = el.aCfgBitrate ? el.aCfgBitrate.value : (state.audioSettings.bitrate || "192k");
  let brLabel = rawBr;
  if (rawBr === "copy" || rawBr === "original") {
    brLabel = isAr ? "بت المصدر" : "Source Bitrate";
  } else if (!rawBr.endsWith("k") && !isNaN(parseInt(rawBr, 10))) {
    brLabel = `${rawBr}k`;
  }

  const rawSr = el.aCfgSampleRate ? el.aCfgSampleRate.value : (state.audioSettings.sampleRate || "48000");
  let srLabel = `${rawSr} Hz`;
  if (rawSr === "original" || rawSr === "copy") {
    srLabel = isAr ? "تردد المصدر" : "Source Sample Rate";
  }

  box.innerHTML = `
    <span class="chip amber" style="font-size: 11px; font-weight: 700;">${codecBadge}</span>
    <span class="chip neutral" style="font-size: 11px;">${chLabel}</span>
    <span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${brLabel}</span>
    <span class="chip neutral" style="font-size: 11px;">${srLabel}</span>
  `;
}

function highlightActivePresetChips() {
  document.querySelectorAll(".quick-preset-chips").forEach(container => {
    const targetId = container.getAttribute("data-target");
    const targetInput = targetId ? document.getElementById(targetId) : null;
    if (!targetInput) return;
    const currentVal = String(targetInput.value).trim();
    container.querySelectorAll(".chip").forEach(chip => {
      const chipVal = String(chip.getAttribute("data-val")).trim();
      if (chipVal === currentVal) {
        chip.style.borderColor = "var(--accent)";
        chip.style.fontWeight = "700";
        chip.style.opacity = "1";
        chip.style.background = "var(--accent-glow, rgba(99, 102, 241, 0.15))";
      } else {
        chip.style.borderColor = "";
        chip.style.fontWeight = "";
        chip.style.opacity = "0.75";
        chip.style.background = "";
      }
    });
  });
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
// Smart Output Naming Engine
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
  let sourceResolution = null;
  let sourceResNumber = null;

  // First: check media stream dimensions if available (highest accuracy)
  let vidWidth = null;
  let vidHeight = null;
  if (group) {
    if (typeof group.width === "number" && group.width > 0) {
      vidWidth = group.width;
      vidHeight = group.height || 0;
    } else if (group.tracks && Array.isArray(group.tracks)) {
      const vt = group.tracks.find(t => t.kind === "video");
      if (vt && typeof vt.width === "number" && vt.width > 0) {
        vidWidth = vt.width;
        vidHeight = vt.height || 0;
      }
    }
  }

  if (vidWidth || vidHeight) {
    if ((vidWidth && vidWidth >= 3800) || (vidHeight && vidHeight >= 2000)) {
      sourceResolution = "2160p";
      sourceResNumber = "2160";
    } else if ((vidWidth && vidWidth >= 2500) || (vidHeight && vidHeight >= 1400)) {
      sourceResolution = "1440p";
      sourceResNumber = "1440";
    } else if ((vidWidth && vidWidth >= 1800) || (vidHeight && vidHeight >= 1000)) {
      sourceResolution = "1080p";
      sourceResNumber = "1080";
    } else if ((vidWidth && vidWidth >= 1200) || (vidHeight && vidHeight >= 680)) {
      sourceResolution = "720p";
      sourceResNumber = "720";
    } else if ((vidWidth && vidWidth >= 900) || (vidHeight && vidHeight >= 500)) {
      sourceResolution = "540p";
      sourceResNumber = "540";
    } else if ((vidWidth && vidWidth >= 640) || (vidHeight && vidHeight >= 400)) {
      sourceResolution = "480p";
      sourceResNumber = "480";
    } else if (vidHeight && vidHeight > 0) {
      sourceResolution = `${vidHeight}p`;
      sourceResNumber = `${vidHeight}`;
    }
  }

  // Second: check filename tokens if dimensions not available
  if (!sourceResolution) {
    const resRegex = /(?:^|[ ._\-\[])(2160p|4k|uhd|3840x2160|1440p|2k|qhd|2560x1440|1080p|1080i|fhd|1920x1080|720p|1280x720|576p|480p|854x480)(?:[ ._\-\]]|$)/i;
    const resMatch = cleanStem.match(resRegex);
    if (resMatch) {
      const lower = resMatch[1].toLowerCase();
      if (lower === "4k" || lower === "uhd" || lower === "2160p" || lower === "3840x2160") {
        sourceResolution = "2160p";
        sourceResNumber = "2160";
      } else if (lower === "1440p" || lower === "2k" || lower === "qhd" || lower === "2560x1440") {
        sourceResolution = "1440p";
        sourceResNumber = "1440";
      } else if (lower === "1080p" || lower === "1080i" || lower === "fhd" || lower === "1920x1080") {
        sourceResolution = "1080p";
        sourceResNumber = "1080";
      } else if (lower === "720p" || lower === "1280x720") {
        sourceResolution = "720p";
        sourceResNumber = "720";
      } else if (lower === "576p") {
        sourceResolution = "576p";
        sourceResNumber = "576";
      } else {
        sourceResolution = "480p";
        sourceResNumber = "480";
      }
    }
  }

  // Default fallback if unknown
  if (!sourceResolution) {
    sourceResolution = "1080p";
    sourceResNumber = "1080";
  }

  // Target resolution override:
  // ONLY if video is actively being converted with an explicit resize (and not copy / not in-place / not original)
  let resolution = sourceResolution;
  let resNumber = sourceResNumber;

  const isExplicitResize = videoSettings && videoSettings.resolution && videoSettings.resolution !== "original";
  const isVideoConverting = group && group.tracks && group.tracks.some(t => t.kind === "video" && t.action === "convert");

  if (isExplicitResize && isVideoConverting) {
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
  const vSettings = videoSettings || state.videoSettings;
  const doviAct = vSettings ? (vSettings.doviAction || "retain") : "retain";

  if (doviAct === "convert_sdr") {
    hdr = ""; // When converted to SDR, strip HDR from output name & tags
  } else if (doviAct === "strip_hdr10") {
    hdr = "HDR10"; // When DV is stripped, output name & tag is pure clean HDR10
  } else if (doviAct === "convert_p81") {
    hdr = "DV.HDR10"; // Converted to Profile 8.1 with HDR10 compatibility
  } else {
    if (group && group.hdr) {
      hdr = group.hdr;
    } else if (group && group.tracks) {
      const vt = group.tracks.find(t => t.kind === "video");
      if (vt && vt.hdr) hdr = vt.hdr;
    }
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
            if (t.kind === "video" || t.kind === "audio" || t.kind === "subtitle") {
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
            item.coverPath = currentPreviewMeta.localPosterPath || null;
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
        const info = parseMediaInfo(item.filename, { ...item, metadata: { title: newTitle, year: newYear } }, { ...state.videoSettings, resolution: "original" });
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
    el.btnApplyMetaAllEpisodes.addEventListener("click", async () => {
      if (metaModalContext.mode === "quick") {
        if (!state.quickToolsFiles || state.quickToolsFiles.length === 0) return;

        const newTitle = el.metaResultTitleInput ? el.metaResultTitleInput.value.trim() : "";
        const newYear = el.metaResultYearInput ? el.metaResultYearInput.value.trim() : "";
        const matchedSource = currentPreviewMeta ? (currentPreviewMeta.source || "Manual") : "Manual";

        let coverUrl = currentPreviewMeta ? currentPreviewMeta.posterUrl : null;
        let coverPath = currentPreviewMeta ? currentPreviewMeta.localPosterPath : null;
        let coverDataUrl = null;

        if (currentPreviewMeta && currentPreviewMeta.posterUrl) {
          if (currentPreviewMeta.posterUrl.startsWith("data:")) {
            coverDataUrl = currentPreviewMeta.posterUrl;
            coverPath = currentPreviewMeta.localPosterPath || null;
          } else if (coverPath) {
            try {
              coverDataUrl = await invoke("read_image_data_url", { path: coverPath });
            } catch (_) {}
          } else {
            // Online URL - download once to cache and generate dataUrl
            const safeKey = "all_quick_series_" + Date.now();
            try {
              const localP = await invoke("download_cover_image", { key: safeKey, url: currentPreviewMeta.posterUrl });
              if (localP) {
                coverPath = localP;
                coverDataUrl = await invoke("read_image_data_url", { path: localP });
              }
            } catch (e) {
              console.warn("Batch cover download error:", e);
            }
          }
        }

        const namingCfg = state.globalSettings.naming || {};
        state.quickToolsFiles.forEach(item => {
          item.coverUrl = coverUrl;
          item.coverPath = coverPath;
          if (coverDataUrl) item.coverDataUrl = coverDataUrl;
          item.matchedSource = matchedSource;

          // Recompute proposed name based on new title / year preserving episode numbers
          const info = parseMediaInfo(item.filename, { ...item, metadata: { title: newTitle, year: newYear } }, { ...state.videoSettings, resolution: "original" });
          const pattern = info.isSeries
            ? (namingCfg.seriesPattern || "{Title}.S{SS}E{EE}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}")
            : (namingCfg.moviePattern || "{Title}.{Year}.{Resolution}.{hdr}.{Qt}.{vc}.{ac}.{Tag}");
          item.proposedName = formatFilename(pattern, info, namingCfg.tag || "yasinoss") + ".mkv";
        });

        renderQuickToolsStage();
        el.metadataModal.classList.remove("open");
        return;
      }

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
        const initialInfo = parseMediaInfo(item.filename, item, { ...state.videoSettings, resolution: "original" });
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
    el.btnApplyMetaAllEpisodes.textContent = t("btn_apply_meta_all_episodes");
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
    el.btnApplyMetaAllEpisodes.style.display = (state.quickToolsFiles && state.quickToolsFiles.length > 1) ? "inline-flex" : "none";
    el.btnApplyMetaAllEpisodes.textContent = t("btn_apply_meta_all_episodes");
  }

  const initialInfo = parseMediaInfo(item.filename, item, { ...state.videoSettings, resolution: "original" });
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
      : `<div class="gallery-no-img"><svg class="ui-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg><span style="margin-top:4px;">No Poster</span></div>`;

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

  // Clickable quick preset chips (Resolution, Quality, Channels, Bitrate)
  document.querySelectorAll(".quick-preset-chips .chip").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      const val = chip.getAttribute("data-val");
      const container = chip.closest(".quick-preset-chips");
      const targetId = container ? container.getAttribute("data-target") : null;
      const targetInput = targetId ? document.getElementById(targetId) : null;
      if (targetInput && val !== null) {
        targetInput.value = val;
        targetInput.dispatchEvent(new Event("input", { bubbles: true }));
        targetInput.dispatchEvent(new Event("change", { bubbles: true }));
        updateRateControlUI();
        if (typeof liveSyncModalToState === "function") liveSyncModalToState();
      }
    });
  });
  if (el.vCfgRateControl) {
    el.vCfgRateControl.addEventListener("change", updateRateControlUI);
  }

  if (el.vCfgQualitySlider) {
    el.vCfgQualitySlider.addEventListener("input", () => {
      if (el.vCfgQualityVal) el.vCfgQualityVal.value = el.vCfgQualitySlider.value;
      updateQualityBadge(el.vCfgQualitySlider.value);
      state.videoSettings.qualityVal = el.vCfgQualitySlider.value;
      updateVideoLivePipeline();
      highlightActivePresetChips();
    });
  }
  if (el.vCfgQualityVal) {
    el.vCfgQualityVal.addEventListener("input", () => {
      const val = parseInt(el.vCfgQualityVal.value, 10);
      if (!isNaN(val) && val >= 16 && val <= 32 && el.vCfgQualitySlider) {
        el.vCfgQualitySlider.value = val;
      }
      updateQualityBadge(el.vCfgQualityVal.value);
      state.videoSettings.qualityVal = el.vCfgQualityVal.value;
      updateVideoLivePipeline();
      highlightActivePresetChips();
    });
  }

  // Clickable hardware acceleration engine cards (NVENC, AMF, QSV, CPU)
  document.querySelectorAll(".hw-engine-card").forEach(card => {
    card.addEventListener("click", () => {
      const engine = card.getAttribute("data-engine");
      if (!engine) return;
      if (el.vCfgHwAccel) {
        el.vCfgHwAccel.value = engine;
        el.vCfgHwAccel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  });

  if (el.vCfgHwAccel) {
    el.vCfgHwAccel.addEventListener("change", () => {
      updateHwAccelUI();
      liveSyncModalToState();
    });
  }
  if (el.vCfgCodec) {
    el.vCfgCodec.addEventListener("change", () => {
      updateRateControlUI();
      liveSyncModalToState();
    });
  }
  if (el.aCfgCodec) {
    el.aCfgCodec.addEventListener("change", () => {
      updateRateControlUI();
      liveSyncModalToState();
    });
  }

  // Live input events to keep state.videoSettings and state.audioSettings in sync instantly
  const liveSyncModalToState = () => {
    if (el.vCfgHwAccel) state.videoSettings.hwAccel = el.vCfgHwAccel.value;
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
    if (el.vCfgDoviAction) {
      state.videoSettings.doviAction = el.vCfgDoviAction.value;
      if (el.quickDoviAction) el.quickDoviAction.value = el.vCfgDoviAction.value;
    }

    if (el.aCfgCodec) state.audioSettings.codec = el.aCfgCodec.value;
    if (el.aCfgChannels) state.audioSettings.channels = el.aCfgChannels.value;
    if (el.aCfgBitrate) state.audioSettings.bitrate = el.aCfgBitrate.value;
    if (el.aCfgSampleRate) state.audioSettings.sampleRate = el.aCfgSampleRate.value;

    updateVideoLivePipeline();
    updateAudioLivePipeline();
    highlightActivePresetChips();
  };

  [
    el.vCfgHwAccel, el.vCfgResolution, el.vCfgCodec, el.vCfgRateControl, el.vCfgQualityVal, el.vCfgQualitySlider, el.vCfgPreset, el.vCfgTune, el.vCfgPixFmt,
    el.vCfgMultipass, el.vCfgProfile, el.vCfgLevel, el.vCfgAq, el.vCfgDoviAction,
    el.aCfgCodec, el.aCfgChannels, el.aCfgBitrate, el.aCfgSampleRate
  ].forEach(input => {
    if (input) {
      input.addEventListener("change", liveSyncModalToState);
      input.addEventListener("input", liveSyncModalToState);
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

      if (el.vCfgHwAccel) el.vCfgHwAccel.value = state.videoSettings.hwAccel || "nvenc";
      updateHwAccelUI();

      if (el.vCfgResolution) el.vCfgResolution.value = state.videoSettings.resolution;
      if (el.vCfgCodec) el.vCfgCodec.value = state.videoSettings.codec;
      if (el.vCfgRateControl) el.vCfgRateControl.value = state.videoSettings.rateControl;
      if (el.vCfgQualityVal) {
    el.vCfgQualityVal.value = state.videoSettings.qualityVal;
    if (el.vCfgQualitySlider) {
      const qNum = parseInt(state.videoSettings.qualityVal, 10);
      if (!isNaN(qNum) && qNum >= 16 && qNum <= 32) {
        el.vCfgQualitySlider.value = qNum;
      }
    }
  }
      if (el.vCfgPreset) el.vCfgPreset.value = state.videoSettings.preset;
      if (el.vCfgTune) el.vCfgTune.value = state.videoSettings.tune;
      if (el.vCfgPixFmt) el.vCfgPixFmt.value = state.videoSettings.pixFmt;
      if (el.vCfgMultipass) el.vCfgMultipass.value = state.videoSettings.multipass || "disabled";
      if (el.vCfgProfile) el.vCfgProfile.value = state.videoSettings.profile || "auto";
      if (el.vCfgLevel) el.vCfgLevel.value = state.videoSettings.level || "auto";
      if (el.vCfgAq) el.vCfgAq.value = state.videoSettings.aq || "enabled";
      if (el.vCfgDoviAction) el.vCfgDoviAction.value = state.videoSettings.doviAction || "retain";

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
        hwAccel: el.vCfgHwAccel ? el.vCfgHwAccel.value : (state.videoSettings.hwAccel || "nvenc"),
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
        aq: el.vCfgAq ? el.vCfgAq.value : "enabled",
        doviAction: el.quickDoviAction ? el.quickDoviAction.value : (state.videoSettings.doviAction || "retain")
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
      state.videoSettings.hwAccel = "nvenc";
      if (el.vCfgHwAccel) el.vCfgHwAccel.value = "nvenc";
      updateHwAccelUI();
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
        icon: "trash"
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
        icon: "trash"
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

  if (el.quickDoviAction) {
    el.quickDoviAction.addEventListener("change", async () => {
      const val = el.quickDoviAction.value;
      state.videoSettings.doviAction = val;
      if (el.vCfgDoviAction) el.vCfgDoviAction.value = val;

      const currentGroup = state.groups[state.selectedGroupIndex];
      const prof = currentGroup?.dovi_profile ?? currentGroup?.tracks.find(t => t.dovi_profile != null)?.dovi_profile;
      if (val === "strip_hdr10" && prof === 5) {
        const proceed = await showConfirmDialog({
          title: t("warn_dovi_p5_title") || "Dolby Vision Profile 5 Warning",
          message: t("warn_dovi_p5_msg") || "Warning: Profile 5 lacks an HDR10 base layer. Stripping it directly will cause distorted green and purple colors on normal displays. Are you sure you want to proceed with instant stripping?",
          confirmText: t("btn_proceed") || "Proceed Anyway",
          cancelText: t("btn_cancel") || "Cancel",
          isDanger: true,
          icon: "⚠️"
        });
        if (!proceed) {
          el.quickDoviAction.value = "convert_sdr";
          state.videoSettings.doviAction = "convert_sdr";
          if (el.vCfgDoviAction) el.vCfgDoviAction.value = "convert_sdr";
        }
      }
      applyQuickSettingsToAll();
      if (state.currentStep === 3) renderExportStage();
    });

    // 2-second hover tooltip for HDR / DV Quick Settings
    let hoverTimer = null;
    const showDoviTooltip = () => {
      if (!el.quickDoviTooltip) return;
      const isArabic = state.lang === "ar";
      const val = el.quickDoviAction ? el.quickDoviAction.value : "retain";

      const content = isArabic ? `
        <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
          <span>دليل خيارات HDR و Dolby Vision</span>
          <span style="font-size: 10px; color: var(--accent);">تلميح توضيحي</span>
        </div>
        <div style="margin-bottom: 6px; ${val === 'retain' ? 'background: rgba(168,85,247,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #c084fc;">• Keep DV (إبقاء DV):</strong><br>
          الاحتفاظ بتقنية Dolby Vision كما هي في الملف الأصلي دون أي تعديل (Passthrough).
        </div>
        <div style="margin-bottom: 6px; ${val === 'convert_p81' ? 'background: rgba(16,185,129,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #34d399;">• To Profile 8.1 (إلى Profile 8.1):</strong><br>
          تحويل Dolby Vision Profile 7 إلى Profile 8.1 مع طبقة HDR10 متوافقة ليعمل بسلاسة فائقة وبأعلى جودة على جميع الشاشات.
        </div>
        <div style="margin-bottom: 6px; ${val === 'strip_hdr10' ? 'background: rgba(245,158,11,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #fbbf24;">• Strip DV (حذف DV):</strong><br>
          حذف طبقة RPU فورياً واستخراج طبقة HDR10 الصافية في ثوانٍ معدودة دون إعادة تشفير الفيديو.
        </div>
        <div style="${val === 'convert_sdr' ? 'background: rgba(59,130,246,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #60a5fa;">• To SDR (إلى SDR):</strong><br>
          إعادة ترميز الفيديو مع تحويل المدى اللوني (Tone-Mapping BT.709) لتعمل الألوان بوضوح وطبيعية على الشاشات العادية.
        </div>
      ` : `
        <div style="font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
          <span>HDR &amp; Dolby Vision Options Guide</span>
          <span style="font-size: 10px; color: var(--accent);">Interactive Guide</span>
        </div>
        <div style="margin-bottom: 6px; ${val === 'retain' ? 'background: rgba(168,85,247,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #c084fc;">• Keep DV:</strong><br>
          Preserves original Dolby Vision and HDR metadata as-is without modification.
        </div>
        <div style="margin-bottom: 6px; ${val === 'convert_p81' ? 'background: rgba(16,185,129,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #34d399;">• To Profile 8.1:</strong><br>
          Converts Profile 7 to universal Profile 8.1 with standard HDR10 base layer for universal playback.
        </div>
        <div style="margin-bottom: 6px; ${val === 'strip_hdr10' ? 'background: rgba(245,158,11,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #fbbf24;">• Strip DV:</strong><br>
          Removes Dolby Vision RPU metadata in seconds without re-encoding, leaving pure HDR10.
        </div>
        <div style="${val === 'convert_sdr' ? 'background: rgba(59,130,246,0.12); padding: 4px 6px; border-radius: 4px;' : ''}">
          <strong style="color: #60a5fa;">• To SDR:</strong><br>
          Re-encodes video converting HDR color space to standard SDR BT.709 for normal screens.
        </div>
      `;

      el.quickDoviTooltip.innerHTML = content;
      el.quickDoviTooltip.style.display = "block";
    };

    const hideDoviTooltip = () => {
      if (hoverTimer) {
        clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      if (el.quickDoviTooltip) el.quickDoviTooltip.style.display = "none";
    };

    const targetEl = document.getElementById("groupDoviAction") || el.quickDoviAction;
    targetEl.addEventListener("mouseenter", () => {
      hoverTimer = setTimeout(showDoviTooltip, 2000);
    });
    targetEl.addEventListener("mouseleave", hideDoviTooltip);
    el.quickDoviAction.addEventListener("change", hideDoviTooltip);
    el.quickDoviAction.addEventListener("click", hideDoviTooltip);
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

            // When adding a new subtitle:
            // 1. If old container subtitles share the same language, remove them so the new one takes over
            if (detectedLang !== "und") {
              g.tracks.forEach(t => {
                if (t.kind === "subtitle" && t.origin === "container" && t.lang === detectedLang) {
                  t.action = "remove";
                  t.is_default = false;
                }
              });
            }
            // 2. Unset default flag on existing subtitles so the new subtitle becomes default
            g.tracks.forEach(t => {
              if (t.kind === "subtitle") {
                t.is_default = false;
              }
            });
            // 3. Clear old track title names across group if auto-clear is enabled
            if (state.globalSettings.clearTrackNames !== false) {
              g.tracks.forEach(t => {
                t.name = "";
              });
            }
          }

          const trackName = (kind === "subtitle" || state.globalSettings.clearTrackNames !== false) ? "" : filename;

          g.tracks.push({
            id: `att_${idx}_${Date.now()}`,
            kind: kind,
            name: trackName,
            origin: "external",
            source_path: p,
            source_index: 0,
            codec: ext.toUpperCase(),
            lang: detectedLang,
            is_default: (kind === "subtitle"),
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
          if (autoClearTrackNames && (t.kind === "video" || t.kind === "audio" || t.kind === "subtitle")) {
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

  const hasDovi = group.tracks.some(t => (t.hdr && t.hdr.includes("DV")) || t.dovi_profile != null) || (group.hdr && group.hdr.includes("DV")) || group.dovi_profile != null;
  if (el.doviBadge) {
    if (hasDovi) {
      el.doviBadge.style.display = "inline-block";
      const prof = group.dovi_profile ?? group.tracks.find(t => t.dovi_profile != null)?.dovi_profile;
      el.doviBadge.textContent = prof ? `DV P${prof}` : "DV";
      if (prof === 5) {
        el.doviBadge.style.background = "rgba(239, 68, 68, 0.18)";
        el.doviBadge.style.color = "#EF4444";
        el.doviBadge.title = "Dolby Vision Profile 5 (Convert to SDR recommended for standard screens)";
      } else {
        el.doviBadge.style.background = "rgba(168, 85, 247, 0.18)";
        el.doviBadge.style.color = "#A855F7";
        el.doviBadge.title = prof ? `Dolby Vision Profile ${prof} (HDR10 Base Layer)` : "Dolby Vision";
      }
    } else {
      el.doviBadge.style.display = "none";
    }
  }

  renderTracksTable(group);
}

function renderTracksTable(group) {
  if (!el.tracksTableBody) return;
  el.tracksTableBody.innerHTML = "";

  const containerTracks = group.tracks.filter(t => t.origin === "container");
  const externalTracks = group.tracks.filter(t => t.origin === "external");

  if (containerTracks.length > 0) {
    containerTracks.forEach(t => renderTrackRow(t, group));
  }

  if (externalTracks.length > 0) {
    const divRow = document.createElement("tr");
    divRow.className = "group-divider";
    divRow.innerHTML = `
      <td colspan="6" style="padding: 7px 12px; background: rgba(0,0,0,0.22); border-bottom: 1px solid var(--border);">
        <span style="font-weight: 700; color: var(--accent);">${t("lbl_external_files") || "External & Added files"} ·</span>
        <span style="opacity: 0.85; font-size: 12px;"> ${externalTracks.length} ${t("lbl_files") || "files"}</span>
      </td>
    `;
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

  const isNamedTrack = (track.kind === "video" || track.kind === "audio" || track.kind === "subtitle");
  const hasCustomName = Boolean(track.name && !track.name.startsWith("Track ") && track.name.trim().length > 0);

  let videoHdrBadge = "";
  if (track.kind === "video") {
    const hdrType = track.hdr || group?.hdr || "";
    const doviProf = track.dovi_profile ?? group?.dovi_profile;
    if (doviProf != null || hdrType.includes("DV")) {
      const profStr = doviProf != null ? `DV P${doviProf}` : "DV";
      videoHdrBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 4px;">${profStr}</span>`;
    } else if (hdrType.includes("HDR10+")) {
      videoHdrBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 4px;">HDR10+</span>`;
    } else if (hdrType.includes("HDR")) {
      videoHdrBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 4px;">HDR10</span>`;
    } else if (hdrType.includes("HLG")) {
      videoHdrBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; background: rgba(6, 182, 212, 0.2); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.35); border-radius: 4px;">HLG</span>`;
    } else {
      videoHdrBadge = `<span class="chip" style="font-size: 10px; font-weight: 600; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; background: rgba(100, 116, 139, 0.15); color: var(--muted-text); border: 1px solid rgba(100, 116, 139, 0.25); border-radius: 4px;">SDR</span>`;
    }
  }

  let audioChannelsBadge = "";
  if (track.kind === "audio") {
    let layout = track.channel_layout || "";
    const ch = track.channels;
    if (!layout && ch) {
      if (ch === 1) layout = "Mono (1.0)";
      else if (ch === 2) layout = "Stereo (2.0)";
      else if (ch === 6) layout = "5.1";
      else if (ch === 8) layout = "7.1";
      else layout = `${ch}ch`;
    }
    if (!layout) {
      const lowerName = (track.name || "").toLowerCase();
      if (lowerName.includes("7.1") || lowerName.includes("8ch")) layout = "7.1";
      else if (lowerName.includes("5.1") || lowerName.includes("6ch")) layout = "5.1";
      else if (lowerName.includes("stereo") || lowerName.includes("2.0") || lowerName.includes("2ch")) layout = "Stereo (2.0)";
      else if (lowerName.includes("mono") || lowerName.includes("1.0") || lowerName.includes("1ch")) layout = "Mono (1.0)";
    }
    if (layout) {
      let chipStyle = "background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35);";
      if (layout.includes("7.1") || layout.includes("8ch")) {
        chipStyle = "background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);";
      } else if (layout.includes("5.1") || layout.includes("6ch")) {
        chipStyle = "background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.35);";
      } else if (layout.includes("Mono") || layout.includes("1.0")) {
        chipStyle = "background: rgba(100, 116, 139, 0.15); color: var(--muted-text); border: 1px solid rgba(100, 116, 139, 0.25);";
      }
      audioChannelsBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; border-radius: 4px; ${chipStyle}">${escapeHtml(layout)}</span>`;
    }
  }

  let subtitleBadge = "";
  if (track.kind === "subtitle") {
    const rawCodec = (track.codec || "").toLowerCase();
    let subType = "SRT";
    let subStyle = "background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);";
    if (rawCodec.includes("ass") || rawCodec.includes("ssa")) {
      subType = "ASS";
      subStyle = "background: rgba(139, 92, 246, 0.22); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.35);";
    } else if (rawCodec.includes("pgs") || rawCodec.includes("hdmv")) {
      subType = "PGS";
      subStyle = "background: rgba(245, 158, 11, 0.22); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);";
    } else if (rawCodec.includes("vobsub") || rawCodec.includes("dvd")) {
      subType = "VobSub";
      subStyle = "background: rgba(234, 179, 8, 0.22); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.35);";
    } else if (rawCodec.includes("mov_text") || rawCodec.includes("tx3g")) {
      subType = "TX3G";
      subStyle = "background: rgba(6, 182, 212, 0.22); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.35);";
    } else if (rawCodec.includes("webvtt") || rawCodec.includes("vtt")) {
      subType = "VTT";
      subStyle = "background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35);";
    } else if (rawCodec) {
      subType = track.codec.toUpperCase();
    }
    subtitleBadge = `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 6px; margin-inline-end: 6px; vertical-align: middle; border-radius: 4px; ${subStyle}">${escapeHtml(subType)}</span>`;
  }

  let trackTitle = "";
  if (track.displayLabel && track.displayLabel !== formatLang(track.lang)) {
    trackTitle = `${videoHdrBadge}${audioChannelsBadge}${subtitleBadge}${track.codec} · <strong>${escapeHtml(track.displayLabel)}</strong>${hasCustomName && track.name !== track.displayLabel ? ` (${escapeHtml(track.name)})` : ""}`;
  } else {
    trackTitle = `${videoHdrBadge}${audioChannelsBadge}${subtitleBadge}${track.codec} · ${hasCustomName ? escapeHtml(track.name) : escapeHtml(track.displayLabel || "")}`;
  }

  if (isNamedTrack && hasCustomName) {
    trackTitle += ` <button type="button" class="btn-clear-track-name" title="${t("btn_clear_track_name") || "Clear track name"}" style="background: none; border: 1px solid var(--border); border-radius: 4px; color: var(--muted-text); cursor: pointer; padding: 0 5px; font-size: 11px; margin-inline-start: 6px; line-height: 1.2; vertical-align: middle;">✕</button>`;
  }

  const optKeep = t("opt_action_keep") || "Keep";
  const optAdd = t("opt_action_add") || "Add";
  const optBurn = t("opt_action_burn") || "Burn";
  const optRemove = t("opt_action_remove") || "Remove";
  const optConvert = t("opt_action_convert") || "Convert";
  const optYes = t("opt_yes") || "Yes";

  tr.innerHTML = `
    <td><span class="tag ${track.kind}">${track.kind.toUpperCase()}</span></td>
    <td style="max-width: 290px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(track.name || track.displayLabel || '')}">${trackTitle}</td>
    <td>${langCell}</td>
    <td>
      <select class="track-default-select">
        <option value="false" ${!track.is_default ? "selected" : ""}>—</option>
        <option value="true" ${track.is_default ? "selected" : ""}>${optYes}</option>
      </select>
    </td>
    <td>
      <input type="number" class="track-delay-input" style="width: 80px;" value="${track.delay}" step="50">
    </td>
    <td>
      <select class="track-action-select">
        ${track.kind === "subtitle"
          ? `${track.origin === "container" ? `<option value="keep" ${track.action === "keep" ? "selected" : ""}>${optKeep}</option>` : `<option value="add" ${track.action === "add" ? "selected" : ""}>${optAdd}</option>`}
             <option value="burn" ${track.action === "burn" ? "selected" : ""}>${optBurn}</option>
             <option value="remove" ${track.action === "remove" ? "selected" : ""}>${optRemove}</option>`
          : (track.kind === "audio"
              ? `${track.origin === "container" ? `<option value="keep" ${track.action === "keep" ? "selected" : ""}>${optKeep}</option>` : `<option value="add" ${track.action === "add" ? "selected" : ""}>${optAdd}</option>`}
                 <option value="convert" ${track.action === "convert" ? "selected" : ""}>${optConvert}</option>
                 <option value="remove" ${track.action === "remove" ? "selected" : ""}>${optRemove}</option>`
              : (track.origin === "container"
                  ? `<option value="keep" ${track.action === "keep" ? "selected" : ""}>${optKeep}</option>
                     <option value="convert" ${track.action === "convert" ? "selected" : ""}>${optConvert}</option>
                     <option value="remove" ${track.action === "remove" ? "selected" : ""}>${optRemove}</option>`
                  : `<option value="add" ${track.action === "add" ? "selected" : ""}>${optAdd}</option>
                     <option value="remove" ${track.action === "remove" ? "selected" : ""}>${optRemove}</option>`
                )
            )
        }
      </select>
    </td>
  `;

  function updateRowHighlight() {
    tr.classList.remove("track-row-kept", "track-row-removed", "track-row-convert");
    if (track.action === "remove") {
      tr.classList.add("track-row-removed");
    } else if (track.action === "convert" || track.action === "burn") {
      tr.classList.add("track-row-convert");
    }
  }
  updateRowHighlight();

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
    updateRowHighlight();
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
    } else {
      renderVideoSidebar();
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
  const isPresetCopy = (preset === "copy");
  const isVideoCopy = isPresetCopy || (preset === "default" && state.videoSettings.codec === "copy");
  
  let isAudioConverting = false;
  if (isPresetCopy) {
    // Under Copy (no re-encode), audio is strictly kept untouched
    isAudioConverting = false;
  } else if (preset in PRESET_MAP && PRESET_MAP[preset].audioCodec) {
    isAudioConverting = (PRESET_MAP[preset].audioCodec !== "copy");
  } else {
    isAudioConverting = Boolean(state.audioSettings.codec && state.audioSettings.codec !== "copy");
  }
  const doviAct = el.quickDoviAction ? el.quickDoviAction.value : (state.videoSettings.doviAction || "retain");
  state.videoSettings.doviAction = doviAct;
  if (el.vCfgDoviAction) el.vCfgDoviAction.value = doviAct;

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

        const defAudioAction = isAudioConverting ? "convert" : (t.origin === "container" ? "keep" : "add");
        if (state.quickSettings.userTouchedAudios || state.quickSettings.keepAudios.size > 0) {
          t.action = isKept ? defAudioAction : "remove";
        } else if (t.action !== "remove") {
          t.action = defAudioAction;
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
        if (doviAct === "convert_sdr") {
          t.action = "convert";
        } else if (doviAct === "strip_hdr10") {
          t.action = isVideoCopy ? "keep" : "convert";
        } else {
          t.action = isVideoCopy ? "keep" : "convert";
        }
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
    const isPresetCopy = (presetKey === "copy");
    const isVideoCopy = isPresetCopy || (presetKey === "default" && state.videoSettings.codec === "copy");
    const hasBurn = g.tracks.some(t => t.kind === "subtitle" && t.action === "burn");
    const isConvert = !isVideoCopy && g.tracks.some(t => t.kind === "video" && t.action === "convert");
    const isStripDovi = (state.videoSettings.doviAction === "strip_hdr10");
    const isConvertSdr = (state.videoSettings.doviAction === "convert_sdr");
    const isConvertP81 = (state.videoSettings.doviAction === "convert_p81");
    const hasConvertAudio = !isPresetCopy && g.tracks.some(t => t.kind === "audio" && t.action === "convert");

    let videoPart = "";
    if (isConvertSdr) {
      videoPart = "Tone-Map SDR (Re-encode)";
    } else if (isStripDovi) {
      videoPart = "Strip DV (Fast HDR10)";
    } else if (isConvertP81) {
      videoPart = "Convert DV to P8.1 (Fast)";
    } else if (isConvert) {
      let pLabel = "";
      if (presetKey !== "default" && presetKey !== "copy" && PRESET_MAP[presetKey]) {
        pLabel = PRESET_MAP[presetKey].label;
      } else {
        pLabel = state.videoSettings.codec.toUpperCase().replace('_NVENC', '');
      }
      videoPart = hasBurn ? `Convert Video (${pLabel} + Hardsub)` : `Convert Video (${pLabel})`;
    } else {
      videoPart = "Copy Video";
    }

    let planParts = [videoPart];
    if (hasConvertAudio) {
      const aCodec = (presetKey in PRESET_MAP && PRESET_MAP[presetKey].audioCodec)
        ? PRESET_MAP[presetKey].audioCodec.toUpperCase()
        : ((state.audioSettings.codec && state.audioSettings.codec !== "copy")
          ? state.audioSettings.codec.toUpperCase()
          : "AAC");
      planParts.push(`Convert Audio (${aCodec})`);
    }
    planParts.push("Mux");
    let plan = planParts.join(" · ");

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

  const lblWaiting = t("status_waiting") || "Waiting";
  const lblConverting = t("status_converting") || "Converting";
  const lblPaused = t("status_paused") || "Paused";
  const lblSkipped = t("status_skipped") || "Skipped";
  const lblDone = t("status_done") || "Done";
  const lblFailed = t("status_failed") || "Failed";
  const lblOutput = t("lbl_output") || "Output";

  state.queueJobs.forEach(job => {
    const tr = document.createElement("tr");

    let statusBadge = `<span class="chip neutral" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block;">${lblWaiting}</span>`;
    if (job.status === "running") {
      let speedText = job.speed ? job.speed : lblConverting;
      statusBadge = `<span class="chip blue" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block;" title="${escapeHtml(speedText)}">${escapeHtml(speedText)}</span>`;
    } else if (job.status === "paused") {
      statusBadge = `<span class="chip amber" style="white-space: nowrap; display: inline-block;">${lblPaused}</span>`;
    } else if (job.status === "skipped") {
      statusBadge = `<span class="chip neutral" style="white-space: nowrap; display: inline-block;">${lblSkipped}</span>`;
    } else if (job.status === "done") {
      statusBadge = `<span class="chip green" style="white-space: nowrap; display: inline-block;">${lblDone}</span>`;
    } else if (job.status === "failed") {
      statusBadge = `<span class="chip red" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; display: inline-block;" title="${escapeHtml(job.error || '')}">${lblFailed}</span>`;
    }

    const planHtml = `<div style="font-size: 12px; color: var(--text); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(job.plan || '')}">${escapeHtml(job.plan || '')}</div>`;

    const outName = job.outputFilename || (job.key + '.mkv');

    tr.innerHTML = `
      <td style="font-weight: 600; max-width: 0; overflow: hidden;" title="${escapeHtml(job.key)}">
        <div style="display: flex; gap: 10px; align-items: center; max-width: 100%;">
          ${job.posterUrl ? `<img src="${job.posterUrl}" style="width: 28px; height: 40px; border-radius: 3px; object-fit: cover; flex-shrink: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">` : ''}
          <div style="min-width: 0; flex: 1; overflow: hidden;">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(job.key)}">${escapeHtml(job.key)}</div>
            <div style="font-size: 11px; color: var(--accent); font-family: monospace; margin-top: 3px; display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(outName)}">
              <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink: 0; opacity: 0.8;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              <span style="opacity: 0.7; flex-shrink: 0;">${lblOutput}:</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(outName)}</span>
            </div>
          </div>
        </div>
      </td>
      <td style="vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${planHtml}</td>
      <td style="vertical-align: middle;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="progress-bar-container" style="flex: 1;">
            <div class="progress-bar-fill" style="width: ${job.progress}%;"></div>
          </div>
          <span style="font-size: 11px; font-weight: 700; width: 36px; text-align: right;">${Math.round(job.progress)}%</span>
        </div>
      </td>
      <td style="text-align: center; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${statusBadge}</td>
    `;
    el.queueTableBody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// Real Queue Execution
// -------------------------------------------------------------
async function startRealQueueProcessing() {
  if (state.groups.length === 0) return;

  try {
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
        icon: "warning"
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
    const isPresetCopy = (presetKey === "copy");

    let pCfg;
    if (presetKey === "default") {
      pCfg = {
        resolution: state.videoSettings.resolution || "original",
        codec: state.videoSettings.codec || "hevc_nvenc",
        rate_control: state.videoSettings.rateControl || "cqp",
        quality_val: state.videoSettings.qualityVal || "22",
        preset: state.videoSettings.preset || "p5",
        tune: state.videoSettings.tune || "hq",
        pix_fmt: state.videoSettings.pixFmt || "p010le",
        fps: null,
        profile: (state.videoSettings.profile && state.videoSettings.profile !== "auto") ? state.videoSettings.profile : null,
        level: (state.videoSettings.level && state.videoSettings.level !== "auto") ? state.videoSettings.level : null,
        multipass: state.videoSettings.multipass || "disabled",
        aq: state.videoSettings.aq || "enabled"
      };
    } else if (presetKey !== "copy" && PRESET_MAP[presetKey]) {
      const raw = PRESET_MAP[presetKey];
      pCfg = {
        resolution: raw.resolution || "original",
        codec: raw.codec || "hevc_nvenc",
        rate_control: raw.rateControl || "cqp",
        quality_val: raw.qualityVal || "22",
        preset: raw.preset || "p5",
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
        resolution: state.videoSettings.resolution || "original",
        codec: "copy",
        rate_control: state.videoSettings.rateControl || "cqp",
        quality_val: state.videoSettings.qualityVal || "22",
        preset: state.videoSettings.preset || "p5",
        tune: state.videoSettings.tune || "hq",
        pix_fmt: state.videoSettings.pixFmt || "p010le",
        fps: null,
        profile: (state.videoSettings.profile && state.videoSettings.profile !== "auto") ? state.videoSettings.profile : null,
        level: (state.videoSettings.level && state.videoSettings.level !== "auto") ? state.videoSettings.level : null,
        multipass: state.videoSettings.multipass || "disabled",
        aq: state.videoSettings.aq || "enabled"
      };
    }

    pCfg.dovi_action = state.videoSettings.doviAction || "retain";

    const isVideoCopyPreset = isPresetCopy || (presetKey === "default" && state.videoSettings.codec === "copy");
    if (isVideoCopyPreset && pCfg.dovi_action !== "convert_sdr") {
      pCfg.codec = "copy";
    }

    let audioSettingsPayload;
    let isAudioCopy = false;
    if (isPresetCopy) {
      // When Copy (no re-encode) is selected, force audio strictly to copy/passthrough
      isAudioCopy = true;
      audioSettingsPayload = {
        codec: "copy",
        channels: "original",
        bitrate: "copy",
        sample_rate: "original"
      };
    } else if (presetKey in PRESET_MAP && PRESET_MAP[presetKey].audioCodec) {
      const pAudio = PRESET_MAP[presetKey];
      isAudioCopy = (pAudio.audioCodec === "copy");
      audioSettingsPayload = {
        codec: pAudio.audioCodec,
        channels: pAudio.audioChannels === "stereo" ? "2" : (pAudio.audioChannels || "original"),
        bitrate: pAudio.audioBitrate || "192k",
        sample_rate: "original"
      };
    } else {
      const anyAudioConverting = groupsToProcess.some(g => (g.tracks || []).some(t => t.kind === "audio" && t.action === "convert"));
      isAudioCopy = (state.audioSettings.codec === "copy" || !state.audioSettings.codec) && !anyAudioConverting;
      audioSettingsPayload = isAudioCopy
        ? {
            codec: "copy",
            channels: "original",
            bitrate: "copy",
            sample_rate: "original"
          }
        : {
            codec: (state.audioSettings.codec && state.audioSettings.codec !== "copy") ? state.audioSettings.codec : "aac",
            channels: state.audioSettings.channels || "original",
            bitrate: (state.audioSettings.bitrate && state.audioSettings.bitrate !== "copy") ? state.audioSettings.bitrate : "192k",
            sample_rate: state.audioSettings.sampleRate || "original"
          };
    }

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

      const hasBurnSub = (g.tracks || []).some(t => t.kind === "subtitle" && t.action === "burn");
      const finalTracks = (g.tracks || []).map(t => {
        const cloned = { ...t };
        if (cloned.kind === "video") {
          if (hasBurnSub || state.videoSettings.doviAction === "convert_sdr") {
            cloned.action = "convert";
          } else if (state.videoSettings.doviAction === "strip_hdr10") {
            cloned.action = isVideoCopyPreset ? "keep" : "convert";
          } else if (isVideoCopyPreset) {
            cloned.action = "keep";
          }
        }
        if (cloned.kind === "audio") {
          if (cloned.action === "convert") {
            // Explicitly converted
          } else if (isAudioCopy && cloned.action !== "remove") {
            cloned.action = (cloned.origin === "container" ? "keep" : "add");
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
        file_pattern: (el.exportPattern && el.exportPattern.value) ? el.exportPattern.value : "smart",
        output_filename: job && job.outputFilename ? job.outputFilename : null,
        cover_image_path: coverPath,
        if_exists: (el.exportIfExists && el.exportIfExists.value) ? el.exportIfExists.value : "ask",
        delete_originals: el.chkDeleteOriginals ? el.chkDeleteOriginals.checked : false,
        tracks: finalTracks,
        shared_attachments: state.sharedAttachments || [],
        remove_old_attachments: state.removeOldAttachments || false,
        video_settings: pCfg,
        audio_settings: audioSettingsPayload
      };
    }));

    await invoke("run_queue", { jobs: payloads });
  } catch (err) {
    console.error("Queue execution error:", err);
    await showAlertDialog({
      title: "Queue Error",
      message: "Queue error: " + err,
      icon: "warning"
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
    const info = parseMediaInfo(g.filename, g, { ...state.videoSettings, resolution: "original" });
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
      width: g.width,
      height: g.height,
      tracks: g.tracks,
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
        const info = parseMediaInfo(g.filename, g, { ...state.videoSettings, resolution: "original" });
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
          width: g.width,
          height: g.height,
          tracks: g.tracks,
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
            const info = parseMediaInfo(g.filename, g, { ...state.videoSettings, resolution: "original" });
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
      const upper = (s || "").toUpperCase();
      let style = "background: rgba(100, 116, 139, 0.18); color: var(--muted-text); border: 1px solid rgba(100, 116, 139, 0.3);";
      
      if (upper.includes("DV") || upper.includes("DOVI")) {
        style = "background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);";
      } else if (upper.includes("HDR10+")) {
        style = "background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);";
      } else if (upper.includes("HDR") || upper.includes("PQ")) {
        style = "background: rgba(245, 158, 11, 0.2); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35);";
      } else if (upper.includes("HLG")) {
        style = "background: rgba(6, 182, 212, 0.2); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.35);";
      } else if (upper.includes("2160") || upper.includes("4K") || upper.includes("UHD")) {
        style = "background: rgba(59, 130, 246, 0.22); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4);";
      } else if (upper.includes("1080") || upper.includes("FHD")) {
        style = "background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.35);";
      } else if (upper.includes("720") || upper.includes("HD")) {
        style = "background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.35);";
      } else if (upper.includes("HEVC") || upper.includes("H265") || upper.includes("H.265") || upper.includes("X265")) {
        style = "background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.35);";
      } else if (upper.includes("AV1")) {
        style = "background: rgba(20, 184, 166, 0.2); color: #2dd4bf; border: 1px solid rgba(20, 184, 166, 0.35);";
      } else if (upper.includes("H264") || upper.includes("H.264") || upper.includes("AVC") || upper.includes("X264")) {
        style = "background: rgba(59, 130, 246, 0.16); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3);";
      } else if (upper.includes("TRUEHD") || upper.includes("ATMOS") || upper.includes("DTS-HD") || upper.includes("DTS")) {
        style = "background: rgba(217, 70, 239, 0.2); color: #e879f9; border: 1px solid rgba(217, 70, 239, 0.35);";
      } else if (upper.includes("EAC3") || upper.includes("E-AC3") || upper.includes("AC3") || upper.includes("DD+")) {
        style = "background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.35);";
      } else if (upper.includes("AAC") || upper.includes("OPUS") || upper.includes("FLAC")) {
        style = "background: rgba(6, 182, 212, 0.2); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.35);";
      } else if (upper.includes("7.1") || upper.includes("8CH")) {
        style = "background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35);";
      } else if (upper.includes("5.1") || upper.includes("6CH")) {
        style = "background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.35);";
      } else if (upper.includes("STEREO") || upper.includes("2.0") || upper.includes("2CH")) {
        style = "background: rgba(59, 130, 246, 0.18); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35);";
      }
      return `<span class="chip" style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; ${style}">${escapeHtml(s)}</span>`;
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
      <td style="text-align: center; vertical-align: middle; padding: 6px 4px; width: 56px;">
        ${coverCellHtml}
      </td>
      <td style="vertical-align: middle; padding: 8px 10px; max-width: 280px;">
        <div style="font-weight: 600; font-size: 13px; color: var(--text-color); word-break: break-all;" title="${escapeHtml(item.filepath)}">
          ${escapeHtml(item.filename)}
        </div>
        ${folderPath ? `<div style="font-size: 11px; color: var(--muted-text); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(folderPath)}">${escapeHtml(folderPath)}</div>` : ""}
      </td>
      <td style="vertical-align: middle; padding: 8px 10px;">
        <div style="position: relative; width: 100%;">
          <input type="text" class="quick-proposed-name-input" data-idx="${idx}" value="${escapeHtml(item.proposedName || "")}" style="width: 100%; font-size: 12.5px; padding: 7px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg); color: var(--text-color); font-family: monospace;" spellcheck="false" placeholder="Proposed clean name...">
        </div>
        ${item.tmdbMatched ? `<div style="font-size: 10.5px; color: var(--primary); margin-top: 4px; display: flex; align-items: center; gap: 4px;"><svg style="width: 12px; height: 12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> ${escapeHtml(item.tmdbMatched)}</div>` : ""}
      </td>
      <td style="vertical-align: middle; padding: 8px 10px; text-align: center;">
        <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; align-items: center;">
          ${specsHtml || `<span style="color: var(--muted-text); font-size: 11px;">—</span>`}
        </div>
      </td>
      <td style="text-align: center; vertical-align: middle; padding: 8px 4px; white-space: nowrap;">
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
