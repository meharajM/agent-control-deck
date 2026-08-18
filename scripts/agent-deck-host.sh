#!/usr/bin/env bash

set -euo pipefail

CONFIG_FILE="${AGENT_DECK_CONFIG_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/agent-deck/host.env}"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Agent Deck is not configured. Run ./setup.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

: "${AGENT_DECK_REPO:?Missing AGENT_DECK_REPO in $CONFIG_FILE}"
: "${AGENT_DECK_RUNTIME:?Missing AGENT_DECK_RUNTIME in $CONFIG_FILE}"
: "${AGENT_DECK_BRIDGE_INTERFACE:?Missing AGENT_DECK_BRIDGE_INTERFACE in $CONFIG_FILE}"
: "${AGENT_DECK_BRIDGE_PORT:?Missing AGENT_DECK_BRIDGE_PORT in $CONFIG_FILE}"

runtime_bin_dir=""
if [[ -n "${AGENT_DECK_RUNTIME_BIN:-}" && -x "$AGENT_DECK_RUNTIME_BIN" ]]; then
  runtime_bin_dir="$(dirname "$AGENT_DECK_RUNTIME_BIN")"
fi
node_bin_dir=""
if [[ -n "${AGENT_DECK_NODE_BIN:-}" && -x "$AGENT_DECK_NODE_BIN" ]]; then
  node_bin_dir="$(dirname "$AGENT_DECK_NODE_BIN")"
fi
export PATH="$runtime_bin_dir:$node_bin_dir:$PATH"

LOG_DIR="${AGENT_DECK_LOG_DIR:-${XDG_STATE_HOME:-$HOME/.local/state}/agent-deck}"
mkdir -p "$LOG_DIR"

opencode_pid=""
bridge_pid=""

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "$bridge_pid" ]] && kill -0 "$bridge_pid" 2>/dev/null; then
    kill "$bridge_pid" 2>/dev/null || true
    wait "$bridge_pid" 2>/dev/null || true
  fi
  if [[ -n "$opencode_pid" ]] && kill -0 "$opencode_pid" 2>/dev/null; then
    kill "$opencode_pid" 2>/dev/null || true
    wait "$opencode_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

if [[ "$AGENT_DECK_RUNTIME" == "opencode" ]]; then
  : "${AGENT_DECK_OPENCODE_BIN:?Missing AGENT_DECK_OPENCODE_BIN in $CONFIG_FILE}"
  : "${OPENCODE_SERVER_URL:?Missing OPENCODE_SERVER_URL in $CONFIG_FILE}"
  : "${OPENCODE_SERVER_USERNAME:?Missing OPENCODE_SERVER_USERNAME in $CONFIG_FILE}"
  : "${OPENCODE_SERVER_PASSWORD:?Missing OPENCODE_SERVER_PASSWORD in $CONFIG_FILE}"
  : "${OPENCODE_SERVER_PORT:?Missing OPENCODE_SERVER_PORT in $CONFIG_FILE}"

  if ! curl --fail --silent --show-error \
    --user "$OPENCODE_SERVER_USERNAME:$OPENCODE_SERVER_PASSWORD" \
    "$OPENCODE_SERVER_URL/global/health" >/dev/null 2>&1; then
    echo "Starting OpenCode server on loopback port $OPENCODE_SERVER_PORT"
    (
      cd "${OPENCODE_WORKDIR:-$AGENT_DECK_REPO}"
      exec "$AGENT_DECK_OPENCODE_BIN" serve \
        --hostname 127.0.0.1 \
        --port "$OPENCODE_SERVER_PORT"
    ) >>"$LOG_DIR/opencode.log" 2>&1 &
    opencode_pid=$!

    ready=0
    for _ in {1..60}; do
      if curl --fail --silent --show-error \
        --user "$OPENCODE_SERVER_USERNAME:$OPENCODE_SERVER_PASSWORD" \
        "$OPENCODE_SERVER_URL/global/health" >/dev/null 2>&1; then
        ready=1
        break
      fi
      sleep 1
    done
    if [[ "$ready" != "1" ]]; then
      echo "OpenCode server did not become healthy. Check $LOG_DIR/opencode.log" >&2
      exit 1
    fi
  fi

  export OPENCODE_SERVER_URL OPENCODE_SERVER_USERNAME OPENCODE_SERVER_PASSWORD OPENCODE_WORKDIR
fi

export BRIDGE_RUNTIME="$AGENT_DECK_RUNTIME"
export BRIDGE_INTERFACE="$AGENT_DECK_BRIDGE_INTERFACE"
export BRIDGE_PORT="$AGENT_DECK_BRIDGE_PORT"
export BRIDGE_DB_PATH="${AGENT_DECK_DB_PATH:-$LOG_DIR/bridge.db}"
export BRIDGE_PAIRING_ENDPOINT="ws://${AGENT_DECK_BRIDGE_INTERFACE}:${AGENT_DECK_BRIDGE_PORT}"

PNPM_BIN="${AGENT_DECK_PNPM_BIN:-$(command -v pnpm || true)}"
if [[ -z "$PNPM_BIN" || ! -x "$PNPM_BIN" ]]; then
  echo "pnpm was not found. Re-run ./setup.sh or set AGENT_DECK_PNPM_BIN." >&2
  exit 1
fi

cd "$AGENT_DECK_REPO"
echo "Starting Agent Deck bridge on $BRIDGE_PAIRING_ENDPOINT"
"$PNPM_BIN" start:bridge >"$LOG_DIR/bridge.log" 2>&1 &
bridge_pid=$!
wait "$bridge_pid"
