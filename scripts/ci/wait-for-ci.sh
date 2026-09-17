#!/usr/bin/env bash
set -euo pipefail

classify_run() {
  local expected_sha="$1"
  local observed_sha="$2"
  local status="$3"
  local conclusion="$4"

  [[ "$observed_sha" == "$expected_sha" ]] || {
    echo "mismatch"
    return
  }
  if [[ "$status" != "completed" ]]; then
    echo "pending"
  elif [[ "$conclusion" == "success" ]]; then
    echo "success"
  else
    echo "failure"
  fi
}

if [[ "${WAIT_FOR_CI_SELF_TEST:-0}" == "1" ]]; then
  [[ "$(classify_run abc abc completed success)" == "success" ]]
  [[ "$(classify_run abc abc in_progress '')" == "pending" ]]
  [[ "$(classify_run abc abc completed failure)" == "failure" ]]
  [[ "$(classify_run abc abc completed cancelled)" == "failure" ]]
  [[ "$(classify_run abc def completed success)" == "mismatch" ]]
  echo "wait-for-ci self-test: ok"
  exit 0
fi

REPOSITORY="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
DISPATCH_SHA="${GITHUB_SHA:?GITHUB_SHA is required}"
# CI runs unit work before parallel e2e jobs that may each consume 90 minutes.
# Poll for up to 120 minutes for a completed run on this exact dispatch SHA.
MAX_ATTEMPTS="${CI_WAIT_MAX_ATTEMPTS:-240}"
POLL_SECONDS="${CI_WAIT_POLL_SECONDS:-30}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  run="$(
    gh api --method GET \
      "repos/${REPOSITORY}/actions/workflows/ci.yml/runs" \
      -f "head_sha=${DISPATCH_SHA}" \
      -f per_page=20 \
      --jq '.workflow_runs
        | map(select(.head_sha == "'"${DISPATCH_SHA}"'"))
        | sort_by(.created_at)
        | reverse
        | .[0]
        | if . == null then "" else [.head_sha, .status, (.conclusion // ""), .html_url] | @tsv end'
  )"

  if [[ -z "$run" ]]; then
    echo "CI wait $attempt/$MAX_ATTEMPTS: no CI run yet for $DISPATCH_SHA"
  else
    IFS=$'\t' read -r observed_sha status conclusion url <<<"$run"
    result="$(classify_run "$DISPATCH_SHA" "$observed_sha" "$status" "$conclusion")"
    echo "CI wait $attempt/$MAX_ATTEMPTS: sha=$observed_sha status=$status conclusion=${conclusion:-none} $url"
    case "$result" in
      success) exit 0 ;;
      failure)
        echo "Exact-SHA CI completed without success: $url" >&2
        exit 1
        ;;
      mismatch)
        echo "GitHub returned a different SHA; refusing it" >&2
        exit 1
        ;;
    esac
  fi

  [[ "$attempt" -eq "$MAX_ATTEMPTS" ]] || sleep "$POLL_SECONDS"
done

echo "Timed out waiting for successful CI on exact SHA $DISPATCH_SHA" >&2
exit 1
