/** Shared TypeScript types for UI Navigator */

export interface SessionInfo {
  session_id: string;
  status: string;
}

export interface NavigateResult {
  status: string;
  screenshot: string;
  url: string;
}

export interface ExecuteResult {
  session_id: string;
  screenshot: string;
  analysis: string;
  plan: string;
  actions: BrowserAction[];
  response: string;
  executed_actions: ExecutedAction[];
  current_url: string | null;
}

export interface BrowserAction {
  type: "click" | "type" | "navigate" | "scroll" | "press_key";
  x?: number;
  y?: number;
  text?: string;
  url?: string;
  direction?: "up" | "down" | "left" | "right";
  amount?: number;
  key?: string;
}

export interface ExecutedAction {
  action: BrowserAction;
  result: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  intent: string;
  response: string;
  actions: BrowserAction[];
  executedActions: ExecutedAction[];
  screenshot: string;
}
