#!/bin/sh
# Launcher for MCP stdio servers that need NOTION_TOKEN / CONTEXT7_API_KEY /
# GITHUB_PERSONAL_ACCESS_TOKEN loaded from the project's .env file.
# Usage: ./scripts/mcp-launch.sh <npm-package> [extra-npx-args...]

set -e

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)"
cd "$PROJECT_ROOT"

if [ -f ./.env ]; then
  set -a
  . ./.env
  set +a
fi

# Ensure nvm-installed and user-local node binaries are reachable when MCP
# clients spawn us with a minimal PATH.
NVM_BIN=""
if [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_BIN="$(ls -1d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -n1)"
fi
[ -n "$NVM_BIN" ] && PATH="$NVM_BIN:$PATH"
[ -d "$HOME/.local/bin" ] && PATH="$HOME/.local/bin:$PATH"
export PATH

exec npx -y "$@"
