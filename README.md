# 📱 ADB Developer Studio

> **High-Speed Android Connection, Debugging & Developer Workflow Desktop App**

ADB Developer Studio is a modern, high-performance desktop application built with **Python**, **`pywebview`**, and a hardware-accelerated **Glassmorphism Dark UI**. It is designed specifically for Android developers (Android Studio, Flutter, React Native, Kotlin/Java) to eliminate repetitive CLI commands and streamline testing on physical devices.

---

## 🌟 Key Features

### 🔌 1. Instant ADB Connection & Recent Devices
- **USB & Wireless Debugging**: Instant auto-detection of connected devices.
- **Recent Devices & Reconnect**: Saved history of previously connected IP & ports with 1-click reconnect.
- **Inline Port Editor**: Dynamically edit target ports directly on recent device cards if Android assigns a new Wi-Fi debugging port.
- **Android 11+ Wireless Pairing**: Built-in pairing dialog for `adb pair ip:port code`.

### 📁 2. Dev Projects & APK Build Watcher
- **Project Folder Tracker**: Bookmark Android Studio, Flutter, or React Native project root directories.
- **Auto-Detect Built APKs**: Automatically scans Gradle and Flutter build output folders (`build/outputs/apk/...`, `build/app/outputs/flutter-apk/...`) for compiled `.apk` files.
- **1-Click Install**: Single-click button to push and launch newly compiled builds on the target device.
- **Drag & Drop APK Target**: Drag any `.apk` file into the app interface to install immediately.

### 📸 3. Screenshots & Direct Clipboard Copy
- **Ultra-Fast Screenshot Capture**: Full-resolution PNG capture via direct stdout stream decoding.
- **Copy Image to Clipboard**: Direct 1-click button to copy screenshots straight to the Windows system clipboard (for pasting into Slack, Figma, Discord, GitHub, or docs).
- **Folder Manager**: Saves timestamped PNGs to your custom picture folder.
- **Screen Recorder**: Record screen videos up to 60s and pull `.mp4` files directly to your PC.

### 📄 4. Live Logcat Stream & Filtering
- **Real-Time Stream**: Monospace terminal logcat stream.
- **Filtering & Search**: Filter logs by Verbose (V), Debug (D), Info (I), Warning (W), Error (E), and Fatal (F) levels or search query.

### ⚡ 5. Developer App Actions & Deep Link Tester
- **Package Shortcuts**:
  - 🧹 **Clear App Data** (`adb shell pm clear <pkg>`)
  - 🛑 **Force Stop App** (`adb shell am force-stop <pkg>`)
  - 🔑 **Grant All Permissions** (`adb shell pm grant <pkg> ...`)
  - 🗑️ **Uninstall App** (`adb uninstall <pkg>`)
- **Deep Link / Intent Launcher**: Enter custom URIs (`myapp://profile?id=1024`) to trigger deep links instantly without manual terminal commands.

### 🛠️ 6. UI Testing Toggles & Diagnostics
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
