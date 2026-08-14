# 📱 ADB Developer Studio

> **High-Speed Android Connection, Debugging & Developer Workflow Desktop App**

ADB Developer Studio is a modern, high-performance desktop application built with **Python**, **`pywebview`**, and a hardware-accelerated **Glassmorphism Dark UI** designed strictly following an internal UI Plan specification and reference dashboard mockups (kept locally, not part of this repo).

---

## 🎨 Professional UI Architecture (3-Zone Desktop Layout)

- **Left Sidebar (220px)**: Grouped navigation for `WORKSPACE` (`Dashboard`, `Devices`, `Projects`), `TOOLS` (`Remote & Mirror`, `Capture`, `File Explorer`, `Logcat`, `Actions`, `Testing`, `Terminal`), `SYSTEM` (`Settings`), with a bottom **ADB Server Status** monitor.
- **Top Header Bar**: Active Page Title & Subtitle, **Global Target Device Selector Dropdown**, `Pair New Device` button, `Connect Device` button, and `Command Palette` trigger (`Ctrl + K`).
- **Interactive Connection & Pairing Modals**:
  - **⚡ Wireless Connect Modal (`#modal-wireless-connect`)**: Clean popup dialog with pre-filled local IP address and Port (`5555`) input fields to connect to any device over Wi-Fi.
  - **🔑 Wireless Pairing Modal (`#modal-wireless-pair`)**: Tabbed popup dialog supporting **📷 Scan QR Code** (auto-generated Android ADB pairing QR) and **🔢 Manual 6-Digit Pairing Code**.
- **Fixed Tab View Nesting**: Resolved an unclosed `<section id="tab-dashboard">` tag in `index.html` that was causing all other tab pages (`Devices`, `Projects`, `Remote & Mirror`, `Capture`, `File Explorer`, `Logcat`, `Actions`, `Testing`, `Terminal`, `Settings`) to be hidden when switching tabs. All pages now display fully populated workspace cards.
- **Pure Vector SVG Icon System**: Replaced all emojis across the Capture page, subtabs, thumbnail cards, and control buttons with crisp, hardware-accelerated inline vector SVG icons matching `ADB Developer Studio Capture Dashboard.png`.
- **Capture Page 3-Column Workspace (Matches `ADB Developer Studio Capture Dashboard.png`)**:
  - **Left Card**: Live Device Info box (`Model`, `Android`, `Resolution`, `Density`, `Battery`, `Status`) + High-res vertical Phone Screen Display Frame + Zoom Bar (`— 59% +`, `[ ]`, `⟳`).
  - **Middle Card**: `RECENT CAPTURES` 6-grid gallery featuring live phone frame thumbnails, timestamps, file sizes, and 1-click `Copy`, `Open Folder` vector SVG buttons.
  - **Right Sidebar**: `QUICK CAPTURE` (Big Blue `Take Screenshot` & `Copy to Clipboard`), `OPTIONS` (Save Location picker, Auto-copy toggle, Auto-open folder toggle, Image Format, Image Quality), and `SCREEN RECORDER` (Hero Purple `Record Screen`, Max Duration, Resolution, Save Location).
- **Devices Page (Matches `ADB Developer Studio Devices Dashboard.png`)**:
  - **Always Visible**: Renders the complete hero card, recent devices list, and 3 connection method cards even when 0 devices are attached.
  - **Connected Device Hero Card**: Connected device hero banner with Phone Mockup, 5 Stat Cards (`Battery`, `Storage`, `Resolution`, `Model`, `OS Build`), and Action Bar (`>_ Open Shell`, `Logcat`, `Screenshot`, `Record Screen`, `Actions`).
  - **Recent Devices Section**: Sort by dropdown, refresh, clear all, status indicators (`● Offline`/`● Connected`), editable port input `[5555 ✎]`, and `Reconnect` button.
  - **Bottom 3 Cards**: `USB Devices` (`Scan USB`), `Wireless Devices` (`Connect IP`), `Pair New Device` (`Start Pairing`).
- **Main Workspace Area**:
  - **Connected Device Hero Banner**: Phone mockup graphic frame, battery/storage/resolution metrics, device badges, and primary action shortcuts.
  - **Quick Actions 6-Card Neon Grid**: Glowing 1-click shortcut cards (`Install APK`, `Screenshot`, `Start Logcat`, `App Actions`, `Deep Link`, `Clear Data`).
  - **3-Column Dashboard Section**: Live `RECENT DEVICES` (with inline editable port `[5555 ✎]`), `RECENT PROJECTS`, and `RECENT ACTIVITY` timeline.
- **Global Status Bar (Bottom 30px)**: Live server indicator, connected device count, target device OS, and IP address.
- **Command Palette (`Ctrl + K`)**: Instant command search overlay for fast keyboard-driven developer workflows.
- **Projects Page Redesign**: Moved the separate "Project Actions" panel directly onto each project card (`Build`, `Clean`, `Install`, `Open Folder`, `Remove`), removing an unstyled/broken options button and the need to select a project before acting on it.
- **Logcat Page Redesign**: Replaced the old text-dump console (and its duplicate-line polling bug) with a persistent background-streamed `adb logcat` engine, a structured sortable/filterable table view, level/tag/package filters, regex search, export, saved filter presets, and a pop-out standalone window.

## 🌟 Key Features

### 🔌 1. Instant ADB Connection & Recent Devices
- **USB & Wireless Debugging**: Instant auto-detection of connected devices.
- **📷 QR Code Pairing (Android 11+)**: Displays an active Android ADB pairing QR code on screen. Simply open `Settings ➔ Developer options ➔ Wireless debugging ➔ Pair device with QR code` on your phone and scan the screen!
- **Recent Devices & Reconnect**: Saved history of previously connected IP & ports with 1-click reconnect.
- **Inline Port Editor**: Dynamically edit target ports directly on recent device cards if Android assigns a new Wi-Fi debugging port.
- **Manual Wireless Pairing**: Built-in dialog for manual 6-digit `adb pair ip:port code`.

### 🎮 2. Virtual Remote Control & Screen Mirroring
- **On-Screen Hardware Buttons**: Trigger physical hardware keyevents (**Back**, **Home**, **Recents / App Switcher**, **Power/Lock Screen**, **Volume Up/Down**, **Mute**).
- **Keyboard Text Injector**: Type text or paste long URLs/passwords on your PC keyboard and inject them directly into the active focused input field on the phone.
- **Screen Mirroring (`scrcpy` Launcher)**: 1-click launcher for high-FPS low-latency screen mirroring via `scrcpy` (`--always-on-top --stay-awake`).

### 📁 3. Dev Projects & APK Build Watcher
- **Project Folder Tracker**: Bookmark Android Studio, Flutter, or React Native project root directories.
- **Auto-Detect Built APKs**: Automatically scans Gradle and Flutter build output folders (`build/outputs/apk/...`, `build/app/outputs/flutter-apk/...`) for compiled `.apk` files.
- **Per-Project Inline Actions**: Each project card carries its own **Build**, **Clean**, **Install**, **Open Folder**, and **Remove** buttons — no need to select a project first via a separate global panel.
- **1-Click Install**: Single-click button to push and launch newly compiled builds on the target device.
- **Drag & Drop APK Target**: Drag any `.apk` file into the app interface to install immediately.

### 📂 4. Device File Explorer & Transfer
- **Storage Directory Explorer**: Interactive file browser for `/sdcard/Download`, `/sdcard/DCIM`, and system folders.
- **Push File to Phone**: Push any local file from PC directly to target device directories.
- **Pull File to PC**: Download files and logs from phone to your computer with 1 click.

### 📸 5. Screenshots & Direct Clipboard Copy
- **Ultra-Fast Screenshot Capture**: Full-resolution PNG capture via direct stdout stream decoding.
- **Copy Image to Clipboard**: Direct 1-click button to copy screenshots straight to the Windows system clipboard (for pasting into Slack, Figma, Discord, GitHub, or docs).
- **Folder Manager**: Saves timestamped PNGs to your custom picture folder.
- **Screen Recorder**: Record screen videos up to 60s and pull `.mp4` files directly to your PC.

### 💻 6. ADB CLI Terminal & Developer Snippets
- **Integrated Terminal Console**: Execute custom ADB CLI and shell commands directly in the app.
- **Pre-loaded Snippets Dropdown**: 1-click execution of favorite developer commands (Current Active Focus Window, Installed Package Count, Battery Dump, Running Services).

### 📄 7. Live Logcat Stream & Filtering
- **True Real-Time Streaming**: A persistent `adb logcat -v threadtime` process is tailed in the background and polled incrementally by sequence number — no re-fetching or duplicate lines, unlike a naive polling loop.
- **Structured Table View**: Parsed columns for `TIME`, `LEVEL`, `PID`, `TID`, `TAG`, and `MESSAGE`, color-coded by severity, instead of a flat text dump.
- **Filtering**: Multi-select Verbose/Debug/Info/Warning/Error/Fatal level checkboxes, tag substring filter, and per-package filter (resolved to live PIDs).
- **Search**: Live substring or regular-expression search with match highlighting.
- **Pause / Resume, Clear, and Export**: Freeze the view without losing buffered logs, wipe the device + in-app buffer, or export the currently filtered lines to a file.
- **Saved & Recent Filters**: Name and reload filter presets, or reapply a recent search from the sidebar.
- **Pop Out to a Second Window**: Open a focused, sidebar-free Logcat-only window that shares the same live stream as the main window.

### ⚡ 8. Developer App Actions & Deep Link Tester
- **Package Shortcuts**:
  - 🧹 **Clear App Data** (`adb shell pm clear <pkg>`)
  - 🛑 **Force Stop App** (`adb shell am force-stop <pkg>`)
  - 🔑 **Grant All Permissions** (`adb shell pm grant <pkg> ...`)
  - 🗑️ **Uninstall App** (`adb uninstall <pkg>`)
- **Deep Link / Intent Launcher**: Enter custom URIs (`myapp://profile?id=1024`) to trigger deep links instantly without manual terminal commands.

### 🛠️ 9. UI Testing Toggles & Diagnostics
- **Show Layout Bounds**: Toggle screen layout clip bounds, margins, and padding (`debug.layout`).
- **Pointer Touchpoints**: Toggle touch position overlays.
- **Stay Awake**: Keep screen awake while connected via USB.
- **DPI Changer**: Change display density on the fly (e.g. 320, 420, 480 DPI) to test UI responsiveness across screen sizes.
- **Hardware Diagnostics**: View live battery level, storage free, OS version, resolution, and model info.

---

## 🛠️ Prerequisites

- **Python 3.10+**
- **Android Debug Bridge (`adb`)** installed and available in system `PATH` (included with Android SDK platform-tools).

---

## 🚀 Installation & Running

1. **Clone or Download Repository**:
   ```bash
   git clone https://github.com/your-username/adb-developer-studio.git
   cd adb-developer-studio
   ```

2. **Install Required Python Packages**:
   ```bash
   pip install pywebview Pillow
   ```

3. **Launch the Application**:
   - **On Windows**: Double-click `run_adb_studio.bat` or run:
     ```bash
     python main.py
     ```

---

## 📂 Project Architecture

```
adb-developer-studio/
├── main.py                     # PyWebView window host & Python-to-JS bridge API
├── adb_manager.py              # Core ADB execution engine & binary screenshot decoder
├── dev_projects_manager.py     # Scans dev folders for built APK files
├── storage_manager.py          # Persistent storage for recent devices & project paths
├── run_adb_studio.bat          # 1-click Windows launcher script
├── README.md                   # Project documentation
├── .gitignore                  # Git ignore rules
└── web/                        # HTML5 / CSS3 / JS Frontend
    ├── index.html              # Developer workspace shell
    ├── css/
    │   └── styles.css          # Glassmorphic cyber-dark studio design system
    └── js/
        └── app.js              # Frontend controller & clipboard bridge
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
