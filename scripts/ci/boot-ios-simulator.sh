#!/usr/bin/env bash
# Boot (or reuse) an iOS Simulator for coverage e2e.
# Prefer a non-RNFB-slotted device name. Does not claim RNFB e2e slots.
#
# Style mirrors RNFB `.github/workflows/scripts/boot-simulator.sh`:
# exact device-name match, open the simulator UI, poll bootstatus until ready
# (including first-boot data migration).
# Xcode 26 ships Simulator.app. Xcode 27+ ships Device Hub and does not
# include Simulator.app.
set -euo pipefail

DEVICE_NAME="${IOS_DEVICE_NAME:-iPhone 17}"
BOOT_POLL_INTERVAL_SECONDS="${BOOT_POLL_INTERVAL_SECONDS:-20}"
BOOT_PROBE_TIMEOUT_SECONDS="${BOOT_PROBE_TIMEOUT_SECONDS:-12}"
BOOT_MAX_WAIT_SECONDS="${BOOT_MAX_WAIT_SECONDS:-660}"

run_with_timeout() {
  local max="$1"
  shift
  "$@" &
  local cmd_pid=$!
  local waited=0
  while kill -0 "$cmd_pid" 2>/dev/null && (( waited < max )); do
    sleep 1
    waited=$((waited + 1))
  done
  if kill -0 "$cmd_pid" 2>/dev/null; then
    kill "$cmd_pid" 2>/dev/null
    wait "$cmd_pid" 2>/dev/null || true
    return 124
  fi
  wait "$cmd_pid"
}

log_boot_status() {
  echo "[boot-status] $*"
}

# Exact name match: "iPhone 17 (" must not match "iPhone 17 Pro (".
# Prefer the last available match so we land on the newest runtime section
# (simctl lists older iOS runtimes first).
resolve_device_udid() {
  local device="$1"
  local udid

  udid="$(
    xcrun simctl list devices available 2>/dev/null \
      | grep -F "${device} (" \
      | grep -v 'unavailable' \
      | tail -1 \
      | sed -E 's/.*\(([A-F0-9-]{36})\).*/\1/' \
      || true
  )"
  echo "$udid"
}

describe_booted_device() {
  local device="$1"
  xcrun simctl list devices booted 2>/dev/null \
    | grep -F "${device} (" \
    | grep -v 'unavailable' \
    | head -1 \
    || true
}

wait_for_simulator_ready() {
  local device="$1"
  local start=$SECONDS

  while (( SECONDS - start < BOOT_MAX_WAIT_SECONDS )); do
    local elapsed=$(( SECONDS - start ))
    local booted_line ready_rc

    log_boot_status "elapsed=${elapsed}s phase=wait_for_full_boot device=\"${device}\""

    booted_line="$(describe_booted_device "$device")"
    if [[ -z "$booted_line" ]]; then
      log_boot_status "  simctl list: not in Booted state yet"
    else
      log_boot_status "  simctl list: ${booted_line}"
    fi

    set +e
    run_with_timeout "$BOOT_PROBE_TIMEOUT_SECONDS" xcrun simctl bootstatus "$device" >/dev/null 2>&1
    ready_rc=$?
    set -e

    if [[ "$ready_rc" -eq 0 ]]; then
      log_boot_status "bootstatus: simulator ready after ${elapsed}s"
      return 0
    fi

    if [[ "$ready_rc" -eq 124 ]]; then
      log_boot_status "bootstatus: still booting (probe timed out after ${BOOT_PROBE_TIMEOUT_SECONDS}s)"
    else
      log_boot_status "bootstatus: probe exited with status ${ready_rc}"
    fi

    sleep "$BOOT_POLL_INTERVAL_SECONDS"
  done

  log_boot_status "ERROR: timed out after ${BOOT_MAX_WAIT_SECONDS}s waiting for simulator to become ready"
  return 1
}

udid="$(resolve_device_udid "$DEVICE_NAME")"
if [[ -z "${udid}" ]]; then
  echo "No available simulator matching exact DEVICE_NAME=${DEVICE_NAME}" >&2
  echo "--- xcrun simctl list devices available ---" >&2
  xcrun simctl list devices available >&2 || true
  echo "--- device types (create hint) ---" >&2
  xcrun simctl list devicetypes 2>/dev/null | grep -i iPhone >&2 || true
  exit 1
fi

log_boot_status "phase=resolve_device name=\"${DEVICE_NAME}\" udid=${udid}"

state="$(xcrun simctl list devices | grep "$udid" | sed -n 's/.*(\(Booted\|Shutdown\|Shutting Down\)).*/\1/p' | head -1 || true)"
if [[ "${state}" != "Booted" ]]; then
  log_boot_status "phase=boot_command starting simctl boot..."
  set +e
  boot_output="$(xcrun simctl boot "$udid" 2>&1)"
  boot_rc=$?
  set -e
  if [[ "$boot_rc" -ne 0 ]]; then
    log_boot_status "simctl boot exited ${boot_rc}: ${boot_output}"
  else
    log_boot_status "simctl boot command returned (device may still be migrating data)"
  fi
fi

# Appium XCUITest restarts a headless-booted sim to show the UI and can hang
# for 120s+. Open the simulator UI first (RNFB pattern).
foreground_simulator_ui() {
  local device_udid="$1"
  local xcode_major=""

  # Read the full `xcodebuild -version` output before parsing. An awk `exit`
  # closes the pipe early, and `pipefail` then turns that SIGPIPE into 141.
  local xcode_version_text=""
  xcode_version_text="$(xcodebuild -version 2>/dev/null || true)"
  xcode_major="$(
    printf '%s\n' "$xcode_version_text" \
      | awk '/^Xcode / { split($2, parts, "."); print parts[1] }'
  )"

  if [[ -n "$xcode_major" && "$xcode_major" -ge 27 ]]; then
    log_boot_status "phase=foreground_simulator opening Device Hub (Xcode ${xcode_major})..."
    open -a "Device Hub" --args -CurrentDeviceUDID "$device_udid" \
      || open -b com.apple.dt.Devices --args -CurrentDeviceUDID "$device_udid" \
      || true
    return 0
  fi

  log_boot_status "phase=foreground_simulator opening Simulator.app (Xcode ${xcode_major:-unknown})..."
  open -a Simulator --args -CurrentDeviceUDID "$device_udid" || open -a Simulator.app || true
}

foreground_simulator_ui "$udid"

if ! wait_for_simulator_ready "$DEVICE_NAME"; then
  echo "--- diagnostics after boot timeout ---" >&2
  xcrun simctl list devices booted >&2 || true
  xcrun simctl bootstatus "$udid" >&2 || true
  pgrep -lf 'Simulator|DeviceHub|DevicesTrampoline' >&2 || true
  exit 1
fi

echo "IOS_UDID=${udid}"
echo "IOS_DEVICE_NAME=${DEVICE_NAME}"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "IOS_UDID=${udid}" >> "$GITHUB_ENV"
  echo "IOS_DEVICE_NAME=${DEVICE_NAME}" >> "$GITHUB_ENV"
fi
