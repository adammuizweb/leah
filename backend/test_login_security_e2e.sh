#!/bin/bash
set -euo pipefail

: "${ROOT_PASSWORD:?ROOT_PASSWORD is required}"
: "${ROOT_EMAIL:?ROOT_EMAIL is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
: "${TEST_USER_EMAIL:?TEST_USER_EMAIL is required}"
: "${TEST_USER_PASSWORD:?TEST_USER_PASSWORD is required}"

base="${LEAH_API_URL:-http://127.0.0.1:8080/api}"
response=$(mktemp)
trap 'rm -f "$response"' EXIT

login() {
    local email="$1"
    local password="$2"
    local ip="$3"
    curl -sS -f -X POST "$base/auth/login" \
        -H 'Content-Type: application/json' -H "X-Real-IP: $ip" \
        --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

root_login=$(login "$ROOT_EMAIL" "$ROOT_PASSWORD" 198.51.100.1)
root_token=$(jq -er '.token' <<<"$root_login")
root_id=$(jq -er '.user.id' <<<"$root_login")
jq -e '.user.is_root == true' <<<"$root_login" >/dev/null

admin_token=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 198.51.100.2 | jq -er '.token')
test "$(curl -sS -o /dev/null -w '%{http_code}' "$base/security/login" -H "Authorization: Bearer $admin_token")" = "403"
test "$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "$base/users/$root_id/password" -H "Authorization: Bearer $admin_token" -H 'Content-Type: application/json' --data '{"password":"must-not-change"}')" = "403"
test "$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "$base/users/$root_id" -H "Authorization: Bearer $admin_token")" = "403"

original=$(curl -sS -f "$base/security/login" -H "Authorization: Bearer $root_token")
restore=$(jq -c '{enabled, attempt_window_minutes, ip_attempt_limit, account_attempt_limit, account_lock_minutes}' <<<"$original")
test_user_id=$(curl -sS -f "$base/users" -H "Authorization: Bearer $root_token" | jq -er --arg email "$TEST_USER_EMAIL" '.[] | select(.email == $email) | .id')

cleanup() {
    curl -sS -o /dev/null -X POST "$base/users/$test_user_id/unlock" -H "Authorization: Bearer $root_token" || true
    curl -sS -o /dev/null -X DELETE "$base/security/login-attempts" -H "Authorization: Bearer $root_token" || true
    curl -sS -o /dev/null -X PUT "$base/security/login" -H "Authorization: Bearer $root_token" -H 'Content-Type: application/json' --data "$restore" || true
}
trap 'cleanup; rm -f "$response"' EXIT

curl -sS -f -o /dev/null -X PUT "$base/security/login" -H "Authorization: Bearer $root_token" -H 'Content-Type: application/json' \
    --data '{"enabled":true,"attempt_window_minutes":1,"ip_attempt_limit":2,"account_attempt_limit":2,"account_lock_minutes":1}'

request_login() {
    local ip="$1"
    local email="$2"
    local password="$3"
    curl -sS -o "$response" -w '%{http_code}' -X POST "$base/auth/login" \
        -H 'Content-Type: application/json' -H "X-Real-IP: $ip" \
        --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

test "$(request_login 198.51.100.11 "$TEST_USER_EMAIL" wrong)" = "401"
first_body=$(<"$response")
test "$(request_login 198.51.100.12 "$TEST_USER_EMAIL" wrong)" = "401"
test "$(<"$response")" = "$first_body"
test "$(request_login 198.51.100.13 "$TEST_USER_EMAIL" "$TEST_USER_PASSWORD")" = "401"
test "$(<"$response")" = "$first_body"
test "$(request_login 198.51.100.14 unknown@example.test wrong)" = "401"
test "$(<"$response")" = "$first_body"

test "$(request_login 198.51.100.15 "$ROOT_EMAIL" wrong)" = "401"
test "$(request_login 198.51.100.16 "$ROOT_EMAIL" wrong)" = "401"
test "$(request_login 198.51.100.17 "$ROOT_EMAIL" "$ROOT_PASSWORD")" = "200"

admin_users=$(curl -sS -f "$base/users" -H "Authorization: Bearer $admin_token")
jq -e --arg email "$TEST_USER_EMAIL" '.[] | select(.email == $email) | has("locked_until") == false' <<<"$admin_users" >/dev/null

test "$(request_login 198.51.100.20 another-unknown@example.test wrong)" = "401"
test "$(request_login 198.51.100.20 another-unknown@example.test wrong)" = "429"
jq -e '.retry_after > 0' "$response" >/dev/null

curl -sS -f -o /dev/null -X POST "$base/users/$test_user_id/unlock" -H "Authorization: Bearer $root_token"
test "$(request_login 198.51.100.30 "$TEST_USER_EMAIL" "$TEST_USER_PASSWORD")" = "200"

printf 'root_only=ok generic_auth_errors=ok ip_limit=429 lock_unlock=ok\n'
