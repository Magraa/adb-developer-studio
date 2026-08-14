import os
import glob
import subprocess
import time
from pathlib import Path

class DevProjectsManager:
    """Scans, monitors, and builds development projects (Android, Flutter, React Native)."""

    @staticmethod
    def detect_project_type(proj_dir):
        """Detects framework type of project directory."""
        p = Path(proj_dir)
        if (p / "pubspec.yaml").exists():
            return "Flutter"
        if (p / "package.json").exists():
            try:
                with open(p / "package.json", "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "react-native" in content:
                        return "React Native"
            except Exception:
                pass
            if (p / "android").exists():
                return "React Native"
        if (p / "build.gradle").exists() or (p / "build.gradle.kts").exists() or (p / "settings.gradle").exists() or (p / "app").exists():
            return "Android Studio"
        return "Android"

    @staticmethod
    def get_time_ago(timestamp):
        """Returns relative time string e.g. '3 minutes ago', '1 hour ago'."""
        if not timestamp:
            return "Never"
        diff = time.time() - timestamp
        if diff < 60:
            return "Just now"
        elif diff < 3600:
            mins = max(1, int(diff // 60))
            return f"{mins} minute{'s' if mins > 1 else ''} ago"
        elif diff < 86400:
            hours = int(diff // 3600)
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        else:
            days = int(diff // 86400)
            return f"{days} day{'s' if days > 1 else ''} ago"

    @staticmethod
    def scan_project_apks(project_path):
        """Finds all APK files in a project path, sorted by modification time (newest first)."""
        proj_dir = Path(project_path)
        if not proj_dir.exists() or not proj_dir.is_dir():
            return []

        apks = []
        seen_paths = set()

        build_dirs = [
            proj_dir / "build",
            proj_dir / "app" / "build",
            proj_dir / "android" / "app" / "build"
        ]

        search_roots = [d for d in build_dirs if d.exists()]
        if not search_roots:
            search_roots = [proj_dir]

        for root in search_roots:
            for file_path in root.glob("**/*.apk"):
                resolved = str(file_path.resolve())
                if resolved in seen_paths:
                    continue
                seen_paths.add(resolved)
                try:
                    stat = file_path.stat()
                    name_lower = file_path.name.lower()
                    variant = "release" if "release" in name_lower or "release" in resolved.lower() else "debug"
                    apks.append({
                        "name": file_path.name,
                        "path": resolved,
                        "size_mb": round(stat.st_size / (1024 * 1024), 1),
                        "modified": stat.st_mtime,
                        "modified_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                        "time_ago": DevProjectsManager.get_time_ago(stat.st_mtime),
                        "relative_path": str(file_path.relative_to(proj_dir)),
                        "variant": variant,
                        "mode": variant.capitalize()
                    })
                except Exception:
                    pass

        apks.sort(key=lambda x: x["modified"], reverse=True)
        return apks

    @staticmethod
    def get_project_details(project_path):
        """Returns full project metadata bundle."""
        p_path = Path(project_path)
        if not p_path.exists():
            return None

        apks = DevProjectsManager.scan_project_apks(project_path)
        proj_type = DevProjectsManager.detect_project_type(project_path)
        latest_apk = apks[0] if apks else None
        
        stat = p_path.stat()
        created_str = time.strftime("%d %b %Y", time.localtime(stat.st_ctime))
        last_built = latest_apk["time_ago"] if latest_apk else "Never"

        return {
            "name": p_path.name,
            "path": str(p_path.resolve()),
            "type": proj_type,
            "platform": "Android",
            "created": created_str,
            "last_built": last_built,
            "status": "Watching for builds",
            "apks": apks,
            "latest_apk": latest_apk,
            "build_variant": latest_apk["variant"] if latest_apk else "debug",
            "build_mode": latest_apk["mode"] if latest_apk else "Debug"
        }

    @staticmethod
    def _resolve_executable(cmd_name):
        """Resolves full executable path for Windows/Unix CLI tools."""
        import shutil
        found = shutil.which(cmd_name)
        if found:
            return found
        if os.name == "nt":
            for ext in [".bat", ".cmd", ".exe"]:
                found = shutil.which(cmd_name + ext)
                if found:
                    return found
        return cmd_name

    @staticmethod
    def build_project(project_path, build_variant="debug"):
        """Executes project build (flutter build apk, gradlew assemble, etc.)."""
        import shutil
        p_path = Path(project_path).resolve()
        if not p_path.exists():
            return {"success": False, "message": f"Project folder not found: {project_path}", "output": ""}

        proj_type = DevProjectsManager.detect_project_type(project_path)
        build_variant = build_variant.lower()
        task = "assembleRelease" if build_variant == "release" else "assembleDebug"
        
        cmd = []
        cwd = str(p_path)
        use_shell = os.name == "nt"

        if proj_type == "Flutter":
            flutter_bin = DevProjectsManager._resolve_executable("flutter")
            cmd = [flutter_bin, "build", "apk", f"--{build_variant}"]
            cwd = str(p_path)
        else:
            # Android / React Native / Gradle project
            # Locate gradlew.bat / gradlew
            candidate_dirs = [p_path, p_path / "android", p_path / "app"]
            gradlew_file = None
            for d in candidate_dirs:
                target_name = "gradlew.bat" if os.name == "nt" else "gradlew"
                if (d / target_name).exists():
                    gradlew_file = (d / target_name).resolve()
                    cwd = str(d)
                    break
                elif (d / "gradlew").exists():
                    gradlew_file = (d / "gradlew").resolve()
                    cwd = str(d)
                    break

            if gradlew_file:
                cmd = [str(gradlew_file), task]
            else:
                gradle_bin = DevProjectsManager._resolve_executable("gradle")
                cmd = [gradle_bin, task]
                if (p_path / "android").exists():
                    cwd = str(p_path / "android")

        try:
            # Build execution with fallback shell support
            res = subprocess.run(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=360,
                shell=use_shell,
                creationflags=subprocess.CREATE_NO_WINDOW if (os.name == "nt" and not use_shell) else 0
            )
            output = res.stdout or ""
            apks = DevProjectsManager.scan_project_apks(project_path)
            latest = apks[0] if apks else None

            if res.returncode == 0 or (latest and (time.time() - latest["modified"]) < 180):
                return {
                    "success": True,
                    "message": f"Successfully built {proj_type} project ({build_variant})!",
                    "latest_apk": latest,
                    "output": output[-3000:]
                }
            else:
                return {
                    "success": False,
                    "message": f"Build failed with exit code {res.returncode}. Check output logs.",
                    "output": output[-3000:]
                }
        except subprocess.TimeoutExpired:
            return {"success": False, "message": "Build timed out after 6 minutes", "output": ""}
        except Exception as e:
            return {"success": False, "message": f"Error executing build command: {e}", "output": str(e)}

    @staticmethod
    def clean_project(project_path):
        """Cleans project build directory."""
        p_path = Path(project_path).resolve()
        if not p_path.exists():
            return {"success": False, "message": "Folder not found"}

        proj_type = DevProjectsManager.detect_project_type(project_path)
        cmd = []
        cwd = str(p_path)
        use_shell = os.name == "nt"

        if proj_type == "Flutter":
            flutter_bin = DevProjectsManager._resolve_executable("flutter")
            cmd = [flutter_bin, "clean"]
        else:
            candidate_dirs = [p_path, p_path / "android", p_path / "app"]
            gradlew_file = None
            for d in candidate_dirs:
                target_name = "gradlew.bat" if os.name == "nt" else "gradlew"
                if (d / target_name).exists():
                    gradlew_file = (d / target_name).resolve()
                    cwd = str(d)
                    break

            if gradlew_file:
                cmd = [str(gradlew_file), "clean"]
            else:
                gradle_bin = DevProjectsManager._resolve_executable("gradle")
                cmd = [gradle_bin, "clean"]

        try:
            res = subprocess.run(
                cmd,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60,
                shell=use_shell,
                creationflags=subprocess.CREATE_NO_WINDOW if (os.name == "nt" and not use_shell) else 0
            )
            return {"success": res.returncode == 0, "message": res.stdout or "Clean completed"}
        except Exception as e:
            return {"success": False, "message": str(e)}

