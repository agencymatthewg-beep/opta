import { NextResponse } from 'next/server';

const OPTA_CLI_TARBALL_URL =
  'https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz';

const script = `#!/usr/bin/env bash
set -euo pipefail

OPTA_CLI_TARBALL_URL="${OPTA_CLI_TARBALL_URL}"

say() {
  printf '==> %s\\n' "$1"
}

fail() {
  printf 'ERROR: %s\\n' "$1" >&2
  exit 1
}

unsupported() {
  printf '\\n'
  printf 'Opta bootstrap is currently supported on macOS (Apple Silicon) only.\\n' >&2
  printf 'Detected OS: %s\\n' "$1" >&2
  printf 'Detected ARCH: %s\\n' "$2" >&2
  printf 'For updates: https://init.optalocal.com\\n\\n' >&2
  exit 1
}

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Darwin" ]; then
  unsupported "$OS" "$ARCH"
fi

if [ "$ARCH" != "arm64" ]; then
  unsupported "$OS" "$ARCH"
fi

if ! command -v curl >/dev/null 2>&1; then
  fail 'curl is required but not installed.'
fi

if ! command -v npm >/dev/null 2>&1; then
  fail 'npm is required but not installed. Install Node.js 20+ and retry.'
fi

say 'Installing Opta CLI from latest release tarball'

INSTALL_PREFIX="\${HOME}/.local"
export npm_config_prefix="$INSTALL_PREFIX"
mkdir -p "$INSTALL_PREFIX/bin"

npm install -g "$OPTA_CLI_TARBALL_URL"

if ! command -v opta >/dev/null 2>&1; then
  if [ -x "$INSTALL_PREFIX/bin/opta" ]; then
    export PATH="$INSTALL_PREFIX/bin:$PATH"
  fi
fi

if ! command -v opta >/dev/null 2>&1; then
  fail "Install completed but 'opta' is not on PATH. Add $INSTALL_PREFIX/bin to your shell profile."
fi

say "Installed: $(command -v opta)"
say 'Validation: opta --version && opta doctor'
`;

export async function GET() {
  return new NextResponse(script, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
