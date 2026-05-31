#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building VSIX..."
npm run vsix

VSIX="$(ls -t vsimage-*.vsix | head -1)"
echo "==> Package: $VSIX"

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "ERROR: Set VSCE_PAT (Azure DevOps PAT with Marketplace Manage scope)."
  echo "  https://marketplace.visualstudio.com/manage/publishers/"
  exit 1
fi

echo "==> Publishing to VS Code Marketplace..."
vsce publish --no-dependencies --packagePath "$VSIX"

if [[ -z "${OVSX_PAT:-}" ]]; then
  echo "WARN: OVSX_PAT not set — skipping Open VSX."
  exit 0
fi

echo "==> Publishing to Open VSX..."
ovsx publish "$VSIX" --pat "$OVSX_PAT"

echo "Done."
