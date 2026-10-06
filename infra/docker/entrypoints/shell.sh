#!/bin/sh
# Shell container start-up hook (ADR 031). Runs from /docker-entrypoint.d/ in the
# nginx image, before nginx starts, and writes /config.json from the environment.
#
# POSIX sh only: the image has busybox, no bash and no jq. Variables that are
# unset or empty fall back to their defaults.
#
#   PEOPLE_REMOTE_URL     default /remotes/people/remoteEntry.js
#   DELIVERY_REMOTE_URL   default /remotes/delivery/remoteEntry.js
#   FX_TABLE              default EUR=1,USD=1.08,GBP=0.85   (CODE=units per 1 EUR)
#   DEFAULT_CURRENCY      default EUR
#   USERS                 default user-1=Demo Planner,user-2=Demo Lead   (id=name)
#   CONFIG_OUT            default /usr/share/nginx/html/config.json (for tests)
#
# Malformed input stops the container with a message, so a typo shows up at
# `docker compose up` and not as a blank page.

set -eu

PEOPLE_REMOTE_URL="${PEOPLE_REMOTE_URL:-/remotes/people/remoteEntry.js}"
DELIVERY_REMOTE_URL="${DELIVERY_REMOTE_URL:-/remotes/delivery/remoteEntry.js}"
FX_TABLE="${FX_TABLE:-EUR=1,USD=1.08,GBP=0.85}"
DEFAULT_CURRENCY="${DEFAULT_CURRENCY:-EUR}"
USERS="${USERS:-user-1=Demo Planner,user-2=Demo Lead}"
CONFIG_OUT="${CONFIG_OUT:-/usr/share/nginx/html/config.json}"

fail() {
  echo "shell entrypoint: $*" >&2
  exit 1
}

# Escapes a string for use inside a JSON string literal: backslash, quote, and
# control characters that can't appear in an env var line anyway.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

# Splits "$1" on commas and calls "$2" with each non-empty item.
each_item() {
  _list="$1"
  _fn="$2"
  _old_ifs="$IFS"
  IFS=','
  # Field splitting is the point here; globbing off so '*' stays literal.
  set -f
  # shellcheck disable=SC2086
  set -- $_list
  set +f
  IFS="$_old_ifs"
  for _item in "$@"; do
    [ -n "$_item" ] && "$_fn" "$_item"
  done
  return 0
}

currencies=""
add_currency() {
  case "$1" in
    *=*) ;;
    *) fail "FX_TABLE entry '$1' must look like CODE=number" ;;
  esac
  _code="${1%%=*}"
  _rate="${1#*=}"
  printf '%s' "$_code" | grep -Eq '^[A-Z]{3}$' ||
    fail "FX_TABLE code '$_code' must be three capital letters"
  # A JSON number (no leading zeros) that is greater than zero, like the shell's
  # schema requires.
  printf '%s' "$_rate" | grep -Eq '^(0|[1-9][0-9]*)(\.[0-9]+)?$' ||
    fail "FX_TABLE rate '$_rate' for $_code must be a plain number such as 1 or 0.85 (no leading zeros)"
  printf '%s' "$_rate" | grep -q '[1-9]' ||
    fail "FX_TABLE rate '$_rate' for $_code must be greater than zero"
  [ "$currencies" ] && currencies="$currencies,"
  currencies="$currencies{\"code\":\"$_code\",\"perEur\":$_rate}"
  seen_codes="$seen_codes $_code"
}

users_json=""
USER_ID_PATTERN='^user-([0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
add_user() {
  case "$1" in
    *=*) ;;
    *) fail "USERS entry '$1' must look like id=name" ;;
  esac
  _id="${1%%=*}"
  _name="${1#*=}"
  [ -n "$_id" ] && [ -n "$_name" ] || fail "USERS entry '$1' needs a non-empty id and name"
  # The id pattern of UserId in host-contract: user-<digits> or user-<lowercase uuid>.
  printf '%s' "$_id" | grep -Eq "$USER_ID_PATTERN" ||
    fail "USERS id '$_id' must look like user-1 or user-<uuid>"
  [ "$users_json" ] && users_json="$users_json,"
  users_json="$users_json{\"id\":\"$(json_escape "$_id")\",\"name\":\"$(json_escape "$_name")\"}"
}

seen_codes=""
each_item "$FX_TABLE" add_currency
[ -n "$currencies" ] || fail "FX_TABLE is empty"
# One code, checked for shape first so that it can only match a whole entry.
printf '%s' "$DEFAULT_CURRENCY" | grep -Eq '^[A-Z]{3}$' ||
  fail "DEFAULT_CURRENCY '$DEFAULT_CURRENCY' must be three capital letters"
case " $seen_codes " in
  *" $DEFAULT_CURRENCY "*) ;;
  *) fail "DEFAULT_CURRENCY '$DEFAULT_CURRENCY' is not in FX_TABLE ($seen_codes )" ;;
esac

each_item "$USERS" add_user
[ -n "$users_json" ] || fail "USERS is empty"

cat >"$CONFIG_OUT" <<EOF
{
  "remotes": {
    "people": "$(json_escape "$PEOPLE_REMOTE_URL")",
    "delivery": "$(json_escape "$DELIVERY_REMOTE_URL")"
  },
  "currencies": [$currencies],
  "defaultCurrency": "$DEFAULT_CURRENCY",
  "users": [$users_json]
}
EOF

echo "shell entrypoint: wrote $CONFIG_OUT (people=$PEOPLE_REMOTE_URL, delivery=$DELIVERY_REMOTE_URL)"
