#!/usr/bin/env bash
# Run Appium iOS e2e for one coverage cell, then pull/export/assert LCOV.
#
# Required env:
#   CELL=dynamic|static
# Optional:
#   IOS_DEVICE_NAME (default iPhone 17)
#   SKIP_BUILD=1  SKIP_METRO=1  SKIP_APPIUM_INSTALL=1
#   METRO_PORT / APPIUM_PORT (defaults: Metro 8081 both cells; Appium 4723 dynamic / 4725 static)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CELL="${CELL:?CELL=dynamic|static required}"
IOS_DEVICE_NAME="${IOS_DEVICE_NAME:-iPhone 17}"
REPORT_DIR="${REPORT_DIR:-$ROOT/artifacts/e2e}"
LOG_DIR="${REPORT_DIR}/logs/${CELL}"
COV_DIR="${REPORT_DIR}/coverage/${CELL}"
mkdir -p "$LOG_DIR" "$COV_DIR"

# Both cells default Metro to :8081 (Expo Debug apps look there). Kill leftovers
# first so serial local runs of dynamic → static do not collide. Override via env.
METRO_PORT="${METRO_PORT:-8081}"
if [[ "$CELL" == "dynamic" ]]; then
  APPIUM_PORT="${APPIUM_PORT:-4723}"
else
  APPIUM_PORT="${APPIUM_PORT:-4725}"
fi
export APPIUM_PORT
export APPIUM_HOST="${APPIUM_HOST:-127.0.0.1}"

kill_port_listeners() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    echo "Killing listeners on port $port: $pids"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

cd "$ROOT"
yarn prepare

if [[ "$CELL" == "dynamic" ]]; then
  APP_DIR="$ROOT/example-dynamic"
  BUNDLE_ID="com.example.CoverageDynamic"
  PRODUCT_NAME="CoverageDynamic"
  CONFIG_PATH="$APP_DIR/react-native-coverage.config.js"
  WORKSPACE="$APP_DIR/ios/CoverageDynamic.xcworkspace"
  SCHEME="CoverageDynamic"
  DERIVED="$APP_DIR/ios/build/DerivedData"
  POD_CMD=(bash -lc "cd '$APP_DIR/ios' && USE_FRAMEWORKS=dynamic RCT_NEW_ARCH_ENABLED=1 pod install")
elif [[ "$CELL" == "static" ]]; then
  APP_DIR="$ROOT/example"
  BUNDLE_ID="com.example.coverage"
  PRODUCT_NAME="CoverageExample"
  CONFIG_PATH="$APP_DIR/react-native-coverage.config.js"
  WORKSPACE="$APP_DIR/ios/CoverageExample.xcworkspace"
  SCHEME="CoverageExample"
  DERIVED="$APP_DIR/ios/build/DerivedData"
  POD_CMD=(bash -lc "cd '$APP_DIR/ios' && pod install")
else
  echo "Unknown CELL=$CELL (expected dynamic|static)" >&2
  exit 1
fi

APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/${PRODUCT_NAME}.app"
export IOS_BUNDLE_ID="$BUNDLE_ID"
export IOS_DEVICE_NAME

echo "==> Boot simulator"
BOOT_OUT="$LOG_DIR/boot-sim.log"
bash "$ROOT/scripts/ci/boot-ios-simulator.sh" | tee "$BOOT_OUT"
IOS_UDID="$(grep -E '^IOS_UDID=' "$BOOT_OUT" | tail -1 | cut -d= -f2-)"
BOOT_DEVICE_NAME="$(grep -E '^IOS_DEVICE_NAME=' "$BOOT_OUT" | tail -1 | cut -d= -f2-)"
: "${IOS_UDID:?simulator UDID missing}"
export IOS_UDID
export IOS_DEVICE_NAME="${BOOT_DEVICE_NAME:-$IOS_DEVICE_NAME}"
export IOS_APP_PATH="$APP_PATH"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Pod install ($CELL)"
  "${POD_CMD[@]}" 2>&1 | tee "$LOG_DIR/pod-install.log"

  echo "==> xcodebuild ($CELL)"
  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "id=${IOS_UDID}" \
    -derivedDataPath "$DERIVED" \
    CODE_SIGNING_ALLOWED=NO \
    build 2>&1 | tee "$LOG_DIR/xcodebuild.log"
fi

if [[ ! -d "$APP_PATH" ]]; then
  echo "Missing app at $APP_PATH" >&2
  exit 1
fi

# Prove dynamic frameworks for primary cell
if [[ "$CELL" == "dynamic" ]]; then
  echo "==> Assert CoverageFixture.framework product"
  FW="$(find "$DERIVED/Build/Products/Debug-iphonesimulator" -type d -name 'CoverageFixture.framework' | head -1 || true)"
  if [[ -z "$FW" ]]; then
    echo "CoverageFixture.framework not found under DerivedData (dynamic cell hard fail)" >&2
    find "$DERIVED/Build/Products/Debug-iphonesimulator" -maxdepth 2 -type d | head -80 >&2 || true
    exit 1
  fi
  BIN="$FW/CoverageFixture"
  file "$BIN" | tee "$LOG_DIR/framework-file.txt"
  if ! file "$BIN" | grep -qi 'dynamically linked\|Mach-O.*dylib\|shared library'; then
    if ! otool -hv "$BIN" | tee "$LOG_DIR/framework-otool.txt" | grep -q 'DYLIB'; then
      echo "CoverageFixture binary is not a dynamic library" >&2
      exit 1
    fi
  fi
  echo "Dynamic framework OK: $FW" | tee "$LOG_DIR/framework-ok.txt"
fi

METRO_PID=""
APPIUM_PID=""
cleanup() {
  set +e
  if [[ -n "${APPIUM_PID}" ]] && kill -0 "$APPIUM_PID" 2>/dev/null; then
    kill "$APPIUM_PID" 2>/dev/null || true
  fi
  if [[ -n "${METRO_PID}" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  kill_port_listeners "$METRO_PORT"
  kill_port_listeners "$APPIUM_PORT"
  wait 2>/dev/null || true
}
trap cleanup EXIT

kill_port_listeners "$METRO_PORT"
kill_port_listeners "$APPIUM_PORT"

if [[ "${SKIP_METRO:-0}" != "1" ]]; then
  echo "==> Start Metro on :$METRO_PORT"
  (
    cd "$APP_DIR"
    if [[ "$CELL" == "static" ]]; then
      CI=1 yarn start -- --port "$METRO_PORT"
    else
      yarn start --port "$METRO_PORT"
    fi
  ) >"$LOG_DIR/metro.log" 2>&1 &
  METRO_PID=$!
  for _ in $(seq 1 90); do
    if curl -sf "http://127.0.0.1:${METRO_PORT}/status" >/dev/null; then
      break
    fi
    if curl -sf "http://127.0.0.1:${METRO_PORT}/" >/dev/null; then
      break
    fi
    sleep 1
  done
  if ! curl -sf "http://127.0.0.1:${METRO_PORT}/status" >/dev/null \
    && ! curl -sf "http://127.0.0.1:${METRO_PORT}/" >/dev/null; then
    echo "Metro failed to start on :$METRO_PORT" >&2
    cat "$LOG_DIR/metro.log" >&2 || true
    exit 1
  fi
fi

echo "==> Install app on simulator"
xcrun simctl uninstall "$IOS_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$IOS_UDID" "$APP_PATH"

# Point the installed Debug app at this cell's Metro port (default 8081).
xcrun simctl spawn "$IOS_UDID" launchctl setenv RCT_METRO_PORT "$METRO_PORT" 2>/dev/null || true

if [[ "${SKIP_APPIUM_INSTALL:-0}" != "1" ]]; then
  echo "==> Ensure Appium XCUITest driver"
  (
    cd "$ROOT/e2e"
    npx appium driver install xcuitest >/dev/null 2>&1 || true
  )
fi

echo "==> Start Appium on :$APPIUM_PORT"
(
  cd "$ROOT/e2e"
  npx appium --address 127.0.0.1 --port "$APPIUM_PORT"
) >"$LOG_DIR/appium.log" 2>&1 &
APPIUM_PID=$!
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null; then
    break
  fi
  sleep 1
done
if ! curl -sf "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null; then
  echo "Appium failed to start on :$APPIUM_PORT" >&2
  cat "$LOG_DIR/appium.log" >&2 || true
  exit 1
fi

echo "==> Pre-WDIO simulator diagnostics"
{
  echo "=== env ==="
  echo "IOS_UDID=${IOS_UDID}"
  echo "IOS_DEVICE_NAME=${IOS_DEVICE_NAME}"
  echo "IOS_APP_PATH=${IOS_APP_PATH}"
  echo "DEVELOPER_DIR=${DEVELOPER_DIR:-}"
  echo "=== xcodebuild -version ==="
  xcodebuild -version || true
  echo "=== xcrun swiftc --version ==="
  xcrun swiftc --version || true
  echo "=== simctl list devices (match UDID) ==="
  xcrun simctl list devices | grep -F "$IOS_UDID" || true
  echo "=== simctl bootstatus ==="
  xcrun simctl bootstatus "$IOS_UDID" || true
  echo "=== Simulator.app processes ==="
  pgrep -lf Simulator || true
} | tee "$LOG_DIR/pre-wdio-sim.txt"

echo "==> WDIO Appium e2e"
(
  cd "$ROOT/e2e"
  yarn test:ios
) 2>&1 | tee "$LOG_DIR/wdio.log"

echo "==> Pull + export + assert iOS coverage"
xcrun simctl terminate "$IOS_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
sleep 1

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  ios pull \
  --device "$IOS_UDID" \
  --output "$COV_DIR/profraw" 2>&1 | tee "$LOG_DIR/ios-pull.log"

mkdir -p "$DERIVED/output/coverage"
cp -f "$COV_DIR/profraw"/*.profraw "$DERIVED/output/coverage/" 2>/dev/null || true

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  ios export \
  --derived-data "$DERIVED" \
  --app-name "$PRODUCT_NAME" \
  --output "$COV_DIR/lcov.info" 2>&1 | tee "$LOG_DIR/ios-export.log"

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  assert \
  --platform ios \
  --lcov "$COV_DIR/lcov.info" 2>&1 | tee "$LOG_DIR/ios-assert.log"

mkdir -p "$APP_DIR/coverage/ios"
cp "$COV_DIR/lcov.info" "$APP_DIR/coverage/ios/lcov.info"

echo "OK cell=$CELL lcov=$COV_DIR/lcov.info"
