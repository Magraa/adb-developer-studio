import os
import sys
import webview
import tkinter as tk
from tkinter import filedialog
from pathlib import Path

from adb_manager import ADBManager
from storage_manager import StorageManager
from dev_projects_manager import DevProjectsManager

class ADBStudioAPI:
    def __init__(self):
        self.adb = ADBManager()
        self.storage = StorageManager()
        self.dev_projects = DevProjectsManager()

    def get_local_ip(self):
        return self.adb.get_local_ip()

    def generate_qr_pairing_info(self):
        import random
        ip = self.adb.get_local_ip()
        passcode = f"{random.randint(100000, 999999)}"
        service_name = f"ADB_Studio_{random.randint(1000, 9999)}"
        # Android ADB QR Code standard payload format
        qr_payload = f"WIFI:T:ADB;S:{service_name};P:{passcode};;"
        return {
            "ip": ip,
            "passcode": passcode,
            "service_name": service_name,
            "qr_payload": qr_payload
        }

    def get_activity_log(self):
        return self.storage.get_activity_log()

    def log_activity(self, title, details="", type_icon="info"):
        return self.storage.log_activity(title, details, type_icon)

    def clear_activity_log(self):
        return self.storage.clear_activity_log()

    def restart_adb_server(self):
        success, message = self.adb.restart_server()
        if success:
            self.storage.log_activity("ADB Server Restarted", "adb start-server", "server")
        return {"success": success, "message": message}

    # --- Connection Management ---
    def get_devices(self):
        return self.adb.get_devices()



    def connect_wireless(self, ip, port):
        ip = ip.strip()
        port = str(port).strip()
        success, message = self.adb.connect_wireless(ip, port)
        if success:
            self.storage.add_recent_device(ip, port)
        return {"success": success, "message": message}

    def pair_wireless(self, ip, port, code):
        success, message = self.adb.pair_wireless(ip.strip(), str(port).strip(), str(code).strip())
        return {"success": success, "message": message}

    def disconnect_device(self, target):
        success, message = self.adb.disconnect_device(target)
        return {"success": success, "message": message}

    def get_recent_devices(self):
        return self.storage.get_recent_devices()

    def update_recent_device_port(self, ip, old_port, new_port):
        self.storage.update_recent_device_port(ip, old_port, new_port)
        return True

    def remove_recent_device(self, ip, port):
        self.storage.remove_recent_device(ip, port)
        return True

    # --- Screenshots & Screen Recording ---
    def take_screenshot(self, target):
        save_dir = self.storage.get_screenshot_dir()
        success, b64_or_err, file_path = self.adb.take_screenshot(target, save_dir)
        return {
            "success": success,
            "image_data": b64_or_err if success else "",
            "error": "" if success else b64_or_err,
            "file_path": file_path
        }

    def take_screenshot_silent(self, target):
        """Returns base64 screenshot without saving to disk - for live mirror stream use."""
        try:
            success, b64_or_err = self.adb.take_screenshot_silent(target)
            return {"success": success, "image_data": b64_or_err if success else "", "error": "" if success else b64_or_err}
        except Exception as e:
            return {"success": False, "image_data": "", "error": str(e)}

    def get_recent_captures(self):
        save_dir = self.storage.get_screenshot_dir()
        return self.adb.get_recent_captures(save_dir, limit=6)

    def get_capture_settings(self):
        return self.storage.get_capture_settings()

    def set_capture_setting(self, key, value):
        return self.storage.set_capture_setting(key, value)

    def get_video_dir(self):
        return self.storage.get_video_dir()

    def set_video_dir(self, directory):
        self.storage.set_video_dir(directory)
        return True

    def record_screen(self, target, duration_sec=60):
        save_dir = self.storage.get_video_dir()
        success, path_or_err = self.adb.record_screen(target, duration_sec, save_dir)
        return {"success": success, "file_path": path_or_err if success else "", "error": "" if success else path_or_err}


    def get_screenshot_dir(self):
        return self.storage.get_screenshot_dir()

    def set_screenshot_dir(self, directory):
        self.storage.set_screenshot_dir(directory)
        return True

    def open_folder(self, folder_path=""):
        path_to_open = folder_path or self.storage.get_screenshot_dir()
        if os.path.exists(path_to_open):
            if os.name == "nt":
                os.startfile(path_to_open)
            else:
                import subprocess
                subprocess.Popen(["xdg-open", path_to_open])
            return True
        return False

    def select_folder(self):
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        folder = filedialog.askdirectory(title="Select Directory")
        root.destroy()
        return folder or ""

    def select_apk_file(self):
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        file_path = filedialog.askopenfilename(
            title="Select APK File",
            filetypes=[("Android Package", "*.apk"), ("All Files", "*.*")]
        )
        root.destroy()
        return file_path or ""

    def select_any_file(self):
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        file_path = filedialog.askopenfilename(title="Select File to Upload")
        root.destroy()
        return file_path or ""

    # --- APK Installation & Dev Projects ---
    def install_apk(self, target, apk_path):
        success, message = self.adb.install_apk(target, apk_path)
        return {"success": success, "message": message}

    def get_projects(self):
        projects = self.storage.get_projects()
        detailed_projects = []
        for p in projects:
            details = self.dev_projects.get_project_details(p["path"])
            if details:
                details["auto_install"] = p.get("auto_install", False)
                detailed_projects.append(details)
            else:
                detailed_projects.append({
                    "name": p.get("name", "Project"),
                    "path": p["path"],
                    "type": "Android",
                    "platform": "Android",
                    "created": "Unknown",
                    "last_built": "Never",
                    "status": "Idle",
                    "apks": [],
                    "latest_apk": None,
                    "build_variant": "debug",
                    "build_mode": "Debug",
                    "auto_install": p.get("auto_install", False)
                })
        return detailed_projects

    def add_project(self, project_path=""):
        if not project_path:
            project_path = self.select_folder()
        if not project_path:
            return None
        self.storage.add_project(project_path)
        return self.dev_projects.get_project_details(project_path)

    def remove_project(self, project_path):
        self.storage.remove_project(project_path)
        return True

    def scan_project_apks(self, project_path):
        return self.dev_projects.scan_project_apks(project_path)

    def build_project(self, project_path, build_variant="debug"):
        return self.dev_projects.build_project(project_path, build_variant)

    def clean_project(self, project_path):
        return self.dev_projects.clean_project(project_path)

    # --- Device Diagnostics & App Management ---
    def get_device_info(self, target):
        return self.adb.get_device_info(target)

    def list_installed_packages(self, target):
        return self.adb.list_installed_packages(target, third_party_only=True)

    def uninstall_package(self, target, package_name):
        success, message = self.adb.uninstall_package(target, package_name)
        return {"success": success, "message": message}

    def clear_app_data(self, target, package_name):
        success, message = self.adb.clear_app_data(target, package_name)
        return {"success": success, "message": message}

    def force_stop_app(self, target, package_name):
        success, message = self.adb.force_stop_app(target, package_name)
        return {"success": success, "message": message}

    def grant_all_permissions(self, target, package_name):
        success, message = self.adb.grant_all_permissions(target, package_name)
        return {"success": success, "message": message}

    def launch_deep_link(self, target, uri):
        success, message = self.adb.launch_deep_link(target, uri)
        return {"success": success, "message": message}

    def send_keyevent(self, target, key_code):
        success, message = self.adb.send_keyevent(target, key_code)
        return {"success": success, "message": message}

    def set_layout_bounds(self, target, enable):
        val = "true" if enable else "false"
        success, message = self.adb.set_system_prop(target, "debug.layout", val)
        return {"success": success, "message": message}

    def set_pointer_location(self, target, enable):
        success, message = self.adb.set_pointer_location(target, enable)
        return {"success": success, "message": message}

    def set_stay_awake(self, target, enable):
        success, message = self.adb.set_stay_awake(target, enable)
        return {"success": success, "message": message}

    def set_display_density(self, target, dpi_or_reset):
        success, message = self.adb.set_display_density(target, dpi_or_reset)
        return {"success": success, "message": message}

    def input_text(self, target, text):
        success, message = self.adb.input_text(target, text)
        return {"success": success, "message": message}

    def launch_scrcpy(self, target):
        try:
            success, message = self.adb.launch_scrcpy(target)
            return {"success": success, "message": message}
        except Exception as e:
            return {"success": False, "message": f"Bridge error: {e}"}

    # --- Device File Explorer ---
    def list_files(self, target, remote_path="/sdcard/Download"):
        success, items, error = self.adb.list_files(target, remote_path)
        return {"success": success, "items": items, "error": error}

    def push_file(self, target, local_path="", remote_dir="/sdcard/Download"):
        if not local_path:
            root = tk.Tk()
            root.withdraw()
            root.attributes("-topmost", True)
            local_path = filedialog.askopenfilename(title="Select File to Push to Phone")
            root.destroy()
        if not local_path:
            return {"success": False, "message": "No file selected"}
        success, message = self.adb.push_file(target, local_path, remote_dir)
        return {"success": success, "message": message}

    def pull_file(self, target, remote_path, local_dir=""):
        if not local_dir:
            local_dir = self.storage.get_screenshot_dir()
        success, path_or_err = self.adb.pull_file(target, remote_path, local_dir)
        return {"success": success, "file_path": path_or_err if success else "", "error": "" if success else path_or_err}

    # --- Terminal & Command Snippets ---
    def run_custom_adb(self, target, raw_cmd):
        success, output = self.adb.run_custom_adb(target, raw_cmd)
        return {"success": success, "output": output}

    def send_adb_shell(self, target, shell_cmd):
        success, output = self.adb.send_adb_shell(target, shell_cmd)
        return {"success": success, "output": output}

    def change_brightness(self, target, delta):
        success, message = self.adb.change_brightness(target, int(delta))
        return {"success": success, "message": message}

    def get_snippets(self):
        return self.storage.get_snippets()

    def add_snippet(self, title, cmd):
        return self.storage.add_snippet(title, cmd)

    def remove_snippet(self, title):
        return self.storage.remove_snippet(title)

    # --- Logcat Streaming ---
    def start_logcat_stream(self, target):
        return self.adb.start_logcat_stream(target)

    def stop_logcat_stream(self, target):
        return self.adb.stop_logcat_stream(target)

    def poll_logcat_stream(self, target, since_seq=0):
        return self.adb.poll_logcat_stream(target, since_seq)

    def clear_logcat_stream(self, target):
        return self.adb.clear_logcat_stream(target)

    def resolve_package_pids(self, target, package_name):
        return self.adb.resolve_package_pids(target, package_name)

    def get_logcat_filters(self):
        return self.storage.get_logcat_filters()

    def save_logcat_filter(self, name, filter_config):
        return self.storage.save_logcat_filter(name, filter_config)

    def remove_logcat_filter(self, name):
        return self.storage.remove_logcat_filter(name)

    def export_text_file(self, content, default_filename="export.txt"):
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        file_path = filedialog.asksaveasfilename(
            title="Export Logs",
            initialfile=default_filename,
            defaultextension=".txt",
            filetypes=[("Text File", "*.txt"), ("Log File", "*.log"), ("All Files", "*.*")]
        )
        root.destroy()
        if not file_path:
            return {"success": False}
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True, "path": file_path}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def open_logcat_window(self):
        try:
            index_path = Path(__file__).parent / "web" / "index.html"
            webview.create_window(
                title="ADB Developer Studio - Logcat",
                url=f"{index_path.resolve()}?popout=logcat",
                js_api=self,
                width=1280,
                height=780,
                min_size=(720, 480),
                background_color="#080B10"
            )
            return {"success": True}
        except Exception as e:
            return {"success": False, "message": str(e)}


def main():
    api = ADBStudioAPI()
    web_dir = Path(__file__).parent / "web"
    index_path = web_dir / "index.html"

    window = webview.create_window(
        title="ADB Developer Studio - High Speed Android Connection & Workflow Tools",
        url=str(index_path.resolve()),
        js_api=api,
        width=1220,
        height=800,
        min_size=(960, 640),
        background_color="#0F172A"
    )
    window.events.closing += api.adb.stop_all_logcat_streams

    webview.start(debug=False)

if __name__ == "__main__":
    main()
