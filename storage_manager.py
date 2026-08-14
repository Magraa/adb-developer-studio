import json
import os
from pathlib import Path

DEFAULT_CONFIG_PATH = Path.home() / ".adb_developer_studio" / "config.json"

class StorageManager:
    def __init__(self, config_path=DEFAULT_CONFIG_PATH):
        self.config_path = Path(config_path)
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.data = self._load()

    def _load(self):
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return self._default_config()

    def _default_config(self):
        default_screenshot_dir = str(Path.home() / "Pictures" / "ADB_Studio")
        default_video_dir = str(Path.home() / "Videos" / "ADB_Studio")
        return {
            "recent_devices": [],
            "projects": [],
            "screenshot_dir": default_screenshot_dir,
            "video_dir": default_video_dir,
            "theme": "cyber_dark",
            "auto_connect_last": True,
            "snippets": [
                {"title": "Current Active Focus Window", "cmd": "shell dumpsys window windows | grep -E 'mCurrentFocus'"},
                {"title": "Installed Packages Count", "cmd": "shell pm list packages | wc -l"},
                {"title": "Device Model & Build Info", "cmd": "shell getprop ro.product.model"},
                {"title": "Dump Battery Info", "cmd": "shell dumpsys battery"},
                {"title": "List Running Services", "cmd": "shell dumpsys activity services"}
            ],
            "activity_log": [],
            "capture_settings": {
                "auto_copy_clipboard": True,
                "auto_open_folder": False,
                "image_format": "PNG",
                "image_quality": "100% (Best)",
                "record_max_duration": "60 seconds",
                "record_resolution": "1080 × 2400 (Device)"
            }
        }

    def get_capture_settings(self):
        return self.data.get("capture_settings", self._default_config()["capture_settings"])

    def set_capture_setting(self, key, value):
        settings = self.get_capture_settings()
        settings[key] = value
        self.data["capture_settings"] = settings
        self.save()
        return settings

    def get_video_dir(self):
        v_dir = self.data.get("video_dir")
        if not v_dir:
            v_dir = str(Path.home() / "Videos" / "ADB_Studio")
        Path(v_dir).mkdir(parents=True, exist_ok=True)
        return v_dir

    def set_video_dir(self, directory):
        self.data["video_dir"] = directory
        self.save()


    def get_activity_log(self):
        return self.data.get("activity_log", [])

    def log_activity(self, title, details="", type_icon="info"):
        import time
        logs = self.get_activity_log()
        time_str = time.strftime("%H:%M")
        logs.insert(0, {
            "title": title,
            "details": details,
            "time": time_str,
            "type": type_icon
        })
        # Keep last 30 activity logs
        self.data["activity_log"] = logs[:30]
        self.save()
        return logs

    def clear_activity_log(self):
        self.data["activity_log"] = []
        self.save()
        return []


    def get_snippets(self):
        return self.data.get("snippets", self._default_config()["snippets"])

    def add_snippet(self, title, cmd):
        snippets = self.get_snippets()
        snippets.append({"title": title, "cmd": cmd})
        self.data["snippets"] = snippets
        self.save()
        return snippets

    def remove_snippet(self, title):
        snippets = [s for s in self.get_snippets() if s.get("title") != title]
        self.data["snippets"] = snippets
        self.save()
        return snippets


    def get_logcat_filters(self):
        return self.data.get("logcat_filters", [])

    def save_logcat_filter(self, name, filter_config):
        filters = [f for f in self.get_logcat_filters() if f.get("name") != name]
        filters.append({"name": name, "config": filter_config})
        self.data["logcat_filters"] = filters
        self.save()
        return filters

    def remove_logcat_filter(self, name):
        filters = [f for f in self.get_logcat_filters() if f.get("name") != name]
        self.data["logcat_filters"] = filters
        self.save()
        return filters


    def save(self):
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")

    def get_recent_devices(self):
        return self.data.get("recent_devices", [])

    def add_recent_device(self, ip, port, alias=""):
        devices = self.get_recent_devices()
        # Remove existing if present to move to top
        devices = [d for d in devices if not (d.get("ip") == ip and str(d.get("port")) == str(port))]
        devices.insert(0, {
            "ip": ip,
            "port": str(port),
            "alias": alias or f"{ip}:{port}"
        })
        # Keep last 15
        self.data["recent_devices"] = devices[:15]
        self.save()

    def remove_recent_device(self, ip, port):
        devices = self.get_recent_devices()
        self.data["recent_devices"] = [d for d in devices if not (d.get("ip") == ip and str(d.get("port")) == str(port))]
        self.save()

    def update_recent_device_port(self, ip, old_port, new_port):
        devices = self.get_recent_devices()
        for d in devices:
            if d.get("ip") == ip and str(d.get("port")) == str(old_port):
                d["port"] = str(new_port)
                break
        self.save()

    def get_projects(self):
        return self.data.get("projects", [])

    def add_project(self, project_path, auto_install=False):
        p_path = str(Path(project_path).resolve())
        name = Path(p_path).name
        projects = self.get_projects()
        # check if already exists
        for p in projects:
            if p.get("path") == p_path:
                p["auto_install"] = auto_install
                self.save()
                return p
        new_proj = {"path": p_path, "name": name, "auto_install": auto_install}
        projects.append(new_proj)
        self.data["projects"] = projects
        self.save()
        return new_proj

    def remove_project(self, project_path):
        projects = self.get_projects()
        self.data["projects"] = [p for p in projects if p.get("path") != project_path]
        self.save()

    def set_project_auto_install(self, project_path, enabled):
        projects = self.get_projects()
        for p in projects:
            if p.get("path") == project_path:
                p["auto_install"] = enabled
                break
        self.save()

    def get_screenshot_dir(self):
        s_dir = self.data.get("screenshot_dir")
        if not s_dir:
            s_dir = str(Path.home() / "Pictures" / "ADB_Screenshots")
        Path(s_dir).mkdir(parents=True, exist_ok=True)
        return s_dir

    def set_screenshot_dir(self, directory):
        self.data["screenshot_dir"] = directory
        self.save()
