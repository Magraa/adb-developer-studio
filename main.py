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

    def record_screen(self, target, duration_sec=15):
        save_dir = self.storage.get_screenshot_dir()
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

    # --- APK Installation & Dev Projects ---
    def install_apk(self, target, apk_path):
        success, message = self.adb.install_apk(target, apk_path)
        return {"success": success, "message": message}

    def get_projects(self):
        projects = self.storage.get_projects()
        for p in projects:
            p["apks"] = self.dev_projects.scan_project_apks(p["path"])
        return projects

    def add_project(self, project_path=""):
        if not project_path:
            project_path = self.select_folder()
        if not project_path:
            return None
        proj = self.storage.add_project(project_path)
        proj["apks"] = self.dev_projects.scan_project_apks(project_path)
        return proj

    def remove_project(self, project_path):
        self.storage.remove_project(project_path)
        return True

    def scan_project_apks(self, project_path):
        return self.dev_projects.scan_project_apks(project_path)

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

    def fetch_logcat(self, target, lines=120, filter_tag="", min_level="V"):
        logs = self.adb.fetch_logcat(target, lines, filter_tag, min_level)
        return logs


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

    webview.start(debug=False)

if __name__ == "__main__":
    main()
