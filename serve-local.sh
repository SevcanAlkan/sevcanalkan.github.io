#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3005}"

cd "$ROOT_DIR"

echo "Serving $ROOT_DIR"
echo "Open: http://$HOST:$PORT/"
echo "Press Ctrl+C to stop."

exec python3 -m http.server "$PORT" --bind "$HOST"
