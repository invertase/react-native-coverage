#!/usr/bin/env bash
# Android Appium e2e against Expo example + Jacoco assert (optional cell).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPORT_DIR="${REPORT_DIR:-$ROOT/artifacts/e2e}"
LOG_DIR="${REPORT_DIR}/logs/android"
COV_DIR="${REPORT_DIR}/coverage/android"
mkdir -p "$LOG_DIR" "$COV_DIR"

APP_DIR="$ROOT/example"
CONFIG_PATH="$APP_DIR/react-native-coverage.config.js"
PACKAGE_ID="com.example.coverage"
APK="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
METRO_PORT="${METRO_PORT:-8081}"
APPIUM_PORT="${APPIUM_PORT:-4723}"

cd "$ROOT"
yarn prepare

echo "==> Assemble debug APK (instrumented)"
(
  cd "$APP_DIR/android"
  ./gradlew :app:assembleDebug :app:jacocoDebug --no-daemon
) 2>&1 | tee "$LOG_DIR/gradle-assemble.log"

if [[ ! -f "$APK" ]]; then
  echo "Missing APK at $APK" >&2
  exit 1
fi

ADB="${ANDROID_HOME:+$ANDROID_HOME/platform-tools/}adb"
ADB="${ADB:-adb}"

echo "==> Wait for emulator/device"
"$ADB" wait-for-device
"$ADB" shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'

# Debug APK loads JS from Metro on the host. The emulator's localhost is itself —
# without reverse, the app never fetches the bundle (no Metro "Android Bundled"
# line) and Appium never sees coverage-status.
echo "==> adb reverse tcp:${METRO_PORT} -> host :${METRO_PORT}"
"$ADB" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
"$ADB" reverse --list | tee "$LOG_DIR/adb-reverse.txt" || true

export ANDROID_APP_PACKAGE="$PACKAGE_ID"
export ANDROID_APP_PATH="$APK"
export ANDROID_APP_ACTIVITY=".MainActivity"

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
  "$ADB" reverse --remove "tcp:${METRO_PORT}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Start Metro on :${METRO_PORT}"
(
  cd "$APP_DIR"
  # CI=1 disables reload; avoid RN DevTools chrome-sandbox abort noise on GHA Linux.
  CI=1 EXPO_NO_TELEMETRY=1 yarn start --port "$METRO_PORT"
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
  echo "Metro failed to start on :${METRO_PORT}" >&2
  cat "$LOG_DIR/metro.log" >&2 || true
  exit 1
fi

"$ADB" uninstall "$PACKAGE_ID" >/dev/null 2>&1 || true
"$ADB" install -r "$APK"

(
  cd "$ROOT/e2e"
  npx appium driver install uiautomator2 >/dev/null 2>&1 || true
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
  echo "Appium failed to start on :${APPIUM_PORT}" >&2
  cat "$LOG_DIR/appium.log" >&2 || true
  exit 1
fi

echo "==> Pre-WDIO android diagnostics"
{
  echo "=== adb devices ==="
  "$ADB" devices -l || true
  echo "=== adb reverse --list ==="
  "$ADB" reverse --list || true
  echo "=== metro status ==="
  curl -sf "http://127.0.0.1:${METRO_PORT}/status" || curl -sf "http://127.0.0.1:${METRO_PORT}/" || true
  echo
} | tee "$LOG_DIR/pre-wdio-android.txt"

set +e
(
  cd "$ROOT/e2e"
  yarn test:android
) 2>&1 | tee "$LOG_DIR/wdio.log"
WDIO_RC=${PIPESTATUS[0]}
set -e

if [[ "$WDIO_RC" -ne 0 ]]; then
  echo "==> WDIO failed (rc=${WDIO_RC}); dumping android diagnostics"
  {
    echo "=== metro.log (tail) ==="
    tail -n 80 "$LOG_DIR/metro.log" || true
    echo "=== uiautomator dump ==="
    "$ADB" shell uiautomator dump /sdcard/window_dump.xml >/dev/null 2>&1 || true
    "$ADB" shell cat /sdcard/window_dump.xml 2>/dev/null || true
    echo "=== logcat (ReactNativeJS / Expo / AndroidRuntime) ==="
    "$ADB" logcat -d -t 200 '*:S' ReactNativeJS:V ReactNative:V Expo:V AndroidRuntime:E ActivityManager:I || true
  } | tee "$LOG_DIR/post-wdio-android.txt"
  exit "$WDIO_RC"
fi

"$ADB" shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
sleep 1

# JacocoReport only sees *.ec under the app (or library) buildDir. Pulling into
# artifacts/ alone leaves :app:jacocoTestReport SKIPPED with empty executionData.
EC_DIR="$APP_DIR/android/app/build/outputs/code_coverage"
mkdir -p "$EC_DIR"

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  android pull \
  --output "$EC_DIR" 2>&1 | tee "$LOG_DIR/android-pull.log"

cp -f "$EC_DIR/emulator_coverage.ec" "$COV_DIR/emulator_coverage.ec"

(
  cd "$APP_DIR/android"
  ./gradlew :app:jacocoTestReport --no-daemon
) 2>&1 | tee "$LOG_DIR/jacoco-report.log"

XML="$APP_DIR/android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml"
if [[ ! -f "$XML" ]]; then
  echo "Missing Jacoco XML at $XML (jacocoTestReport likely SKIPPED — no .ec under app/build)" >&2
  find "$APP_DIR/android/app/build" -name '*.ec' -o -name 'jacocoTestReport*' 2>/dev/null | head -40 >&2 || true
  exit 1
fi
cp "$XML" "$COV_DIR/jacocoTestReport.xml"

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  assert \
  --platform android \
  --jacoco-xml "$COV_DIR/jacocoTestReport.xml" 2>&1 | tee "$LOG_DIR/android-assert.log"

echo "OK android jacoco=$COV_DIR/jacocoTestReport.xml"
