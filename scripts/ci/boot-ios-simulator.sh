#!/usr/bin/env bash
# Boot (or reuse) an iOS Simulator for coverage e2e.
# Prefer a non-RNFB device name. Does not claim RNFB e2e slots.
set -euo pipefail

DEVICE_NAME="${IOS_DEVICE_NAME:-iPhone 16}"

udid="$(xcrun simctl list devices available | awk -v name="$DEVICE_NAME" '
  $0 ~ name && $0 ~ /\([A-F0-9-]{36}\)/ {
    if (match($0, /\([A-F0-9-]{36}\)/)) {
      id=substr($0, RSTART+1, RLENGTH-2);
      print id;
      exit;
    }
  }')"

if [[ -z "${udid}" ]]; then
  echo "No available simulator matching DEVICE_NAME=${DEVICE_NAME}" >&2
  xcrun simctl list devices available >&2
  exit 1
fi

state="$(xcrun simctl list devices | grep "$udid" | sed -n 's/.*(\(Booted\|Shutdown\|Shutting Down\)).*/\1/p' | head -1 || true)"
if [[ "${state}" != "Booted" ]]; then
  xcrun simctl boot "$udid" || true
  xcrun simctl bootstatus "$udid" -b
fi

echo "IOS_UDID=${udid}"
echo "IOS_DEVICE_NAME=${DEVICE_NAME}"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "IOS_UDID=${udid}" >> "$GITHUB_ENV"
  echo "IOS_DEVICE_NAME=${DEVICE_NAME}" >> "$GITHUB_ENV"
fi
