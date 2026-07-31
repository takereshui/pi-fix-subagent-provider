/**
 * fix-subagent-provider — Neutralize pi's model auto-routing.
 *
 * Problem: pi auto-routes model IDs to their "native" providers
 * (gemini-* → google, claude-* → anthropic, gpt-* → openai, etc.)
 * even when given an explicit "hub/" prefix. The native providers in
 * models.json are empty shells (same hub baseUrl, no models, no auth)
 * so subagents fail with "No API key found for <provider>".
 *
 * We cannot unregister these proxies because that would restore
 * built-in provider catalogs that need real API keys.
 *
 * Fix: Fill every proxy provider with hub's models + auth so that
 * whichever provider pi resolves to, it finds working credentials.
 * Auto-routing becomes harmless instead of fatal.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface ProviderEntry {
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  compat?: Record<string, unknown>;
  models?: ModelEntry[];
}

interface ModelEntry {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  cost?: Record<string, unknown>;
}

interface ModelsJson {
  providers: Record<string, ProviderEntry>;
}

function loadModelsJson(): ModelsJson | null {
  try {
    const raw = readFileSync(
      join(homedir(), ".pi", "agent", "models.json"),
      "utf-8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function (pi: ExtensionAPI) {
  const cfg = loadModelsJson();
  if (!cfg) return;

  const hub = cfg.providers["hub"];
  if (!hub?.baseUrl || !hub?.models?.length) return;

  const hubUrl = hub.baseUrl;
  const hubKey = hub.apiKey;
  const hubApi = hub.api || "openai-completions";

  for (const [name, p] of Object.entries(cfg.providers)) {
    if (name === "hub") continue;
    if (p.baseUrl !== hubUrl) continue;

    const needsModels = !p.models || p.models.length === 0;
    const needsAuth = !p.apiKey;

    if (!needsModels && !needsAuth) continue;

    const reg: Record<string, unknown> = {
      baseUrl: p.baseUrl,
      api: p.api || hubApi,
      compat: { ...(hub.compat || {}), ...(p.compat || {}) },
    };

    if (needsAuth && hubKey) reg.apiKey = hubKey;

    if (needsModels) {
      reg.models = hub.models;
    } else {
      const existing = new Set(p.models!.map((m) => m.id));
      const missing = hub.models.filter((m) => !existing.has(m.id));
      if (missing.length > 0) reg.models = [...p.models!, ...missing];
    }

    try {
      pi.registerProvider(name, reg as any);
      console.log(
        `[fix-subagent] Patched "${name}": ` +
          [
            needsModels ? "models" : "",
            needsAuth ? "auth" : "",
          ]
            .filter(Boolean)
            .join("+") || "no gaps",
      );
    } catch (err) {
      console.error(`[fix-subagent] Failed patching "${name}":`, err);
    }
  }
}
