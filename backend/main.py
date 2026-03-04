"""FastAPI backend for UI Navigator AI Agent."""

import logging
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agent import UINavigatorAgent
from browser import BrowserManager

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="UI Navigator API",
    description="AI-powered browser automation agent using Gemini multimodal",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage: session_id -> {browser, agent, action_history}
sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class NavigateRequest(BaseModel):
    session_id: str
    url: str


class ExecuteRequest(BaseModel):
    session_id: str
    user_intent: str
    auto_execute: bool = False


class ExecuteResponse(BaseModel):
    session_id: str
    screenshot: str
    analysis: str
    plan: str
    actions: list[dict]
    response: str
    executed_actions: list[dict]
    current_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _get_session(session_id: str) -> dict:
    """Retrieve session or raise 404."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return session


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ui-navigator-backend", "version": "1.0.0"}


@app.post("/api/session/start")
async def start_session():
    """Start a new browser session and return its ID."""
    session_id = str(uuid.uuid4())
    try:
        browser = BrowserManager()
        await browser.launch()

        # Initialise the agent (validates API key)
        agent = UINavigatorAgent()

        sessions[session_id] = {
            "browser": browser,
            "agent": agent,
            "action_history": [],
        }
        logger.info(f"Session started: {session_id}")
        return {"session_id": session_id, "status": "started"}
    except Exception as e:
        logger.error(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/session/{session_id}")
async def close_session(session_id: str):
    """Close a browser session and release resources."""
    session = _get_session(session_id)
    try:
        await session["browser"].close()
        del sessions[session_id]
        logger.info(f"Session closed: {session_id}")
        return {"status": "closed", "session_id": session_id}
    except Exception as e:
        logger.error(f"Failed to close session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/navigate")
async def navigate(request: NavigateRequest):
    """Navigate the browser to a URL and return a screenshot."""
    session = _get_session(request.session_id)
    browser: BrowserManager = session["browser"]
    try:
        await browser.navigate(request.url)
        screenshot = await browser.take_screenshot()
        current_url = await browser.get_current_url()

        session["action_history"].append(
            {"action": f"navigate({request.url})", "result": "success"}
        )

        return {
            "status": "success",
            "screenshot": screenshot,
            "url": current_url,
        }
    except Exception as e:
        logger.error(f"Navigation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/execute", response_model=ExecuteResponse)
async def execute(request: ExecuteRequest):
    """
    Take a screenshot, analyze it with Gemini, optionally execute returned actions,
    and return the full result.
    """
    session = _get_session(request.session_id)
    browser: BrowserManager = session["browser"]
    agent: UINavigatorAgent = session["agent"]
    action_history: list = session["action_history"]

    try:
        # Capture current state
        screenshot = await browser.take_screenshot()

        # Ask Gemini to analyze + plan
        ai_result = await agent.analyze_screenshot(
            screenshot_base64=screenshot,
            user_intent=request.user_intent,
            action_history=action_history,
        )

        executed_actions: list[dict] = []

        # Optionally execute the suggested actions
        if request.auto_execute and ai_result.get("actions"):
            for action in ai_result["actions"]:
                result_msg = await browser.execute_action(action)
                executed_actions.append({"action": action, "result": result_msg})
                action_history.append(
                    {"action": str(action), "result": result_msg}
                )

            # Take a fresh screenshot after actions
            screenshot = await browser.take_screenshot()

        # Record this interaction in history
        action_history.append(
            {
                "action": f"analyze: {request.user_intent}",
                "result": ai_result.get("response", "")[:200],
            }
        )

        current_url = await browser.get_current_url()

        return ExecuteResponse(
            session_id=request.session_id,
            screenshot=screenshot,
            analysis=ai_result.get("analysis", ""),
            plan=ai_result.get("plan", ""),
            actions=ai_result.get("actions", []),
            response=ai_result.get("response", ""),
            executed_actions=executed_actions,
            current_url=current_url,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Execute failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/screenshot/{session_id}")
async def get_screenshot(session_id: str):
    """Return the current screenshot for a session."""
    session = _get_session(session_id)
    browser: BrowserManager = session["browser"]
    try:
        screenshot = await browser.take_screenshot()
        current_url = await browser.get_current_url()
        return {"screenshot": screenshot, "url": current_url}
    except Exception as e:
        logger.error(f"Screenshot failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
