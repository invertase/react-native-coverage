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

# Istanbul instrument Metro bundles; flush() also dumpJsCoverage → coverage-final.json
export RN_COVERAGE_JS=1

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
WDA_PORT="${WDA_PORT:-8100}"
IOS_E2E_ATTEMPTS="${IOS_E2E_ATTEMPTS:-3}"
WDA_DERIVED="$REPORT_DIR/wda-derived-data"
mkdir -p "$WDA_DERIVED"

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

run_logged() {
  local log="$1"
  shift
  local rc
  if "$@" >"$log" 2>&1; then
    return 0
  else
    rc=$?
  fi
  echo "FAILED rc=$rc: $* (full log: $log)" >&2
  tail -n 80 "$log" >&2 || true
  return "$rc"
}

retry_logged() {
  local attempts="$1"
  local log="$2"
  shift 2
  local attempt rc=1
  for attempt in $(seq 1 "$attempts"); do
    echo "==> attempt $attempt/$attempts: $*"
    if run_logged "${log%.log}-attempt-${attempt}.log" "$@"; then
      return 0
    else
      rc=$?
    fi
    sleep $((attempt * 5))
  done
  return "$rc"
}

# `appium driver list` often prints to stderr; grepping stdout only misses an
# already-installed driver and then `driver install` fails.
ensure_appium_driver() {
  local name="$1"
  local list_log="$LOG_DIR/appium-driver-list.log"
  local install_log="$LOG_DIR/appium-driver-install.log"
  (
    cd "$ROOT/e2e"
    npx appium driver list --installed
  ) >"$list_log" 2>&1 || true
  if grep -qi "$name" "$list_log"; then
    return 0
  fi
  echo "==> Install Appium ${name} driver"
  if (
    cd "$ROOT/e2e"
    npx appium driver install "$name"
  ) >"$install_log" 2>&1; then
    return 0
  fi
  if grep -qi 'already installed' "$install_log"; then
    return 0
  fi
  echo "FAILED: appium driver install ${name} (full log: $install_log)" >&2
  tail -n 80 "$install_log" >&2 || true
  return 1
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
  # Same folder GMA uses via `react-native run-ios --buildFolder build`.
  DERIVED="$APP_DIR/ios/build"
  POD_CMD=(
    env BUNDLE_GEMFILE="$ROOT/Gemfile"
    bash -c "cd '$APP_DIR/ios' && USE_FRAMEWORKS=dynamic RCT_NEW_ARCH_ENABLED=1 bundle exec pod install"
  )
elif [[ "$CELL" == "static" ]]; then
  APP_DIR="$ROOT/example"
  BUNDLE_ID="com.example.coverage"
  PRODUCT_NAME="CoverageExample"
  CONFIG_PATH="$APP_DIR/react-native-coverage.config.js"
  WORKSPACE="$APP_DIR/ios/CoverageExample.xcworkspace"
  SCHEME="CoverageExample"
  DERIVED="$APP_DIR/ios/build"
  # Expo ios/ is generated and gitignored. Stale Podfile.lock vs Pods/Local
  # Podspecs (e.g. ExpoModulesWorklets after an SDK patch) makes `pod install`
  # fail; retries of the same command cannot recover.
  POD_CMD=(
    env BUNDLE_GEMFILE="$ROOT/Gemfile"
    bash -c "cd '$APP_DIR/ios' && rm -rf Pods Podfile.lock && bundle exec pod install"
  )
else
  echo "Unknown CELL=$CELL (expected dynamic|static)" >&2
  exit 1
fi

APP_PATH="$DERIVED/Build/Products/Debug-iphonesimulator/${PRODUCT_NAME}.app"
export IOS_BUNDLE_ID="$BUNDLE_ID"
export IOS_DEVICE_NAME

echo "==> Boot simulator"
BOOT_OUT="$LOG_DIR/boot-sim.log"
retry_logged 2 "$BOOT_OUT" bash "$ROOT/scripts/ci/boot-ios-simulator.sh"
cp "${BOOT_OUT%.log}-attempt-2.log" "$BOOT_OUT" 2>/dev/null \
  || cp "${BOOT_OUT%.log}-attempt-1.log" "$BOOT_OUT"
IOS_UDID="$(grep -E '^IOS_UDID=' "$BOOT_OUT" | tail -1 | cut -d= -f2-)"
BOOT_DEVICE_NAME="$(grep -E '^IOS_DEVICE_NAME=' "$BOOT_OUT" | tail -1 | cut -d= -f2-)"
: "${IOS_UDID:?simulator UDID missing}"
export IOS_UDID
export IOS_DEVICE_NAME="${BOOT_DEVICE_NAME:-$IOS_DEVICE_NAME}"
export IOS_APP_PATH="$APP_PATH"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Pod install ($CELL)"
  retry_logged 3 "$LOG_DIR/pod-install.log" "${POD_CMD[@]}"

  echo "==> xcodebuild ($CELL)"
  run_logged "$LOG_DIR/xcodebuild.log" xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "id=${IOS_UDID}" \
    -derivedDataPath "$DERIVED" \
    CODE_SIGNING_ALLOWED=NO \
    build
fi

if [[ ! -d "$APP_PATH" || ! -f "$APP_PATH/Info.plist" ]]; then
  echo "Missing complete app bundle at $APP_PATH" >&2
  exit 1
fi
echo "iOS app (xcodebuild + Appium): $APP_PATH"

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
SIM_LOG_PID=""
cleanup() {
  set +e
  if [[ -n "${APPIUM_PID}" ]] && kill -0 "$APPIUM_PID" 2>/dev/null; then
    kill "$APPIUM_PID" 2>/dev/null || true
  fi
  if [[ -n "${METRO_PID}" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  if [[ -n "${SIM_LOG_PID}" ]] && kill -0 "$SIM_LOG_PID" 2>/dev/null; then
    kill "$SIM_LOG_PID" 2>/dev/null || true
  fi
  kill_port_listeners "$METRO_PORT"
  kill_port_listeners "$APPIUM_PORT"
  kill_port_listeners "$WDA_PORT"
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
      CI=1 EXPO_UNSTABLE_HEADLESS=1 EXPO_NO_TELEMETRY=1 yarn start --port "$METRO_PORT"
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

echo "==> Prefetch Metro iOS bundle"
PREFETCH_LOG="$LOG_DIR/metro-prefetch.log"
: >"$PREFETCH_LOG"
PREFETCH_OK=0
for entry in \
  index.bundle \
  index.ts.bundle \
  .expo/.virtual-metro-entry.bundle \
  node_modules/expo/AppEntry.bundle; do
  url="http://127.0.0.1:${METRO_PORT}/${entry}?platform=ios&dev=true&minify=false"
  echo "Trying $url" | tee -a "$PREFETCH_LOG"
  if curl --fail --show-error --max-time 300 "$url" --output /dev/null \
    >>"$PREFETCH_LOG" 2>&1; then
    echo "Metro bundle ready via $entry" | tee -a "$PREFETCH_LOG"
    PREFETCH_OK=1
    break
  fi
done
if [[ "$PREFETCH_OK" -ne 1 ]]; then
  echo "No Metro iOS bundle entry returned HTTP 200" >&2
  tail -n 80 "$PREFETCH_LOG" >&2 || true
  exit 1
fi
if grep -Eiq 'Failed to install.*(React Native )?DevTools|standalone.*DevTools.*fail' "$LOG_DIR/metro.log"; then
  echo "Standalone React Native DevTools installation failed" >&2
  exit 1
fi

echo "==> Start filtered simulator log stream"
xcrun simctl spawn "$IOS_UDID" log stream --style compact --level info \
  --predicate "process == '${PRODUCT_NAME}' OR process == 'SpringBoard' OR process == 'runningboardd' OR process == 'testmanagerd' OR process CONTAINS 'WebDriverAgent' OR subsystem BEGINSWITH 'com.apple.dt.XCTest' OR eventMessage CONTAINS[c] 'React Native' OR eventMessage CONTAINS[c] 'crash'" \
  >"$LOG_DIR/simulator.log" 2>&1 &
SIM_LOG_PID=$!

echo "==> Install app on simulator"
xcrun simctl uninstall "$IOS_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl install "$IOS_UDID" "$APP_PATH"

# Point the installed Debug app at this cell's Metro port (default 8081).
xcrun simctl spawn "$IOS_UDID" launchctl setenv RCT_METRO_PORT "$METRO_PORT" 2>/dev/null || true

if [[ "${SKIP_APPIUM_INSTALL:-0}" != "1" ]]; then
  echo "==> Ensure Appium XCUITest driver"
  ensure_appium_driver xcuitest
fi

echo "==> Prebuild WebDriverAgent"
WDA_PROJECT="$(
  cd "$ROOT/e2e"
  node -e "const p=require.resolve('appium-webdriveragent/package.json'); console.log(require('path').join(require('path').dirname(p), 'WebDriverAgent.xcodeproj'))"
)"
run_logged "$LOG_DIR/wda-xcodebuild.log" xcodebuild \
  -project "$WDA_PROJECT" \
  -scheme WebDriverAgentRunner \
  -sdk iphonesimulator \
  -destination "id=${IOS_UDID}" \
  -derivedDataPath "$WDA_DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  build-for-testing
export IOS_WDA_DERIVED_DATA_PATH="$WDA_DERIVED"
export IOS_WDA_APP_PATH="$WDA_DERIVED/Build/Products/Debug-iphonesimulator/WebDriverAgentRunner-Runner.app"
if [[ ! -d "$IOS_WDA_APP_PATH" ]]; then
  echo "Missing prebuilt WDA app: $IOS_WDA_APP_PATH" >&2
  exit 1
fi
xcrun simctl install "$IOS_UDID" "$IOS_WDA_APP_PATH"

session_ids() {
  curl -sf "http://127.0.0.1:${APPIUM_PORT}/sessions" 2>/dev/null \
    | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{for(const x of JSON.parse(s).value||[]) console.log(x.id)}catch{}})" \
    || true
}

capture_failure_state() {
  local attempt_dir="$1"
  local id
  for id in $(session_ids); do
    curl -sf "http://127.0.0.1:${APPIUM_PORT}/session/${id}/source" \
      >"$attempt_dir/page-source.json" || true
    curl -sf -X POST -H 'Content-Type: application/json' \
      -d "{\"appId\":\"${BUNDLE_ID}\"}" \
      "http://127.0.0.1:${APPIUM_PORT}/session/${id}/appium/device/app_state" \
      >"$attempt_dir/query-app-state.json" || true
    curl -sf "http://127.0.0.1:${APPIUM_PORT}/session/${id}/screenshot" \
      | node -e "let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{try{process.stdout.write(Buffer.from(JSON.parse(s).value,'base64'))}catch{}})" \
      >"$attempt_dir/failure.png" || true
  done
}

delete_sessions() {
  local id
  for id in $(session_ids); do
    curl -sf -X DELETE "http://127.0.0.1:${APPIUM_PORT}/session/${id}" >/dev/null || true
  done
}

stop_appium() {
  delete_sessions
  if [[ -n "${APPIUM_PID}" ]] && kill -0 "$APPIUM_PID" 2>/dev/null; then
    kill "$APPIUM_PID" 2>/dev/null || true
    wait "$APPIUM_PID" 2>/dev/null || true
  fi
  APPIUM_PID=""
  kill_port_listeners "$APPIUM_PORT"
  kill_port_listeners "$WDA_PORT"
}

# A WDA runner that dies on launch (e.g. dyld(6) when XCTest frameworks are
# missing) leaves Appium polling /status until wdaLaunchTimeout. Fail the
# attempt as soon as the WDA port is provably dead, and record why.
watch_wda_readiness() {
  local attempt_dir="$1"
  local wdio_pid="$2"
  local deadline="${IOS_WDA_READY_DEADLINE:-180}"
  local waited=0
  while kill -0 "$wdio_pid" 2>/dev/null; do
    if lsof -nP -iTCP:"$WDA_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    if ((waited >= deadline)); then
      {
        echo "wda_port=${WDA_PORT} never listened within ${deadline}s"
        grep -a -E "WebDriverAgentRunner\.xctrunner.*(RBSProcessExitStatus|Process exited|dyld)" \
          "$LOG_DIR/simulator.log" | tail -n 20
      } >"$attempt_dir/wda-readiness.log" 2>&1
      echo "WDA never listened on ${WDA_PORT}; aborting attempt (see $attempt_dir/wda-readiness.log)" >&2
      kill -TERM "$wdio_pid" 2>/dev/null || true
      return 1
    fi
    sleep 5
    waited=$((waited + 5))
  done
}

start_appium() {
  local attempt_dir="$1"
  (
    cd "$ROOT/e2e"
    npx appium --address 127.0.0.1 --port "$APPIUM_PORT"
  ) >"$attempt_dir/appium.log" 2>&1 &
  APPIUM_PID=$!
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:${APPIUM_PORT}/status" >/dev/null && return 0
    sleep 1
  done
  return 1
}

WDIO_RC=1
for attempt in $(seq 1 "$IOS_E2E_ATTEMPTS"); do
  ATTEMPT_DIR="$LOG_DIR/attempt-${attempt}"
  mkdir -p "$ATTEMPT_DIR"
  echo "==> WDIO attempt $attempt/$IOS_E2E_ATTEMPTS"

  stop_appium
  xcrun simctl terminate "$IOS_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$IOS_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$IOS_UDID" "$APP_PATH"
  xcrun simctl install "$IOS_UDID" "$IOS_WDA_APP_PATH"
  xcrun simctl spawn "$IOS_UDID" launchctl setenv RCT_METRO_PORT "$METRO_PORT"

  {
    echo "xcode-select=$(xcode-select -p)"
    xcodebuild -version
    xcrun simctl list devices | grep -F "$IOS_UDID"
    xcrun simctl bootstatus "$IOS_UDID"
    curl -sf "http://127.0.0.1:${METRO_PORT}/status"
    test -d "$IOS_WDA_APP_PATH"
    echo "ios_app_path=$IOS_APP_PATH"
    echo "ios_wda_derived=$IOS_WDA_DERIVED_DATA_PATH"
    echo "appium_port=$APPIUM_PORT wda_port=$WDA_PORT"
    lsof -nP -iTCP:"$APPIUM_PORT" -sTCP:LISTEN || true
    lsof -nP -iTCP:"$WDA_PORT" -sTCP:LISTEN || true
  } >"$ATTEMPT_DIR/preflight.log" 2>&1

  if ! start_appium "$ATTEMPT_DIR"; then
    echo "Appium failed to start (artifacts: $ATTEMPT_DIR)" >&2
    tail -n 80 "$ATTEMPT_DIR/appium.log" >&2 || true
    WDIO_RC=1
  else
    {
      echo "=== Appium status ==="
      curl -sf "http://127.0.0.1:${APPIUM_PORT}/status"
      echo
      echo "=== active listeners ==="
      lsof -nP -iTCP:"$APPIUM_PORT" -sTCP:LISTEN
      lsof -nP -iTCP:"$WDA_PORT" -sTCP:LISTEN || true
    } >>"$ATTEMPT_DIR/preflight.log" 2>&1
    set +e
    (
      cd "$ROOT/e2e"
      yarn test:ios
    ) >"$ATTEMPT_DIR/wdio.log" 2>&1 &
    WDIO_PID=$!
    watch_wda_readiness "$ATTEMPT_DIR" "$WDIO_PID" &
    WATCH_PID=$!
    wait "$WDIO_PID"
    WDIO_RC=$?
    kill "$WATCH_PID" 2>/dev/null || true
    wait "$WATCH_PID" 2>/dev/null
    set -e
  fi

  if [[ "$WDIO_RC" -eq 0 ]]; then
    stop_appium
    break
  fi

  if [[ -f "$ATTEMPT_DIR/wdio.log" ]]; then
    echo "WDIO attempt $attempt failed; final log excerpt:" >&2
    tail -n 60 "$ATTEMPT_DIR/wdio.log" >&2 || true
  fi
  capture_failure_state "$ATTEMPT_DIR"
  grep -a -E "WebDriverAgentRunner\.xctrunner|com\.apple\.dt\.XCTest" "$LOG_DIR/simulator.log" \
    | tail -n 200 >"$ATTEMPT_DIR/wda-simulator-excerpt.log" 2>/dev/null || true
  xcrun simctl list devices | grep -F "$IOS_UDID" >"$ATTEMPT_DIR/simulator-state.txt" || true
  lsof -nP -iTCP:"$APPIUM_PORT" -iTCP:"$WDA_PORT" >"$ATTEMPT_DIR/port-state.txt" || true
  cp "$LOG_DIR/metro-prefetch.log" "$ATTEMPT_DIR/" || true
  bash "$ROOT/scripts/ci/classify-ios-flake.sh" "$ATTEMPT_DIR" \
    "$ATTEMPT_DIR/flake-classification.txt"
  stop_appium
done

if [[ "$WDIO_RC" -ne 0 ]]; then
  echo "WDIO failed after $IOS_E2E_ATTEMPTS serialized attempts; see $LOG_DIR" >&2
  exit "$WDIO_RC"
fi

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

echo "==> Pull + NYC-remap JS/TS coverage"
JS_DIR="$COV_DIR/js"
mkdir -p "$JS_DIR"
node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  js pull \
  --platform ios \
  --device "$IOS_UDID" \
  --output "$JS_DIR" 2>&1 | tee "$LOG_DIR/js-pull.log"

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  js report \
  --input "$JS_DIR/coverage-final.json" \
  --output "$JS_DIR" \
  --cwd "$APP_DIR" \
  --nyc-config "$APP_DIR/nyc.config.js" 2>&1 | tee "$LOG_DIR/js-report.log"

node "$ROOT/scripts/ci/assert-js-lcov.js" "$JS_DIR/lcov.info" \
  2>&1 | tee "$LOG_DIR/js-assert.log"

echo "OK cell=$CELL lcov=$COV_DIR/lcov.info js=$JS_DIR/lcov.info"
