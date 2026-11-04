#!/usr/bin/env bash
# Compatibility wrapper for the old systemd Linux server installer.
# The unified installer lives in install.sh.

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -x "${SCRIPT_DIR}/install.sh" ]; then
    exec "${SCRIPT_DIR}/install.sh" --kiosk --method=systemd "$@"
fi

# Standalone download fallback: fetch and run the unified installer.
curl -fsSL "https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh" \
    | bash -s -- --kiosk --method=systemd "$@"
