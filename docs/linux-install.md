# Linux Installation

The unified installer (`install.sh`) supports Raspberry Pi 4, Raspberry Pi 5,
and Intel/AMD Debian or Ubuntu machines.

## Requirements

- 64-bit OS (`arm64` or `amd64`)
- Debian-based distribution (Raspberry Pi OS, Ubuntu Server, CompanionPi, etc.)
- `sudo` access
- Network access to GitHub releases

Raspberry Pi OS Lite 64-bit is recommended for a dedicated kiosk. On a 32-bit
(`armhf`) installation the installer stops with instructions to reflash.

## Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh | bash
sudo reboot
```

The installer sets up kiosk mode by default on both Lite and Full images. On a
Full image it disables the display manager for the next boot so the dashboard
can own the display.

## Advanced options

These are optional; the default install needs no flags.

```text
--kiosk              Kiosk mode is the default; kept for compatibility
--desktop            Advanced: install the .deb only; leave the desktop alone
--method=systemd     Use a systemd kiosk service (default)
--method=profile     Use getty autologin + ~/.bash_profile (legacy)
--version=<tag>      Install a specific release (e.g. v1.6.0)
--force-hdmi         Add hdmi_force_hotplug=1 on Raspberry Pi
--doctor             Print diagnostics and exit
--uninstall          Remove the kiosk service/config and package
--purge              With --uninstall, also remove app user data
```

Examples:

```bash
# Kiosk mode with HDMI hotplug
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh \
  | bash -s -- --force-hdmi

# Install a specific version
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh \
  | bash -s -- --version=v1.6.0

# Diagnose an existing installation
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh \
  | bash -s -- --doctor
```

## What the installer does

1. Detects the board, OS, architecture, default systemd target, and whether a
   desktop environment is present.
2. Installs a minimal X stack. It deliberately avoids the `xorg` metapackage
   and `xserver-xorg-video-fbdev`, which can break Xorg on a Pi 5.
3. On Raspberry Pi, installs `gldriver-test` and runs `rp1-test` so Xorg uses
   the `vc4`/`rp1` display device instead of the `v3d` 3D device.
4. Downloads the matching `.deb` from the latest GitHub release and installs it.
5. Grants `cap_net_bind_service` to the Electron binary so the web server can
   bind port 80 as a normal user.
6. Writes `~/.xinitrc`, `/opt/companion-dashboard/start-display.sh`, and a
   systemd service that runs X on tty1 with a real PAM/logind session.
7. Verifies the install and prints the access URLs.

## Raspberry Pi 5 notes

A Pi 5 exposes two DRM devices: `vc4` (display) and `v3d` (3D). Xorg's
modesetting driver picks `card0`, which is not guaranteed to be the display
device. Without a primary-GPU config, Xorg can exit with:

```text
Cannot run in framebuffer mode. Please specify busIDs for all framebuffer devices
```

or `no screens found`, leaving a black screen with a blinking cursor.

The installer fixes this by installing `gldriver-test`, which writes
`/etc/X11/xorg.conf.d/99-v3d.conf`:

```ini
Section "OutputClass"
  Identifier "vc4"
  MatchDriver "vc4"
  Driver "modesetting"
  Option "PrimaryGPU" "true"
EndSection
```

If `gldriver-test` is unavailable, the installer writes an equivalent
`/etc/X11/xorg.conf.d/99-companion-dashboard.conf`, using the `rp1-*` match
when a DSI/DPI display is detected.

Manual workaround for older installations:

```bash
sudo apt update
sudo apt install -y gldriver-test
sudo systemctl start rp1-test
cat /etc/X11/xorg.conf.d/99-v3d.conf
sudo reboot
```

## Full desktop images

Kiosk mode is the default on Raspberry Pi OS Full as well. The installer
disables the display manager (lightdm, gdm3, or sddm) for the next boot so the
dashboard starts full screen instead of the desktop.

To keep the desktop and install the app as a normal desktop application, use
the advanced `--desktop` flag. To restore the desktop after a kiosk install,
run `--uninstall` or re-enable the display manager manually:

```bash
sudo systemctl enable --now lightdm
```

## Troubleshooting

Run the doctor:

```bash
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh \
  | bash -s -- --doctor
```

It prints the board model, OS, architecture, DRM devices and drivers, Xorg
config, service status, journal, Xorg log, port 80 listeners, HTTP checks, and
capabilities.

Useful commands:

```bash
sudo systemctl status companion-dashboard
sudo journalctl -u companion-dashboard -b --no-pager
cat ~/.local/share/xorg/Xorg.0.log
ls -l /dev/dri/
cat /etc/X11/xorg.conf.d/99-v3d.conf
```

### Black screen with a blinking cursor

Usually Xorg is not starting. Check the doctor output for the DRM driver and
Xorg log. On a Pi 5, confirm `99-v3d.conf` exists and that `card0` is not bound
to `v3d`.

### `Only console users are allowed to run the X server`

The X server is being started without a console/logind session. The unified
installer uses `PAMName=login`, `TTYPath=/dev/tty1`, and `UtmpIdentifier=tty1`
to avoid this. If you are on an older install, re-run the installer or use the
legacy workaround:

```bash
sudo tee /etc/X11/Xwrapper.config >/dev/null <<'EOF'
allowed_users=anybody
needs_root_rights=yes
EOF
sudo systemctl restart companion-dashboard
```

### Web UI unreachable but the app is running

Check that port 80 is listening and that the binary has the capability:

```bash
ss -ltnp | grep ':80 '
getcap '/opt/Companion Dashboard/companion-dashboard'
```

### `/display` returns 404

The display view is `/`, not `/display`. The control view is `/control`.

## Uninstall

```bash
curl -fsSL https://raw.githubusercontent.com/tomhillmeyer/companion-dashboard/main/install.sh \
  | bash -s -- --uninstall
```

Add `--purge` to remove the app's user data in `~/.config/companion-dashboard`.

## Test matrix

| Target | OS | Verify |
| --- | --- | --- |
| Pi 4 | Bookworm Lite 64-bit | X starts, port 80, reboot twice |
| Pi 4 | Trixie Lite 64-bit | X starts, port 80, reboot twice |
| Pi 5 | Bookworm Lite 64-bit | `99-v3d.conf`, X starts |
| Pi 5 | Trixie Lite 64-bit | `99-v3d.conf`, X starts |
| Pi 5 | CompanionPi | systemd kiosk starts, no getty conflict |
| Pi 4/5 | Full image | Kiosk replaces the desktop; `--desktop` keeps it |
| NUC | Ubuntu Server amd64 | Regression check |
