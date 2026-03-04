/** API client for the UI Navigator backend. */

import type {
  SessionInfo,
  NavigateResult,
  ExecuteResult,
} from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `API error ${res.status}: ${errorBody || res.statusText}`
    );
  }

  return res.json() as Promise<T>;
}

/** Start a new browser session. */
export async function startSession(): Promise<SessionInfo> {
  return request<SessionInfo>("/api/session/start", { method: "POST" });
}

/** Close an existing browser session. */
export async function closeSession(sessionId: string): Promise<void> {
  await request(`/api/session/${sessionId}`, { method: "DELETE" });
}

/** Navigate the browser to a URL. */
export async function navigate(
  sessionId: string,
  url: string
): Promise<NavigateResult> {
  return request<NavigateResult>("/api/navigate", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, url }),
  });
}

/** Analyze current page and optionally execute actions. */
export async function execute(
  sessionId: string,
  userIntent: string,
  autoExecute: boolean
): Promise<ExecuteResult> {
  return request<ExecuteResult>("/api/execute", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      user_intent: userIntent,
      auto_execute: autoExecute,
    }),
  });
}

/** Get the current screenshot. */
export async function getScreenshot(
  sessionId: string
): Promise<{ screenshot: string; url: string }> {
  return request(`/api/screenshot/${sessionId}`);
}

/** Health check. */
export async function healthCheck(): Promise<{ status: string }> {
  return request("/health");
}
