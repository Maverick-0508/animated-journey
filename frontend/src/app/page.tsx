"use client";

import { useState, useRef, useCallback } from "react";
import {
  Globe,
  Play,
  StopCircle,
  Send,
  Camera,
  Zap,
  Eye,
  List,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import * as api from "@/lib/api";
import type { ExecuteResult, HistoryEntry, BrowserAction } from "@/types";

function ActionBadge({ action }: { action: BrowserAction }) {
  const colors: Record<string, string> = {
    click: "bg-blue-100 text-blue-700",
    type: "bg-purple-100 text-purple-700",
    navigate: "bg-green-100 text-green-700",
    scroll: "bg-yellow-100 text-yellow-700",
    press_key: "bg-pink-100 text-pink-700",
  };
  const color = colors[action.type] ?? "bg-gray-100 text-gray-700";

  const label = () => {
    switch (action.type) {
      case "click":
        return `Click (${action.x}, ${action.y})`;
      case "type":
        return `Type "${action.text}"`;
      case "navigate":
        return `Go to ${action.url}`;
      case "scroll":
        return `Scroll ${action.direction}`;
      case "press_key":
        return `Press ${action.key}`;
      default:
        return action.type;
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label()}
    </span>
  );
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("https://google.com");
  const [intent, setIntent] = useState("");
  const [autoExecute, setAutoExecute] = useState(false);

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [lastResult, setLastResult] = useState<ExecuteResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  const intentRef = useRef<HTMLTextAreaElement>(null);

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  };

  const handleStartSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await api.startSession();
      setSessionId(session.session_id);
      setIsSessionActive(true);
      setScreenshot(null);
      setLastResult(null);
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStopSession = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      await api.closeSession(sessionId);
    } catch {
      // ignore close errors
    } finally {
      setSessionId(null);
      setIsSessionActive(false);
      setScreenshot(null);
      setLastResult(null);
      setCurrentUrl("");
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleNavigate = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.navigate(sessionId, url);
      setScreenshot(result.screenshot);
      setCurrentUrl(result.url);
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, url]);

  const handleExecute = useCallback(async () => {
    if (!sessionId || !intent.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.execute(sessionId, intent, autoExecute);
      setScreenshot(result.screenshot);
      setLastResult(result);
      if (result.current_url) setCurrentUrl(result.current_url);

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        intent,
        response: result.response,
        actions: result.actions,
        executedActions: result.executed_actions,
        screenshot: result.screenshot,
      };
      setHistory((prev) => [entry, ...prev]);
    } catch (e: unknown) {
      showError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, intent, autoExecute]);

  const toggleHistory = (id: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">UI Navigator</h1>
              <p className="text-xs text-purple-300">AI-Powered Visual Browser Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSessionActive && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Session active
              </span>
            )}
            {!isSessionActive ? (
              <button
                onClick={handleStartSession}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start Session
              </button>
            ) : (
              <button
                onClick={handleStopSession}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <StopCircle className="w-4 h-4" />
                End Session
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left panel – controls */}
        <aside className="flex flex-col gap-4">
          {/* URL Input */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" /> Navigation
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && isSessionActive && handleNavigate()}
                placeholder="https://example.com"
                className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-purple-400 transition-colors"
              />
              <button
                onClick={handleNavigate}
                disabled={!isSessionActive || isLoading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              >
                Go
              </button>
            </div>
            {currentUrl && (
              <p className="mt-2 text-xs text-white/40 truncate">
                📍 {currentUrl}
              </p>
            )}
          </div>

          {/* Intent Input */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4" /> User Intent
            </h2>
            <textarea
              ref={intentRef}
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder="Describe what you want to do on this page…"
              rows={4}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm placeholder-white/30 focus:outline-none focus:border-purple-400 transition-colors resize-none"
            />

            {/* Auto-execute toggle */}
            <div className="flex items-center justify-between mt-3 mb-4">
              <span className="text-xs text-white/60">Auto-execute actions</span>
              <button
                onClick={() => setAutoExecute((v) => !v)}
                className="flex items-center gap-1.5 text-xs"
              >
                {autoExecute ? (
                  <ToggleRight className="w-6 h-6 text-purple-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-white/40" />
                )}
                <span className={autoExecute ? "text-purple-300" : "text-white/40"}>
                  {autoExecute ? "On" : "Off"}
                </span>
              </button>
            </div>

            <button
              onClick={handleExecute}
              disabled={!isSessionActive || !intent.trim() || isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isLoading ? "Analyzing…" : "Execute"}
            </button>
          </div>

          {/* Agent Response Card */}
          {lastResult && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <Eye className="w-4 h-4" /> Agent Analysis
              </h2>

              <div>
                <p className="text-xs font-medium text-white/50 mb-1">What I see</p>
                <p className="text-xs text-white/80 leading-relaxed">{lastResult.analysis}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-white/50 mb-1">Plan</p>
                <p className="text-xs text-white/80 leading-relaxed">{lastResult.plan}</p>
              </div>

              {lastResult.actions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/50 mb-2">Suggested Actions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lastResult.actions.map((a, i) => (
                      <ActionBadge key={i} action={a} />
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-white/10 pt-3">
                <p className="text-xs font-medium text-white/50 mb-1">Response</p>
                <p className="text-xs text-emerald-300 leading-relaxed">{lastResult.response}</p>
              </div>

              {lastResult.executed_actions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-white/50 mb-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-400" /> Executed
                  </p>
                  <ul className="space-y-1">
                    {lastResult.executed_actions.map((ea, i) => (
                      <li key={i} className="text-xs text-white/60">
                        <ActionBadge action={ea.action} />
                        <span className="ml-1 text-white/40">→ {ea.result}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right panel – screenshot + history */}
        <div className="flex flex-col gap-6">
          {/* Screenshot display */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <Camera className="w-4 h-4" /> Browser View
              </span>
              {screenshot && (
                <span className="text-xs text-white/40">1280 × 800</span>
              )}
            </div>
            <div className="relative bg-black/40 min-h-[400px] flex items-center justify-center">
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <p className="text-sm text-purple-300">Processing…</p>
                  </div>
                </div>
              )}
              {screenshot ? (
                <img
                  src={`data:image/png;base64,${screenshot}`}
                  alt="Browser screenshot"
                  className="w-full h-auto"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/30">
                  <Camera className="w-16 h-16" />
                  <p className="text-sm">
                    {isSessionActive
                      ? "Navigate to a URL to see the browser view"
                      : "Start a session to begin"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action history */}
          {history.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <span className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                  <List className="w-4 h-4" /> Action History
                  <span className="text-xs text-white/40">({history.length})</span>
                </span>
                <button
                  onClick={() => setHistory([])}
                  className="text-white/30 hover:text-red-400 transition-colors"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <ul className="divide-y divide-white/5 max-h-[480px] overflow-y-auto">
                {history.map((entry) => (
                  <li key={entry.id} className="p-4">
                    <button
                      className="w-full text-left"
                      onClick={() => toggleHistory(entry.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {entry.intent}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                            {entry.response}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="flex items-center gap-1 text-xs text-white/30">
                            <Clock className="w-3 h-3" />
                            {entry.timestamp}
                          </span>
                          {expandedHistory.has(entry.id) ? (
                            <ChevronUp className="w-4 h-4 text-white/30" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-white/30" />
                          )}
                        </div>
                      </div>
                    </button>

                    {expandedHistory.has(entry.id) && (
                      <div className="mt-3 space-y-3">
                        {entry.actions.length > 0 && (
                          <div>
                            <p className="text-xs text-white/40 mb-1">Actions suggested:</p>
                            <div className="flex flex-wrap gap-1">
                              {entry.actions.map((a, i) => (
                                <ActionBadge key={i} action={a} />
                              ))}
                            </div>
                          </div>
                        )}
                        {entry.executedActions.length > 0 && (
                          <div>
                            <p className="text-xs text-white/40 mb-1 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-400" /> Executed:
                            </p>
                            <ul className="space-y-0.5">
                              {entry.executedActions.map((ea, i) => (
                                <li key={i} className="text-xs text-white/50">
                                  <ActionBadge action={ea.action} />
                                  <span className="ml-1 text-white/30">→ {ea.result}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="rounded-lg overflow-hidden border border-white/10">
                          <img
                            src={`data:image/png;base64,${entry.screenshot}`}
                            alt="Snapshot"
                            className="w-full h-auto"
                          />
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
