#!/bin/bash
# Wrapper that keeps kings_spice_new_import.py running until every
# genuinely-new product has been imported, restarting it automatically
# if it crashes, finishes early, or gets killed.
#
# Usage: ./run_kings_spice.sh

set -uo pipefail
cd "$(dirname "$0")"

SCRIPT="kings_spice_new_import.py"
WRAPPER_LOG="run_kings_spice_wrapper.log"

if [ -f ./.env ]; then
    set -a
    source ./.env
    set +a
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$WRAPPER_LOG"
}

parse_value() {
    # $1 = key (e.g. LIVE_COUNT), $2 = command output
    echo "$2" | grep -o "${1}=[0-9]*" | tail -n1 | cut -d= -f2
}

# --- Compute the expected final product count once, up front -------------
log "Computing baseline: live product count + genuinely-new item count..."

live_output=$(python3 "$SCRIPT" --live-count 2>&1)
live_count=$(parse_value "LIVE_COUNT" "$live_output")

remaining_output=$(python3 "$SCRIPT" --count-remaining 2>&1)
remaining_count=$(parse_value "REMAINING_NEW" "$remaining_output")

if [ -z "$live_count" ] || [ -z "$remaining_count" ]; then
    log "FATAL: could not compute baseline counts (live_output=$live_output remaining_output=$remaining_output)"
    exit 1
fi

expected_total=$((live_count + remaining_count))
log "Baseline: live_count=$live_count, genuinely_new=$remaining_count, expected_total=$expected_total"

# --- Loop: run the importer, restart until expected_total is reached -----
MAX_STALLED_RESTARTS=5
stalled_restarts=0
last_live_count=$live_count

attempt=0
while true; do
    attempt=$((attempt + 1))
    log "Starting $SCRIPT (attempt #$attempt)"

    python3 "$SCRIPT"
    exit_code=$?
    log "$SCRIPT exited with code $exit_code"

    sleep 5

    live_output=$(python3 "$SCRIPT" --live-count 2>&1)
    live_count=$(parse_value "LIVE_COUNT" "$live_output")

    if [ -z "$live_count" ]; then
        log "Could not read live product count (output: $live_output); restarting to be safe."
        continue
    fi

    remaining=$((expected_total - live_count))
    if [ "$remaining" -le 0 ]; then
        echo "IMPORT COMPLETE"
        log "live_count=$live_count has reached expected_total=$expected_total. IMPORT COMPLETE."
        break
    fi

    if [ "$live_count" -gt "$last_live_count" ]; then
        stalled_restarts=0
    else
        stalled_restarts=$((stalled_restarts + 1))
    fi
    last_live_count=$live_count

    if [ "$stalled_restarts" -ge "$MAX_STALLED_RESTARTS" ]; then
        echo "STALLED - manual check needed"
        log "No net progress (live_count stuck at $live_count) across $stalled_restarts consecutive restarts. STALLED - manual check needed."
        exit 1
    fi

    log "$remaining item(s) still remaining (live_count=$live_count, expected_total=$expected_total, stalled_restarts=$stalled_restarts). Restarting..."
done
