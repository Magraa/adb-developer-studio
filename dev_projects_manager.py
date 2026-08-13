import os
import glob
from pathlib import Path
import time

class DevProjectsManager:
    """Scans and monitors development project directories for built APK files."""
    
    COMMON_APK_PATTERNS = [
        "**/build/app/outputs/flutter-apk/*.apk",
        "**/app/build/outputs/apk/**/*.apk",
        "**/android/app/build/outputs/apk/**/*.apk",
        "**/build/outputs/apk/**/*.apk",
        "**/*.apk"
    ]

    @staticmethod
    def scan_project_apks(project_path):
        """Finds all APK files in a project path, sorted by modification time (newest first)."""
        proj_dir = Path(project_path)
        if not proj_dir.exists() or not proj_dir.is_dir():
            return []

        apks = []
        seen_paths = set()

        # Check build directory first if exists to speed up scan
        build_dirs = [
            proj_dir / "build",
            proj_dir / "app" / "build",
            proj_dir / "android" / "app" / "build"
        ]

        search_roots = [d for d in build_dirs if d.exists()]
        if not search_roots:
            search_roots = [proj_dir]

        for root in search_roots:
            for pattern in ["**/*.apk"]:
                for file_path in root.glob(pattern):
                    resolved = str(file_path.resolve())
                    if resolved in seen_paths:
                        continue
                    seen_paths.add(resolved)
                    try:
                        stat = file_path.stat()
                        apks.append({
                            "name": file_path.name,
                            "path": resolved,
                            "size_mb": round(stat.st_size / (1024 * 1024), 2),
                            "modified": stat.st_mtime,
                            "modified_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                            "relative_path": str(file_path.relative_to(proj_dir))
                        })
                    except Exception:
                        pass

        # Sort by newest modified first
        apks.sort(key=lambda x: x["modified"], reverse=True)
        return apks

    @staticmethod
    def get_latest_apk(project_path):
        apks = DevProjectsManager.scan_project_apks(project_path)
        return apks[0] if apks else None
