@echo off
title Movie Converter v1.29 (Native Desktop App)
cd /d "%~dp0src-tauri"
start "" "%~dp0src-tauri\target\debug\app.exe"
