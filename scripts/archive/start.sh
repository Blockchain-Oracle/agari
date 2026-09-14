#!/bin/bash
# Starts the S0 price archivers detached (own process group), skipping any already running. Safe to rerun after a
# reboot or sleep: Pyth backfills until the trial ends; RedStone keeps ≈ 24 h, so restart within a day.
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p data/archive/logs
start() {
  local name=$1; shift
  local pidfile="data/archive/$name.pid"
  if [[ -f $pidfile ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; then echo "$name already running (pid $(cat "$pidfile"))"; return; fi
  perl scripts/archive/detach.pl node --env-file-if-exists=.env.local "$@" >> "data/archive/logs/$name.log" 2>&1 &
  echo $! > "$pidfile"
  echo "$name started (pid $!)"
}
start pyth scripts/archive/pyth-trial.mjs --from 2026-09-11 --until 2026-09-27 --follow
start redstone scripts/archive/redstone.mjs --follow
