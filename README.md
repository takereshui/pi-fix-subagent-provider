# pi-fix-subagent-provider

Neutralize pi's model auto-routing so subagents work through any unified API proxy (e.g. hub.linux.do).

## Problem

pi automatically routes model IDs to their "native" providers:

| Model Matches | Routed To |
|---|---|
| `gemini-*` | `google` |
| `claude-*` | `anthropic` |
| `gpt-*` | `openai` |
| `deepseek-*` | `deepseek` |

This happens **even when using an explicit `hub/` prefix** like `hub/gemini-2.5-flash`. If the native provider is an empty shell (same proxy baseUrl but no models or auth), subagents fail with:

```
No API key found for google.
Warning: No models match pattern "gemini-2.5-flash"
```

## Solution

Instead of fighting auto-routing (which is internal to pi's minified code), this extension makes it **harmless**. It reads your `models.json`, finds the hub provider's credentials, and fills every proxy provider sharing the same `baseUrl` with hub's models + API key.

Result: whichever provider pi resolves to, it finds working credentials.

## Installation

```bash
# Clone or download
git clone https://github.com/YOUR_USER/pi-fix-subagent-provider.git

# Copy to pi extensions directory
cp pi-fix-subagent-provider/fix-subagent-provider.ts ~/.pi/agent/extensions/
```

Or one-liner:
```bash
curl -o ~/.pi/agent/extensions/fix-subagent-provider.ts \
  https://raw.githubusercontent.com/YOUR_USER/pi-fix-subagent-provider/main/fix-subagent-provider.ts
```

Then `/reload` in pi (or restart).

## Verify

After reload, check the startup log:
```
[fix-subagent] Patched "deepseek": models+auth
[fix-subagent] Patched "openai": models+auth
[fix-subagent] Patched "google": auth
[fix-subagent] Patched "github-copilot": models+auth
[fix-subagent] Patched "anthropic": models+auth
```

## Requirements

- Your `models.json` must have a `hub` provider with `apiKey` and `models`
- All proxy providers (google, openai, etc.) must share the same `baseUrl` as hub

## How It Works

1. Reads `~/.pi/agent/models.json`
2. Finds the `hub` provider (key: baseUrl, apiKey, models)
3. Iterates every other provider — if `baseUrl` matches hub's:
   - Fills missing `apiKey`
   - Fills missing models (or merges hub models the provider lacks)
4. Calls `pi.registerProvider()` to apply the patched config

## License

MIT
