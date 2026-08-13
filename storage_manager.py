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
        default_screenshot_dir = str(Path.home() / "Pictures" / "ADB_Screenshots")
        return {
            "recent_devices": [], # List of {"ip": "192.168.1.50", "port": "5555", "alias": "My Phone"}
            "projects": [], # List of {"path": "E:/Projects/MyApp", "name": "MyApp", "auto_install": False}
            "screenshot_dir": default_screenshot_dir,
            "theme": "cyber_dark",
            "auto_connect_last": True
        }

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
