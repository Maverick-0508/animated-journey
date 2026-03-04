"""Browser automation using Playwright for UI Navigator Agent."""

import asyncio
import base64
import logging
from io import BytesIO
from typing import Optional

from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Playwright

logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages a Playwright browser instance for screenshot capture and action execution."""

    def __init__(self):
        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    async def launch(self) -> None:
        """Launch the browser instance."""
        try:
            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-accelerated-2d-canvas",
                    "--no-first-run",
                    "--no-zygote",
                    "--disable-gpu",
                ],
            )
            self._context = await self._browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
            )
            self._page = await self._context.new_page()
            logger.info("Browser launched successfully")
        except Exception as e:
            logger.error(f"Failed to launch browser: {e}")
            raise

    async def navigate(self, url: str) -> None:
        """Navigate to the given URL."""
        if not self._page:
            raise RuntimeError("Browser not launched. Call launch() first.")
        try:
            # Add scheme if missing
            if not url.startswith(("http://", "https://")):
                url = "https://" + url
            await self._page.goto(url, wait_until="domcontentloaded", timeout=30000)
            # Small wait for any dynamic content
            await self._page.wait_for_timeout(1500)
            logger.info(f"Navigated to: {url}")
        except Exception as e:
            logger.error(f"Failed to navigate to {url}: {e}")
            raise

    async def take_screenshot(self) -> str:
        """Capture a screenshot and return as base64-encoded PNG string."""
        if not self._page:
            raise RuntimeError("Browser not launched. Call launch() first.")
        try:
            screenshot_bytes = await self._page.screenshot(
                type="png", full_page=False, timeout=10000
            )
            encoded = base64.b64encode(screenshot_bytes).decode("utf-8")
            logger.info("Screenshot captured successfully")
            return encoded
        except Exception as e:
            logger.error(f"Failed to take screenshot: {e}")
            raise

    async def execute_action(self, action: dict) -> str:
        """Execute a browser action based on the action dict."""
        if not self._page:
            raise RuntimeError("Browser not launched. Call launch() first.")

        action_type = action.get("type", "").lower()
        result = f"Executed action: {action_type}"

        try:
            if action_type == "click":
                x = int(action.get("x", 0))
                y = int(action.get("y", 0))
                await self._page.mouse.click(x, y)
                await self._page.wait_for_timeout(800)
                result = f"Clicked at ({x}, {y})"

            elif action_type == "type":
                text = action.get("text", "")
                await self._page.keyboard.type(text)
                await self._page.wait_for_timeout(300)
                result = f"Typed: {text}"

            elif action_type == "navigate":
                url = action.get("url", "")
                await self.navigate(url)
                result = f"Navigated to: {url}"

            elif action_type == "scroll":
                direction = action.get("direction", "down").lower()
                amount = int(action.get("amount", 300))
                delta_y = amount if direction == "down" else -amount
                delta_x = 0
                if direction == "right":
                    delta_x = amount
                    delta_y = 0
                elif direction == "left":
                    delta_x = -amount
                    delta_y = 0
                await self._page.mouse.wheel(delta_x, delta_y)
                await self._page.wait_for_timeout(500)
                result = f"Scrolled {direction}"

            elif action_type == "press_key":
                key = action.get("key", "")
                await self._page.keyboard.press(key)
                await self._page.wait_for_timeout(500)
                result = f"Pressed key: {key}"

            else:
                result = f"Unknown action type: {action_type}"
                logger.warning(result)

        except Exception as e:
            result = f"Action '{action_type}' failed: {e}"
            logger.error(result)

        return result

    async def get_current_url(self) -> str:
        """Return the current page URL."""
        if not self._page:
            return ""
        return self._page.url

    async def close(self) -> None:
        """Close the browser instance and release resources."""
        try:
            if self._context:
                await self._context.close()
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
            logger.info("Browser closed successfully")
        except Exception as e:
            logger.error(f"Error closing browser: {e}")
        finally:
            self._page = None
            self._context = None
            self._browser = None
            self._playwright = None
