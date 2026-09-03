#!/usr/bin/env bash
# dev.sh — the local server, with every binding the check suites expect.
#
#   ./tools/dev.sh            start it
#   ./tools/dev.sh --restart  kill whatever holds the port first
#
# This exists because starting wrangler by hand kept dropping a binding
# and the suites then failed for a reason that had nothing to do with the
# code: no AGENT_TOKEN gave 401s across check_social, no TIKTOK_* gave a
# 503 on the credentials screen, no MCP_* gave 503s across check_oauth.
# Every one of those looks like a regression and is not.
#
# The values are the defaults each suite falls back to, so the two agree
# by construction rather than by my remembering.

set -euo pipefail
cd "$(dirname "$0")/.."

PORT=8801
LOG="${DEV_LOG:-/tmp/wrangler-dev.log}"

if [ "${1:-}" = "--restart" ]; then
  # `set -e` is off for this block. Killing processes is expected to
  # fail some of the time — one may exit between pgrep and kill, and a
  # non-zero from that is not a reason to abandon the restart.
  set +e
  # by pid, not by pkill: a pattern that matches "wrangler pages dev"
  # also matches the shell running this script, which kills itself
  for p in $(pgrep -f "wrangler|workerd" 2>/dev/null || true); do
    [ "$p" = "$$" ] && continue
    cmd=$(tr '\0' ' ' < "/proc/$p/cmdline" 2>/dev/null || true)
    case "$cmd" in *wrangler*|*workerd*) kill "$p" 2>/dev/null || true ;; esac
  done
  sleep 3
  set -e
fi

# nohup + disown: backgrounded with a plain & the server takes SIGHUP
# when this script exits, and dies partway through a check run — which
# then reports ECONNREFUSED as though the code were at fault.
nohup npx wrangler pages dev . --port "$PORT" \
  --binding \
    STUDIO_PASSWORD=hunter2 \
    SESSION_SECRET=a-long-enough-string-for-signing \
    AGENT_TOKEN=sparktoken123 \
    MCP_CLIENT_ID=gemini-spark \
    MCP_CLIENT_SECRET=spark-secret-value \
    MCP_REDIRECT_URIS=https://gemini.google.com/oauth/callback \
    TIKTOK_CLIENT_KEY=awx1234567890abc \
    TIKTOK_CLIENT_SECRET=ttsecretvalue123 \
  --d1 DB --r2 MEDIA \
  > "$LOG" 2>&1 &
disown

echo "starting on http://127.0.0.1:$PORT — log: $LOG"
until grep -qE "Ready on|ERROR|✘" "$LOG" 2>/dev/null; do sleep 2; done
grep -E "Ready on|✘" "$LOG" | head -1
