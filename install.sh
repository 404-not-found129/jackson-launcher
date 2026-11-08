#!/usr/bin/env bash
# Jackson Launcher installer
#
#   curl -fsSL https://raw.githubusercontent.com/404-not-found129/jackson-launcher/main/install.sh | bash
#
# Downloads the latest release from GitHub, checks it, and installs it for your
# user (no sudo): ~/.local/opt/jackson-launcher, a `jackson-launcher` command in
# ~/.local/bin, and an app-menu entry. Run it again to update.
#
#   ... | bash -s -- --uninstall    remove it again (your projects are kept)
set -euo pipefail

REPO="404-not-found129/jackson-launcher"
APP_DIR="${JACKSON_LAUNCHER_DIR:-$HOME/.local/opt/jackson-launcher}"
BIN_DIR="$HOME/.local/bin"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
ENTRY="$DATA/applications/jackson-launcher.desktop"
ICON="$DATA/icons/hicolor/512x512/apps/jackson-launcher.png"

if [ -t 1 ]; then G=$'\033[1;38;5;190m'; R=$'\033[0m'; D=$'\033[2m'; E=$'\033[1;31m'; else G=; R=; D=; E=; fi
say() { printf '%s==>%s %s\n' "$G" "$R" "$*"; }
die() { printf '%serror:%s %s\n' "$E" "$R" "$*" >&2; exit 1; }

if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$APP_DIR" "$BIN_DIR/jackson-launcher" "$ENTRY" "$ICON"
  command -v update-desktop-database >/dev/null && update-desktop-database "$DATA/applications" 2>/dev/null || true
  say "Jackson Launcher removed. Your projects in ~/jackson-projects are untouched."
  exit 0
fi

[ "$(uname -s)" = Linux ] || die "Jackson Launcher is for Linux."
[ "$(uname -m)" = x86_64 ] || die "Jackson Launcher needs a 64-bit Intel/AMD (x86_64) computer."
for c in curl tar sha256sum; do command -v "$c" >/dev/null || die "Please install $c first."; done
command -v git >/dev/null || printf '%snote:%s git is not installed; the launcher will offer to install it the first time you install a project.\n' "$D" "$R"

say "Finding the latest version"
TAG=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)
[ -n "$TAG" ] || die "Couldn't reach GitHub. Check your internet connection and try again."
VER=${TAG#v}
FILE="JacksonLauncher-$VER.tar.gz"
URL="https://github.com/$REPO/releases/download/$TAG"

if [ -x "$APP_DIR/jackson-launcher" ] && [ -f "$APP_DIR/.version" ] && [ "$(cat "$APP_DIR/.version")" = "$VER" ]; then
  say "Jackson Launcher $VER is already installed and up to date."
  exit 0
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

say "Downloading Jackson Launcher $VER (about 120 MB)"
curl -fL --progress-bar -o "$TMP/$FILE" "$URL/$FILE" || die "Download failed."
curl -fsSL -o "$TMP/SHA256SUMS.txt" "$URL/SHA256SUMS.txt" || die "Couldn't download the checksum file."

say "Checking the download"
( cd "$TMP" && grep " $FILE\$" SHA256SUMS.txt | sha256sum -c --quiet - ) || die "The download didn't match its checksum. Nothing was installed; please try again."

say "Installing to $APP_DIR"
tar -xzf "$TMP/$FILE" -C "$TMP"
rm -rf "$APP_DIR.new"
mkdir -p "$(dirname "$APP_DIR")"
mv "$TMP/JacksonLauncher-$VER" "$APP_DIR.new"
echo "$VER" > "$APP_DIR.new/.version"
rm -rf "$APP_DIR"
mv "$APP_DIR.new" "$APP_DIR"

mkdir -p "$BIN_DIR" "$(dirname "$ENTRY")" "$(dirname "$ICON")"
ln -sfn "$APP_DIR/jackson-launcher" "$BIN_DIR/jackson-launcher"
curl -fsSL -o "$ICON" "https://raw.githubusercontent.com/$REPO/$TAG/build/icon.png" || true
cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=Jackson Launcher
Comment=Install and set up Jackson's projects in one click
Exec="$APP_DIR/jackson-launcher" %U
Icon=jackson-launcher
Terminal=false
Categories=Utility;
StartupWMClass=jackson-launcher
EOF
command -v update-desktop-database >/dev/null && update-desktop-database "$DATA/applications" 2>/dev/null || true

say "Done! Open ${G}Jackson Launcher${R} from your app menu, or run: jackson-launcher"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) printf '%snote:%s %s is not on your PATH, so use the app menu (or add it to PATH).\n' "$D" "$R" "$BIN_DIR" ;; esac
