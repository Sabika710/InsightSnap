"""
SnapSync Enterprise — Windows Background Polling Agent
Usage: python client.py --email bob@demo.com --password pass123 --server http://localhost:8000
"""
import argparse
import logging
import re
import time
from datetime import datetime
from io import BytesIO

import requests

# Optional Windows-only imports
try:
    import win32gui
    WINDOWS = True
except ImportError:
    WINDOWS = False

try:
    import pyautogui
    PYAUTOGUI = True
except ImportError:
    PYAUTOGUI = False

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("snapsync_client.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Window scoring rules
# ---------------------------------------------------------------------------
SCORE_RULES: list[tuple[str, int]] = [
    # IDEs (90–95)
    (r"visual studio code|vscode",          95),
    (r"pycharm|intellij|webstorm|rider",    92),
    (r"android studio",                     90),
    (r"vim|neovim|emacs",                   93),
    (r"xcode",                              90),
    (r"sublime text|notepad\+\+",           85),
    # Dev tools (78–88)
    (r"terminal|powershell|cmd|bash|wsl",   88),
    (r"postman|insomnia|hoppscotch",        80),
    (r"docker desktop|k9s|lens",            82),
    (r"pgadmin|dbeaver|tableplus",          78),
    # Version control / PM (72–80)
    (r"github|gitlab|bitbucket",            78),
    (r"jira|linear|asana|trello|clickup",   75),
    (r"confluence|notion|obsidian",         72),
    # Design (80–88)
    (r"figma|sketch|adobe xd",              85),
    (r"photoshop|illustrator|after effects",80),
    (r"blender|unity|unreal engine",        88),
    # Docs (68–74)
    (r"google docs|google sheets|google slides", 72),
    (r"microsoft word|excel|powerpoint",    70),
    (r"libreoffice",                        68),
    # Comms (38–62)
    (r"zoom|google meet|webex|teams meeting",62),
    (r"slack",                              58),
    (r"microsoft teams",                    55),
    (r"gmail|outlook|thunderbird",          50),
    (r"discord",                            38),
    # Research (45–72)
    (r"stack overflow|mdn web docs|devdocs",72),
    (r"chatgpt|claude\.ai|copilot",         60),
    (r"wikipedia",                          52),
    (r"google",                             45),
    # Entertainment (10–20)
    (r"youtube",                            15),
    (r"netflix|prime video|disney|hulu",    10),
    (r"twitch|kick\.com",                   12),
    (r"spotify|apple music",                20),
    (r"reddit",                             14),
    (r"twitter|x\.com|instagram|facebook|tiktok", 10),
    (r"steam|epic games|battle\.net|roblox",10),
    # Generic browser (45)
    (r"chrome|firefox|edge|safari|brave",   75),
]
DEFAULT_SCORE = 40


def score_window(title: str) -> int:
    """Score a window title using the rule table."""
    lower = title.lower()
    for pattern, score in SCORE_RULES:
        if re.search(pattern, lower):
            return score
    return DEFAULT_SCORE


def extract_app_name(title: str) -> str:
    """Extract app name from window title (last segment after ' - ')."""
    parts = title.replace(" \u2013 ", " - ").split(" - ")
    name = parts[-1].strip() if parts else title.strip()
    return name[:40] if name else "Unknown"


def get_active_window_title() -> str:
    """Get the currently active window title."""
    if WINDOWS:
        try:
            hwnd = win32gui.GetForegroundWindow()
            return win32gui.GetWindowText(hwnd) or "Unknown"
        except Exception:
            return "Unknown"
    # Fallback for non-Windows (dev/testing)
    return "Visual Studio Code — snapsync/client.py"


def capture_screenshot() -> bytes | None:
    """Capture a screenshot and return PNG bytes."""
    if not PYAUTOGUI:
        logger.warning("pyautogui not available — skipping screenshot capture")
        return None
    try:
        img = pyautogui.screenshot()
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"Screenshot capture failed: {e}")
        return None


# ---------------------------------------------------------------------------
# SnapSync Client
# ---------------------------------------------------------------------------
class SnapSyncClient:
    def __init__(self, email: str, password: str, server: str):
        self.email = email
        self.password = password
        self.server = server.rstrip("/")
        self.token: str | None = None
        self.user_id: int | None = None
        self.consecutive_failures = 0
        self.MAX_FAILURES = 5

        self.HEARTBEAT_INTERVAL = 10     # seconds
        self.SCREENSHOT_INTERVAL = 20    

    def login(self) -> bool:
        """Authenticate and store JWT token."""
        try:
            resp = requests.post(
                f"{self.server}/api/login",
                json={"email": self.email, "password": self.password},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            self.token = data["access_token"]
            self.user_id = data["user_id"]
            logger.info(f"Logged in as {data['full_name']} (id={self.user_id}, role={data['role']})")
            return True
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}

    def _handle_401(self, action_name: str) -> bool:
        """Re-login on token expiry."""
        logger.warning(f"Token expired during {action_name}, re-logging in...")
        return self.login()

    def heartbeat(self) -> dict | None:
        """Send heartbeat and get monitoring state."""
        try:
            resp = requests.get(
                f"{self.server}/api/heartbeat",
                headers=self._headers(),
                timeout=5,
            )
            if resp.status_code == 401:
                if self._handle_401("heartbeat"):
                    return self.heartbeat()
                return None
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning(f"Heartbeat failed: {e}")
            return None

    def post_activity(self, window_title: str, score: float) -> bool:
        """Post activity ping (no screenshot)."""
        try:
            resp = requests.post(
                f"{self.server}/api/activity",
                json={"window_title": window_title, "productivity_score": score},
                headers=self._headers(),
                timeout=5,
            )
            if resp.status_code == 401:
                if self._handle_401("activity"):
                    return self.post_activity(window_title, score)
                return False
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"Activity post failed: {e}")
            return False

    def post_screenshot(self, img_bytes: bytes, window_title: str, score: float) -> bool:
        """Upload a screenshot file."""
        try:
            filename = f"screenshot_{self.user_id}_{int(time.time())}.png"
            files = {"file": (filename, img_bytes, "image/png")}
        
            data = {"window_title": window_title, "productivity_score": str(score)}
            resp = requests.post(
                f"{self.server}/api/screenshot",
                files=files,
                data=data,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=30,
            )
            if resp.status_code == 401:
                if self._handle_401("screenshot"):
                    return self.post_screenshot(img_bytes, window_title, score)
                return False
            resp.raise_for_status()
            return True
        except Exception as e:
            logger.warning(f"Screenshot upload failed: {e}")
            return False

    def run(self):
        """Main polling loop."""
        logger.info(f"SnapSync client starting — server: {self.server}")

        if not self.login():
            logger.critical("Cannot login. Check credentials and server URL.")
            return

        last_heartbeat = 0.0
        last_screenshot = 0.0

        logger.info("Polling loop started. Press Ctrl+C to stop.")
        try:
            while True:
                now = time.time()

                # --- Heartbeat cycle (every 60s) ---
                if now - last_heartbeat >= self.HEARTBEAT_INTERVAL:
                    title = get_active_window_title()
                    score = float(score_window(title))
                    truncated = title[:70]

                    hb = self.heartbeat()
                    if hb is None:
                        self.consecutive_failures += 1
                        logger.warning(
                            f"[FAIL {self.consecutive_failures}/{self.MAX_FAILURES}] "
                            f"Heartbeat failed | window: {truncated}"
                        )
                        if self.consecutive_failures >= self.MAX_FAILURES:
                            logger.critical(
                                f"Reached {self.MAX_FAILURES} consecutive failures. "
                                "Will keep trying..."
                            )
                    else:
                        self.consecutive_failures = 0
                        is_active = hb.get("is_active_monitoring", False)
                        status = "ACTIVE" if is_active else "BREAK"
                        logger.info(
                            f"[{status}] score={score:.0f} | window: {truncated}"
                        )

                        # Post activity only when active
                        if is_active:
                            self.post_activity(title, score)

                    last_heartbeat = now

                # --- Screenshot cycle (every 5 min, only if active) ---
                if now - last_screenshot >= self.SCREENSHOT_INTERVAL:
                    title = get_active_window_title()
                    score = float(score_window(title))
                    hb = self.heartbeat()
                    is_active = hb.get("is_active_monitoring", False) if hb else False

                    if is_active:
                        img_bytes = capture_screenshot()
                        if img_bytes:
                            ok = self.post_screenshot(img_bytes, title, score)
                            if ok:
                                logger.info(f"Screenshot uploaded | score={score:.0f} | window: {title[:70]}")
                            else:
                                logger.warning("Screenshot upload failed")
                        else:
                            logger.info("No screenshot captured (pyautogui unavailable), posting activity only")
                            self.post_activity(title, score)
                    else:
                        logger.info("Monitoring paused — skipping screenshot")

                    last_screenshot = now

                time.sleep(5)  # small sleep to avoid busy-waiting

        except KeyboardInterrupt:
            logger.info("SnapSync client stopped by user (KeyboardInterrupt).")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SnapSync Enterprise Windows Client")
    parser.add_argument("--email", required=True, help="Employee email address")
    parser.add_argument("--password", required=True, help="Employee password")
    parser.add_argument(
        "--server",
        default="http://localhost:8000",
        help="Backend server URL (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    client = SnapSyncClient(
        email=args.email,
        password=args.password,
        server=args.server,
    )
    client.run()