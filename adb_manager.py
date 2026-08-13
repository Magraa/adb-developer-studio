import subprocess
import base64
import os
import re
import time
from pathlib import Path

class ADBManager:
    """Core ADB wrapper executing CLI commands with error handling and data parsing."""

    def __init__(self, adb_path="adb"):
        self.adb_path = adb_path

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
        """Returns list of connected ADB devices with details."""
        success, stdout, stderr = self._run_cmd(["devices", "-l"])
        if not success:
            return []

        devices = []
        lines = stdout.splitlines()
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                serial = parts[0]
                status = parts[1]
                
                info = {"serial": serial, "status": status, "model": serial, "connection": "usb"}
                if ":" in serial:
                    info["connection"] = "wireless"
                
                for item in parts[2:]:
                    if ":" in item:
                        k, v = item.split(":", 1)
                        if k == "model":
                            info["model"] = v
                        elif k == "product":
                            info["product"] = v
                        elif k == "device":
                            info["device_name"] = v
                
                devices.append(info)
        return devices

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

    def take_screenshot(self, target, save_dir):
        """Takes screenshot via exec-out screencap, saves PNG, and returns base64 & file path."""
        args = ["-s", target, "exec-out", "screencap", "-p"] if target else ["exec-out", "screencap", "-p"]
        success, image_bytes, stderr = self._run_bytes_cmd(args, timeout=12)

        if not success or not image_bytes:
            return False, f"Screenshot failed: {stderr}", ""

        # Verify PNG header (\x89PNG)
        if not image_bytes.startswith(b"\x89PNG"):
            return False, "Invalid image data received from device", ""

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

    def fetch_logcat(self, target, lines=100, filter_tag="", min_level="V"):
        """Fetches recent logcat entries."""
        target_args = ["-s", target] if target else []
        # Filter format: *:V, *:D, *:I, *:W, *:E, *:F
        log_filter = f"*:{min_level.upper()}"
        cmd = target_args + ["shell", "logcat", "-d", "-t", str(lines), log_filter]
        success, stdout, stderr = self._run_cmd(cmd, timeout=8)
        if not success:
            return []

        parsed_logs = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line or line.startswith("------"):
                continue
            if filter_tag and filter_tag.lower() not in line.lower():
                continue
            parsed_logs.append(line)
        return parsed_logs
