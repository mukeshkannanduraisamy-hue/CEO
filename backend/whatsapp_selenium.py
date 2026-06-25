import os
import sys
import time
import json
import random
import uuid
import platform
import pandas as pd
from datetime import datetime
from urllib.parse import quote
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

# On Linux servers, Chrome binary may be at a fixed path
IS_LINUX = platform.system() == "Linux"
CHROME_BIN = "/usr/bin/google-chrome" if IS_LINUX else None

# Virtual display (Xvfb) for headless Linux — avoids need for --headless flag
# which WhatsApp Web sometimes detects and blocks.
_DISPLAY = None
if IS_LINUX:
    try:
        from pyvirtualdisplay import Display
        _DISPLAY = Display(visible=False, size=(1920, 1080))
        _DISPLAY.start()
        print("[WA Engine] Virtual display started (Xvfb)")
    except Exception as _e:
        print(f"[WA Engine] pyvirtualdisplay not available, falling back to --headless: {_e}")
        _DISPLAY = None

# ─── Anti-Ban Configuration ────────────────────────────────────────────────────
SEND_DELAY = 30          # Seconds to wait for send button to appear
MIN_DELAY  = 12          # Min seconds between messages
MAX_DELAY  = 25          # Max seconds between messages
BURST_AFTER = 15         # How many messages before a long pause
BURST_MIN  = 60          # Min seconds for burst pause
BURST_MAX  = 120         # Max seconds for burst pause
RETRY_COUNT = 3          # Retries per number

class WhatsAppSeleniumEngine:
    def __init__(self, data_dir="C:\\CEO_WA_Session"):
        self.data_dir = os.path.abspath(data_dir)
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        self.driver = None
        self.status = "initializing"
        self.qr_data = None
        self.campaigns = {}

    # ─── Driver Setup ────────────────────────────────────────────────────────────

    def get_driver(self, headless=False):
        options = Options()
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument(f"--user-data-dir={self.data_dir}")
        # Reduce bot detection fingerprint
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation", "enable-logging"])
        options.add_experimental_option("useAutomationExtension", False)

        # Point to system Chrome on Linux
        if IS_LINUX and CHROME_BIN and os.path.exists(CHROME_BIN):
            options.binary_location = CHROME_BIN

        # Use --headless only if Xvfb is not running
        if headless and _DISPLAY is None:
            options.add_argument("--headless=new")

        # Selenium 4.6+ has built-in driver management (SeleniumManager)
        # It auto-detects the correct ChromeDriver for the current OS/arch.
        # No need for webdriver_manager on Windows.
        try:
            from selenium.webdriver.chrome.service import Service as ChromeService
            from webdriver_manager.chrome import ChromeDriverManager
            driver_path = ChromeDriverManager().install()
            
            # Fix for webdriver_manager returning THIRD_PARTY_NOTICES or directory instead of exe
            if not driver_path.endswith(".exe"):
                # Check if it's a file but not exe, or a directory
                base_dir = os.path.dirname(driver_path)
                exe_path = os.path.join(base_dir, "chromedriver.exe")
                if os.path.exists(exe_path):
                    driver_path = exe_path
                else:
                    # Try one more level up if it's in a subfolder like chromedriver-win32
                    exe_path = os.path.join(driver_path, "chromedriver.exe")
                    if os.path.exists(exe_path):
                        driver_path = exe_path

            service = ChromeService(executable_path=driver_path)
            driver = webdriver.Chrome(service=service, options=options)
        except Exception as e:
            print(f"[WA Engine] webdriver_manager failed: {e}. Falling back to default...")
            # Fallback: let Selenium 4 SeleniumManager handle it automatically
            try:
                driver = webdriver.Chrome(options=options)
            except Exception as e2:
                print(f"[WA Engine] Default fallback failed: {e2}")
                raise e2

        # Mask navigator.webdriver flag
        driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        return driver

    def start_driver(self, headless=False):
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
        self.driver = self.get_driver(headless=headless)
        self.status = "authenticating"
        self.driver.get("https://web.whatsapp.com")

    # ─── Status Check ────────────────────────────────────────────────────────────

    def check_status(self):
        if not self.driver:
            return "disconnected"
        try:
            # Check for multiple indicators of being logged in
            WebDriverWait(self.driver, 0.5).until(
                lambda d: d.find_elements(By.ID, "pane-side") or 
                          d.find_elements(By.XPATH, "//div[@aria-label='Chat list']") or
                          d.find_elements(By.XPATH, "//div[@contenteditable='true'][@data-tab='3']")
            )
            self.status = "ready"
            self.qr_data = None
        except:
            # Check if we are in the "Loading" state (spinner or progress bar)
            loading = self.driver.find_elements(By.XPATH, "//div[@role='progressbar']") or \
                      self.driver.find_elements(By.XPATH, "//progress")
            if loading:
                self.status = "authenticating"
                self.qr_data = None
            else:
                try:
                    WebDriverWait(self.driver, 0.5).until(
                        EC.presence_of_element_located((By.XPATH, "//canvas"))
                    )
                    self.status = "qr_ready"
                    # Extract the QR canvas as base64 image so the frontend can display it
                    try:
                        self.qr_data = self.driver.execute_script(
                            "var canvas = document.querySelector('canvas');"
                            "return canvas ? canvas.toDataURL('image/png') : null;"
                        )
                    except:
                        self.qr_data = None
                except:
                    self.status = "authenticating"
                    self.qr_data = None
        return self.status

    # ─── Send a Single Text Message (URL method with retries) ────────────────────

    def _send_text(self, phone: str, message: str) -> bool:
        """
        Open the WhatsApp Web URL for `phone` with pre-filled `message`,
        wait for the send button, click it. Retries up to RETRY_COUNT times.
        Returns True on success.
        """
        url = f"https://web.whatsapp.com/send?phone={phone}&text={quote(message)}"
        for attempt in range(1, RETRY_COUNT + 1):
            try:
                self.driver.get(url)
                click_btn = WebDriverWait(self.driver, SEND_DELAY).until(
                    EC.element_to_be_clickable((
                        By.XPATH,
                        "//button[@aria-label='Send'] | //button[@data-testid='compose-btn-send']"
                    ))
                )
                time.sleep(2)
                click_btn.click()
                time.sleep(3)
                return True
            except Exception as e:
                print(f"  Attempt {attempt}/{RETRY_COUNT} failed for {phone}: {e}")
                if attempt < RETRY_COUNT:
                    time.sleep(5)
        return False

    # ─── Send Attachment ─────────────────────────────────────────────────────────

    def send_attachment(self, file_path: str):
        """
        Click the attachment (plus) button, select the file via the hidden file input,
        then click send on the media preview screen.
        """
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Attachment not found: {abs_path}")

        # 1. Find and click the attachment / plus button
        attach_selectors = [
            "//span[@data-icon='plus-rounded']",
            "//span[@data-icon='wds-ic-plus-filled']",
            "//div[@aria-label='Plus']",
            "//button[@aria-label='Plus']",
            "//span[@data-icon='plus']",
            "//div[@title='Attach']",
            "//span[@data-icon='clip']",
            "//div[@aria-label='Attach']",
            "//div[@role='button' and .//span[contains(@data-icon, 'plus') or contains(@data-icon, 'clip')]]",
            "//footer//div[@role='button' and .//span[contains(@data-icon, 'plus') or contains(@data-icon, 'clip')]]",
        ]

        attach_btn = None
        for sel in attach_selectors:
            try:
                attach_btn = WebDriverWait(self.driver, 5).until(
                    EC.element_to_be_clickable((By.XPATH, sel))
                )
                if attach_btn:
                    break
            except:
                continue

        if not attach_btn:
            raise Exception("Could not find attachment button")

        attach_btn.click()
        time.sleep(2)

        # 2. Upload file via the hidden file input
        file_input = WebDriverWait(self.driver, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='file']"))
        )
        file_input.send_keys(abs_path)

        # 3. Wait for media preview and click Send
        send_selectors = [
            "//span[@data-icon='wds-ic-send-filled']",
            "//span[@data-icon='send']",
            "//div[@aria-label='Send']",
            "//button[@aria-label='Send']",
            "//span[contains(@data-icon,'send')]/parent::div[@role='button']",
            "//span[contains(@data-icon,'send')]/parent::button",
        ]

        send_btn = None
        for sel in send_selectors:
            try:
                send_btn = WebDriverWait(self.driver, 25).until(
                    EC.element_to_be_clickable((By.XPATH, sel))
                )
                if send_btn:
                    break
            except:
                continue

        if not send_btn:
            raise Exception("Could not find send button on media preview screen")

        time.sleep(2)
        send_btn.click()
        time.sleep(5)  # Let the upload finalise

    # ─── Campaign Runner ─────────────────────────────────────────────────────────

    def run_campaign(
        self,
        campaign_id: str,
        contacts: list,
        message_template: str,
        attachment_path: str = None,
        delay_range: tuple = (MIN_DELAY, MAX_DELAY),
    ):
        """
        Sends `message_template` (with {column} placeholders) to every contact.
        Uses anti-ban randomised delays and a burst-pause every BURST_AFTER messages.
        Optionally attaches `attachment_path` after each text message.
        """
        camp = self.campaigns.get(campaign_id)
        if not camp:
            return

        camp["status"] = "running"
        camp["started_at"] = datetime.now().isoformat()
        sent_count = 0  # For burst-pause tracking

        try:
            for idx, contact in enumerate(contacts):
                if camp.get("status") == "cancelled":
                    break

                # ── Resolve target (phone or group name) ──────────────────────────
                if isinstance(contact, dict):
                    raw_phone = (
                        contact.get("Phone")
                        or contact.get("phone")
                        or contact.get("Number")
                        or contact.get("number")
                        or ""
                    )
                    target = str(raw_phone).strip()
                else:
                    # It's a string (group name)
                    target = str(contact).strip()

                # Normalise if it looks like a phone number
                import re
                if target.isdigit() or (target.startswith('+') and target[1:].isdigit()):
                    target = re.sub(r"[\s\-().+]", "", target)
                    if len(target) == 10 and target.isdigit():
                        target = "91" + target

                if not target:
                    camp["failed"] += 1
                    camp["errors"].append(f"Empty target at index {idx}")
                    continue

                print(f"\n[{campaign_id}] {idx+1}/{len(contacts)} -> Sending to {target}")

                # ── Personalise message ───────────────────────────────────────────
                msg = message_template
                if isinstance(contact, dict):
                    for col, val in contact.items():
                        msg = msg.replace(f"{{{col}}}", str(val) if val is not None else "")

                # ── Send text (with retries) ──────────────────────────────────────
                success = self._send_text(target, msg)

                if success:
                    # ── Send attachment if provided ───────────────────────────────
                    if attachment_path and os.path.exists(attachment_path):
                        try:
                            self.send_attachment(attachment_path)
                            print(f"  OK: Attachment sent to {target}")
                        except Exception as ae:
                            print(f"  FAIL: Attachment failed for {target}: {ae}")
                            # Don't count as failure — text was sent successfully

                    camp["sent"] += 1
                    sent_count += 1
                    print(f"  OK: Message sent to {target}")
                else:
                    camp["failed"] += 1
                    camp["errors"].append(f"{target}: failed after {RETRY_COUNT} retries")
                    print(f"  FAIL: Giving up on {target}")

                # ── Burst pause ───────────────────────────────────────────────────
                if sent_count > 0 and sent_count % BURST_AFTER == 0:
                    burst_pause = random.uniform(BURST_MIN, BURST_MAX)
                    print(f"\n  [Anti-Ban] Burst pause: {burst_pause:.0f}s after {sent_count} messages...")
                    time.sleep(burst_pause)
                else:
                    # Normal randomised delay between messages
                    delay = random.uniform(*delay_range)
                    print(f"  [Delay] {delay:.1f}s")
                    time.sleep(delay)

            camp["status"] = "completed" if camp.get("status") != "cancelled" else "cancelled"
        except Exception as e:
            print(f"[{campaign_id}] FATAL ERROR: {e}")
            camp["status"] = "failed"
            camp["errors"].append(f"Fatal error: {str(e)}")
        finally:
            camp["finished_at"] = datetime.now().isoformat()
            print(f"\n[{campaign_id}] Done — sent={camp['sent']} failed={camp['failed']}")

    # ─── Group Fetching ──────────────────────────────────────────────────────────

    def get_groups(self):
        """
        Scrapes the side pane for visible group chats.
        Returns a list of {id, name} objects.
        """
        if not self.driver or self.status != "ready":
            return []

        try:
            # Script to find all chat titles in the side pane
            # We look for spans with a title attribute inside the pane-side div
            script = """
            const chats = [];
            // Try to find the side pane
            const side = document.querySelector('#side') || document.querySelector('#pane-side') || document.body;
            const titles = side.querySelectorAll('span[title]');
            titles.forEach(t => {
                const name = t.getAttribute('title');
                // Heuristic: Chat names are visible spans where the text matches the title
                if (name && name.length > 0 && t.innerText === name && t.offsetParent !== null) {
                    // Avoid common UI buttons like "Status", "New Chat", etc.
                    const text = name.toLowerCase();
                    if (['status', 'new chat', 'communities', 'channels', 'archived', 'starred'].includes(text)) return;
                    
                    let subtitle = "";
                    try {
                        // Navigate to the chat row to find the second line of text (participants or last message)
                        const row = t.closest('div[role="listitem"]') || t.parentElement.parentElement.parentElement.parentElement;
                        const subSpan = row.querySelector('div[dir="ltr"] span, div[dir="auto"] span');
                        if (subSpan && subSpan.innerText !== name) {
                            subtitle = subSpan.innerText;
                        }
                    } catch(e) {}
                    
                    chats.push({ 
                        id: name, 
                        name: name, 
                        participants: subtitle || "Chat" 
                    });
                }
            });
            return chats;
            """
            groups = self.driver.execute_script(script)
            # Remove duplicates and empty names
            seen = set()
            unique_groups = []
            for g in groups:
                if g['name'] and g['name'] not in seen:
                    unique_groups.append(g)
                    seen.add(g['name'])
            return unique_groups
        except Exception as e:
            print(f"[WA Engine] Error fetching groups: {e}")
            return []

    def scrape_group_participants(self, group_name: str):
        """
        Harder logic: Click the group, open info, and scrape the participant list.
        """
        if not self.driver or self.status != "ready":
            raise Exception("WhatsApp not ready")

        try:
            # 1. Search and Click the group
            search_box = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.XPATH, "//div[@contenteditable='true'][@data-tab='3']"))
            )
            search_box.clear()
            search_box.send_keys(group_name)
            time.sleep(2)
            search_box.send_keys(Keys.ENTER)
            time.sleep(2)

            # 2. Click group header to open info
            header = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//header[@id='main']//div[@role='button']"))
            )
            header.click()
            time.sleep(2)

            # 3. Look for "Participants" or numbers in the right pane
            # This is tricky because the pane is lazy loaded.
            # We will scroll a bit in the right pane
            script = """
            const results = [];
            const infoPane = document.querySelector('div[data-testid="drawer-right"]');
            if (infoPane) {
                const spans = infoPane.querySelectorAll('span[dir="auto"]');
                spans.forEach(s => {
                    const text = s.innerText;
                    // Phone numbers often have + or are numeric
                    if (text.includes('+') || (text.length > 8 && /^\d+$/.test(text.replace(/\s/g,'')))) {
                        results.push(text);
                    }
                });
            }
            return results;
            """
            participants = self.driver.execute_script(script)
            
            # Close the info pane to return to normal state
            try:
                close_btn = self.driver.find_element(By.XPATH, "//div[@data-testid='drawer-right']//button")
                close_btn.click()
            except:
                pass

            return list(set(participants))
        except Exception as e:
            print(f"[WA Engine] Error scraping participants for {group_name}: {e}")
            raise e
