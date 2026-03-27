#!/usr/bin/env bash
set -euo pipefail

manifest="$(mktemp)"
trap 'rm -f "$manifest"' EXIT

cargo package --allow-dirty --list > "$manifest"

if command -v rg >/dev/null 2>&1; then
  search_exact() {
    rg -Fxq "$1" "$manifest"
  }

  search_prefix() {
    rg -q "^$1" "$manifest"
  }
else
  search_exact() {
    grep -Fxq "$1" "$manifest"
  }

  search_prefix() {
    grep -Eq "^$1" "$manifest"
  }
fi

require() {
  local path="$1"
  if ! search_exact "$path"; then
    echo "missing packaged file: $path" >&2
    exit 1
  fi
}

reject_prefix() {
  local prefix="$1"
  if search_prefix "$prefix"; then
    echo "unexpected packaged path matching prefix: $prefix" >&2
    exit 1
  fi
}

reject_exact() {
  local path="$1"
  if search_exact "$path"; then
    echo "unexpected packaged file: $path" >&2
    exit 1
  fi
}

require "Cargo.toml"
require "Cargo.lock"
require "README.md"
require "LICENSE"
require "CHANGELOG.md"
require "src/lib.rs"
require "static/sf/sf.css"
require "static/sf/sf.js"
require "static/sf/vendor/frappe-gantt/frappe-gantt.min.js"
require "static/sf/vendor/split/split.min.js"
require "static/sf/fonts/space-grotesk.woff2"
require "static/sf/fonts/jetbrains-mono.woff2"
require "static/sf/img/ouroboros.svg"

reject_prefix "css-src/"
reject_prefix "js-src/"
reject_prefix "screenshots/"
reject_prefix "scripts/"
reject_exact "WIREFRAME.md"
reject_exact ".versionrc.json"

echo "package contents verified"
