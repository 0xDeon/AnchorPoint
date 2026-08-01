#!/usr/bin/env bash

set -euo pipefail

BASE_URL="${BASE_URL:-}"
SMOKE_TEST_ACCOUNT="${SMOKE_TEST_ACCOUNT:-}"
CONNECT_TIMEOUT="${SMOKE_TEST_CONNECT_TIMEOUT:-10}"
MAX_TIME="${SMOKE_TEST_MAX_TIME:-30}"
FAILURES=0

if [[ -z "$BASE_URL" ]]; then
  printf '[smoke-test][ERROR] BASE_URL must be set.\n' >&2
  exit 2
fi

if [[ -z "$SMOKE_TEST_ACCOUNT" ]]; then
  printf '[smoke-test][ERROR] SMOKE_TEST_ACCOUNT must be set.\n' >&2
  exit 2
fi

if [[ ! "$SMOKE_TEST_ACCOUNT" =~ ^G[A-Z2-7]{55}$ ]]; then
  printf '[smoke-test][ERROR] SMOKE_TEST_ACCOUNT must be a valid Stellar public key.\n' >&2
  exit 2
fi

BASE_URL="${BASE_URL%/}"

check_endpoint() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local status
  local -a curl_args=(
    --silent
    --show-error
    --output /dev/null
    --write-out '%{http_code}'
    --connect-timeout "$CONNECT_TIMEOUT"
    --max-time "$MAX_TIME"
    --request "$method"
  )

  if [[ -n "$body" ]]; then
    curl_args+=(--header 'Content-Type: application/json' --data "$body")
  fi

  if ! status="$(curl "${curl_args[@]}" "${BASE_URL}${path}")"; then
    printf '[smoke-test][FAIL] %s %s (request failed)\n' "$method" "$path" >&2
    FAILURES=$((FAILURES + 1))
    return
  fi

  if [[ "$status" != "200" ]]; then
    printf '[smoke-test][FAIL] %s %s (HTTP %s)\n' "$method" "$path" "$status" >&2
    FAILURES=$((FAILURES + 1))
    return
  fi

  printf '[smoke-test][PASS] %s %s (HTTP 200)\n' "$method" "$path"
}

check_endpoint GET '/info'
check_endpoint POST '/sep10/challenge' "{\"account\":\"${SMOKE_TEST_ACCOUNT}\"}"
check_endpoint GET '/sep24/info'
check_endpoint GET '/sep38/info'

if [[ "$FAILURES" -gt 0 ]]; then
  printf '[smoke-test][ERROR] %s endpoint check(s) failed.\n' "$FAILURES" >&2
  exit 1
fi

printf '[smoke-test] All endpoint checks passed.\n'
