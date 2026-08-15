import subprocess
import base64
import os
import re
import socket
import threading
import time
from collections import deque
from pathlib import Path

LOGCAT_LINE_RE = re.compile(
    r'^(?P<time>\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+'
    r'(?P<pid>\d+)\s+(?P<tid>\d+)\s+(?P<level>[VDIWEF])\s+'
    r'(?P<tag>.*?):\s?(?P<message>.*)$'
)

class ADBManager:
    """Core ADB wrapper executing CLI commands with error handling and data parsing."""

    def __init__(self, adb_path="adb"):
        self.adb_path = adb_path
        self.base_dir = str(Path(__file__).parent.resolve())
        self._logcat_streams = {}
        self._logcat_streams_lock = threading.Lock()

    @staticmethod
    def get_local_ip():
        """Gets local PC IP address on the Wi-Fi/LAN network."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "192.168.1.100"

    def restart_server(self):
        self._run_cmd(["kill-server"])
        time.sleep(0.5)
        success, stdout, stderr = self._run_cmd(["start-server"])
        return success, (stdout or stderr)




    def _run_cmd(self, args, timeout=15):
        cmd = [self.adb_path] + args
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=timeout,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            )
            return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
        except subprocess.TimeoutExpired:
            return False, "", "Command timed out"
        except Exception as e:
            return False, "", str(e)

    def _run_bytes_cmd(self, args, timeout=20):
        cmd = [self.adb_path] + args
        try:
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            )
            return res.returncode == 0, res.stdout, res.stderr.decode("utf-8", errors="replace")
        except Exception as e:
            return False, b"", str(e)

    def get_devices(self):
        """Returns list of connected, ready ADB devices.
        Only returns devices with status 'device' (skips offline/unauthorized/mDNS transport entries)."""
        success, stdout, stderr = self._run_cmd(["devices", "-l"])
        if not success:
            return []

        devices = []
        seen_ips = set()  # deduplicate: prefer IP:port over mDNS transport
        lines = stdout.splitlines()
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            serial = parts[0]
            status = parts[1]

            # Only include fully authorized, ready devices
            if status != "device":
                continue

            # Detect connection type
            is_wireless = False
            if ":" in serial and serial[0].isdigit():        # IP:port  e.g. 192.168.1.5:41101
                is_wireless = True
                ip = serial.split(":")[0]
                seen_ips.add(ip)
            elif serial.startswith("adb-"):                   # mDNS transport handle
                is_wireless = True

            info = {
                "serial": serial,
                "status": status,
                "model": serial,
                "connection": "wireless" if is_wireless else "usb",
            }

            for item in parts[2:]:
                if ":" in item:
                    k, v = item.split(":", 1)
                    if k == "model":
                        info["model"] = v.replace("_", " ")
                    elif k == "product":
                        info["product"] = v
                    elif k == "device":
                        info["device_name"] = v

            devices.append(info)

        # Deduplicate: if we have both IP:port AND mDNS handle for the same device, keep IP:port
        seen_mdns_ips = set()
        final = []
        for d in devices:
            if d["serial"].startswith("adb-"):
                # only keep mDNS entry if no IP:port entry for same device
                # (we can't easily match without resolving, so just skip mDNS if any IP entry exists)
                if not seen_ips:
                    final.append(d)
            else:
                final.append(d)
        return final

    def connect_wireless(self, ip, port):
        """Connects to a wireless ADB device (ip:port)."""
        target = f"{ip}:{port}"
        success, stdout, stderr = self._run_cmd(["connect", target], timeout=10)
        output = (stdout + " " + stderr).strip()
        
        if "connected to" in output.lower():
            return True, f"Successfully connected to {target}"
        elif "already connected" in output.lower():
            return True, f"Already connected to {target}"
        else:
            return False, output or f"Failed to connect to {target}. Check IP & Port."

    def pair_wireless(self, ip, port, code):
        """Pairs with an Android 11+ wireless debugging device (ip:port pairing_code)."""
        target = f"{ip}:{port}"
        success, stdout, stderr = self._run_cmd(["pair", target, code], timeout=15)
        output = (stdout + " " + stderr).strip()
        if "successfully paired" in output.lower():
            return True, f"Successfully paired with {target}!"
        return False, output or "Pairing failed. Verify code and pairing port."

    def disconnect_device(self, target):
        success, stdout, stderr = self._run_cmd(["disconnect", target])
        return success, stdout or stderr

    def _ensure_device_online(self, target, retries=2):
        """Check if target device is 'device' (ready). If offline, attempt reconnect.
        Returns True if device is online after checks, False otherwise."""
        for attempt in range(retries + 1):
            ok, stdout, _ = self._run_cmd(["devices"], timeout=8)
            if ok:
                for line in stdout.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 2 and parts[0] == target:
                        status = parts[1]
                        if status == "device":
                            return True  # online & ready
                        elif status in ("offline", "unauthorized"):
                            # Try reconnect for wireless targets
                            if ":" in target and attempt < retries:
                                self._run_cmd(["disconnect", target], timeout=5)
                                time.sleep(0.5)
                                self._run_cmd(["connect", target], timeout=8)
                                time.sleep(1.0)
                                continue
                            return False
            # device not in list at all — try reconnect if wireless
            if ":" in target and attempt < retries:
                self._run_cmd(["connect", target], timeout=8)
                time.sleep(1.0)
        return False

    def _screencap_bytes(self, target, timeout=15):
        """Captures screen bytes via a reliable pull-based method.
        Works on USB and wireless ADB. Auto-reconnects offline wireless devices."""
        import tempfile, uuid

        # Auto-heal offline / stale wireless connection before attempting capture
        if not self._ensure_device_online(target):
            return False, b"", f"Device '{target}' is offline or not authorized. Try reconnecting."

        target_args = ["-s", target] if target else []
        remote_tmp = f"/sdcard/.adbstudio_cap_{uuid.uuid4().hex[:8]}.png"

        # Step 1: capture to device temp file
        ok, _, err = self._run_cmd(target_args + ["shell", "screencap", "-p", remote_tmp], timeout=timeout)
        if not ok:
            combined = err.lower()
            # If still offline after reconnect attempt, surface a clear message
            if "offline" in combined or "unauthorized" in combined:
                return False, b"", "Device went offline. Please reconnect your phone in ADB settings."
            self._run_cmd(target_args + ["shell", "rm", "-f", remote_tmp], timeout=5)
            return False, b"", f"screencap failed: {err}"

        # Step 2: pull to local temp file
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                local_tmp = tmp.name
            ok2, _, err2 = self._run_cmd(target_args + ["pull", remote_tmp, local_tmp], timeout=timeout)
            self._run_cmd(target_args + ["shell", "rm", "-f", remote_tmp], timeout=5)
            if not ok2:
                return False, b"", f"adb pull failed: {err2}"
            with open(local_tmp, "rb") as f:
                image_bytes = f.read()
            try:
                os.remove(local_tmp)
            except Exception:
                pass
            if not image_bytes or not image_bytes.startswith(b"\x89PNG"):
                return False, b"", "Invalid PNG data from device"
            return True, image_bytes, ""
        except Exception as e:
            return False, b"", str(e)


    def take_screenshot(self, target, save_dir):
        """Takes screenshot, saves PNG, and returns base64 & file path.
        Works over USB and wireless ADB."""
        success, image_bytes, err = self._screencap_bytes(target, timeout=20)
        if not success:
            return False, f"Screenshot failed: {err}", ""

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        filename = f"screenshot_{timestamp}.png"
        out_path = Path(save_dir) / filename
        out_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            with open(out_path, "wb") as f:
                f.write(image_bytes)
        except Exception as e:
            return False, f"Failed to save screenshot file: {e}", ""

        b64_str = "data:image/png;base64," + base64.b64encode(image_bytes).decode("utf-8")
        return True, b64_str, str(out_path.resolve())

    def take_screenshot_silent(self, target):
        """Takes screenshot to memory only (no file saved) for live mirror stream.
        Hot path: skips device-status pre-check for performance. Auto-reconnects inline on offline error."""
        import tempfile, uuid

        target_args = ["-s", target] if target else []
        remote_tmp = f"/sdcard/.adbstudio_cap_{uuid.uuid4().hex[:8]}.png"

        # Step 1: screencap to device storage
        ok, _, err = self._run_cmd(target_args + ["shell", "screencap", "-p", remote_tmp], timeout=12)
        if not ok:
            err_lower = err.lower()
            if "offline" in err_lower or "unauthorized" in err_lower:
                # One auto-reconnect attempt for wireless targets
                if ":" in target:
                    self._run_cmd(["disconnect", target], timeout=4)
                    time.sleep(0.4)
                    rok, rout, _ = self._run_cmd(["connect", target], timeout=8)
                    if rok and ("connected" in rout.lower() or "already" in rout.lower()):
                        time.sleep(0.8)
                        # Retry screencap after reconnect
                        ok, _, err = self._run_cmd(target_args + ["shell", "screencap", "-p", remote_tmp], timeout=12)
                        if not ok:
                            return False, f"Reconnected but screencap still failed: {err}"
                    else:
                        return False, "Device offline — auto-reconnect failed. Re-pair in ADB settings."
                else:
                    return False, "USB device offline. Unplug and reconnect the cable."
            else:
                return False, f"screencap failed: {err}"

        # Step 2: pull PNG to local temp
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                local_tmp = tmp.name
            ok2, _, err2 = self._run_cmd(target_args + ["pull", remote_tmp, local_tmp], timeout=12)
            self._run_cmd(target_args + ["shell", "rm", "-f", remote_tmp], timeout=4)
            if not ok2:
                return False, f"adb pull failed: {err2}"
            with open(local_tmp, "rb") as f:
                image_bytes = f.read()
            try:
                os.remove(local_tmp)
            except Exception:
                pass
            if not image_bytes or not image_bytes.startswith(b"\x89PNG"):
                return False, "Invalid PNG received from device"
            b64_str = "data:image/png;base64," + base64.b64encode(image_bytes).decode("utf-8")
            return True, b64_str
        except Exception as e:
            return False, str(e)

    def get_recent_captures(self, save_dir, limit=6):
        """Returns recent screenshot thumbnails, sizes, and timestamps from save_dir."""
        s_dir = Path(save_dir)
        if not s_dir.exists():
            return []

        captures = []
        for ext in ["*.png", "*.jpg", "*.jpeg", "*.webp"]:
            for img_file in s_dir.glob(ext):
                try:
                    stat = img_file.stat()
                    mod_time = time.localtime(stat.st_mtime)
                    time_str = time.strftime("%H:%M:%S", mod_time)
                    size_mb = f"{stat.st_size / (1024*1024):.1f} MB" if stat.st_size >= 1024*1024 else f"{round(stat.st_size / 1024)} KB"
                    
                    with open(img_file, "rb") as f:
                        b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

                    captures.append({
                        "name": img_file.name,
                        "path": str(img_file.resolve()),
                        "time_str": time_str,
                        "size_str": size_mb,
                        "mtime": stat.st_mtime,
                        "b64": b64
                    })
                except Exception:
                    pass

        captures.sort(key=lambda x: x["mtime"], reverse=True)
        return captures[:limit]


    def record_screen(self, target, duration_sec, save_dir):
        """Records device screen for given duration (in seconds) and pulls MP4 to PC."""
        target_args = ["-s", target] if target else []
        remote_file = "/sdcard/adb_studio_rec.mp4"

        # Start screenrecord
        rec_cmd = target_args + ["shell", "screenrecord", "--time-limit", str(duration_sec), remote_file]
        success, stdout, stderr = self._run_cmd(rec_cmd, timeout=duration_sec + 5)

        # Pull recorded MP4
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        local_file = Path(save_dir) / f"recording_{timestamp}.mp4"
        pull_cmd = target_args + ["pull", remote_file, str(local_file)]
        p_success, p_stdout, p_stderr = self._run_cmd(pull_cmd, timeout=30)

        # Cleanup remote file
        self._run_cmd(target_args + ["shell", "rm", "-f", remote_file])

        if local_file.exists() and local_file.stat().st_size > 0:
            return True, str(local_file.resolve())
        return False, f"Screen recording failed: {p_stderr or stderr}"

    def install_apk(self, target, apk_path):
        """Installs APK on target device."""
        if not os.path.exists(apk_path):
            return False, f"APK file not found: {apk_path}"

        target_args = ["-s", target] if target else []
        cmd = target_args + ["install", "-r", "-d", apk_path]
        success, stdout, stderr = self._run_cmd(cmd, timeout=120)
        output = (stdout + " " + stderr).strip()

        if "Success" in stdout or "Success" in stderr or success:
            return True, f"Successfully installed {Path(apk_path).name}"
        return False, f"Installation failed: {output}"

    def get_device_info(self, target):
        """Retrieves hardware/software status (Battery, Storage, Android OS, Resolution)."""
        target_args = ["-s", target] if target else []
        info = {
            "model": "Unknown",
            "manufacturer": "Unknown",
            "android_version": "Unknown",
            "api_level": "Unknown",
            "battery_level": "--",
            "battery_status": "--",
            "resolution": "Unknown",
            "storage_free": "--"
        }

        # Props
        _, model, _ = self._run_cmd(target_args + ["shell", "getprop", "ro.product.model"])
        _, manufacturer, _ = self._run_cmd(target_args + ["shell", "getprop", "ro.product.manufacturer"])
        _, version, _ = self._run_cmd(target_args + ["shell", "getprop", "ro.build.version.release"])
        _, sdk, _ = self._run_cmd(target_args + ["shell", "getprop", "ro.build.version.sdk"])

        if model: info["model"] = model
        if manufacturer: info["manufacturer"] = manufacturer
        if version: info["android_version"] = version
        if sdk: info["api_level"] = sdk

        # Resolution
        _, wm_size, _ = self._run_cmd(target_args + ["shell", "wm", "size"])
        if "Physical size:" in wm_size:
            info["resolution"] = wm_size.split("Physical size:")[1].strip()

        # Battery
        _, dumpsys_batt, _ = self._run_cmd(target_args + ["shell", "dumpsys", "battery"])
        for line in dumpsys_batt.splitlines():
            line = line.strip()
            if line.startswith("level:"):
                info["battery_level"] = line.split("level:")[1].strip() + "%"
            elif line.startswith("status:"):
                st = line.split("status:")[1].strip()
                info["battery_status"] = "Charging" if st in ["2", "5"] else "Discharging"

        # Storage
        _, df_out, _ = self._run_cmd(target_args + ["shell", "df", "-h", "/sdcard"])
        df_lines = df_out.splitlines()
        if len(df_lines) >= 2:
            parts = df_lines[1].split()
            if len(parts) >= 4:
                info["storage_free"] = f"{parts[3]} free of {parts[1]}"

        return info

    def send_adb_shell(self, target, shell_cmd):
        """Runs an arbitrary adb shell command."""
        target_args = ["-s", target] if target else []
        cmd_parts = shell_cmd.split()
        success, stdout, stderr = self._run_cmd(target_args + ["shell"] + cmd_parts)
        return success, (stdout or stderr)

    def change_brightness(self, target, delta):
        """Changes screen brightness by delta (-255 to +255)."""
        target_args = ["-s", target] if target else []
        # Get current brightness
        _, current_str, _ = self._run_cmd(target_args + ["shell", "settings", "get", "system", "screen_brightness"])
        try:
            current = int(current_str.strip())
        except:
            current = 128
        new_val = max(10, min(255, current + delta))
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "settings", "put", "system", "screen_brightness", str(new_val)])
        return success, f"Brightness: {new_val}/255"

    def list_installed_packages(self, target, third_party_only=True):
        """Lists third-party installed packages."""
        target_args = ["-s", target] if target else []
        cmd = target_args + ["shell", "pm", "list", "packages"]
        if third_party_only:
            cmd.append("-3")

        success, stdout, stderr = self._run_cmd(cmd)
        if not success:
            return []

        packages = []
        for line in stdout.splitlines():
            line = line.strip()
            if line.startswith("package:"):
                pkg = line.replace("package:", "").strip()
                packages.append(pkg)
        packages.sort()
        return packages

    def uninstall_package(self, target, package_name):
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["uninstall", package_name])
        return success, (stdout or stderr)

    def clear_app_data(self, target, package_name):
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "pm", "clear", package_name])
        return success, (stdout or stderr)

    def force_stop_app(self, target, package_name):
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "am", "force-stop", package_name])
        return success, (stdout or stderr)

    def grant_all_permissions(self, target, package_name):
        """Grants all requested runtime permissions for package."""
        target_args = ["-s", target] if target else []
        _, stdout, _ = self._run_cmd(target_args + ["shell", "dumpsys", "package", package_name])
        
        perms = []
        in_requested = False
        for line in stdout.splitlines():
            line = line.strip()
            if "requested permissions:" in line.lower():
                in_requested = True
                continue
            if in_requested:
                if line.startswith("android.permission."):
                    perms.append(line.split(":")[0].strip())
                elif not line:
                    in_requested = False

        granted = 0
        for p in perms:
            s, _, _ = self._run_cmd(target_args + ["shell", "pm", "grant", package_name, p])
            if s: granted += 1

        return True, f"Granted {granted} / {len(perms)} permissions for {package_name}"

    def launch_deep_link(self, target, uri):
        target_args = ["-s", target] if target else []
        cmd = target_args + ["shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", uri]
        success, stdout, stderr = self._run_cmd(cmd)
        return success, (stdout or stderr)

    def send_keyevent(self, target, key_code):
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "input", "keyevent", str(key_code)])
        return success, (stdout or stderr)

    def set_system_prop(self, target, prop_name, value):
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "setprop", prop_name, str(value)])
        return success, (stdout or stderr)

    def set_pointer_location(self, target, enable):
        val = "1" if enable else "0"
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "settings", "put", "system", "pointer_location", val])
        return success, (stdout or stderr)

    def set_stay_awake(self, target, enable):
        val = "true" if enable else "false"
        target_args = ["-s", target] if target else []
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "svc", "power", "stayon", val])
        return success, (stdout or stderr)

    def set_display_density(self, target, dpi_or_reset):
        target_args = ["-s", target] if target else []
        cmd = ["shell", "wm", "density", str(dpi_or_reset)]
        success, stdout, stderr = self._run_cmd(target_args + cmd)
        return success, (stdout or stderr)

    def input_text(self, target, text):
        """Types text into currently focused input field on device."""
        target_args = ["-s", target] if target else []
        # Escape special shell characters for adb input text
        escaped_text = text.replace(" ", "%s").replace("&", "\\&").replace("<", "\\<").replace(">", "\\>").replace('"', '\\"').replace("'", "\\'")
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "input", "text", escaped_text])
        return success, (stdout or stderr)

    def launch_scrcpy(self, target):
        """Attempts to launch scrcpy for low-latency screen mirroring.
        Safe - never raises exceptions, always returns (bool, str)."""
        try:
            import shutil
            scrcpy_bin = shutil.which("scrcpy") or shutil.which("scrcpy.exe")

            if not scrcpy_bin:
                possible_paths = [
                    os.path.join(self.base_dir, "scrcpy.exe"),
                    os.path.join(self.base_dir, "scrcpy", "scrcpy.exe"),
                    os.path.join(self.base_dir, "bin", "scrcpy.exe"),
                    r"C:\scrcpy\scrcpy.exe",
                    os.path.expanduser(r"~\scrcpy\scrcpy.exe"),
                    os.path.expanduser(r"~\AppData\Local\Programs\scrcpy\scrcpy.exe"),
                    r"C:\Program Files\scrcpy\scrcpy.exe",
                    r"C:\Program Files (x86)\scrcpy\scrcpy.exe",
                ]
                for path in possible_paths:
                    if os.path.exists(path):
                        scrcpy_bin = path
                        break

            if not scrcpy_bin:
                return False, "scrcpy not installed. Use 'Open Built-in Live Mirror' instead."

            target_args = ["-s", target] if target else []
            creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

            # Try modern scrcpy flags first (v2.x), fall back to legacy (v1.x)
            try:
                cmd = [scrcpy_bin] + target_args + [
                    "--always-on-top", "--stay-awake",
                    "--max-size=1024", "--video-bit-rate=4M", "--max-fps=60", "--no-audio"
                ]
                subprocess.Popen(cmd, creationflags=creationflags)
                return True, "scrcpy launched successfully!"
            except Exception:
                pass

            try:
                cmd = [scrcpy_bin] + target_args + [
                    "--always-on-top", "--stay-awake",
                    "--max-size", "1024", "--bit-rate", "4M", "--max-fps", "60", "--no-audio"
                ]
                subprocess.Popen(cmd, creationflags=creationflags)
                return True, "scrcpy launched successfully!"
            except Exception as e:
                return False, f"scrcpy found but failed to launch: {e}"

        except Exception as e:
            return False, f"launch_scrcpy error: {e}"

    def list_files(self, target, remote_path="/sdcard/Download"):
        """Lists files and folders in specified device directory."""
        target_args = ["-s", target] if target else []
        path = remote_path.strip() or "/sdcard/Download"
        success, stdout, stderr = self._run_cmd(target_args + ["shell", "ls", "-la", f'"{path}"'])
        if not success:
            return False, [], f"Failed to list directory: {stderr}"

        items = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("total "):
                continue
            parts = line.split(maxsplit=7)
            if len(parts) >= 8:
                perms = parts[0]
                is_dir = perms.startswith("d") or perms.startswith("l")
                size = parts[4]
                name = parts[7]
                if name in [".", ".."]:
                    continue
                # Handle symlinks
                if " -> " in name:
                    name = name.split(" -> ")[0]

                modified_str = "--"
                try:
                    full_parts = line.split(maxsplit=8)
                    if len(full_parts) >= 9:
                        month = full_parts[5]
                        day = full_parts[6]
                        time_or_year = full_parts[7]
                        modified_str = f"{month} {day} {time_or_year}"
                except Exception:
                    pass

                items.append({
                    "name": name,
                    "is_dir": is_dir,
                    "size": size if not is_dir else "--",
                    "permissions": perms,
                    "path": f"{path.rstrip('/')}/{name}",
                    "modified": modified_str
                })

        # Sort: directories first, then files alphabetically
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return True, items, ""

    def push_file(self, target, local_path, remote_dir="/sdcard/Download"):
        """Pushes a file from PC to device directory."""
        if not os.path.exists(local_path):
            return False, f"Local file not found: {local_path}"
        target_args = ["-s", target] if target else []
        cmd = target_args + ["push", local_path, remote_dir]
        success, stdout, stderr = self._run_cmd(cmd, timeout=120)
        return success, (stdout or stderr)

    def pull_file(self, target, remote_path, local_dir):
        """Pulls a file from device to local PC directory."""
        target_args = ["-s", target] if target else []
        local_target = Path(local_dir) / Path(remote_path).name
        cmd = target_args + ["pull", remote_path, str(local_target)]
        success, stdout, stderr = self._run_cmd(cmd, timeout=120)
        if success and local_target.exists():
            return True, str(local_target.resolve())
        return False, (stdout or stderr)

    def run_custom_adb(self, target, raw_cmd):
        """Executes a custom ADB CLI or shell command."""
        cmd_str = raw_cmd.strip()
        if cmd_str.startswith("adb "):
            cmd_str = cmd_str[4:]
        
        args = cmd_str.split()
        if target and "-s" not in args:
            args = ["-s", target] + args
            
        success, stdout, stderr = self._run_cmd(args, timeout=30)
        return success, (stdout or stderr)

    @staticmethod
    def _parse_logcat_line(raw_line):
        """Parses a `logcat -v threadtime` line into structured fields."""
        m = LOGCAT_LINE_RE.match(raw_line)
        if m:
            return {
                "time": m.group("time"),
                "pid": m.group("pid"),
                "tid": m.group("tid"),
                "level": m.group("level"),
                "tag": m.group("tag").strip(),
                "message": m.group("message"),
                "raw": raw_line,
            }
        return {"time": "", "pid": "", "tid": "", "level": "I", "tag": "", "message": raw_line, "raw": raw_line}

    def start_logcat_stream(self, target):
        """Starts (or reuses) a persistent `adb logcat` process for the given device, tailed by a background reader thread."""
        with self._logcat_streams_lock:
            existing = self._logcat_streams.get(target)
            if existing and existing["proc"].poll() is None:
                return {"success": True}

            target_args = ["-s", target] if target else []
            cmd = [self.adb_path] + target_args + ["logcat", "-v", "threadtime"]
            try:
                proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
                )
            except Exception as e:
                return {"success": False, "message": str(e)}

            stream_state = {
                "proc": proc,
                "buffer": deque(maxlen=8000),
                "seq": 0,
                "lock": threading.Lock(),
            }
            self._logcat_streams[target] = stream_state

        def _reader():
            try:
                for raw_line in stream_state["proc"].stdout:
                    raw_line = raw_line.rstrip("\n").rstrip("\r")
                    if not raw_line.strip() or raw_line.startswith("---------"):
                        continue
                    entry = self._parse_logcat_line(raw_line)
                    with stream_state["lock"]:
                        stream_state["seq"] += 1
                        entry["seq"] = stream_state["seq"]
                        stream_state["buffer"].append(entry)
            except Exception:
                pass

        threading.Thread(target=_reader, daemon=True).start()
        return {"success": True}

    def stop_logcat_stream(self, target):
        """Terminates the background logcat process for the given device."""
        with self._logcat_streams_lock:
            stream_state = self._logcat_streams.pop(target, None)
        if stream_state:
            try:
                stream_state["proc"].terminate()
            except Exception:
                pass
        return {"success": True}

    def poll_logcat_stream(self, target, since_seq=0):
        """Returns log entries appended since `since_seq` (incremental, no duplicates)."""
        stream_state = self._logcat_streams.get(target)
        if not stream_state:
            return {"running": False, "entries": [], "last_seq": since_seq, "total_buffered": 0}

        with stream_state["lock"]:
            entries = [e for e in stream_state["buffer"] if e["seq"] > since_seq]
            last_seq = stream_state["buffer"][-1]["seq"] if stream_state["buffer"] else since_seq
            total_buffered = len(stream_state["buffer"])

        running = stream_state["proc"].poll() is None
        return {"running": running, "entries": entries, "last_seq": last_seq, "total_buffered": total_buffered}

    def clear_logcat_stream(self, target):
        """Clears the in-memory buffer (and device-side ring buffer) for the given device."""
        stream_state = self._logcat_streams.get(target)
        if stream_state:
            with stream_state["lock"]:
                stream_state["buffer"].clear()
                stream_state["seq"] = 0
        target_args = ["-s", target] if target else []
        self._run_cmd(target_args + ["logcat", "-c"], timeout=5)
        return {"success": True}

    def resolve_package_pids(self, target, package_name):
        """Resolves the current PID(s) of a running package, used for package-scoped log filtering."""
        if not package_name:
            return []
        target_args = ["-s", target] if target else []
        success, stdout, _ = self._run_cmd(target_args + ["shell", "pidof", package_name], timeout=5)
        if not success or not stdout.strip():
            return []
        return stdout.strip().split()

    def stop_all_logcat_streams(self):
        """Terminates every background logcat process, used on app shutdown to avoid orphaned adb processes."""
        with self._logcat_streams_lock:
            targets = list(self._logcat_streams.keys())
        for target in targets:
            self.stop_logcat_stream(target)
        return {"success": True}
