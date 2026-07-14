#!/usr/bin/env bash
# Verify the live GitHub Pages deploy actually contains expected markers.
set -euo pipefail

BASE_URL="${1:-https://xgamer791.github.io/macronaut}"
shift || true
MARKERS=("$@")
if [ ${#MARKERS[@]} -eq 0 ]; then
  MARKERS=("Daily Goals" "Fat Goal" 'fontSize:20')
fi

STAMP=$(date +%s%N)
HTML=$(curl -fsSL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "${BASE_URL}/?_build=${STAMP}")
JS_PATH=$(printf '%s' "$HTML" | grep -oE '/macronaut/_expo/static/js/web/entry-[a-f0-9]+\.js' | head -1)
if [ -z "$JS_PATH" ]; then
  echo "FAIL: could not find entry JS in HTML" >&2
  exit 1
fi

TMP=$(mktemp)
curl -fsSL -H 'Cache-Control: no-cache' "${BASE_URL%/}/${JS_PATH#/macronaut/}" -o "$TMP" 2>/dev/null \
  || curl -fsSL "https://xgamer791.github.io${JS_PATH}" -o "$TMP"

echo "HTML build stamp URL ok"
echo "JS=${JS_PATH}"
if curl -fsSL "${BASE_URL}/version.json?_=${STAMP}" >/tmp/macronaut-version.json; then
  echo "version=$(cat /tmp/macronaut-version.json)"
fi

fail=0
for marker in "${MARKERS[@]}"; do
  if grep -q -- "$marker" "$TMP"; then
    echo "OK  marker: $marker"
  else
    echo "MISSING marker: $marker" >&2
    fail=1
  fi
done

# Prefer distinctive Daily Goals render props when present
if grep -q 'children:"Daily Goals"' "$TMP"; then
  nearby=$(grep -o '.\{120\}children:"Daily Goals".\{40\}' "$TMP" | head -1 || true)
  echo "Daily Goals render: $nearby"
fi

rm -f "$TMP"
exit "$fail"
