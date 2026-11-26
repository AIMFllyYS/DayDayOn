#!/usr/bin/env bash
set -euo pipefail

# Ensure non-interactive bash shells (which source ~/.bashrc via BASH_ENV)
# pick up persisted PATH exports.
touch "$HOME/.bashrc"
sed -i '/case \$- in/,/esac/d' "$HOME/.bashrc" 2>/dev/null || true

NODE_MAJOR="$(tr -d '[:space:]' < .nvmrc 2>/dev/null || true)"
NODE_MAJOR="${NODE_MAJOR:-24}"
NODE_DIR="$HOME/.local/node"
BIN_DIR="$HOME/.local/bin"
mkdir -p "$HOME/.local" "$BIN_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)
    NODE_ARCH="x64"
    GITLEAKS_ARCH="x64"
    ;;
  aarch64 | arm64)
    NODE_ARCH="arm64"
    GITLEAKS_ARCH="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

# Install Node.js matching .nvmrc into $HOME/.local/node so it persists under /home
if [ ! -x "$NODE_DIR/bin/node" ] || ! "$NODE_DIR/bin/node" -v | grep -q "^v${NODE_MAJOR}\."; then
  BASE_URL="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  TARBALL="$(curl -sSf "${BASE_URL}/SHASUMS256.txt" | awk -v a="linux-${NODE_ARCH}.tar.xz" '$2 ~ a"$" {print $2; exit}')"
  if [ -z "$TARBALL" ]; then
    echo "Failed to resolve Node.js v${NODE_MAJOR}.x tarball for ${NODE_ARCH}" >&2
    exit 1
  fi
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  curl -sSfL "${BASE_URL}/${TARBALL}" -o "$TMP_DIR/$TARBALL"
  tar -xJf "$TMP_DIR/$TARBALL" -C "$TMP_DIR"
  rm -rf "$NODE_DIR"
  mv "$TMP_DIR/${TARBALL%.tar.xz}" "$NODE_DIR"
  rm -rf "$TMP_DIR"
  trap - EXIT
fi

export PATH="$NODE_DIR/bin:$BIN_DIR:$PATH"

# Install pnpm matching package.json packageManager
PNPM_SPEC="$(node -p "require('./package.json').packageManager || 'pnpm@11.7.0'")"
PNPM_SPEC_CLEAN="${PNPM_SPEC%%+*}"
PNPM_VERSION="${PNPM_SPEC_CLEAN#pnpm@}"
if [ ! -x "$NODE_DIR/bin/pnpm" ] || [ "$("$NODE_DIR/bin/pnpm" -v)" != "$PNPM_VERSION" ]; then
  npm install -g "$PNPM_SPEC_CLEAN" --no-audit --no-fund
fi

# Install gitleaks (matching CI version) for lefthook pre-commit secret scanning
GITLEAKS_VERSION="8.30.1"
if [ ! -x "$BIN_DIR/gitleaks" ]; then
  curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GITLEAKS_ARCH}.tar.gz" \
    | tar -xz -C "$BIN_DIR" gitleaks
  chmod +x "$BIN_DIR/gitleaks"
fi

# Persist PATH in ~/.bashrc idempotently
PATH_LINE='export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"'
grep -qxF "$PATH_LINE" "$HOME/.bashrc" || echo "$PATH_LINE" >> "$HOME/.bashrc"

# Install project dependencies and lefthook git hooks non-interactively
CI=true pnpm install --frozen-lockfile
