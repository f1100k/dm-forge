#!/bin/sh
# Diagnostic script that simulates how Cursor launches an MCP server.
# Run from the project root:  sh scripts/mcp-debug.sh
# Outputs a report and (optionally) hits the Notion API to verify the token end-to-end.

set -u

echo "=== MCP launch diagnostic — $(date) ==="
echo

echo "--- Environment ---"
echo "host=$(hostname)"
echo "user=$(whoami)"
echo "cwd=$(pwd)"
echo "shell=$0"
echo

echo "--- .env file ---"
if [ -f ./.env ]; then
  ls -la ./.env
else
  echo "MISSING: ./.env not found at $(pwd)/.env"
  echo "Cursor probably launches the wrapper with a different cwd."
  exit 1
fi
echo

echo "--- Sourcing .env (set -a; . ./.env) ---"
set -a
. ./.env
set +a
echo "NOTION_TOKEN length: ${#NOTION_TOKEN}  prefix: $(printf '%s' "${NOTION_TOKEN:-}" | cut -c1-5)"
[ -n "${CONTEXT7_API_KEY:-}" ] && echo "CONTEXT7_API_KEY length: ${#CONTEXT7_API_KEY}" || echo "CONTEXT7_API_KEY: <unset>"
[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ] && echo "GITHUB_PERSONAL_ACCESS_TOKEN length: ${#GITHUB_PERSONAL_ACCESS_TOKEN}" || echo "GITHUB_PERSONAL_ACCESS_TOKEN: <unset>"
echo

echo "--- PATH for npx ---"
export PATH="$HOME/.local/bin:$PATH"
echo "PATH=$PATH"
NPX_BIN=$(command -v npx 2>/dev/null || echo "<not found>")
NODE_BIN=$(command -v node 2>/dev/null || echo "<not found>")
echo "npx=$NPX_BIN"
echo "node=$NODE_BIN"
echo

echo "--- Live API check (Notion v1/users/me) ---"
if [ -z "${NOTION_TOKEN:-}" ]; then
  echo "SKIP: NOTION_TOKEN is empty after sourcing .env"
elif ! command -v curl >/dev/null 2>&1; then
  echo "SKIP: curl not installed"
else
  HTTP=$(curl -s -o /tmp/mcp-debug-notion.json -w "%{http_code}" \
    -H "Authorization: Bearer $NOTION_TOKEN" \
    -H "Notion-Version: 2025-09-03" \
    https://api.notion.com/v1/users/me)
  echo "HTTP $HTTP"
  head -c 400 /tmp/mcp-debug-notion.json
  echo
fi
echo

echo "--- Verdict ---"
if [ -z "${NOTION_TOKEN:-}" ]; then
  echo "FAIL: NOTION_TOKEN did not load from .env."
elif [ "$NPX_BIN" = "<not found>" ]; then
  echo "FAIL: npx not on PATH even after adding \$HOME/.local/bin."
elif [ "${HTTP:-}" != "200" ]; then
  echo "FAIL: token did not authenticate against Notion API (HTTP $HTTP)."
else
  echo "OK: token loaded, npx present, Notion API accepts the token."
  echo "    If Cursor still gets 401, it is NOT using this exact environment —"
  echo "    most likely a different cwd, a stale cached MCP process, or another"
  echo "    notion server taking over (plugin or user-level mcp.json)."
fi

