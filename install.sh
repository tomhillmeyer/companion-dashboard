#!/usr/bin/env bash
# Companion Dashboard Universal Linux Installer
#
# Supports:
#   - Raspberry Pi 4 and Raspberry Pi 5 (64-bit Raspberry Pi OS Lite or Full)
#   - Debian / Ubuntu amd64 and arm64
#
# Modes:
#   kiosk    X + openbox + systemd kiosk service (default on Lite images)
#   desktop  Install the .deb only; leave the desktop environment alone
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- --kiosk --force-hdmi
#   sudo ./install.sh --doctor
#   sudo ./install.sh --uninstall

set -Eeuo pipefail

REPO="tomhillmeyer/companion-dashboard"
SERVICE_NAME="companion-dashboard"
INSTALL_DIR="/opt/companion-dashboard"
APP_DIR="/opt/Companion Dashboard"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
XORG_CONF="/etc/X11/xorg.conf.d/99-companion-dashboard.conf"
DEFAULTS_FILE="/etc/default/companion-dashboard"
STATE_DIR="/etc/companion-dashboard"

MODE="auto"            # auto | kiosk | desktop
METHOD="systemd"       # systemd | profile
VERSION_TAG=""
VERSION=""
DOCTOR=false
UNINSTALL=false
PURGE=false
FORCE_HDMI=false
SHOW_HELP=false
INSTALLED_VIA_DEB=false

ACTUAL_USER=""
ACTUAL_GROUP=""
USER_HOME=""
ARCH=""
MODEL=""
PI_GEN=""
IS_RASPBERRY_PI=false
OS_ID=""
OS_CODENAME=""
OS_PRETTY=""
DEFAULT_TARGET=""
DM_NAME=""
DM_INSTALLED=false
HAS_DISPLAY_MANAGER=false
HAS_DESKTOP=false
KIOSK_INSTALLED=false
TMP_DIR=""

SCRIPT_DIR=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ "${BASH_SOURCE[0]}" != "bash" ] && [ -f "${BASH_SOURCE[0]}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
info()  { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
error() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }

cleanup() {
    if [ -n "${TMP_DIR:-}" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
    if [ -n "${CD_SELF_TMP:-}" ]; then
        rm -f "$CD_SELF_TMP"
    fi
}
trap cleanup EXIT

usage() {
    cat <<EOF
Companion Dashboard Linux Installer

Usage: install.sh [options]

Options:
  --kiosk              Kiosk mode is the default; kept for compatibility
  --desktop            Advanced: install the .deb only; leave the desktop alone
  --method=systemd     Use a systemd kiosk service (default)
  --method=profile     Use getty autologin + ~/.bash_profile (legacy)
  --version=<tag>      Install a specific release (e.g. v1.6.0)
  --force-hdmi         Add hdmi_force_hotplug=1 (Raspberry Pi)
  --doctor             Print diagnostics and exit
  --uninstall          Remove the kiosk service/config and the package
  --purge              With --uninstall, also remove app user data
  -h, --help           Show this help

Examples:
  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --kiosk --force-hdmi
  sudo ./install.sh --doctor
  sudo ./install.sh --uninstall

Notes:
  - A 64-bit OS is required on Raspberry Pi 4 and Raspberry Pi 5.
  - Kiosk mode is the default on both Lite and Full images. On a Full image the
    installer replaces the desktop with the kiosk on the next boot. Use
    --desktop to keep the desktop and install the app as a normal application.
EOF
}

# ---------------------------------------------------------------------------
# Argument parsing / privilege handling
# ---------------------------------------------------------------------------
parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --kiosk)        MODE="kiosk" ;;
            --desktop)      MODE="desktop" ;;
            --method=*)     METHOD="${1#*=}" ;;
            --version=*)    VERSION_TAG="${1#*=}" ;;
            --doctor)       DOCTOR=true ;;
            --uninstall)    UNINSTALL=true ;;
            --purge)        PURGE=true ;;
            --force-hdmi)   FORCE_HDMI=true ;;
            -h|--help)      SHOW_HELP=true ;;
            *)              error "Unknown option: $1 (use --help)" ;;
        esac
        shift
    done

    case "$METHOD" in
        systemd|profile) ;;
        *) error "Invalid --method: ${METHOD} (use systemd or profile)" ;;
    esac
}

require_root_or_reexec() {
    if [ "$EUID" -eq 0 ]; then
        return 0
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        error "This installer requires root privileges. Install sudo or run as root."
    fi

    if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/install.sh" ]; then
        info "Re-running with sudo..."
        exec sudo -E bash "$SCRIPT_DIR/install.sh" "$@"
    fi

    # Piped to bash: download a temporary copy and re-run it as root.
    info "Re-running with sudo (downloading a temporary copy)..."
    local tmp
    tmp="$(mktemp /tmp/companion-dashboard-install.XXXXXX.sh)"
    if ! curl -fsSL "https://raw.githubusercontent.com/${REPO}/main/install.sh" -o "$tmp"; then
        rm -f "$tmp"
        error "Could not download the installer. Run: sudo bash install.sh"
    fi
    chmod +x "$tmp"
    export CD_SELF_TMP="$tmp"
    exec sudo -E bash "$tmp" "$@"
}

resolve_actual_user() {
    local user=""

    if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
        user="$SUDO_USER"
    elif [ -n "${SUDO_UID:-}" ]; then
        user="$(getent passwd "$SUDO_UID" 2>/dev/null | cut -d: -f1 || true)"
    fi

    if [ -z "$user" ]; then
        user="$(logname 2>/dev/null || true)"
    fi

    if [ -z "$user" ] || [ "$user" = "root" ]; then
        error "Could not determine the non-root user. Run the installer as your normal user (curl ... | bash) or set SUDO_USER."
    fi

    ACTUAL_USER="$user"
    ACTUAL_GROUP="$(id -gn "$ACTUAL_USER" 2>/dev/null || echo "$ACTUAL_USER")"
    USER_HOME="$(getent passwd "$ACTUAL_USER" 2>/dev/null | cut -d: -f6 || true)"

    if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then
        USER_HOME="$(eval echo "~$ACTUAL_USER")"
    fi
    if [ ! -d "$USER_HOME" ]; then
        error "Home directory for $ACTUAL_USER was not found."
    fi
}

as_user() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u "$ACTUAL_USER" -- env HOME="$USER_HOME" "$@"
    else
        sudo -u "$ACTUAL_USER" -H -- "$@"
    fi
}

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
detect_platform() {
    OS_ID=""
    OS_CODENAME=""
    OS_PRETTY=""
    if [ -r /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        OS_ID="${ID:-}"
        OS_CODENAME="${VERSION_CODENAME:-}"
        OS_PRETTY="${PRETTY_NAME:-}"
    fi

    IS_RASPBERRY_PI=false
    if [ -e /etc/rpi-issue ]; then
        IS_RASPBERRY_PI=true
    fi

    MODEL=""
    if [ -r /proc/device-tree/model ]; then
        MODEL="$(tr -d '\0' < /proc/device-tree/model)"
    fi

    PI_GEN=""
    case "$MODEL" in
        *"Raspberry Pi 5"*) PI_GEN="5"; IS_RASPBERRY_PI=true ;;
        *"Raspberry Pi 4"*) PI_GEN="4"; IS_RASPBERRY_PI=true ;;
        *"Raspberry Pi"*)   PI_GEN="other"; IS_RASPBERRY_PI=true ;;
    esac

    ARCH="$(dpkg --print-architecture 2>/dev/null || true)"
    if [ -z "$ARCH" ]; then
        ARCH="$(uname -m)"
    fi
    case "$ARCH" in
        aarch64) ARCH="arm64" ;;
        x86_64)  ARCH="amd64" ;;
        armv7l)  ARCH="armhf" ;;
    esac

    DEFAULT_TARGET="$(systemctl get-default 2>/dev/null || echo unknown)"

    DM_NAME=""
    DM_INSTALLED=false
    HAS_DISPLAY_MANAGER=false
    local dm
    for dm in lightdm gdm3 sddm; do
        if [ -f "/lib/systemd/system/${dm}.service" ] || [ -f "/usr/lib/systemd/system/${dm}.service" ]; then
            DM_INSTALLED=true
            DM_NAME="$dm"
            if systemctl is-enabled --quiet "$dm" 2>/dev/null; then
                HAS_DISPLAY_MANAGER=true
            fi
            break
        fi
    done

    HAS_DESKTOP=false
    if [ "$HAS_DISPLAY_MANAGER" = true ] && [ "$DEFAULT_TARGET" = "graphical.target" ]; then
        HAS_DESKTOP=true
    fi
    if pgrep -x labwc >/dev/null 2>&1 || pgrep -x wayfire >/dev/null 2>&1; then
        HAS_DESKTOP=true
    fi

    KIOSK_INSTALLED=false
    if systemctl is-enabled --quiet "$SERVICE_NAME.service" 2>/dev/null || \
       [ -f "${STATE_DIR}/disabled-display-manager" ]; then
        KIOSK_INSTALLED=true
    fi
}

check_arch() {
    case "$ARCH" in
        arm64|amd64)
            ;;
        armhf)
            error "Companion Dashboard requires a 64-bit OS. This system reports armhf (32-bit). Reflash with Raspberry Pi OS Lite 64-bit and re-run the installer."
            ;;
        *)
            error "Unsupported architecture: ${ARCH:-unknown}. Supported: arm64, amd64."
            ;;
    esac
}

resolve_mode() {
    # Kiosk is the default on both Lite and Full images. --desktop is an
    # advanced opt-out for users who want the app as a normal desktop app.
    if [ "$MODE" = "auto" ]; then
        MODE="kiosk"
    fi

    if [ "$MODE" = "kiosk" ] && [ "$HAS_DESKTOP" = true ]; then
        warn "A desktop environment was detected (${DM_NAME:-unknown})."
        warn "The desktop will be replaced by the kiosk on the next boot."
    fi

    if [ "$MODE" = "desktop" ] && [ "$HAS_DESKTOP" != true ]; then
        warn "No desktop environment was detected; --desktop installs the app but does not configure a display."
    fi
}

# ---------------------------------------------------------------------------
# Package installation
# ---------------------------------------------------------------------------
install_packages() {
    info "Installing system dependencies..."
    export DEBIAN_FRONTEND=noninteractive

    if ! apt-get update; then
        error "apt-get update failed. Check the system clock and network connection, then re-run."
    fi

    local pkgs=(
        xserver-xorg-core
        xserver-xorg-input-libinput
        xinit
        x11-xserver-utils
        x11-utils
        openbox
        unclutter
        mesa-utils
        libgl1-mesa-dri
        xserver-xorg-legacy
        kbd
        libcap2-bin
        avahi-daemon
        avahi-utils
        curl
        ca-certificates
        fonts-dejavu-core
    )

    if [ "$IS_RASPBERRY_PI" = true ]; then
        # gldriver-test writes /etc/X11/xorg.conf.d/99-v3d.conf, which is what
        # makes Xorg choose the vc4/rp1 display device instead of v3d on a Pi 5.
        # Only add them when the packages exist in the configured repositories
        # (e.g. Raspberry Pi OS, not plain Ubuntu on a Pi).
        if apt-cache show gldriver-test >/dev/null 2>&1; then
            pkgs+=(gldriver-test)
        fi
        if apt-cache show raspi-config >/dev/null 2>&1; then
            pkgs+=(raspi-config)
        fi
    fi

    # --no-install-recommends keeps the legacy xserver-xorg-video-fbdev driver
    # (and the rest of the xorg metapackage) off the system. On a Pi 5 that
    # driver can make Xorg fall back to framebuffer mode and fail.
    if ! apt-get install -y --no-install-recommends "${pkgs[@]}"; then
        error "Failed to install system dependencies."
    fi

    systemctl enable avahi-daemon >/dev/null 2>&1 || true
    if ! systemctl start avahi-daemon >/dev/null 2>&1; then
        warn "Could not start avahi-daemon; dashboard.local mDNS may not work."
    fi
}

install_desktop_packages() {
    info "Installing desktop-mode dependencies..."
    export DEBIAN_FRONTEND=noninteractive

    if ! apt-get update; then
        error "apt-get update failed. Check the system clock and network connection, then re-run."
    fi

    # A desktop image already has a working X server. Only install the pieces
    # the dashboard needs for mDNS and binding port 80.
    if ! apt-get install -y --no-install-recommends \
        libcap2-bin avahi-daemon avahi-utils curl ca-certificates; then
        error "Failed to install desktop-mode dependencies."
    fi

    systemctl enable avahi-daemon >/dev/null 2>&1 || true
    if ! systemctl start avahi-daemon >/dev/null 2>&1; then
        warn "Could not start avahi-daemon; dashboard.local mDNS may not work."
    fi
}

# ---------------------------------------------------------------------------
# Xorg configuration (Pi 4 / Pi 5)
# ---------------------------------------------------------------------------
write_primary_gpu_config() {
    local identifier="vc4"
    local match="vc4"
    local by_path

    for by_path in /dev/dri/by-path/*-card; do
        if [ -e "$by_path" ]; then
            case "$(basename "$by_path")" in
                *vec*|*dsi*|*dpi*)
                    identifier="rp1"
                    match="rp1-vec|rp1-dsi|rp1-dpi"
                    break
                    ;;
            esac
        fi
    done

    cat > "$XORG_CONF" <<EOF
Section "OutputClass"
  Identifier "${identifier}"
  MatchDriver "${match}"
  Driver "modesetting"
  Option "PrimaryGPU" "true"
EndSection
EOF
    info "Wrote Xorg primary GPU config: $XORG_CONF"
}

configure_xorg() {
    mkdir -p /etc/X11/xorg.conf.d

    # Older Raspberry Pi images shipped this config; it forces the legacy
    # fbdev driver and is a common cause of black screens on Pi 5.
    rm -f /usr/share/X11/xorg.conf.d/99-fbturbo.conf 2>/dev/null || true

    if [ "$IS_RASPBERRY_PI" = true ]; then
        if dpkg -s gldriver-test >/dev/null 2>&1; then
            if [ -x /usr/lib/systemd/scripts/rp1_test.sh ]; then
                if ! /usr/lib/systemd/scripts/rp1_test.sh; then
                    warn "rp1_test.sh failed; falling back to a vc4 config."
                fi
            fi
        fi

        if [ -f /etc/X11/xorg.conf.d/99-v3d.conf ]; then
            info "Using Raspberry Pi Xorg config: /etc/X11/xorg.conf.d/99-v3d.conf"
            rm -f "$XORG_CONF"
        else
            write_primary_gpu_config
        fi
    fi
}

configure_force_hdmi() {
    if [ "$IS_RASPBERRY_PI" != true ]; then
        warn "--force-hdmi is only supported on Raspberry Pi; ignoring."
        return
    fi

    local config="/boot/firmware/config.txt"
    if [ ! -f "$config" ]; then
        config="/boot/config.txt"
    fi
    if [ ! -f "$config" ]; then
        warn "Could not find config.txt; skipping --force-hdmi."
        return
    fi
    if grep -qE '^[[:space:]]*hdmi_force_hotplug(:[0-9]+)?=1' "$config"; then
        info "hdmi_force_hotplug=1 is already set in $config"
        return
    fi

    cp -a "$config" "${config}.companion-dashboard.bak.$(date +%s)"
    {
        printf '\n# Companion Dashboard: force HDMI output when no display is detected at boot\n'
        printf 'hdmi_force_hotplug=1\n'
    } >> "$config"
    info "Added hdmi_force_hotplug=1 to $config"
}

# ---------------------------------------------------------------------------
# Release download / install
# ---------------------------------------------------------------------------
resolve_release_tag() {
    if [ -n "$VERSION_TAG" ]; then
        case "$VERSION_TAG" in
            v*) printf '%s\n' "$VERSION_TAG" ;;
            *)  printf 'v%s\n' "$VERSION_TAG" ;;
        esac
        return 0
    fi

    local tag=""
    tag="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
        | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
        | head -1 \
        | sed 's/.*"\([^"]*\)"$/\1/' || true)"

    if [ -z "$tag" ]; then
        # Fall back to the redirect target of /releases/latest. This avoids the
        # unauthenticated GitHub API rate limit and does not need jq.
        local location=""
        location="$(curl -fsSI "https://github.com/${REPO}/releases/latest" 2>/dev/null \
            | awk 'tolower($1)=="location:" {print $2}' \
            | tr -d '\r' \
            | tail -1 || true)"
        tag="${location##*/}"
    fi

    if [ -z "$tag" ] || [ "$tag" = "latest" ]; then
        return 1
    fi

    printf '%s\n' "$tag"
}

install_from_source() {
    local src="$1"

    info "Installing from local source: $src"
    mkdir -p "$INSTALL_DIR"
    rm -rf "$INSTALL_DIR/dist" "$INSTALL_DIR/src"
    cp -r "$src/dist" "$src/src" "$INSTALL_DIR"/
    cp "$src"/package*.json "$INSTALL_DIR"/ 2>/dev/null || true
    chown -R "$ACTUAL_USER:$ACTUAL_GROUP" "$INSTALL_DIR"

    if ! command -v npm >/dev/null 2>&1; then
        info "Installing Node.js and npm for the source installation..."
        if ! apt-get install -y --no-install-recommends nodejs npm; then
            error "npm is required for a source installation. Install Node.js and re-run."
        fi
    fi

    info "Installing Node.js dependencies (including Electron)..."
    ( cd "$INSTALL_DIR" && as_user npm install --include=dev )
    INSTALLED_VIA_DEB=false
}

install_from_source_or_fail() {
    if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/package.json" ] && [ -d "$SCRIPT_DIR/dist" ]; then
        install_from_source "$SCRIPT_DIR"
        return 0
    fi
    error "No release package could be downloaded, and no local source build was found."
}

install_deb() {
    local deb_path="$1"
    local deb_arch=""

    deb_arch="$(dpkg-deb -f "$deb_path" Architecture 2>/dev/null || true)"
    if [ "$deb_arch" != "$ARCH" ]; then
        error "Package architecture (${deb_arch:-unknown}) does not match this system (${ARCH})."
    fi
    if ! dpkg-deb -f "$deb_path" Package 2>/dev/null | grep -qx "companion-dashboard"; then
        error "File is not a Companion Dashboard package: ${deb_path}"
    fi

    if ! apt-get install -y "$deb_path"; then
        error "Failed to install the Companion Dashboard package."
    fi
    INSTALLED_VIA_DEB=true
}

install_release() {
    local local_deb=""

    # Prefer a locally built .deb when running from a checkout. This keeps the
    # existing local test workflow working (out/Companion.Dashboard-*.deb).
    if [ -n "$SCRIPT_DIR" ]; then
        local_deb="$(ls -t "$SCRIPT_DIR"/Companion.Dashboard-*-linux-"${ARCH}".deb 2>/dev/null | head -1 || true)"
        if [ -z "$local_deb" ]; then
            local_deb="$(ls -t "$SCRIPT_DIR"/out/Companion.Dashboard-*-linux-"${ARCH}".deb 2>/dev/null | head -1 || true)"
        fi
    fi
    if [ -n "$local_deb" ]; then
        info "Using local package: ${local_deb}"
        VERSION="$(basename "$local_deb" | sed -E 's/^Companion\.Dashboard-(.*)-linux-[^-]+\.deb$/\1/')"
        install_deb "$local_deb"
        return 0
    fi

    local tag=""
    if ! tag="$(resolve_release_tag)"; then
        warn "Could not determine the latest release tag."
        install_from_source_or_fail
        return 0
    fi

    VERSION="${tag#v}"
    local deb_name="Companion.Dashboard-${VERSION}-linux-${ARCH}.deb"
    local deb_url="https://github.com/${REPO}/releases/download/${tag}/${deb_name}"
    local deb_path="${TMP_DIR}/${deb_name}"

    info "Installing Companion Dashboard ${tag} (${ARCH})"
    if ! curl -fL --retry 3 --connect-timeout 20 -o "$deb_path" "$deb_url"; then
        warn "Failed to download ${deb_name}"
        warn "URL: ${deb_url}"
        install_from_source_or_fail
        return 0
    fi

    install_deb "$deb_path"
}

configure_capabilities() {
    local bin=""
    local candidate

    for candidate in \
        "${APP_DIR}/companion-dashboard" \
        "/usr/lib/companion-dashboard/companion-dashboard" \
        "${INSTALL_DIR}/node_modules/electron/dist/electron"; do
        if [ -x "$candidate" ]; then
            bin="$candidate"
            break
        fi
    done

    if [ -z "$bin" ]; then
        bin="$(find /opt /usr/lib "$INSTALL_DIR" -maxdepth 4 -name companion-dashboard -type f -perm -u+x 2>/dev/null | grep -v '\.sh$' | head -1 || true)"
    fi

    if [ -z "$bin" ]; then
        warn "Could not find the Companion Dashboard binary; port 80 may not work."
        return
    fi

    if setcap 'cap_net_bind_service=+ep' "$bin" 2>/dev/null; then
        info "Granted port 80 capability to ${bin}"
    else
        warn "Could not set capability on ${bin}. Port 80 may be unavailable."
        warn "Run manually: sudo setcap 'cap_net_bind_service=+ep' '${bin}'"
    fi
}

configure_ldconfig() {
    if [ -d "$APP_DIR" ]; then
        # The app directory contains a space ("Companion Dashboard"), which
        # ld.so.conf cannot represent reliably. Use a space-free symlink.
        rm -rf /opt/companion-dashboard-lib
        ln -s "$APP_DIR" /opt/companion-dashboard-lib
        echo "/opt/companion-dashboard-lib" > /etc/ld.so.conf.d/companion-dashboard.conf
        ldconfig
        info "Configured library path for ${APP_DIR}"
    fi
}

# ---------------------------------------------------------------------------
# Kiosk autostart
# ---------------------------------------------------------------------------
write_defaults() {
    cat > "$DEFAULTS_FILE" <<'EOF'
# Extra Electron flags for Companion Dashboard kiosk mode.
# Uncomment to force software rendering if the GPU fails to initialize:
# CD_ELECTRON_FLAGS="--disable-gpu"
CD_ELECTRON_FLAGS=""
EOF
}

write_start_script() {
    mkdir -p "$INSTALL_DIR"

    cat > "${INSTALL_DIR}/start-display.sh" <<'EOF'
#!/usr/bin/env bash
# Companion Dashboard kiosk launcher
set -u

cd "$(dirname "$0")" || exit 1

export NODE_ENV=production
export DISPLAY="${DISPLAY:-:0}"
export LD_LIBRARY_PATH="/opt/Companion Dashboard:/opt/companion-dashboard:${LD_LIBRARY_PATH:-}"

EXTRA_FLAGS=""
if [ -r /etc/default/companion-dashboard ]; then
    # shellcheck disable=SC1091
    . /etc/default/companion-dashboard
    EXTRA_FLAGS="${CD_ELECTRON_FLAGS:-}"
fi

APP_BIN=""
if [ -x "/usr/bin/companion-dashboard" ]; then
    APP_BIN="/usr/bin/companion-dashboard"
elif [ -x "/opt/Companion Dashboard/companion-dashboard" ]; then
    APP_BIN="/opt/Companion Dashboard/companion-dashboard"
fi

if [ -n "$APP_BIN" ]; then
    # shellcheck disable=SC2086
    exec "$APP_BIN" --no-sandbox --kiosk-mode --disable-dev-shm-usage --ozone-platform=x11 $EXTRA_FLAGS
else
    # Manual/source installation fallback.
    # shellcheck disable=SC2086
    exec npx --yes electron . --no-sandbox --kiosk-mode --disable-dev-shm-usage --ozone-platform=x11 $EXTRA_FLAGS
fi
EOF

    chmod +x "${INSTALL_DIR}/start-display.sh"
    chown "$ACTUAL_USER:$ACTUAL_GROUP" "${INSTALL_DIR}/start-display.sh"
}

write_xinitrc() {
    local xinitrc="${USER_HOME}/.xinitrc"

    if [ -f "$xinitrc" ] && ! grep -q '# >>> companion-dashboard >>>' "$xinitrc"; then
        cp -a "$xinitrc" "${xinitrc}.companion-dashboard.bak.$(date +%s)"
    fi

    cat > "$xinitrc" <<'EOF'
#!/usr/bin/env bash
# >>> companion-dashboard >>>
# Disable screen blanking and power management
xset s off || true
xset -dpms || true
xset s noblank || true

# Hide the mouse cursor after inactivity
unclutter -idle 0.1 -root &

# Start the window manager
openbox &

# Give openbox a moment to come up
sleep 2

# Launch Companion Dashboard in kiosk mode
exec /opt/companion-dashboard/start-display.sh
# <<< companion-dashboard <<<
EOF

    chown "$ACTUAL_USER:$ACTUAL_GROUP" "$xinitrc"
    chmod +x "$xinitrc"
}

remove_legacy_autostart() {
    local profile="${USER_HOME}/.bash_profile"

    # The original installer added this block. Remove it so it cannot race the
    # systemd kiosk service for tty1.
    if [ -f "$profile" ] && grep -q '# Start X at login on tty1' "$profile"; then
        cp -a "$profile" "${profile}.companion-dashboard.bak.$(date +%s)"
        sed -i '/# Start X at login on tty1/,/^fi$/d' "$profile"
        info "Removed the old .bash_profile X autostart block."
    fi

    # Also remove the newer marked block if present.
    if [ -f "$profile" ] && grep -q '# >>> companion-dashboard >>>' "$profile"; then
        cp -a "$profile" "${profile}.companion-dashboard.bak.$(date +%s)"
        sed -i '/# >>> companion-dashboard >>>/,/# <<< companion-dashboard <<</d' "$profile"
        info "Removed the old marked .bash_profile autostart block."
    fi
}

remove_legacy_getty_autologin() {
    local autologin="/etc/systemd/system/getty@tty1.service.d/autologin.conf"

    if [ -f "$autologin" ] && grep -q -- "--autologin ${ACTUAL_USER}" "$autologin"; then
        rm -f "$autologin"
        rmdir /etc/systemd/system/getty@tty1.service.d 2>/dev/null || true
        systemctl daemon-reload
        info "Removed the tty1 autologin override."
    fi
}

write_systemd_unit() {
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Companion Dashboard Kiosk
After=systemd-user-sessions.service network-online.target
Wants=network-online.target
Conflicts=getty@tty1.service
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
User=${ACTUAL_USER}
WorkingDirectory=${USER_HOME}
PAMName=login
TTYPath=/dev/tty1
StandardInput=tty
UtmpIdentifier=tty1
UtmpMode=user
Environment=XDG_SESSION_TYPE=x11
UnsetEnvironment=TERM
AmbientCapabilities=CAP_NET_BIND_SERVICE
ExecStartPre=+/usr/bin/chvt 1
ExecStart=/usr/bin/startx ${USER_HOME}/.xinitrc -- :0 vt1 -keeptty
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME.service"
    info "Enabled systemd kiosk service: $SERVICE_NAME.service"
}

configure_profile_autostart() {
    info "Configuring getty autologin + .bash_profile (legacy method)..."

    mkdir -p /etc/systemd/system/getty@tty1.service.d
    cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${ACTUAL_USER} --noclear %I \$TERM
EOF

    local profile="${USER_HOME}/.bash_profile"
    touch "$profile"
    if ! grep -q '# >>> companion-dashboard >>>' "$profile"; then
        cat >> "$profile" <<'EOF'

# >>> companion-dashboard >>>
if [ -z "$DISPLAY" ] && [ "$XDG_VTNR" = 1 ]; then
    exec startx
fi
# <<< companion-dashboard <<<
EOF
    fi
    chown "$ACTUAL_USER:$ACTUAL_GROUP" "$profile"

    systemctl disable --now "$SERVICE_NAME.service" >/dev/null 2>&1 || true
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    info "Configured tty1 autologin for ${ACTUAL_USER}."
}

restore_desktop_if_needed() {
    if [ -f "${STATE_DIR}/disabled-display-manager" ]; then
        local dm
        dm="$(cat "${STATE_DIR}/disabled-display-manager")"
        systemctl enable "$dm" >/dev/null 2>&1 || true
        rm -f "${STATE_DIR}/disabled-display-manager"
        info "Re-enabled ${dm}."
    fi

    systemctl disable --now "$SERVICE_NAME.service" >/dev/null 2>&1 || true
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload

    # Remove kiosk autostart artifacts if this system was previously in kiosk mode.
    remove_legacy_autostart
    remove_legacy_getty_autologin
    local latest=""
    local xinitrc="${USER_HOME}/.xinitrc"
    latest="$(ls -t "${xinitrc}".companion-dashboard.bak.* 2>/dev/null | head -1 || true)"
    if [ -n "$latest" ]; then
        if [ ! -f "$xinitrc" ] || grep -q '# >>> companion-dashboard >>>' "$xinitrc"; then
            mv "$latest" "$xinitrc"
            info "Restored ${xinitrc} from backup."
        fi
    elif [ -f "$xinitrc" ] && grep -q '# >>> companion-dashboard >>>' "$xinitrc"; then
        rm -f "$xinitrc"
        info "Removed the kiosk .xinitrc."
    fi
    rmdir "$STATE_DIR" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Verification / doctor
# ---------------------------------------------------------------------------
verify_install() {
    local ok=true

    if [ "$MODE" = "kiosk" ]; then
        if ! systemctl is-enabled --quiet "$SERVICE_NAME.service"; then
            warn "The kiosk service is not enabled."
            ok=false
        fi

        if [ "$IS_RASPBERRY_PI" = true ] && \
           [ ! -f /etc/X11/xorg.conf.d/99-v3d.conf ] && \
           [ ! -f "$XORG_CONF" ]; then
            warn "No Xorg primary-GPU config was found. A Pi 5 may show a black screen."
            ok=false
        fi
    fi

    if [ "$INSTALLED_VIA_DEB" = true ] && ! command -v companion-dashboard >/dev/null 2>&1; then
        warn "companion-dashboard is not in PATH."
        ok=false
    fi

    if [ "$ok" = true ]; then
        info "Installation verification passed."
    else
        warn "Installation completed with warnings. Run --doctor after rebooting."
    fi
}

run_doctor() {
    if [ "$MODE" = "auto" ]; then
        MODE="kiosk"
    fi

    echo "=== Companion Dashboard Doctor ==="
    echo "Date:           $(date)"
    echo "Model:          ${MODEL:-unknown}"
    echo "Pi generation:  ${PI_GEN:-n/a}"
    echo "OS:             ${OS_PRETTY:-unknown} (${OS_ID:-unknown}/${OS_CODENAME:-unknown})"
    echo "Arch:           ${ARCH:-unknown} (kernel: $(uname -m))"
    echo "Default target: ${DEFAULT_TARGET:-unknown}"
    echo "Display mgr:    ${DM_NAME:-none} (installed: ${DM_INSTALLED}, enabled: ${HAS_DISPLAY_MANAGER})"
    echo "Kiosk install:  ${KIOSK_INSTALLED}"
    echo "Mode:           ${MODE}"
    echo "Service:        $(systemctl is-enabled "$SERVICE_NAME.service" 2>/dev/null || echo not-enabled) / $(systemctl is-active "$SERVICE_NAME.service" 2>/dev/null || echo inactive)"
    echo

    echo "--- DRM devices ---"
    ls -l /dev/dri/ 2>/dev/null || echo "no /dev/dri"
    local card driver
    for card in /dev/dri/card*; do
        if [ -e "$card" ]; then
            driver="$(readlink -f "/sys/class/drm/$(basename "$card")/device/driver" 2>/dev/null || true)"
            echo "${card} -> ${driver:-unknown}"
        fi
    done
    echo

    echo "--- Kernel modules ---"
    lsmod | grep -E '^(vc4|v3d|rp1|drm)' || true
    echo

    echo "--- Xorg config ---"
    ls -l /etc/X11/xorg.conf.d/ 2>/dev/null || true
    local f
    for f in /etc/X11/xorg.conf.d/*.conf; do
        if [ -e "$f" ]; then
            echo "== ${f} =="
            cat "$f"
        fi
    done
    echo

    echo "--- Service status ---"
    systemctl status "$SERVICE_NAME.service" --no-pager -l 2>/dev/null || true
    echo

    echo "--- Service journal (last 50) ---"
    journalctl -u "$SERVICE_NAME.service" -b --no-pager -n 50 2>/dev/null || true
    echo

    echo "--- Xorg logs ---"
    for f in /var/log/Xorg.0.log "${USER_HOME}/.local/share/xorg/Xorg.0.log"; do
        if [ -f "$f" ]; then
            echo "== ${f} (tail) =="
            tail -50 "$f"
        fi
    done
    echo

    echo "--- Port 80 ---"
    ss -ltnp 2>/dev/null | grep ':80 ' || echo "nothing listening on port 80"
    echo

    echo "--- HTTP check ---"
    curl -fsS --max-time 5 -o /dev/null -w "root:    %{http_code}\n" http://127.0.0.1/ 2>/dev/null || echo "root:    unreachable"
    curl -fsS --max-time 5 -o /dev/null -w "control: %{http_code}\n" http://127.0.0.1/control 2>/dev/null || echo "control: unreachable"
    echo

    echo "--- Port 80 capability ---"
    local bin
    for bin in "${APP_DIR}/companion-dashboard" "/usr/bin/companion-dashboard"; do
        if [ -e "$bin" ]; then
            echo "${bin}: $(getcap "$bin" 2>/dev/null || echo 'no capabilities')"
        fi
    done
    echo

    echo "--- mDNS ---"
    avahi-browse -at 2>/dev/null | grep -i dashboard || echo "no dashboard mDNS service found"
    echo
}

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
run_uninstall() {
    info "Stopping and disabling the kiosk service..."
    systemctl disable --now "$SERVICE_NAME.service" >/dev/null 2>&1 || true
    rm -f "$SERVICE_FILE"
    rm -f "$XORG_CONF"
    rm -f "$DEFAULTS_FILE"
    rm -rf /opt/companion-dashboard-lib
    rm -f /etc/ld.so.conf.d/companion-dashboard.conf
    rm -rf "$INSTALL_DIR"
    remove_legacy_autostart
    remove_legacy_getty_autologin

    local latest=""
    local xinitrc="${USER_HOME}/.xinitrc"
    latest="$(ls -t "${xinitrc}".companion-dashboard.bak.* 2>/dev/null | head -1 || true)"
    if [ -n "$latest" ]; then
        if [ ! -f "$xinitrc" ] || grep -q '# >>> companion-dashboard >>>' "$xinitrc"; then
            mv "$latest" "$xinitrc"
            info "Restored ${xinitrc} from backup."
        fi
    elif [ -f "$xinitrc" ] && grep -q '# >>> companion-dashboard >>>' "$xinitrc"; then
        rm -f "$xinitrc"
        info "Removed the kiosk .xinitrc."
    fi

    if [ "$PURGE" = true ]; then
        rm -rf "${USER_HOME}/.config/companion-dashboard"
        info "Removed Companion Dashboard user data."
    fi

    if [ -f "${STATE_DIR}/disabled-display-manager" ]; then
        local dm
        dm="$(cat "${STATE_DIR}/disabled-display-manager")"
        systemctl enable "$dm" >/dev/null 2>&1 || true
        rm -f "${STATE_DIR}/disabled-display-manager"
        info "Re-enabled ${dm}."
    fi
    rmdir "$STATE_DIR" 2>/dev/null || true

    apt-get remove -y companion-dashboard >/dev/null 2>&1 || true
    systemctl daemon-reload
    info "Uninstall complete."
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print_summary() {
    local ip=""
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    local display_ip="${ip:-<device-ip>}"

    echo
    echo "=== Companion Dashboard installation complete ==="
    echo
    echo "Mode:    ${MODE}"
    echo "Method:  ${METHOD}"
    echo "Version: ${VERSION:-unknown}"
    echo "User:    ${ACTUAL_USER}"
    echo "Model:   ${MODEL:-unknown}"
    echo "OS:      ${OS_PRETTY:-unknown}"
    echo

    if [ "$MODE" = "kiosk" ]; then
        cat <<EOF
The system will:
  1. Boot to the console and start X with openbox.
  2. Launch Companion Dashboard full screen in kiosk mode.
  3. Serve the dashboard on port 80.

Access:
  Display:  http://dashboard.local/         or http://${display_ip}/
  Control:  http://dashboard.local/control  or http://${display_ip}/control

Reboot to start:
  sudo reboot
EOF
    else
        cat <<EOF
Companion Dashboard was installed as a desktop application.
Launch it from the application menu. No display or autostart settings
were changed.
EOF
    fi

    cat <<EOF

Troubleshooting:
  Doctor (after reboot):
    curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --doctor
    or, from a checkout: sudo ./install.sh --doctor

  Service logs:
    sudo journalctl -u ${SERVICE_NAME} -b --no-pager

  X server log:
    cat ~/.local/share/xorg/Xorg.0.log

  Pi 5 black screen:
    sudo apt install -y gldriver-test
    sudo systemctl start rp1-test
    sudo reboot

  Uninstall:
    curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash -s -- --uninstall
    or, from a checkout: sudo ./install.sh --uninstall

GitHub: https://github.com/${REPO}
EOF
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    parse_args "$@"

    if [ "$SHOW_HELP" = true ]; then
        usage
        exit 0
    fi

    require_root_or_reexec "$@"
    resolve_actual_user
    detect_platform

    if [ "$DOCTOR" = true ]; then
        run_doctor
        exit 0
    fi

    if [ "$UNINSTALL" = true ]; then
        run_uninstall
        exit 0
    fi

    check_arch
    resolve_mode

    TMP_DIR="$(mktemp -d)"
    export DEBIAN_FRONTEND=noninteractive

    info "Companion Dashboard installer"
    info "Model: ${MODEL:-unknown} | OS: ${OS_PRETTY:-unknown} | Arch: ${ARCH} | Mode: ${MODE}"

    if [ "$MODE" = "kiosk" ]; then
        install_packages
        configure_xorg
    else
        install_desktop_packages
    fi

    install_release
    configure_capabilities
    configure_ldconfig
    write_defaults
    write_start_script

    if [ "$MODE" = "kiosk" ]; then
        write_xinitrc
        remove_legacy_autostart

        if [ "$HAS_DISPLAY_MANAGER" = true ]; then
            info "Disabling ${DM_NAME} for the next boot..."
            # Do not stop the display manager now: the installer may be running
            # inside that desktop session. Disabling it is enough for the next
            # boot, when the kiosk service takes over.
            mkdir -p "$STATE_DIR"
            printf '%s\n' "$DM_NAME" > "${STATE_DIR}/disabled-display-manager"
            if ! systemctl disable "$DM_NAME" >/dev/null 2>&1; then
                warn "Could not disable ${DM_NAME}; the kiosk may conflict with the desktop."
            fi
        fi

        if [ "$METHOD" = "systemd" ]; then
            remove_legacy_getty_autologin
            write_systemd_unit
        else
            configure_profile_autostart
        fi
    else
        restore_desktop_if_needed
    fi

    if [ "$FORCE_HDMI" = true ]; then
        configure_force_hdmi
    fi

    verify_install
    print_summary
}

main "$@"
