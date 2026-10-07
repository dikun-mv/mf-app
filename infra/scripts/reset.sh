#!/bin/sh
# Reset both data services to their seed (T3.8, ADR 031).
#
#   infra/scripts/reset.sh
#
# Stops people-pb and delivery-pb, empties each /pb_data volume, and starts them again.
# PocketBase then finds no database, runs every migration from 001 and seeds it. The
# gateway, the shell and the remotes keep running (their /api/… routes answer 502 for a
# few seconds). The other way to the same state is `docker compose down -v`, which also
# removes the containers and the other volumes.
#
# The start is in an EXIT trap, so a failure half way (a volume that can't be emptied,
# Ctrl-C) doesn't leave the services down.
set -eu

cd "$(dirname "$0")/../.."

SERVICES="people-pb delivery-pb"

start() {
  # shellcheck disable=SC2086 # the list is meant to split
  docker compose up -d --wait $SERVICES
}
trap start EXIT

# shellcheck disable=SC2086
docker compose stop $SERVICES

for service in $SERVICES; do
  # --no-deps: nothing else is started. --entrypoint: the image's command would be `serve`.
  docker compose run --rm --no-deps --entrypoint sh "$service" -c 'rm -rf /pb_data/*'
done
