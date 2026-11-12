"""Settings page with Theme, Accent selection, Audio/Video defaults, and Tool paths.
Version: 1.00
"""
from pathlib import Path
from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox,
    QComboBox,
    QFileDialog,
    QFormLayout,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QScrollArea,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)

from movie_converter.core.models import AccentTheme, AppearanceTheme, AppSettings
from movie_converter.core.settings import load_settings, save_settings
from movie_converter.ui.theme import ColorPalette


class SettingsPage(QWidget):
    settings_saved = Signal(AppSettings)
    theme_changed = Signal(str, str)  # (theme, accent)

    def __init__(self, parent: QWidget | None = None):
        super().__init__(parent)
        self.settings: AppSettings = load_settings()
        self.palette: ColorPalette | None = None
        self._init_ui()

    def _init_ui(self) -> None:
        outer_layout = QVBoxLayout(self)
        outer_layout.setContentsMargins(32, 20, 32, 24)
        outer_layout.setSpacing(16)

        # Header: Title + Save / Reset buttons
        header_row = QHBoxLayout()
        title_box = QVBoxLayout()
        title_box.setSpacing(2)
        title = QLabel("Settings")
        title.setObjectName("pageTitle")
        subtitle = QLabel("Defaults used for every new project. You can still change them per video.")
        subtitle.setObjectName("pageSubtitle")
        title_box.addWidget(title)
        title_box.addWidget(subtitle)
        header_row.addLayout(title_box)

        header_row.addStretch()

        self.btn_reset = QPushButton("Reset")
        self.btn_reset.clicked.connect(self._reset_defaults)
        header_row.addWidget(self.btn_reset)

        self.btn_save = QPushButton("Save")
        self.btn_save.setProperty("class", "primaryButton")
        self.btn_save.setFixedHeight(40)
        self.btn_save.clicked.connect(self._save_settings)
        header_row.addWidget(self.btn_save)

        outer_layout.addLayout(header_row)

        # Scroll Area for two columns
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        container = QWidget()
        cols_layout = QHBoxLayout(container)
        cols_layout.setSpacing(20)

        # Left Column (Appearance, Languages, Audio)
        left_col = QVBoxLayout()
        left_col.setSpacing(16)

        # 1. Appearance Card
        app_card = QFrame()
        app_card.setProperty("class", "card")
        app_layout = QVBoxLayout(app_card)
        app_layout.setContentsMargins(18, 16, 18, 16)
        app_layout.setSpacing(12)

        lbl_app = QLabel("Appearance")
        lbl_app.setStyleSheet("font-weight: 700; font-size: 15px;")
        app_layout.addWidget(lbl_app)

        app_form = QFormLayout()
        app_form.setSpacing(10)

        # Theme selector
        self.combo_theme = QComboBox()
        self.combo_theme.addItem("Dark", "dark")
        self.combo_theme.addItem("Light", "light")
        self.combo_theme.addItem("System", "system")
        idx_t = self.combo_theme.findData(self.settings.theme)
        if idx_t >= 0:
            self.combo_theme.setCurrentIndex(idx_t)
        self.combo_theme.currentIndexChanged.connect(self._on_appearance_changed)
        app_form.addRow("Theme", self.combo_theme)

        # Accent selector (Teal, Amber, Sage, Blue)
        self.combo_accent = QComboBox()
        self.combo_accent.addItem("Nordic Teal (Calm & Modern)", "teal")
        self.combo_accent.addItem("Cinematic Amber (Studio Gold)", "amber")
        self.combo_accent.addItem("Sage Juniper (Restful Green)", "sage")
        self.combo_accent.addItem("Classic Blue (Original)", "blue")
        idx_a = self.combo_accent.findData(self.settings.accent)
        if idx_a >= 0:
            self.combo_accent.setCurrentIndex(idx_a)
        self.combo_accent.currentIndexChanged.connect(self._on_appearance_changed)
        app_form.addRow("Accent Color", self.combo_accent)

        app_layout.addLayout(app_form)
        left_col.addWidget(app_card)

        # 2. Preferred Languages Card
        lang_card = QFrame()
        lang_card.setProperty("class", "card")
        lang_layout = QVBoxLayout(lang_card)
        lang_layout.setContentsMargins(18, 16, 18, 16)
        lang_layout.setSpacing(12)

        lbl_lang = QLabel("Preferred languages")
        lbl_lang.setStyleSheet("font-weight: 700; font-size: 15px;")
        lang_layout.addWidget(lbl_lang)

        lang_form = QFormLayout()
        lang_form.setSpacing(10)

        self.combo_def_audio = QComboBox()
        self.combo_def_audio.addItem("Keep as in file", "keep")
        self.combo_def_audio.addItem("English (eng)", "eng")
        self.combo_def_audio.addItem("Arabic (ara)", "ara")
        lang_form.addRow("Default audio language", self.combo_def_audio)

        self.combo_def_sub = QComboBox()
        self.combo_def_sub.addItem("Arabic (ara)", "ara")
        self.combo_def_sub.addItem("English (eng)", "eng")
        self.combo_def_sub.addItem("Keep as in file", "keep")
        lang_form.addRow("Default subtitle language", self.combo_def_sub)

        lang_layout.addLayout(lang_form)
        left_col.addWidget(lang_card)

        # 3. External Tools Paths Card
        tools_card = QFrame()
        tools_card.setProperty("class", "card")
        tools_layout = QVBoxLayout(tools_card)
        tools_layout.setContentsMargins(18, 16, 18, 16)
        tools_layout.setSpacing(12)

        lbl_tools = QLabel("External Tools")
        lbl_tools.setStyleSheet("font-weight: 700; font-size: 15px;")
        tools_layout.addWidget(lbl_tools)

        tools_form = QFormLayout()
        tools_form.setSpacing(8)

        # ffmpeg
        row_ff = QHBoxLayout()
        self.txt_ffmpeg = QLineEdit(self.settings.ffmpeg_path)
        btn_ff = QPushButton("...")
        btn_ff.setFixedWidth(32)
        btn_ff.clicked.connect(lambda: self._browse_tool(self.txt_ffmpeg, "ffmpeg.exe"))
        row_ff.addWidget(self.txt_ffmpeg)
        row_ff.addWidget(btn_ff)
        tools_form.addRow("FFmpeg", row_ff)

        # ffprobe
        row_pr = QHBoxLayout()
        self.txt_ffprobe = QLineEdit(self.settings.ffprobe_path)
        btn_pr = QPushButton("...")
        btn_pr.setFixedWidth(32)
        btn_pr.clicked.connect(lambda: self._browse_tool(self.txt_ffprobe, "ffprobe.exe"))
        row_pr.addWidget(self.txt_ffprobe)
        row_pr.addWidget(btn_pr)
        tools_form.addRow("FFprobe", row_pr)

        # mkvmerge
        row_mkv = QHBoxLayout()
        self.txt_mkvmerge = QLineEdit(self.settings.mkvmerge_path)
        btn_mkv = QPushButton("...")
        btn_mkv.setFixedWidth(32)
        btn_mkv.clicked.connect(lambda: self._browse_tool(self.txt_mkvmerge, "mkvmerge.exe"))
        row_mkv.addWidget(self.txt_mkvmerge)
        row_mkv.addWidget(btn_mkv)
        tools_form.addRow("MKVMerge", row_mkv)

        tools_layout.addLayout(tools_form)
        left_col.addWidget(tools_card)

        left_col.addStretch()
        cols_layout.addLayout(left_col, stretch=1)

        # Right Column: Video & Audio Output
        right_col = QVBoxLayout()
        right_col.setSpacing(16)

        # Video Output Card
        vid_card = QFrame()
        vid_card.setProperty("class", "card")
        vid_layout = QVBoxLayout(vid_card)
        vid_layout.setContentsMargins(18, 16, 18, 16)
        vid_layout.setSpacing(12)

        lbl_vid = QLabel("Video output (default preset)")
        lbl_vid.setStyleSheet("font-weight: 700; font-size: 15px;")
        vid_layout.addWidget(lbl_vid)

        vid_form = QFormLayout()
        vid_form.setSpacing(10)

        # Hardware
        self.combo_hw = QComboBox()
        self.combo_hw.addItem("NVIDIA (NVENC - Fast)", "nvidia")
        self.combo_hw.addItem("CPU (Software - Precise)", "cpu")
        self.combo_hw.addItem("AMD (AMF)", "amd")
        self.combo_hw.addItem("Intel (QSV)", "intel")
        vid_form.addRow("Hardware", self.combo_hw)

        # Codec
        self.combo_vcodec = QComboBox()
        self.combo_vcodec.addItem("H.265 (HEVC)", "hevc")
        self.combo_vcodec.addItem("H.264 (AVC)", "h264")
        self.combo_vcodec.addItem("AV1", "av1")
        vid_form.addRow("Codec", self.combo_vcodec)

        # Resolution
        self.combo_res = QComboBox()
        self.combo_res.addItem("Keep original", "keep")
        self.combo_res.addItem("1080p (FHD)", "1080p")
        self.combo_res.addItem("720p (HD)", "720p")
        self.combo_res.addItem("2160p (4K)", "2160p")
        vid_form.addRow("Resolution", self.combo_res)

        # Quality (CRF / CQ)
        self.spin_quality = QSpinBox()
        self.spin_quality.setRange(14, 35)
        self.spin_quality.setValue(22)
        vid_form.addRow("Quality value (CRF/CQ)", self.spin_quality)

        # Bit Depth
        self.combo_depth = QComboBox()
        self.combo_depth.addItem("10-bit (Recommended)", 10)
        self.combo_depth.addItem("8-bit", 8)
        vid_form.addRow("Bit depth", self.combo_depth)

        # HDR
        self.combo_hdr = QComboBox()
        self.combo_hdr.addItem("Keep HDR10 (Preserve colors)", "keep")
        self.combo_hdr.addItem("Tone-map to SDR", "tonemap_sdr")
        vid_form.addRow("HDR", self.combo_hdr)

        vid_layout.addLayout(vid_form)
        right_col.addWidget(vid_card)

        # Audio Output Card
        aud_card = QFrame()
        aud_card.setProperty("class", "card")
        aud_layout = QVBoxLayout(aud_card)
        aud_layout.setContentsMargins(18, 16, 18, 16)
        aud_layout.setSpacing(12)

        lbl_aud = QLabel("Audio output")
        lbl_aud.setStyleSheet("font-weight: 700; font-size: 15px;")
        aud_layout.addWidget(lbl_aud)

        aud_form = QFormLayout()
        aud_form.setSpacing(10)

        self.combo_acodec = QComboBox()
        self.combo_acodec.addItem("Copy (keep original audio)", "copy")
        self.combo_acodec.addItem("AAC", "aac")
        self.combo_acodec.addItem("AC3", "ac3")
        self.combo_acodec.addItem("E-AC3", "eac3")
        self.combo_acodec.addItem("Opus", "opus")
        aud_form.addRow("Codec", self.combo_acodec)

        self.combo_channels = QComboBox()
        self.combo_channels.addItem("Keep original", "keep")
        self.combo_channels.addItem("Stereo 2.0", "stereo")
        self.combo_channels.addItem("5.1 Surround", "5.1")
        aud_form.addRow("Channels", self.combo_channels)

        self.combo_bitrate = QComboBox()
        self.combo_bitrate.addItem("192 kbps", "192k")
        self.combo_bitrate.addItem("256 kbps", "256k")
        self.combo_bitrate.addItem("320 kbps", "320k")
        self.combo_bitrate.addItem("640 kbps", "640k")
        aud_form.addRow("Bitrate", self.combo_bitrate)

        self.chk_norm = QCheckBox("Normalize volume (EBU R128 loudnorm)")
        aud_form.addRow("Volume", self.chk_norm)

        aud_layout.addLayout(aud_form)
        right_col.addWidget(aud_card)

        right_col.addStretch()
        cols_layout.addLayout(right_col, stretch=1)

        scroll.setWidget(container)
        outer_layout.addWidget(scroll, stretch=1)

    def _on_appearance_changed(self) -> None:
        theme = self.combo_theme.currentData()
        accent = self.combo_accent.currentData()
        self.theme_changed.emit(theme, accent)

    def _browse_tool(self, line_edit: QLineEdit, filter_name: str) -> None:
        path, _ = QFileDialog.getOpenFileName(self, f"Locate {filter_name}", line_edit.text(), f"{filter_name} ({filter_name});;All Files (*.*)")
        if path:
            line_edit.setText(path)

    def _save_settings(self) -> None:
        self.settings.theme = self.combo_theme.currentData()
        self.settings.accent = self.combo_accent.currentData()
        self.settings.ffmpeg_path = self.txt_ffmpeg.text().strip()
        self.settings.ffprobe_path = self.txt_ffprobe.text().strip()
        self.settings.mkvmerge_path = self.txt_mkvmerge.text().strip()

        save_settings(self.settings)
        self.settings_saved.emit(self.settings)

    def _reset_defaults(self) -> None:
        self.combo_theme.setCurrentIndex(self.combo_theme.findData("dark"))
        self.combo_accent.setCurrentIndex(self.combo_accent.findData("teal"))
        self._on_appearance_changed()
