#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${1:?usage: classify-ios-flake.sh <attempt-artifact-dir>}"
OUT="${2:-$ARTIFACT_DIR/flake-classification.txt}"

classification="unclassified"
evidence="Inspect Appium, WDIO, Metro, and simulator logs in $ARTIFACT_DIR"
LOGS=(/dev/null "$ARTIFACT_DIR"/*.log)
[[ -f "$ARTIFACT_DIR/../metro.log" ]] && LOGS+=("$ARTIFACT_DIR/../metro.log")
[[ -f "$ARTIFACT_DIR/../simulator.log" ]] && LOGS+=("$ARTIFACT_DIR/../simulator.log")

if grep -Eiq 'ECONNREFUSED|Could not proxy command|socket hang up' "${LOGS[@]}" 2>/dev/null; then
  classification="appium-or-wda-transport"
elif grep -Eiq 'xcodebuild.*(timed out|failed)|WebDriverAgent.*(timed out|not reachable)' "${LOGS[@]}" 2>/dev/null; then
  classification="wda-startup"
elif grep -Eiq 'No bundle URL|Unable to load script|Metro.*(failed|error)' "${LOGS[@]}" 2>/dev/null; then
  classification="metro-bundle"
elif grep -Eiq 'crash|SIGABRT|Terminated due to signal' "${LOGS[@]}" 2>/dev/null; then
  classification="application-crash"
fi

{
  echo "classification=$classification"
  echo "artifacts=$ARTIFACT_DIR"
  echo "next=$evidence"
} >"$OUT"

cat "$OUT"
