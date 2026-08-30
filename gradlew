#!/usr/bin/env bash
# Shim for global pre-commit hook (expects ./gradlew ktlintFormat -PinternalKtlintGitFilter=...).
# Real Android builds use example/android or consumer apps — not this root.
set -euo pipefail
if [[ "$*" != *ktlintFormat* ]]; then
  echo "react-native-coverage root ./gradlew shim only supports ktlintFormat (got: $*)" >&2
  exit 1
fi
filter=""
for a in "$@"; do
  case "$a" in
    -PinternalKtlintGitFilter=*) filter="${a#*=}" ;;
  esac
done
if [[ -z "$filter" ]]; then
  echo "No -PinternalKtlintGitFilter files; nothing to format."
  exit 0
fi
if ! command -v ktlint >/dev/null 2>&1; then
  echo "ktlint not on PATH; install with: brew install ktlint" >&2
  exit 1
fi
# Property may contain newlines or spaces between paths
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if [[ -f "$f" ]]; then
    ktlint --format "$f"
  fi
done <<< "$(printf '%s\n' $filter)"
