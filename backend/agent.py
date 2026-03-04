"""UI Navigator Agent using Google GenAI SDK with Gemini 2.0 Flash multimodal."""

import json
import logging
import os
import re
from typing import Any, Optional

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are UI Navigator, an expert AI agent that analyzes browser screenshots and helps users interact with web interfaces.

When given a screenshot and a user intent, you MUST respond with ONLY a valid JSON object (no markdown, no code blocks, no extra text) in this exact structure:
{
  "analysis": "Detailed description of what you see in the screenshot - UI elements, content, current state",
  "plan": "Step-by-step plan of what actions you will take to fulfill the user intent",
  "actions": [
    {"type": "navigate", "url": "https://example.com"},
    {"type": "click", "x": 100, "y": 200},
    {"type": "type", "text": "search query"},
    {"type": "press_key", "key": "Enter"},
    {"type": "scroll", "direction": "down", "amount": 300}
  ],
  "response": "Natural language response to the user explaining what you found and what actions you are taking"
}

Action types available:
- navigate: {"type": "navigate", "url": "https://..."} - Navigate to a URL
- click: {"type": "click", "x": <number>, "y": <number>} - Click at pixel coordinates
- type: {"type": "type", "text": "<string>"} - Type text into focused element
- press_key: {"type": "press_key", "key": "<key>"} - Press a keyboard key (e.g., "Enter", "Tab", "Escape")
- scroll: {"type": "scroll", "direction": "down|up|left|right", "amount": <pixels>} - Scroll the page

Guidelines:
- Be precise with click coordinates based on what you see in the screenshot (1280x800 viewport)
- If the page is empty or blank, suggest navigating to a URL
- Always explain your reasoning in the analysis and plan fields
- The actions array can be empty if no actions are needed
- Respond ONLY with the JSON object, no other text"""


class UINavigatorAgent:
    """UI Navigator agent that uses Gemini 2.0 Flash to analyze screenshots and plan browser actions."""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        self._client = genai.Client(api_key=api_key)
        self._model = "gemini-2.0-flash"
        logger.info(f"UINavigatorAgent initialized with model: {self._model}")

    async def analyze_screenshot(
        self,
        screenshot_base64: str,
        user_intent: str,
        action_history: Optional[list[dict]] = None,
    ) -> dict[str, Any]:
        """
        Analyze a screenshot with user intent using Gemini multimodal.

        Args:
            screenshot_base64: Base64-encoded PNG screenshot
            user_intent: What the user wants to accomplish
            action_history: Previous actions taken in this session

        Returns:
            Dict with keys: analysis, plan, actions, response
        """
        history_text = ""
        if action_history:
            recent = action_history[-5:]  # Last 5 actions for context
            history_text = "\n\nPrevious actions taken:\n" + "\n".join(
                f"- {a.get('action', '')} -> {a.get('result', '')}"
                for a in recent
            )

        prompt = (
            f"User intent: {user_intent}{history_text}\n\n"
            "Analyze the screenshot and respond with the JSON object as instructed."
        )

        try:
            # Decode base64 to bytes for the image part
            import base64
            image_bytes = base64.b64decode(screenshot_base64)

            response = self._client.models.generate_content(
                model=self._model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part(
                                inline_data=types.Blob(
                                    mime_type="image/png",
                                    data=image_bytes,
                                )
                            ),
                            types.Part(text=prompt),
                        ],
                    )
                ],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                    max_output_tokens=2048,
                ),
            )

            raw_text = response.text.strip()
            logger.debug(f"Gemini raw response: {raw_text[:500]}")
            return self._parse_response(raw_text)

        except Exception as e:
            logger.error(f"Error calling Gemini API: {e}")
            return self._error_response(str(e))

    def _parse_response(self, raw_text: str) -> dict[str, Any]:
        """Parse Gemini's response, handling cases where it's not pure JSON."""
        # Try direct JSON parse first
        try:
            data = json.loads(raw_text)
            return self._validate_response(data)
        except json.JSONDecodeError:
            pass

        # Strip markdown code fences if present
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
        cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE).strip()
        try:
            data = json.loads(cleaned)
            return self._validate_response(data)
        except json.JSONDecodeError:
            pass

        # Try extracting first JSON object from the text
        match = re.search(r"\{.*\}", raw_text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
                return self._validate_response(data)
            except json.JSONDecodeError:
                pass

        # Fallback: return raw text as the response
        logger.warning("Could not parse Gemini response as JSON, returning raw text")
        return {
            "analysis": "Could not parse structured response",
            "plan": "Review the raw response below",
            "actions": [],
            "response": raw_text,
        }

    def _validate_response(self, data: dict) -> dict[str, Any]:
        """Ensure the response has all required fields with correct types."""
        return {
            "analysis": str(data.get("analysis", "")),
            "plan": str(data.get("plan", "")),
            "actions": data.get("actions", []) if isinstance(data.get("actions"), list) else [],
            "response": str(data.get("response", "")),
        }

    def _error_response(self, error_message: str) -> dict[str, Any]:
        """Return a structured error response."""
        return {
            "analysis": "Error occurred while analyzing the screenshot",
            "plan": "Unable to proceed due to an error",
            "actions": [],
            "response": f"I encountered an error: {error_message}. Please check your API key and try again.",
        }
