from __future__ import annotations

import json
import base64
import shutil
import tempfile
import os
import subprocess
import threading
import time
import webbrowser
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data.json"
HOST = "127.0.0.1"
PORT = 4177
ORIGIN = f"http://{HOST}:{PORT}"
MAX_BODY = 4 * 1024 * 1024
NOTIFY_TOPIC = "habit-z137965-8f3c9a7d2e"
GH_REPO = "z137965-blip/habit-tracker"
GH_DATA_ENDPOINT = f"repos/{GH_REPO}/contents/data.json"

publish_event = threading.Event()
stop_event = threading.Event()
data_lock = threading.Lock()
publish_lock = threading.Lock()


def ensure_data_file() -> None:
    if DATA_FILE.exists():
        return
    payload = {
        "version": 1,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "viewDate": time.strftime("%Y-%m-%d"),
        "habits": [],
        "records": {},
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_data() -> bytes:
    with data_lock:
        return DATA_FILE.read_bytes()


def write_data(payload: object) -> None:
    normalized = json.dumps(payload, ensure_ascii=False, indent=2, separators=(",", ": "))
    with data_lock:
        temp = DATA_FILE.with_suffix(".json.tmp")
        temp.write_text(normalized, encoding="utf-8")
        temp.replace(DATA_FILE)
    publish_event.set()


def find_gh() -> str:
    discovered = shutil.which("gh")
    candidates = [
        discovered,
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Links\gh.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\GitHub.cli_Microsoft.Winget.Source_8wekyb3d8bbwe\bin\gh.exe"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return str(candidate)
    raise RuntimeError("GitHub CLI was not found. Run GitHub CLI login first.")


def publish_notification() -> None:
    request = urllib.request.Request(
        f"https://ntfy.sh/{NOTIFY_TOPIC}",
        data=b"updated",
        method="POST",
        headers={"Title": "Habit data updated"},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            response.read()
    except Exception as error:
        print(f"Live update notification failed: {error}")


def publish_data() -> None:
    with publish_lock:
        try:
            gh = find_gh()
            payload = json.loads(read_data().decode("utf-8"))
            encoded = base64.b64encode(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).decode("ascii")
            sha_result = subprocess.run(
                [gh, "api", GH_DATA_ENDPOINT, "--jq", ".sha"],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            if sha_result.returncode != 0:
                raise RuntimeError(sha_result.stderr.strip() or "Unable to read remote data SHA")
            body = {
                "message": f"Update habit data {time.strftime('%Y-%m-%d %H:%M:%S')}",
                "content": encoded,
                "sha": sha_result.stdout.strip(),
                "branch": "main",
            }
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".json", delete=False) as handle:
                json.dump(body, handle, ensure_ascii=False)
                payload_file = handle.name
            try:
                result = subprocess.run(
                    [gh, "api", "--method", "PUT", GH_DATA_ENDPOINT, "--input", payload_file],
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                )
            finally:
                Path(payload_file).unlink(missing_ok=True)
            if result.returncode != 0:
                raise RuntimeError(result.stderr.strip() or "GitHub API update failed")
            publish_notification()
            print(f"Synced local habit data ({time.strftime('%H:%M:%S')})")
        except Exception as error:
            print(f"Sync failed: {error}")


def publish_worker() -> None:
    while not stop_event.is_set():
        if not publish_event.wait(timeout=0.5):
            continue
        publish_event.clear()
        time.sleep(1.2)
        publish_data()
        if publish_event.is_set():
            continue


class Handler(BaseHTTPRequestHandler):
    server_version = "HabitTrackerLocal/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        return

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/data":
            try:
                body = read_data()
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception as error:
                self.send_json(500, {"error": str(error)})
            return

        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_error(403)
            return
        if not target.is_file():
            self.send_error(404)
            return

        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
            ".svg": "image/svg+xml",
        }.get(target.suffix.lower(), "application/octet-stream")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_PUT(self) -> None:
        if urlparse(self.path).path != "/api/data":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict) or not isinstance(payload.get("habits"), list):
                raise ValueError("Invalid habit data")
            write_data(payload)
            self.send_json(200, {"ok": True, "updatedAt": payload.get("updatedAt", "")})
        except Exception as error:
            self.send_json(400, {"error": str(error)})


def main() -> None:
    ensure_data_file()
    threading.Thread(target=publish_worker, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"本地习惯打卡服务已启动：{ORIGIN}")
    print("数据修改会自动同步到 GitHub Pages。关闭此窗口即可停止同步。")
    if os.environ.get("HABIT_TRACKER_NO_BROWSER") != "1":
        threading.Timer(0.8, lambda: webbrowser.open(ORIGIN)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop_event.set()
        server.server_close()


if __name__ == "__main__":
    main()

