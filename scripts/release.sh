#!/usr/bin/env bash
# Automate slid-phi version bump + publish
# Usage:
#   ./scripts/release.sh patch   # 2.1.1 -> 2.1.2
#   ./scripts/release.sh minor   # 2.1.1 -> 2.2.0
#   ./scripts/release.sh major   # 2.1.1 -> 3.0.0
#   ./scripts/release.sh publish # publish current package.json version only
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BUMP="${1:-patch}"

echo "==> whoami: $(npm whoami 2>/dev/null || echo 'NOT LOGGED IN')"
npm config get registry

if [[ "$BUMP" != "publish" ]]; then
  case "$BUMP" in
    patch|minor|major) ;;
    *)
      echo "Usage: $0 [patch|minor|major|publish]"
      exit 1
      ;;
  esac
  echo "==> bump $BUMP"
  npm version "$BUMP" --no-git-tag-version
fi

VER="$(node -p "require('./package.json').version")"
echo "==> version $VER"

echo "==> test"
npm test

echo "==> publish $VER"
npm publish --access public

echo "==> verify"
npm view slid-phi version

echo "Done. Optional git:"
echo "  git add package.json && git commit -m \"chore: release v$VER\" && git tag v$VER && git push && git push --tags"
