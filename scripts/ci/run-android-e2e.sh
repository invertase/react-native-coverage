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

export ANDROID_APP_PACKAGE="$PACKAGE_ID"
export ANDROID_APP_PATH="$APK"
export ANDROID_APP_ACTIVITY=".MainActivity"

METRO_PID=""
APPIUM_PID=""
cleanup() {
  if [[ -n "${APPIUM_PID}" ]] && kill -0 "$APPIUM_PID" 2>/dev/null; then
    kill "$APPIUM_PID" 2>/dev/null || true
  fi
  if [[ -n "${METRO_PID}" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "==> Start Metro"
(
  cd "$APP_DIR"
  CI=1 yarn start --port 8081
) >"$LOG_DIR/metro.log" 2>&1 &
METRO_PID=$!
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:8081/status" >/dev/null; then
    break
  fi
  if curl -sf "http://127.0.0.1:8081/" >/dev/null; then
    break
  fi
  sleep 1
done

"$ADB" uninstall "$PACKAGE_ID" >/dev/null 2>&1 || true
"$ADB" install -r "$APK"

(
  cd "$ROOT/e2e"
  npx appium driver install uiautomator2 >/dev/null 2>&1 || true
  npx appium --address 127.0.0.1 --port 4723
) >"$LOG_DIR/appium.log" 2>&1 &
APPIUM_PID=$!
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:4723/status" >/dev/null; then
    break
  fi
  sleep 1
done

(
  cd "$ROOT/e2e"
  yarn test:android
) 2>&1 | tee "$LOG_DIR/wdio.log"

"$ADB" shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
sleep 1

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  android pull \
  --output "$COV_DIR" 2>&1 | tee "$LOG_DIR/android-pull.log"

(
  cd "$APP_DIR/android"
  ./gradlew :app:jacocoTestReport --no-daemon
) 2>&1 | tee "$LOG_DIR/jacoco-report.log"

XML="$APP_DIR/android/app/build/reports/jacoco/jacocoTestReport/jacocoTestReport.xml"
cp "$XML" "$COV_DIR/jacocoTestReport.xml"

node "$ROOT/bin/rn-coverage.js" \
  -c "$CONFIG_PATH" \
  --strict \
  assert \
  --platform android \
  --jacoco-xml "$COV_DIR/jacocoTestReport.xml" 2>&1 | tee "$LOG_DIR/android-assert.log"

echo "OK android jacoco=$COV_DIR/jacocoTestReport.xml"
