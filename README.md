# 🎬 MKVForge

<div align="center">
  <img src="ui/app_logo.png" alt="MKVForge Logo" width="128" height="128" />
  <h3>Professional Matroska (MKV) Processing Suite & In-Place Media Tools</h3>
  <p>
    <b>Fast · Lightweight · Modern Desktop Application</b>
  </p>

  [![Version](https://img.shields.io/badge/version-v1.35-blue.svg)](https://github.com/yasinoss/MKVForge)
  [![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6.svg)](https://github.com/yasinoss/MKVForge)
  [![Rust](https://img.shields.io/badge/built%20with-Rust%20%2B%20Tauri%202-orange.svg)](https://tauri.app)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
</div>

---

## 🌍 Language / اللغة
- [🇬🇧 English](#-english)
- [🇹🇳 العربية](#-باللغة-العربية)

---

## 🇬🇧 English

### Overview
**MKVForge** is a fast, modern desktop application designed for media collectors, archivists, and fansubbers. Built with **Rust** and **Tauri 2**, it provides hardware-accelerated video/audio conversion, stream multiplexing, track header stripping, and instant in-place container editing without duplicating files.

### ✨ Key Features
- ⚡ **Instant In-Place File Tools**:
  - Update MKV container covers in milliseconds directly in-place without generating a new file.
  - Smart batch renaming based on media title, year, resolution, codecs, and tags.
- 🎨 **Cover Art Gallery & Online Metadata**:
  - Automatic online search across **Wikipedia**, **AniList**, **TVmaze**, and **TMDB**.
  - Interactive multi-candidate poster gallery with one-click selection.
  - Custom local cover art importer (JPG, PNG, WebP).
- 🎞️ **Hardware-Accelerated Video Conversion**:
  - HandBrake-style presets (H.264, HEVC, AV1, VP9).
  - NVIDIA NVENC hardware acceleration support with strict CBR/VBR rate control.
- 🔥 **Pixel-Perfect Hardsub Burning**:
  - Burn ASS/SSA subtitles with 100% typography, embedded fonts, and styling fidelity.
  - High-contrast MPC-HC calibrated text styling for SRT/plain text subtitles.
- 🎵 **Multi-Track Audio Transcoding**:
  - Convert audio streams to AAC, AC3, E-AC3, Opus, FLAC, or MP3 with custom bitrates and 5.1/Stereo channel mapping.
- ✂️ **Automatic Track Name Stripping**:
  - Automatically remove unwanted release group titles from video and audio tracks for clean media library organization.
- 🌐 **Multilingual Interface**:
  - Fully localized in Arabic, English, French, Spanish, and Turkish.

### 📥 Download & Installation
1. Download **`MKVForge_Setup_v1.35.exe`** from the [Releases](https://github.com/yasinoss/MKVForge/releases) section.
2. Run the installer and choose whether to create a desktop shortcut.
3. Launch **MKVForge** and start organizing your library!
> Or run the portable standalone version from the `MKVForge_Standalone` folder with zero installation.

### 🛠️ Building from Source
Prerequisites:
- [Rust](https://rustup.rs/) (stable toolchain)
- Windows 10/11 with WebView2 runtime (preinstalled on modern Windows)

```bash
# Clone the repository
git clone https://github.com/yasinoss/MKVForge.git
cd MKVForge

# Build release executable
cargo build --release --manifest-path src-tauri/Cargo.toml
```

---

## 🇹🇳 باللغة العربية

### نبذة عن البرنامج
**MKVForge** هو برنامج مكتبي حديث واحترافي تم بناؤه بلغة **Rust** مع تقنية **Tauri 2**، مخصص لإدارة وتجهيز مكتبات الأفلام والمسلسلات ومعالجة حاويات Matroska (MKV) بأعلى سرعة وأقل استهلاك للموارد.

### 🌟 أبرز المميزات
1. ⚡ **أدوات التعديل الفوري في مكان الملف (Instant Tools)**:
   - حقن وتحديث بوسترات أفلام MKV فورياً في أجزاء من الثانية دون إعادة إنتاج أو تكرار الملف.
   - إعادة التسمية الذكية الجماعية المعتمدة على استخراج بيانات الوسائط (العنوان، السنة، الدقة، الكوديك، الوسم).
2. 🎨 **جلب البوسترات والمعلومات أونلاين**:
   - بحث تلقائي ويدوي عبر ويكيبيديا، AniList للأنمي، TVmaze للمسلسلات، و TMDB.
   - معرض بصري يضم عدة ملصقات مقترحة للاختيار بنقرة واحدة، مع إمكانية استيراد أي صورة من جهازك.
3. 🎞️ **تحويل الفيديو بدعم التسريع المكتبي (Hardware Acceleration)**:
   - باقة جاهزة من البروفايلات (H.264, HEVC, AV1, VP9).
   - دعم بطاقات NVIDIA NVENC للتحويل فائق السرعة.
4. 🔥 **حرق الترجمات باحترافية كاملة (Hardsub)**:
   - حرق ترجمات ASS/SSA مع الاحتفاظ الكامل بجماليات الخطوط المرفقة والتنسيقات.
   - معايرة مظهر ترجمات SRT النصية لتطابق مشغل Media Player Classic بدقة عالية.
5. ✂️ **تجريد وحذف تسميات المسارات تلقائياً**:
   - إزالة أسماء وروابط فرق الإصدار المزعجة من مسارات الفيديو والصوت للحصول على ملفات نظيفة ومرتبة.
6. 🌍 **واجهة عربية كاملة**:
   - دعم متكامل للغة العربية مع واجهة عصرية تدعم الوضعين الداكن والفاتح وألوان مخصصة.

---

## 👨‍💻 المطور وحقوق الملكية / Developer & Credits
- **برمجة وتطوير / Developed by**: **Yasinoss**
- **جميع الحقوق محفوظة للمطور / All Rights Reserved © 2026 yasinoss**

### 📬 تواصل مع المطور / Contact Channels
- 💬 **WhatsApp**: [+216 55 331 334](https://wa.me/21655331334)
- 🌐 **Facebook**: [fb.me/MrYasinoss](http://fb.me/MrYasinoss)
- 🐙 **GitHub**: [@yasinoss](https://github.com/yasinoss)

---

## 📄 الترخيص / License
هذا المشروع مرخص تحت رخصة [MIT License](LICENSE).
