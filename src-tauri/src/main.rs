// Prevents additional console window on Windows in ALL builds
#![windows_subsystem = "windows"]

fn main() {
    std::panic::set_hook(Box::new(|info| {
        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };
        let loc = info.location().map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column())).unwrap_or_default();
        let msg = format!("PANIC: {}\nLocation: {}\n", payload, loc);
        let _ = std::fs::write("d:\\Projects\\MKV Convert\\panic_log.txt", msg);
    }));

    // Prevent multiple instances from conflicting over WebView2 user data directory
    #[cfg(windows)]
    unsafe {
        type CreateMutexAFn = extern "system" fn(*const std::ffi::c_void, i32, *const u8) -> *mut std::ffi::c_void;
        let kernel32 = windows_sys::Win32::System::LibraryLoader::GetModuleHandleA(b"kernel32.dll\0".as_ptr());
        if !kernel32.is_null() {
            let func = windows_sys::Win32::System::LibraryLoader::GetProcAddress(kernel32, b"CreateMutexA\0".as_ptr());
            if let Some(create_mutex) = func {
                let create_mutex_fn: CreateMutexAFn = std::mem::transmute(create_mutex);
                let handle = create_mutex_fn(std::ptr::null(), 1, b"Local\\MovieConverter_SingleInstance_App_v18\0".as_ptr());
                if !handle.is_null() && windows_sys::Win32::Foundation::GetLastError() == windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS {
                    return;
                }
            }
        }
    }

    app_lib::run();
}
